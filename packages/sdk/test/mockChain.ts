/**
 * Deterministic in-memory JSON-RPC double for unit tests. It models the Arc behaviours the SDK
 * depends on (one native balance seen through an 18-decimal and a truncated 6-decimal view, a
 * fee check on eth_call/eth_estimateGas when fee fields are present, a pending nonce) and nothing
 * else. It is not evidence of mainnet behaviour; mainnet evidence lives in evidence/mainnet.
 */
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  getAddress,
  numberToHex,
  type Address,
  type PublicClient,
} from 'viem'
import { splitterAbi, usdcAbi } from '../src/abis.js'
import { arcMainnet, SCALE, type ArcNetworkConfig } from '../src/config.js'

export interface MockState {
  chainId: number
  blockNumber: bigint
  baseFee: bigint
  /** Arc-style 8-byte next base fee; undefined → plain extraData. */
  nextBaseFee?: bigint | undefined
  priorityFee: bigint
  balances: Map<string, bigint>
  /** Overrides the token view for an address (to model inconsistent views). */
  tokenOverride: Map<string, bigint>
  nonces: Map<string, { latest: number; pending: number }>
  code: Map<string, `0x${string}`>
  blacklisted: Set<string>
  gas: { native: bigint; erc20: bigint; splitterBase: bigint; splitterPerRecipient: bigint }
  /** Reverts any estimate/call to these recipients with the given reason. */
  revertTo: Map<string, string>
  calls: { method: string; params: unknown[] }[]
  rpcDown: boolean
  /** Models Arc eth_call behaviour that does not apply signed-request balance admission. */
  callIgnoresAffordability: boolean
}

export const SPLITTER: Address = getAddress('0x00000000000000000000000000000000005911e7')

export function mockConfig(overrides: Partial<ArcNetworkConfig> = {}): ArcNetworkConfig {
  return { ...arcMainnet, splitter: SPLITTER, ...overrides }
}

export function createMockState(partial: Partial<MockState> = {}): MockState {
  return {
    chainId: 5042,
    blockNumber: 1000n,
    baseFee: 20_000_000_000n,
    nextBaseFee: 20_000_000_000n,
    priorityFee: 1151n,
    balances: new Map(),
    tokenOverride: new Map(),
    nonces: new Map(),
    code: new Map([['0x00000000000000000000000000000000005911e7', '0x6080']]),
    blacklisted: new Set(),
    gas: { native: 21_000n, erc20: 49_326n, splitterBase: 32_000n, splitterPerRecipient: 9_500n },
    revertTo: new Map(),
    calls: [],
    rpcDown: false,
    callIgnoresAffordability: false,
    ...partial,
  }
}

const k = (a: string) => a.toLowerCase()

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: string,
  ) {
    super(message)
  }
}

export function setBalance(state: MockState, address: string, native18: bigint): void {
  state.balances.set(k(address), native18)
}

function balanceOf(state: MockState, a: string): bigint {
  return state.balances.get(k(a)) ?? 0n
}

function token6(state: MockState, a: string): bigint {
  return state.tokenOverride.get(k(a)) ?? balanceOf(state, a) / SCALE
}

interface TxLike {
  from?: string
  to?: string
  data?: `0x${string}`
  input?: `0x${string}`
  value?: string
  gas?: string
  maxFeePerGas?: string
}

function interpret(state: MockState, tx: TxLike, cfg: ArcNetworkConfig) {
  const from = tx.from ?? '0x0000000000000000000000000000000000000000'
  const to = k(tx.to ?? '')
  const data = (tx.data ?? tx.input ?? '0x') as `0x${string}`
  const value = tx.value ? BigInt(tx.value) : 0n
  if (to === k(cfg.usdc)) {
    const d = decodeFunctionData({ abi: usdcAbi, data })
    if (d.functionName === 'balanceOf') return { kind: 'read' as const, result: encodeAbiParameters([{ type: 'uint256' }], [token6(state, d.args[0])]) }
    if (d.functionName === 'isBlacklisted') return { kind: 'read' as const, result: encodeAbiParameters([{ type: 'bool' }], [state.blacklisted.has(k(d.args[0]))]) }
    if (d.functionName === 'decimals') return { kind: 'read' as const, result: encodeAbiParameters([{ type: 'uint8' }], [6]) }
    if (d.functionName === 'transfer') {
      const [rcpt, amount6] = d.args
      return { kind: 'transfer' as const, from, value, debit: amount6 * SCALE, token: amount6, gas: state.gas.erc20, recipients: [rcpt as string] }
    }
  }
  if (cfg.splitter && to === k(cfg.splitter)) {
    const d = decodeFunctionData({ abi: splitterAbi, data })
    if (d.functionName === 'pay') {
      const [rs] = d.args as readonly [readonly Address[], readonly bigint[]]
      return {
        kind: 'transfer' as const,
        from,
        value,
        debit: value,
        token: undefined,
        gas: state.gas.splitterBase + state.gas.splitterPerRecipient * BigInt(rs.length),
        recipients: [...rs],
      }
    }
  }
  return { kind: 'transfer' as const, from, value, debit: value, token: undefined, gas: state.gas.native, recipients: [to] }
}

