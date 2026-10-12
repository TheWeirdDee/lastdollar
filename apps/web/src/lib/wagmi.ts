import { createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { appChain, readTransport } from './network'

/**
 * Browser wallets are discovered through EIP-6963 (each installed wallet announces itself) with a
 * generic injected fallback. Reconnecting restores the session only; it never signs anything.
 */
export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  // Same-origin relay first, then every official Arc RPC. All report chain 5042, and every quote
  // re-checks the chain id anyway.
  transports: { [appChain.id]: readTransport() },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
