import { explorerAddressUrl, explorerTxUrl, formatUsdc } from '@lastdollar/arc'
import { appNetwork } from './network'

export function usd(amount18: bigint | string | undefined, maxDecimals = 6): string {
  if (amount18 === undefined) return '—'
  return formatUsdc(typeof amount18 === 'string' ? BigInt(amount18) : amount18, { maxDecimals })
}

/** Full 18-decimal precision, trailing zeros trimmed. */
export function usdExact(amount18: bigint | string | undefined): string {
  if (amount18 === undefined) return '—'
  return formatUsdc(typeof amount18 === 'string' ? BigInt(amount18) : amount18, { maxDecimals: 18, minDecimals: 2 })
}

export function shortAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return '—'
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}

export function shortHash(hash: string | undefined | null): string {
  if (!hash) return '—'
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

export const txUrl = (hash: string) => explorerTxUrl(appNetwork, hash)
export const addressUrl = (address: string) => explorerAddressUrl(appNetwork, address)

export function formatTime(ms: number | string | undefined): string {
  if (ms === undefined) return '—'
  const d = new Date(typeof ms === 'string' ? Number(ms) : ms)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function gweiString(wei: bigint | string | undefined): string {
  if (wei === undefined) return '—'
  const v = typeof wei === 'string' ? BigInt(wei) : wei
  const whole = v / 1_000_000_000n
  const frac = (v % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '').slice(0, 4)
  return `${whole}${frac ? `.${frac}` : ''} gwei`
}