function checkExecution(state: MockState, tx: TxLike, cfg: ArcNetworkConfig, withFees: boolean): bigint | `0x${string}` {
  const r = interpret(state, tx, cfg)
  if (r.kind === 'read') return r.result
  for (const rcpt of r.recipients) {
    const reason = state.revertTo.get(k(rcpt))
    if (reason) throw new RpcError(3, `execution reverted: ${reason}`)
  }
  const bal = balanceOf(state, r.from)
  const feeCap = withFees && tx.gas && tx.maxFeePerGas ? BigInt(tx.gas) * BigInt(tx.maxFeePerGas) : 0n
  if (tx.gas && BigInt(tx.gas) < r.gas) throw new RpcError(-32000, 'out of gas')
  if (!state.callIgnoresAffordability || !withFees) {
    if (r.value + feeCap > bal) throw new RpcError(-32003, 'insufficient funds for gas * price + value')
  }
  if (r.token !== undefined) {
    if (r.token > token6(state, r.from)) throw new RpcError(3, 'execution reverted: ERC20: transfer amount exceeds balance')
    if ((!state.callIgnoresAffordability || !withFees) && r.debit + feeCap > bal) throw new RpcError(3, 'execution reverted: ERC20: transfer amount exceeds balance')
  }
  return r.gas
}

export function createMockClient(state: MockState, cfg: ArcNetworkConfig = mockConfig()): PublicClient {
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      const p = (params ?? []) as unknown[]
      state.calls.push({ method, params: p })
      if (state.rpcDown) throw new Error('fetch failed')
      switch (method) {
        case 'eth_chainId':
          return numberToHex(state.chainId)
        case 'eth_blockNumber':
          return numberToHex(state.blockNumber)
        case 'eth_getBlockByNumber':
          return {
            number: numberToHex(state.blockNumber),
            hash: `0x${'ab'.repeat(32)}`,
            parentHash: `0x${'cd'.repeat(32)}`,
            timestamp: numberToHex(1_760_000_000n + state.blockNumber),
            baseFeePerGas: numberToHex(state.baseFee),
            extraData: state.nextBaseFee === undefined ? '0x' : numberToHex(state.nextBaseFee, { size: 8 }),
            gasLimit: '0x1c9c380',
            gasUsed: '0x0',
            transactions: [],
            logsBloom: `0x${'00'.repeat(256)}`,
            miner: '0x0000000000000000000000000000000000000000',
            difficulty: '0x0',
            nonce: '0x0000000000000000',
            sha3Uncles: `0x${'00'.repeat(32)}`,
            size: '0x0',
            stateRoot: `0x${'00'.repeat(32)}`,
            receiptsRoot: `0x${'00'.repeat(32)}`,
            transactionsRoot: `0x${'00'.repeat(32)}`,
            mixHash: `0x${'00'.repeat(32)}`,
            totalDifficulty: '0x0',
            uncles: [],
          }
        case 'eth_maxPriorityFeePerGas':
          return numberToHex(state.priorityFee)
        case 'eth_getBalance':
          return numberToHex(balanceOf(state, p[0] as string))
        case 'eth_getTransactionCount': {
          const n = state.nonces.get(k(p[0] as string)) ?? { latest: 0, pending: 0 }
          return numberToHex(p[1] === 'pending' ? n.pending : n.latest)
        }
        case 'eth_getCode':
          return state.code.get(k(p[0] as string)) ?? '0x'
        case 'eth_estimateGas': {
          const gas = checkExecution(state, p[0] as TxLike, cfg, false)
          return numberToHex(gas as bigint)
        }
        case 'eth_call': {
          const out = checkExecution(state, p[0] as TxLike, cfg, true)
          return typeof out === 'bigint' ? '0x' : out
        }
        default:
          throw new Error(`mock: unsupported method ${method}`)
      }
    },
  })
  return createPublicClient({ transport }) as PublicClient
}
