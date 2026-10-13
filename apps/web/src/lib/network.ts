import { arcMainnet, defineArcNetwork, toViemChain, type ArcNetworkConfig } from '@lastdollar/arc'
import { createPublicClient, fallback, http, type PublicClient } from 'viem'
import deployment from '@/generated/deployment.json'

/**
 * The single network this deployment of the app talks to.
 *
 * Production is Arc mainnet. Automated browser tests may point the app at a local chain that uses
 * the Arc chain id by setting NEXT_PUBLIC_NETWORK_MODE=local-test; the UI then shows a
 * persistent "test network" banner so it can never be mistaken for real execution.
 */
const mode = process.env.NEXT_PUBLIC_NETWORK_MODE === 'local-test' ? 'local-test' : 'mainnet'
const rpcOverride = process.env.NEXT_PUBLIC_ARC_RPC_URL
const splitter = (process.env.NEXT_PUBLIC_SPLITTER_ADDRESS || (deployment as { address?: string }).address || undefined) as
  | `0x${string}`
  | undefined

export const networkMode = mode
export const isTestMode = mode === 'local-test'

export const appNetwork: ArcNetworkConfig = defineArcNetwork(arcMainnet, {
  ...(rpcOverride ? { rpcUrls: [rpcOverride] } : {}),
  ...(isTestMode ? { isMainnet: false, name: 'Local test chain' } : {}),
  splitter,
})

export const appChain = toViemChain(appNetwork)

/**
 * Read transport: the app's own same-origin relay first (works where browsers or extensions block
 * direct RPC hosts), then every official Arc endpoint directly. Test mode talks to its local chain only.
 */
export function readTransport() {
  const direct = appNetwork.rpcUrls.map((u) => http(u, { retryCount: 1, timeout: 12_000 }))
  if (isTestMode || typeof window === 'undefined') return fallback(direct)
  return fallback([http(`${window.location.origin}/api/rpc`, { retryCount: 1, timeout: 15_000 }), ...direct])
}

/** A wallet-independent read client, used by public pages. */
export function createAppReadClient(): PublicClient {
  return createPublicClient({ chain: appChain, transport: readTransport() }) as PublicClient
}

export const splitterDeployment = deployment as {
  address?: `0x${string}`
  transactionHash?: `0x${string}`
  blockNumber?: string
  deployer?: `0x${string}`
  compiler?: string
  runtimeMatches?: boolean
  explorerVerification?: string
}

export const REPO_URL = 'https://github.com/TheWeirdDee/lastdollar'
export const APP_VERSION = '0.1.0'
/** Git commit of this build, when built by Vercel from the repository. */
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? ''
