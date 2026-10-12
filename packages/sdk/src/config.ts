import { getAddress, type Address } from 'viem'

/**
 * Network configuration for an Arc deployment. Values for Arc mainnet were verified against
 * docs.arc.io and the live RPC; see docs/network-verification.md in the repository.
 */
export interface ArcNetworkConfig {
  /** EIP-155 chain id. Arc mainnet is 5042. */
  readonly chainId: number
  readonly name: string
  /** True only for the production Arc network. Writes to other networks are labelled as tests. */
  readonly isMainnet: boolean
  readonly rpcUrls: readonly string[]
  readonly explorerUrl: string
  /** The optional ERC-20 interface for the native USDC balance (6 decimals). */
  readonly usdc: Address
  /** Address that emits EIP-7708 `Transfer` logs for native value movements (18 decimals). */
  readonly nativeTransferEmitter: Address
  /** Protocol minimum base fee in wei. Transactions with a lower maxFeePerGas are dropped. */
  readonly minBaseFeePerGas: bigint
  /** Deployed LastDollarSplitter address, when available on this network. */
  readonly splitter?: Address | undefined
}

export const NATIVE_DECIMALS = 18
export const TOKEN_DECIMALS = 6
/** Native (18-decimal) units per ERC-20 (6-decimal) unit. */
export const SCALE = 10n ** 12n

export const ARC_USDC_ADDRESS: Address = '0x3600000000000000000000000000000000000000'
export const ARC_NATIVE_TRANSFER_EMITTER: Address = '0xfffffffffffffffffffffffffffffffffffffffe'

export const arcMainnet: ArcNetworkConfig = {
  chainId: 5042,
  name: 'Arc',
  isMainnet: true,
  rpcUrls: [
    'https://rpc.mainnet.arc.io',
    'https://rpc.drpc.mainnet.arc.io',
    'https://rpc.blockdaemon.mainnet.arc.io',
    'https://rpc.quicknode.mainnet.arc.io',
  ],
  explorerUrl: 'https://explorer.arc.io',
  usdc: ARC_USDC_ADDRESS,
  nativeTransferEmitter: ARC_NATIVE_TRANSFER_EMITTER,
  minBaseFeePerGas: 20_000_000_000n,
  splitter: undefined,
}

export const arcTestnet: ArcNetworkConfig = {
  chainId: 5042002,
  name: 'Arc Testnet',
  isMainnet: false,
  rpcUrls: ['https://rpc.testnet.arc.io'],
  explorerUrl: 'https://explorer.testnet.arc.io',
  usdc: ARC_USDC_ADDRESS,
  nativeTransferEmitter: ARC_NATIVE_TRANSFER_EMITTER,
  minBaseFeePerGas: 20_000_000_000n,
  splitter: undefined,
}

/** Returns a copy of `base` with overrides applied and addresses checksummed. */
export function defineArcNetwork(
  base: ArcNetworkConfig,
  overrides: Partial<ArcNetworkConfig> = {},
): ArcNetworkConfig {
  const merged = { ...base, ...overrides }
  return {
    ...merged,
    usdc: getAddress(merged.usdc),
    nativeTransferEmitter: getAddress(merged.nativeTransferEmitter),
    splitter: merged.splitter ? getAddress(merged.splitter) : undefined,
  }
}

export function explorerTxUrl(config: ArcNetworkConfig, hash: string): string {
  return `${config.explorerUrl.replace(/\/$/, '')}/tx/${hash}`
}

export function explorerAddressUrl(config: ArcNetworkConfig, address: string): string {
  return `${config.explorerUrl.replace(/\/$/, '')}/address/${address}`
}
