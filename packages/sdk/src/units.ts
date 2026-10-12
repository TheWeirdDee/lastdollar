import { SCALE } from './config.js'
import { LastDollarError } from './errors.js'

/**
 * Unit conventions used throughout the SDK:
 *   - `*18` values are native USDC base units (18 decimals). Fees and balances live here.
 *   - `*6`  values are ERC-20 USDC base units (6 decimals).
 * One ERC-20 unit equals 10^12 native units. Every function here is integer-only.
 */

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/

function parseDecimal(input: string, maxDecimals: number, outDecimals: number): bigint {
  const text = input.trim().replace(/_/g, '')
  if (text === '') throw new LastDollarError('INVALID_AMOUNT', 'Enter an amount.')
  if (text.startsWith('-')) throw new LastDollarError('INVALID_AMOUNT', 'Amounts must be positive.')
  const normalized = text.startsWith('.') ? `0${text}` : text
  const m = DECIMAL_RE.exec(normalized)
  if (!m) throw new LastDollarError('INVALID_AMOUNT', `"${input}" is not a valid decimal amount.`)
  const whole = m[1] ?? '0'
  const frac = m[2] ?? ''
  if (frac.length > maxDecimals) {
    throw new LastDollarError(
      'INVALID_PRECISION',
      `USDC amounts support at most ${maxDecimals} decimal places; "${input}" has ${frac.length}.`,
      { details: { maxDecimals, provided: frac.length } },
    )
  }
  return BigInt(whole) * 10n ** BigInt(outDecimals) + BigInt(frac.padEnd(outDecimals, '0') || '0')
}

/** Parses a user-entered USDC amount (max 6 decimals) into native 18-decimal units. Never rounds. */
export function parseUsdc(input: string): bigint {
  return parseDecimal(input, 6, 18)
}

/** Parses a USDC amount into 6-decimal ERC-20 units. Rejects excess precision. */
export function parseUsdc6(input: string): bigint {
  return parseDecimal(input, 6, 6)
}

/** Parses a full-precision native amount (up to 18 decimals) into 18-decimal units. */
export function parseNativeUsdc(input: string): bigint {
  return parseDecimal(input, 18, 18)
}

/** Converts ERC-20 units to native units. Exact. */
export function toNative18(amount6: bigint): bigint {
  return amount6 * SCALE
}

/** Converts native units to ERC-20 units, rounding down (the same truncation Arc applies). */
export function toToken6Floor(amount18: bigint): bigint {
  if (amount18 < 0n) throw new LastDollarError('INVALID_AMOUNT', 'Negative native amount.')
  return amount18 / SCALE
}

/** Native units that cannot be expressed through the 6-decimal ERC-20 view. */
export function subMicroRemainder(amount18: bigint): bigint {
  if (amount18 < 0n) throw new LastDollarError('INVALID_AMOUNT', 'Negative native amount.')
  return amount18 % SCALE
}

export function isTokenRepresentable(amount18: bigint): boolean {
  return amount18 >= 0n && amount18 % SCALE === 0n
}

/** `max(0, a - b)`, without silent underflow. */
export function saturatingSub(a: bigint, b: bigint): bigint {
  return a > b ? a - b : 0n
}

export interface FormatOptions {
  /** Maximum fractional digits to show. Default 6. */
  maxDecimals?: number
  /** Minimum fractional digits to show. Default 2. */
  minDecimals?: number
  /**
   * When a non-zero value would display as zero at `maxDecimals`, show enough digits to make it
   * visible (up to 18). Default true. Prevents tiny fees from looking free.
   */
  revealSmall?: boolean
  /** Group the integer part with commas. Default true. */
  group?: boolean
}

/**
 * Formats a native 18-decimal amount as a USDC string. Truncates toward zero (never rounds up),
 * and does not mutate the canonical value.
 */
export function formatUsdc(amount18: bigint, options: FormatOptions = {}): string {
  const { maxDecimals = 6, minDecimals = 2, revealSmall = true, group = true } = options
  const negative = amount18 < 0n
  const abs = negative ? -amount18 : amount18
  const whole = abs / 10n ** 18n
  const fracFull = (abs % 10n ** 18n).toString().padStart(18, '0')
  let digits = maxDecimals
  if (revealSmall && abs !== 0n && whole === 0n && /^0*$/.test(fracFull.slice(0, maxDecimals))) {
    const firstNonZero = fracFull.search(/[1-9]/)
    digits = Math.min(18, firstNonZero + 3)
  }
  let frac = fracFull.slice(0, digits).replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  const wholeStr = group ? whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole.toString()
  return `${negative ? '-' : ''}${wholeStr}${frac ? `.${frac}` : ''}`
}

/** Formats a 6-decimal ERC-20 amount. */
export function formatUsdc6(amount6: bigint, options: FormatOptions = {}): string {
  return formatUsdc(toNative18(amount6), options)
}

/** Full-precision rendering of a native amount, e.g. "0.000421000000000000". */
export function formatNativeExact(amount18: bigint): string {
  return formatUsdc(amount18, { maxDecimals: 18, minDecimals: 18, revealSmall: false, group: false })
}

/** JSON-safe serialization helpers for values containing bigint. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? `${value.toString()}n` : value
}

export function bigintReviver(_key: string, value: unknown): unknown {
  return typeof value === 'string' && /^-?\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
}
