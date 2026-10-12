import type { Address, Hash, Hex } from 'viem'
import type { LastDollarErrorCode } from './errors.js'
import type { FeeQuote } from './fees.js'

/** How value moves. `native` sends 18-decimal value; `erc20` calls USDC `transfer` (6 decimals). */
export type PaymentMode = 'native' | 'erc20'
export type PaymentKind = 'exact' | 'max' | 'batch'

export interface PaymentLine {
  recipient: Address
  /** Amount in native units (18 decimals). In ERC-20 mode this is always a multiple of 10^12. */
  amount18: bigint
  /** Optional caller reference (e.g. invoice id). Off-chain metadata only. */
  reference?: string | undefined
}

export interface BalanceSnapshot {
  account: Address
  chainId: number
  blockNumber: bigint
  /** eth_getBalance: the authoritative USDC balance (18 decimals). */
  native18: bigint
  /** USDC.balanceOf: the same funds through the 6-decimal ERC-20 view. */
  token6: bigint
  /** floor(native18 / 10^12): what the token view should equal. */
  expectedToken6: bigint
  /** native18 mod 10^12: value invisible to the ERC-20 interface. */
  subMicro18: bigint
  /** True when token6 === expectedToken6 at the same block. */
  viewsConsistent: boolean
}

export type WarningCode =
  | 'PENDING_TRANSACTION'
  | 'RECIPIENT_IS_CONTRACT'
  | 'DUPLICATE_RECIPIENT'
  | 'SELF_PAYMENT'
  | 'SUB_MICRO_RESIDUAL'
  | 'NEXT_BASE_FEE_FALLBACK'
  | 'BALANCE_VIEWS_INCONSISTENT'
  | 'TEST_NETWORK'
  | 'RESIDUAL_AFTER_MAX'

export interface QuoteIssue {
  code: LastDollarErrorCode | WarningCode
  message: string
  /** Batch row index when the issue concerns a specific line. */
  index?: number
}

/** Exactly what the wallet will be asked to sign. */
export interface TransactionRequestPlan {
  type: 'eip1559'
  chainId: number
  from: Address
  to: Address
  data: Hex
  value: bigint
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  nonce: number
}

export type PaymentIntent =
  | { kind: 'exact'; mode: PaymentMode; recipient: Address; amount18: bigint; reference?: string | undefined }
  | { kind: 'max'; mode: PaymentMode; recipient: Address; reference?: string | undefined }
  | { kind: 'batch'; mode: 'native'; lines: PaymentLine[] }

export interface PaymentQuote {
  version: 1
  /** Fingerprint of the economic terms and request. Changes whenever anything material changes. */
  id: Hex
  intent: PaymentIntent
  kind: PaymentKind
  mode: PaymentMode
  chainId: number
  isMainnet: boolean
  account: Address
  /** Resolved recipient lines. For `max`, the computed amount. */
  lines: PaymentLine[]
  recipientTotal18: bigint
  /** ERC-20 mode: the exact `transfer` amount (6 decimals). */
  tokenAmount6?: bigint | undefined
  balance: BalanceSnapshot
  nonce: number
  pendingNonce: number
  /** Undefined only when gas could not be estimated at all (the quote is then blocked). */
  fee?: FeeQuote | undefined
  /** recipientTotal18 + maxFeeBudget18. */
  maxDebit18: bigint
  /** recipientTotal18 + estimatedFee18. */
  estimatedDebit18: bigint
  estimatedRemaining18: bigint
  /** Remaining balance if the entire fee budget is charged. */
  minimumRemaining18: bigint
  status: 'ready' | 'blocked'
  blockers: QuoteIssue[]
  warnings: QuoteIssue[]
  request?: TransactionRequestPlan | undefined
  simulation: 'passed' | 'failed' | 'skipped'
  /** Number of estimate/compute rounds used for send-max. */
  iterations: number
  createdAt: number
  expiresAt: number
  splitter?: Address | undefined
}

