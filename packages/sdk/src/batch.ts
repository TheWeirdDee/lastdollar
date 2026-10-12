import { getAddress, isAddress, zeroAddress, type Address } from 'viem'
import { SPLITTER_MAX_RECIPIENTS } from './abis.js'
import { LastDollarError } from './errors.js'
import { parseUsdc } from './units.js'
import type { PaymentLine, QuoteIssue } from './types.js'

export interface BatchValidation {
  lines: PaymentLine[]
  errors: QuoteIssue[]
  warnings: QuoteIssue[]
  total18: bigint
  /** Indexes grouped by recipient for every address that appears more than once. */
  duplicates: Map<Address, number[]>
}

/** Validates already-parsed batch lines. Repeated recipients are allowed but always reported. */
export function validateBatchLines(
  lines: readonly PaymentLine[],
  options: { maxRecipients?: number; payer?: Address | undefined } = {},
): BatchValidation {
  const maxRecipients = options.maxRecipients ?? SPLITTER_MAX_RECIPIENTS
  const errors: QuoteIssue[] = []
  const warnings: QuoteIssue[] = []
  const seen = new Map<Address, number[]>()
  const out: PaymentLine[] = []
  let total18 = 0n

  if (lines.length === 0) errors.push({ code: 'INVALID_BATCH', message: 'Add at least one recipient.' })
  if (lines.length > maxRecipients) {
    errors.push({
      code: 'INVALID_BATCH',
      message: `A batch supports at most ${maxRecipients} recipients; this one has ${lines.length}.`,
    })
  }

  lines.forEach((line, index) => {
    const raw = String(line.recipient ?? '').trim()
    if (!isAddress(raw, { strict: false })) {
      errors.push({ code: 'INVALID_RECIPIENT', message: `Row ${index + 1}: not a valid address.`, index })
      return
    }
    const recipient = getAddress(raw)
    if (recipient === zeroAddress) {
      errors.push({ code: 'UNSUPPORTED_RECIPIENT', message: `Row ${index + 1}: the zero address cannot receive value on Arc.`, index })
      return
    }
    if (line.amount18 <= 0n) {
      errors.push({ code: 'INVALID_AMOUNT', message: `Row ${index + 1}: amount must be greater than zero.`, index })
      return
    }
    if (options.payer && recipient === getAddress(options.payer)) {
      warnings.push({ code: 'SELF_PAYMENT', message: `Row ${index + 1}: pays your own address.`, index })
    }
    const list = seen.get(recipient) ?? []
    list.push(index)
    seen.set(recipient, list)
    total18 += line.amount18
    out.push({ recipient, amount18: line.amount18, reference: line.reference })
  })

  const duplicates = new Map<Address, number[]>()
  for (const [addr, idx] of seen) {
    if (idx.length > 1) {
      duplicates.set(addr, idx)
      warnings.push({
        code: 'DUPLICATE_RECIPIENT',
        message: `${addr} appears in rows ${idx.map((i) => i + 1).join(', ')}. Each row is paid separately; rows are never merged.`,
        index: idx[0],
      })
    }
  }
  return { lines: out, errors, warnings, total18, duplicates }
}

export interface CsvRow {
  /** 1-based line number in the source file. */
  line: number
  recipient: string
  amount: string
  reference: string
  amount18?: bigint | undefined
  errors: string[]
}

export interface CsvParseResult {
  rows: CsvRow[]
  /** File-level problems (missing header, too many rows, …). */
  errors: string[]
  /** True only when there are no file-level or row-level errors. */
  ok: boolean
  lines: PaymentLine[]
}

export const BATCH_CSV_TEMPLATE = 'recipient,amount,reference\n0x0000000000000000000000000000000000000001,1.50,invoice-1001\n'

function splitCsvLine(text: string): string[] | null {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') {
      if (cur.trim() !== '') return null
      quoted = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  if (quoted) return null
  cells.push(cur)
  return cells.map((c) => c.trim())
}

/**
 * Strict CSV import for batch payments. Header `recipient,amount[,reference]` is required.
 * Amounts are parsed with at most 6 decimals and are never rounded; rows are never merged,
 * reordered or dropped (only fully blank lines are skipped and reported as skipped).
 */
export function parseBatchCsv(text: string, options: { maxRecipients?: number } = {}): CsvParseResult {
  const maxRecipients = options.maxRecipients ?? SPLITTER_MAX_RECIPIENTS
  const errors: string[] = []
  const rows: CsvRow[] = []
  const rawLines = text.replace(/^﻿/, '').split(/\r?\n/)
  const headerIndex = rawLines.findIndex((l) => l.trim() !== '')
  if (headerIndex === -1) return { rows, errors: ['The file is empty.'], ok: false, lines: [] }
  const header = splitCsvLine(rawLines[headerIndex] ?? '')?.map((h) => h.toLowerCase())
  if (!header || header[0] !== 'recipient' || header[1] !== 'amount' || header.length > 3 || (header[2] !== undefined && header[2] !== 'reference')) {
    return {
      rows,
      errors: ['The first line must be the header "recipient,amount,reference" (reference is optional).'],
      ok: false,
      lines: [],
    }
  }
  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i] ?? ''
    if (rawLine.trim() === '') continue
    const cells = splitCsvLine(rawLine)
    const row: CsvRow = { line: i + 1, recipient: '', amount: '', reference: '', errors: [] }
    if (!cells) {
      row.errors.push('Malformed quoting.')
      rows.push(row)
      continue
    }
    if (cells.length > header.length) row.errors.push(`Expected ${header.length} columns, found ${cells.length}.`)
    row.recipient = cells[0] ?? ''
    row.amount = cells[1] ?? ''
    row.reference = cells[2] ?? ''
    if (!isAddress(row.recipient, { strict: false })) row.errors.push('Recipient is not a valid address.')
    else if (getAddress(row.recipient) === zeroAddress) row.errors.push('The zero address cannot receive value on Arc.')
    try {
      const v = parseUsdc(row.amount)
      if (v <= 0n) row.errors.push('Amount must be greater than zero.')
      else row.amount18 = v
    } catch (err) {
      row.errors.push(err instanceof LastDollarError ? err.message : 'Invalid amount.')
    }
    if (row.reference.length > 64) row.errors.push('Reference must be 64 characters or fewer.')
    rows.push(row)
  }
  if (rows.length === 0) errors.push('The file has a header but no payment rows.')
  if (rows.length > maxRecipients) errors.push(`At most ${maxRecipients} rows are supported; found ${rows.length}.`)
  const ok = errors.length === 0 && rows.every((r) => r.errors.length === 0)
  const lines = ok
    ? rows.map((r) => ({ recipient: getAddress(r.recipient), amount18: r.amount18 as bigint, reference: r.reference || undefined }))
    : []
  return { rows, errors, ok, lines }
}
