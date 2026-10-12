# Payment math

All monetary values in LastDollar are integers (`bigint`). No floating-point value ever decides an amount, a fee or an affordability check. A lint rule rejects `parseFloat` in the web app, and every function below is unit- and property-tested.

## Units

| Symbol | Meaning | Decimals |
|---|---|---|
| `B18` | Native USDC balance (`eth_getBalance`) | 18 |
| `T6` | ERC-20 USDC amount (`transfer`, `balanceOf`) | 6 |
| `G18` | Maximum fee budget for a transaction | 18 |
| `S` | Scale: `10^12` native units per ERC-20 unit | — |

The SDK uses suffixes to keep units visible in code: `amount18`, `token6`, `maxFeeBudget18`.

Conversions:

- `toNative18(T6) = T6 × S` (exact)
- `toToken6Floor(X18) = floor(X18 / S)` (the same truncation Arc applies)
- `subMicroRemainder(X18) = X18 mod S` (value invisible to the ERC-20 view)

## Fees: estimate versus budget

For an EIP-1559 transaction:

```
gasLimit       = ceil(estimate × (1 + margin)) + fixed            // default margin 10%, fixed 2000
maxFeePerGas   = max(nextBaseFee, 20 gwei) × 1.25 + priorityFee   // rounded up
G18            = gasLimit × maxFeePerGas                          // maximum fee budget
estimatedFee18 = estimate × min(nextBaseFee + priorityFee, maxFeePerGas)
actualFee18    = gasUsed × effectiveGasPrice                      // from the receipt
```

`G18` is a **cap** under the prepared parameters, not a prediction. The node checks `value + gasLimit × maxFeePerGas ≤ balance` before accepting a transaction, so the budget must be reserved even though less is normally charged. The interface always shows the estimate and the budget as separate lines.

Fees below one micro-USDC are never displayed as zero: `formatUsdc` reveals extra digits for any non-zero value that would otherwise round away.

## Exact payment

Native mode: the transaction `value` is the amount.

```
affordable ⇔ amount18 + G18 ≤ B18
```

ERC-20 mode: the amount must be representable in 6 decimals (`amount18 mod S = 0`), otherwise the input is rejected with `INVALID_PRECISION`, never rounded. Then:

```
affordable ⇔ T6 × S + G18 ≤ B18   and   T6 ≤ balanceOf(sender)
```

When unaffordable, the quote says whether the payment itself exceeds the balance (`INSUFFICIENT_FUNDS`) or only the fee budget does not fit (`INSUFFICIENT_GAS_FUNDS`), with the shortfall in USDC.

## Send maximum

Native:

```
amount18 = max(0, B18 − G18)
```

ERC-20:

```
T6 = min(balanceOf(sender), floor(max(0, B18 − G18) / S))
```

Both use saturating subtraction; there is no path that underflows.

### Resolving the circular dependency

Gas depends on the call, and the call depends on the amount, which depends on gas. LastDollar resolves this with a bounded procedure (at most 4 rounds):

1. Estimate the call with the full balance as the candidate amount (estimation without fee fields only checks `value ≤ balance`). If that fails, retry with 1 micro-USDC: direct-transfer gas does not depend on the amount's size.
2. Build the fee quote from the estimate and compute the amount under that budget.
3. Re-estimate the **final** call. If its gas still fits inside the reserved `gasLimit`, stop and keep the earlier reservation. Otherwise use the larger estimate and repeat.
4. Simulate the final request with `eth_call`, including its exact `gas`, `maxFeePerGas` and `maxPriorityFeePerGas`, to check execution. Some Arc RPC implementations do **not** apply signed-transaction gas-balance admission to `eth_call`; explicit integer affordability arithmetic remains authoritative for payment-plus-reserve affordability.

### What remains after send-max

Send-max never promises an empty wallet. After it executes:

```
remaining18 = B18 − amount18 − actualFee18
            = (G18 − actualFee18)                     native mode
            = (G18 − actualFee18) + (B18 − G18) mod S  ERC-20 mode (exact unless balanceOf is the binding limit)
```

The first term is the unused fee budget. In ERC-20 mode, the sub-micro part of `B18 − G18` also stays, because the token interface cannot move it. Native mode keeps full 18-decimal precision, so its remainder is exactly the unused budget. The proof page shows both remainders as measured on mainnet.

## Batch

The splitter receives `value = Σ amount18_i` and pays each recipient in one transaction.

```
affordable ⇔ Σ amount18_i + G18 ≤ B18
```

Each amount must be greater than zero. Rows are never merged, rounded or reordered; a repeated recipient is paid once per row and is shown as a warning that the user must acknowledge.

## Projections shown before signing

```
maxDebit18           = recipientTotal18 + G18
estimatedRemaining18 = max(0, B18 − recipientTotal18 − estimatedFee18)
minimumRemaining18   = max(0, B18 − recipientTotal18 − G18)
```

## Quote invalidation

A quote records the chain, account, nonce, block, both balance views, gas limit and fee caps. `revalidatePlan` re-quotes the same intent and returns `valid` only if:

- chain, account, destination, calldata, value and nonce are unchanged, and
- the reviewed `maxFeePerGas` still covers the current next base fee plus tip, and the reviewed gas limit still covers the current estimate, and
- `recipientTotal18 + gas × maxFeePerGas ≤ B18` still holds, including ERC-20 transfers whose request value is zero, and
- the exact reviewed request simulates successfully.

For send-max, a balance change changes `value` and therefore always requires a new review. For exact payments, an unrelated balance increase leaves the reviewed terms intact. Any pending transaction from the account blocks quoting until it settles, because it changes the balance in ways the quote cannot see.

## Tests

`packages/sdk/test/units.test.ts` and `math.test.ts` cover parsing, rejection of excess precision, negative and malformed input, truncation, sub-micro remainders, formatting of tiny fees, exact-affordability boundaries (affordable at the boundary, not one unit past it), send-max formulas, randomised properties (the max is affordable and max + 1 is not), fee-policy floors and rounding, and saturating projections.
