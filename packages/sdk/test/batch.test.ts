import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { BATCH_CSV_TEMPLATE, parseBatchCsv, validateBatchLines } from '../src/batch.js'
import { parseUsdc } from '../src/units.js'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'

describe('parseBatchCsv', () => {
  it('accepts the documented template', () => {
    const r = parseBatchCsv(BATCH_CSV_TEMPLATE)
    expect(r.ok).toBe(true)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]?.amount18).toBe(parseUsdc('1.50'))
    expect(r.lines[0]?.reference).toBe('invoice-1001')
  })

  it('requires the header', () => {
    const r = parseBatchCsv(`${A},1\n`)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/header/)
  })

  it('reports row-level errors without rounding, merging or dropping rows', () => {
    const csv = ['recipient,amount,reference', `${A},1.1234567,too-precise`, `${B},0,zero`, `0x123,1,bad-address`, `${A},2.5,ok`, `${A},2.5,dup`].join('\n')
    const r = parseBatchCsv(csv)
    expect(r.ok).toBe(false)
    expect(r.lines).toEqual([]) // nothing executable while any row is invalid
    expect(r.rows).toHaveLength(5)
    expect(r.rows[0]?.errors.join()).toMatch(/6 decimal/)
    expect(r.rows[1]?.errors.join()).toMatch(/greater than zero/)
    expect(r.rows[2]?.errors.join()).toMatch(/valid address/)
    expect(r.rows[3]?.errors).toEqual([])
    expect(r.rows.map((x) => x.line)).toEqual([2, 3, 4, 5, 6])
  })

  it('handles quoting, CRLF, BOM and blank lines', () => {
    const csv = `﻿recipient,amount,reference\r\n${A},"1.00","ref, with comma"\r\n\r\n${B},2,\r\n`
    const r = parseBatchCsv(csv)
    expect(r.ok).toBe(true)
    expect(r.lines.map((l) => l.reference)).toEqual(['ref, with comma', undefined])
  })

  it('rejects the zero address and extra columns', () => {
    const r = parseBatchCsv(`recipient,amount\n0x0000000000000000000000000000000000000000,1\n${A},1,extra`)
    expect(r.rows[0]?.errors.join()).toMatch(/zero address/)
    expect(r.rows[1]?.errors.join()).toMatch(/columns/)
  })

  it('enforces the row cap', () => {
    const rows = Array.from({ length: 4 }, () => `${A},1`).join('\n')
    expect(parseBatchCsv(`recipient,amount\n${rows}`, { maxRecipients: 3 }).errors.join()).toMatch(/At most 3/)
  })
})

describe('validateBatchLines', () => {
  it('reports repeated recipients and keeps each row', () => {
    const v = validateBatchLines([
      { recipient: getAddress(A), amount18: 1n },
      { recipient: getAddress(B), amount18: 2n },
      { recipient: getAddress(A), amount18: 3n },
    ])
    expect(v.errors).toEqual([])
    expect(v.lines).toHaveLength(3)
    expect(v.total18).toBe(6n)
    expect(v.duplicates.get(getAddress(A))).toEqual([0, 2])
    expect(v.warnings[0]?.code).toBe('DUPLICATE_RECIPIENT')
  })

  it('rejects empty batches and invalid rows', () => {
    expect(validateBatchLines([]).errors[0]?.code).toBe('INVALID_BATCH')
    const v = validateBatchLines([{ recipient: getAddress(A), amount18: 0n }])
    expect(v.errors[0]?.code).toBe('INVALID_AMOUNT')
  })
})
