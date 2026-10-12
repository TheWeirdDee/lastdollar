import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  TransactionExecutionError,
  UserRejectedRequestError,
  HttpRequestError,
  TimeoutError,
  WaitForTransactionReceiptTimeoutError,
  ChainMismatchError,
  type Hash,
} from 'viem'

/** Stable, machine-readable classifications. These strings are part of the public API. */
export type LastDollarErrorCode =
  | 'INVALID_RECIPIENT'
  | 'UNSUPPORTED_RECIPIENT'
  | 'INVALID_AMOUNT'
  | 'INVALID_PRECISION'
  | 'INVALID_BATCH'
  | 'WRONG_CHAIN'
  | 'ACCOUNT_MISMATCH'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_GAS_FUNDS'
  | 'NOTHING_TO_SEND'
  | 'STALE_QUOTE'
  | 'QUOTE_EXPIRED'
  | 'USER_REJECTED'
  | 'SIMULATION_FAILED'
  | 'RPC_UNAVAILABLE'
  | 'BROADCAST_FAILED'
  | 'EXECUTION_REVERTED'
  | 'TRANSACTION_REPLACED'
  | 'RECEIPT_TIMEOUT'
  | 'RECONCILIATION_INCOMPLETE'
  | 'VERIFICATION_MISMATCH'
  | 'SPLITTER_UNAVAILABLE'
  | 'DUPLICATE_SUBMISSION'
  | 'UNKNOWN'

export interface LastDollarErrorOptions {
  cause?: unknown
  details?: Record<string, unknown>
  hash?: Hash
}

export class LastDollarError extends Error {
  override readonly name = 'LastDollarError'
  readonly code: LastDollarErrorCode
  readonly details: Record<string, unknown>
  /** Present when a transaction was broadcast before the error occurred. */
  readonly hash: Hash | undefined

  constructor(code: LastDollarErrorCode, message: string, options: LastDollarErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.code = code
    this.details = options.details ?? {}
    this.hash = options.hash
  }
}

export function isLastDollarError(value: unknown, code?: LastDollarErrorCode): value is LastDollarError {
  return value instanceof LastDollarError && (code === undefined || value.code === code)
}

function walk(err: unknown, fn: (e: unknown) => boolean): unknown {
  if (err instanceof BaseError) return err.walk((e) => fn(e))
  let cur: unknown = err
  for (let i = 0; i < 10 && cur; i++) {
    if (fn(cur)) return cur
    cur = (cur as { cause?: unknown }).cause
  }
  return undefined
}

function messageOf(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage || err.message
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * Maps viem, wallet and RPC errors onto a stable LastDollar classification.
 * Unknown errors stay UNKNOWN; they are never reinterpreted as success.
 */
export function classifyError(err: unknown, fallback: LastDollarErrorCode = 'UNKNOWN'): LastDollarError {
  if (err instanceof LastDollarError) return err
  const msg = messageOf(err)
  const chain: string[] = []
  for (let cur: unknown = err, i = 0; cur && i < 10; cur = (cur as { cause?: unknown }).cause, i++) {
    chain.push(messageOf(cur), String((cur as { details?: unknown }).details ?? ''))
  }
  const lower = chain.join(' | ').toLowerCase()
  // viem's walk() returns null (not undefined) when nothing matches.
  const has = (pred: (e: unknown) => boolean) => walk(err, pred) != null
  const code = (e: unknown) => (e as { code?: unknown }).code

  if (
    has((e) => e instanceof UserRejectedRequestError || code(e) === 4001 || code(e) === 'ACTION_REJECTED') ||
    /user (rejected|denied)|rejected the request|request rejected|user cancel/.test(lower)
  ) {
    return new LastDollarError('USER_REJECTED', 'The wallet request was rejected. Nothing was sent.', { cause: err })
  }
  if (has((e) => e instanceof ChainMismatchError) || /chain mismatch|does not match the target chain/.test(lower)) {
    return new LastDollarError('WRONG_CHAIN', 'The wallet is connected to a different network.', { cause: err })
  }
  // Arc reports an unaffordable value transfer during estimation as "revert: OutOfFunds".
  if (has((e) => e instanceof InsufficientFundsError) || /insufficient funds|exceeds the balance|outoffunds|lack of funds/.test(lower)) {
    return new LastDollarError(
      'INSUFFICIENT_GAS_FUNDS',
      'The balance cannot cover this transaction plus its maximum network fee.',
      { cause: err },
    )
  }
  if (/zero address not allowed/.test(lower)) {
    return new LastDollarError('UNSUPPORTED_RECIPIENT', 'Arc does not allow value transfers to the zero address.', {
      cause: err,
    })
  }
  if (/blacklist|blocklist|blocked/.test(lower)) {
    return new LastDollarError('UNSUPPORTED_RECIPIENT', 'The sender or recipient is restricted by USDC.', {
      cause: err,
    })
  }
  if (has((e) => e instanceof WaitForTransactionReceiptTimeoutError)) {
    return new LastDollarError(
      'RECEIPT_TIMEOUT',
      'No receipt yet. The transaction may still confirm; check again before sending anything new.',
      { cause: err },
    )
  }
  if (
    has((e) => e instanceof HttpRequestError || e instanceof TimeoutError) ||
    /fetch failed|failed to fetch|network error|timed? ?out|econn|\b(503|502|429)\b/.test(lower)
  ) {
    return new LastDollarError('RPC_UNAVAILABLE', 'The Arc RPC endpoint did not respond reliably.', { cause: err })
  }
  if (has((e) => e instanceof ContractFunctionRevertedError) || /execution reverted|revert/.test(lower)) {
    return new LastDollarError('SIMULATION_FAILED', `Simulation reverted: ${msg}`, { cause: err })
  }
  if (has((e) => e instanceof TransactionExecutionError)) {
    return new LastDollarError('BROADCAST_FAILED', `The transaction could not be submitted: ${msg}`, { cause: err })
  }
  return new LastDollarError(fallback, msg || 'Unknown error', { cause: err })
}