/** A quote that passed every check and is ready to be shown for review and signing. */
export interface PreparedPayment {
  quote: PaymentQuote
  request: TransactionRequestPlan
  preparedAt: number
}

export interface QuoteChange {
  field: string
  before: string
  after: string
}

export type RevalidationResult =
  | { status: 'valid'; plan: PreparedPayment; checkedAtBlock: bigint }
  | { status: 'changed'; plan: PreparedPayment; fresh: PaymentQuote; changes: QuoteChange[] }
  | { status: 'blocked'; plan: PreparedPayment; fresh: PaymentQuote; changes: QuoteChange[] }

export type ExecutionStatus =
  | 'revalidating'
  | 'awaiting-signature'
  | 'submitted'
  | 'replaced'
  | 'confirming'
  | 'reconciling'
  | 'verified'
  | 'mismatch'
  | 'reverted'

export interface ExecutionUpdate {
  status: ExecutionStatus
  hash?: Hash
  message?: string
}

export type ReconciledOperation = 'native-transfer' | 'erc20-transfer' | 'splitter-batch' | 'unknown'

export interface ObservedTransfer {
  from: Address
  to: Address
  amount18: bigint
  /** Set for ERC-20 token logs (6 decimals). */
  amount6?: bigint | undefined
  source: 'erc20-log' | 'native-log' | 'splitter-event'
  logIndex: number
}

export interface ReceiptComparison {
  expectedLines: PaymentLine[]
  linesMatch: boolean
  mismatches: string[]
  estimatedFee18?: bigint | undefined
  maxFeeBudget18?: bigint | undefined
  /** actualFee18 <= maxFeeBudget18 */
  feeWithinBudget?: boolean | undefined
  /** True when the broadcast gas or fee caps differ from the reviewed request. */
  walletModifiedParameters: boolean
  modifiedFields: string[]
}

export type ReceiptStatus =
  /** Transaction succeeded and every expected transfer was observed. */
  | 'verified'
  /** Transaction succeeded but the observed transfers differ from what was expected. */
  | 'mismatch'
  /** Transaction was included and reverted. Fees were still charged. */
  | 'reverted'
  /** Transaction is known but has no receipt yet. */
  | 'pending'
  /** Neither transaction nor receipt is available from this RPC. */
  | 'not-found'
  /** Succeeded, but no expectation was supplied; transfers are reported as observed. */
  | 'observed'

export interface ReconciledPayment {
  hash: Hash
  chainId: number
  status: ReceiptStatus
  operation: ReconciledOperation
  /** True when the transaction targets the configured LastDollar splitter. */
  viaSplitter: boolean
  from?: Address | undefined
  to?: Address | null | undefined
  blockNumber?: bigint | undefined
  blockTimestamp?: bigint | undefined
  gasUsed?: bigint | undefined
  effectiveGasPrice?: bigint | undefined
  actualFee18?: bigint | undefined
  submitted?:
    | {
        gas: bigint
        maxFeePerGas?: bigint | undefined
        maxPriorityFeePerGas?: bigint | undefined
        value: bigint
        nonce: number
        type: string
        input: Hex
      }
    | undefined
  /** Every relevant transfer log, deduplicated so one economic movement is counted once. */
  transfers: ObservedTransfer[]
  /** Payouts attributed to the sender, in order. */
  delivered: PaymentLine[]
  deliveredTotal18: bigint
  /** Native logs that duplicate an ERC-20 log for the same movement (not double counted). */
  mirroredNativeLogs: number
  comparison?: ReceiptComparison | undefined
  issues: string[]
  checkedAt: number
}

export interface ExecutionResult {
  hash: Hash
  /** Differs from `hash` when the wallet sped up the transaction. */
  finalHash: Hash
  replacement?: { reason: 'repriced' | 'cancelled' | 'replaced'; originalHash: Hash } | undefined
  receipt: ReconciledPayment
}
