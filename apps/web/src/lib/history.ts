'use client'

import { useSyncExternalStore } from 'react'

/**
 * App-tracked transaction history.
 *
 * Stores only public, non-secret identifiers in this browser's localStorage, scoped by chain and
 * account. It is a convenience index of payments made through this app, not a wallet history and
 * not settlement evidence: every status shown is re-derived from chain data.
 */
export type RecordStatus = 'pending' | 'verified' | 'mismatch' | 'reverted' | 'replaced' | 'unresolved'

export interface TxRecord {
  v: 1
  hash: `0x${string}`
  chainId: number
  account: `0x${string}`
  kind: 'exact' | 'max' | 'batch'
  mode: 'native' | 'erc20'
  nonce: number
  quoteId: `0x${string}`
  createdAt: number
  status: RecordStatus
  recipients: { recipient: `0x${string}`; amount18: string; reference?: string | undefined }[]
  total18: string
  estimatedFee18?: string | undefined
  maxFeeBudget18?: string | undefined
  actualFee18?: string | undefined
  blockNumber?: string | undefined
  replacementHash?: `0x${string}` | undefined
  lastCheckedAt?: number | undefined
  note?: string | undefined
}

const PREFIX = 'lastdollar:v1:history'
const EVENT = 'lastdollar-history'
const keyFor = (chainId: number, account: string) => `${PREFIX}:${chainId}:${account.toLowerCase()}`

function safeRead(key: string): TxRecord[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord)
  } catch {
    return []
  }
}

function isRecord(r: unknown): r is TxRecord {
  const x = r as Partial<TxRecord>
  return (
    !!x &&
    x.v === 1 &&
    typeof x.hash === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(x.hash) &&
    typeof x.chainId === 'number' &&
    typeof x.account === 'string' &&
    Array.isArray(x.recipients)
  )
}

function write(key: string, records: TxRecord[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(records.slice(0, 200)))
  } catch {
    /* storage full or blocked: history is best-effort */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function listRecords(chainId: number, account: string): TxRecord[] {
  return safeRead(keyFor(chainId, account)).sort((a, b) => b.createdAt - a.createdAt)
}

export function upsertRecord(record: TxRecord) {
  const key = keyFor(record.chainId, record.account)
  const list = safeRead(key).filter((r) => r.hash.toLowerCase() !== record.hash.toLowerCase())
  write(key, [record, ...list])
}

export function patchRecord(chainId: number, account: string, hash: string, patch: Partial<TxRecord>) {
  const key = keyFor(chainId, account)
  const list = safeRead(key)
  const i = list.findIndex((r) => r.hash.toLowerCase() === hash.toLowerCase())
  if (i < 0) return
  list[i] = { ...list[i]!, ...patch }
  write(key, list)
}

export function clearRecords(chainId: number, account: string) {
  try {
    window.localStorage.removeItem(keyFor(chainId, account))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Finds a record for a hash across every account stored in this browser. */
export function findRecord(hash: string): TxRecord | undefined {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k?.startsWith(PREFIX)) continue
      const hit = safeRead(k).find((r) => r.hash.toLowerCase() === hash.toLowerCase())
      if (hit) return hit
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(PREFIX) || e.key.startsWith(LOCK_PREFIX)) cb()
  }
  window.addEventListener('storage', onStorage) // other tabs
  window.addEventListener(EVENT, cb) // this tab
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT, cb)
  }
}

const cache = new Map<string, { raw: string | null; value: TxRecord[] }>()
const EMPTY: TxRecord[] = []

export function useRecords(chainId: number | undefined, account: string | undefined): TxRecord[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!chainId || !account) return EMPTY
      const key = keyFor(chainId, account)
      let raw: string | null = null
      try {
        raw = window.localStorage.getItem(key)
      } catch {
        raw = null
      }
      const hit = cache.get(key)
      if (hit && hit.raw === raw) return hit.value
      const value = listRecords(chainId, account)
      cache.set(key, { raw, value })
      return value
    },
    () => EMPTY,
  )
}

const recordCache = new Map<string, { raw: string; value: TxRecord | undefined }>()

/** Subscribes to the locally recorded intent for a hash (metadata only, never evidence). */
export function useRecordByHash(hash: string): TxRecord | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      const value = findRecord(hash)
      const raw = JSON.stringify(value ?? null)
      const hit = recordCache.get(hash)
      if (hit && hit.raw === raw) return hit.value
      recordCache.set(hash, { raw, value })
      return value
    },
    () => undefined,
  )
}

/* Cross-tab submission lock: prevents the same reviewed plan being submitted twice. */
const LOCK_PREFIX = 'lastdollar:v1:lock'
const LOCK_TTL = 10 * 60_000

export function acquireSubmissionLock(account: string, quoteId: string): boolean {
  const key = `${LOCK_PREFIX}:${account.toLowerCase()}`
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const lock = JSON.parse(raw) as { quoteId: string; at: number }
      if (Date.now() - lock.at < LOCK_TTL) return false
    }
    window.localStorage.setItem(key, JSON.stringify({ quoteId, at: Date.now() }))
    return true
  } catch {
    return true
  }
}

export function releaseSubmissionLock(account: string) {
  try {
    window.localStorage.removeItem(`${LOCK_PREFIX}:${account.toLowerCase()}`)
  } catch {
    /* ignore */
  }
}
