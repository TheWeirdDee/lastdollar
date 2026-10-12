import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { appChain, appNetwork } from './network'

/**
 * Browser wallets are discovered through EIP-6963 (each installed wallet announces itself) with a
 * generic injected fallback. Reconnecting restores the session only; it never signs anything.
 */
export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  // Every official Arc RPC, tried in order. If one is unreachable from the user's network the next
  // is used; all of them report chain 5042, and every quote re-checks the chain id anyway.
  transports: {
    [appChain.id]: fallback(appNetwork.rpcUrls.map((url) => http(url, { retryCount: 1, timeout: 12_000 }))),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
