import { describe, expect, it } from 'vitest'
import {
  formatNativeExact,
  formatUsdc,
  isTokenRepresentable,
  parseNativeUsdc,
  parseUsdc,
  parseUsdc6,
  subMicroRemainder,
  toNative18,
  toToken6Floor,
  bigintReplacer,
  bigintReviver,
} from '../src/units.js'
import { LastDollarError } from '../src/errors.js'
import { SCALE } from '../src/config.js'

function rand(maxBits: number): bigint {
  let v = 0n
  for (let i = 0; i < maxBits; i += 30) v = (v << 30n) | BigInt(Math.floor(Math.random() * 2 ** 30))
  return v & ((1n << BigInt(maxBits)) - 1n)
}

describe('parseUsdc', () => {
  it('parses whole and fractional amounts into 18-decimal units', () => {
    expect(parseUsdc('1')).toBe(10n ** 18n)
    expect(parseUsdc('0.000001')).toBe(SCALE)
    expect(parseUsdc('12.5')).toBe(125n * 10n ** 17n)
    expect(parseUsdc('.25')).toBe(25n * 10n ** 16n)
    expect(parseUsdc(' 1_000.10 ')).toBe(1000_100_000n * SCALE)
  })

  it('rejects more than six decimals instead of rounding', () => {
    expect(() => parseUsdc('0.0000001')).toThrowError(LastDollarError)
    try {
      parseUsdc('1.1234567')
    } catch (e) {
      expect((e as LastDollarError).code).toBe('INVALID_PRECISION')
    }
  })

  it('rejects negatives, empty and malformed input', () => {
    for (const bad of ['', '-1', '1e6', '0x10', '1.2.3', 'abc', '1,000', ' . ']) {
      expect(() => parseUsdc(bad), bad).toThrowError(LastDollarError)
    }
  })

  it('parses 6-decimal and full native precision variants', () => {
    expect(parseUsdc6('2.000001')).toBe(2_000_001n)
    expect(parseNativeUsdc('0.000000000000000001')).toBe(1n)
    expect(() => parseNativeUsdc('0.0000000000000000001')).toThrowError(/18 decimal/)
  })
})

describe('scale conversion', () => {
  it('converts exactly upward and truncates downward like the ERC-20 view', () => {
    expect(toNative18(1n)).toBe(SCALE)
    expect(toToken6Floor(SCALE - 1n)).toBe(0n)
    expect(toToken6Floor(1_635_832_916_707_859_154n)).toBe(1_635_832n) // observed mainnet balance
    expect(subMicroRemainder(1_635_832_916_707_859_154n)).toBe(916_707_859_154n)
  })

  it('holds the round-trip invariant for random values', () => {
    for (let i = 0; i < 2000; i++) {
      const x = rand(120)
      const t = toToken6Floor(x)
      expect(toNative18(t) <= x).toBe(true)
      expect(x - toNative18(t)).toBe(subMicroRemainder(x))
      expect(subMicroRemainder(x) < SCALE).toBe(true)
      expect(isTokenRepresentable(toNative18(t))).toBe(true)
    }
  })

  it('refuses negative native amounts', () => {
    expect(() => toToken6Floor(-1n)).toThrowError(LastDollarError)
  })
})

describe('formatUsdc', () => {
  it('truncates rather than rounds', () => {
    expect(formatUsdc(1_999_999_999_999_999_999n)).toBe('1.999999')
    expect(formatUsdc(10n ** 18n)).toBe('1.00')
    expect(formatUsdc(1_234_567n * 10n ** 18n)).toBe('1,234,567.00')
  })

  it('never shows a non-zero fee as zero', () => {
    // 21000 gas at 20 gwei = 0.00042 USDC; a 1-wei fee must stay visible too.
    expect(formatUsdc(420_000_000_000_000n)).toBe('0.00042')
    expect(formatUsdc(1n)).toBe('0.000000000000000001')
    expect(formatUsdc(116_643_090_082n)).toBe('0.000000116')
    expect(formatUsdc(0n)).toBe('0.00')
  })

  it('renders full precision when asked', () => {
    expect(formatNativeExact(420_000_000_000_000n)).toBe('0.000420000000000000')
  })

  it('round-trips bigint through JSON helpers', () => {
    const v = { a: 1n, b: [2n, 'x'], c: '3' }
    expect(JSON.parse(JSON.stringify(v, bigintReplacer), bigintReviver)).toEqual(v)
  })
})
