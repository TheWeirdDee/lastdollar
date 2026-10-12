import { describe, expect, it } from 'vitest'
import { HttpRequestError, UserRejectedRequestError, InsufficientFundsError, BaseError } from 'viem'
import { classifyError, LastDollarError } from '../src/errors.js'

describe('classifyError', () => {
  it('detects wallet rejection from viem and EIP-1193 shapes', () => {
    expect(classifyError(new UserRejectedRequestError(new Error('x'))).code).toBe('USER_REJECTED')
    expect(classifyError({ code: 4001, message: 'User denied transaction signature' }).code).toBe('USER_REJECTED')
  })

  it('detects insufficient funds, including the Arc OutOfFunds estimation error', () => {
    expect(classifyError(new InsufficientFundsError()).code).toBe('INSUFFICIENT_GAS_FUNDS')
    const arcStyle = new BaseError('Transaction creation failed.', { cause: Object.assign(new Error('revert: OutOfFunds'), { code: -32003 }) })
    expect(classifyError(arcStyle).code).toBe('INSUFFICIENT_GAS_FUNDS')
  })

  it('maps Arc protocol restrictions', () => {
    expect(classifyError(new Error('execution reverted: Zero address not allowed')).code).toBe('UNSUPPORTED_RECIPIENT')
    expect(classifyError(new Error('execution reverted: Blacklistable: account is blacklisted')).code).toBe('UNSUPPORTED_RECIPIENT')
  })

  it('maps transport failures without matching digits inside hex payloads', () => {
    expect(classifyError(new HttpRequestError({ url: 'https://rpc.mainnet.arc.io' })).code).toBe('RPC_UNAVAILABLE')
    expect(classifyError(new Error('execution reverted: custom 0xdead5030beef')).code).toBe('SIMULATION_FAILED')
  })

  it('keeps unknown errors unknown and passes LastDollarError through', () => {
    expect(classifyError(new Error('something odd')).code).toBe('UNKNOWN')
    const e = new LastDollarError('STALE_QUOTE', 'x')
    expect(classifyError(e)).toBe(e)
  })
})
