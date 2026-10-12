// Shared setup for the examples. Reads are free. Nothing is signed unless you pass --execute
// AND set PRIVATE_KEY in your environment (never commit it). Mainnet transactions move real USDC.
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arc } from 'viem/chains'
import { arcMainnet, defineArcNetwork } from '@lastdollar/arc'

export const config = defineArcNetwork(arcMainnet, {
  ...(process.env.SPLITTER_ADDRESS ? { splitter: process.env.SPLITTER_ADDRESS } : {}),
})
export const publicClient = createPublicClient({ chain: arc, transport: http(process.env.ARC_RPC_URL ?? config.rpcUrls[0]) })
export const execute = process.argv.includes('--execute')

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}

/** The payer: from PRIVATE_KEY when executing, otherwise any address passed with --from. */
export function payer() {
  if (process.env.PRIVATE_KEY) return privateKeyToAccount(process.env.PRIVATE_KEY)
  const from = arg('from')
  if (!from) throw new Error('Pass --from 0x… to quote, or set PRIVATE_KEY to execute.')
  return { address: from }
}

export function walletFor(account) {
  if (!('signTransaction' in account)) throw new Error('Set PRIVATE_KEY to execute.')
  return createWalletClient({ account, chain: arc, transport: http(process.env.ARC_RPC_URL ?? config.rpcUrls[0]) })
}
