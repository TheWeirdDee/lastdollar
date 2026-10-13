// Shared helpers for LastDollar operational scripts. No secrets are printed or written to the repo.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, keccak256 } from 'viem'
import { arcMainnet, defineArcNetwork, toViemChain } from '@lastdollar/arc'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EVIDENCE_DIR = join(ROOT, 'evidence', 'mainnet')
export const DEPLOYMENT_FILE = join(EVIDENCE_DIR, 'splitter-deployment.json')
export const PROOFS_FILE = join(EVIDENCE_DIR, 'proofs.json')

/** Primary and independent verification RPCs (different operators). */
export const PRIMARY_RPC = process.env.ARC_RPC_URL ?? 'https://rpc.mainnet.arc.io'
export const SECONDARY_RPC = process.env.ARC_VERIFY_RPC_URL ?? 'https://rpc.drpc.mainnet.arc.io'

export function readJson(path, fallback = undefined) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Writes JSON with bigint values as plain decimal strings (base units; see field suffixes). */
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`)
}

export function networkConfig() {
  const deployment = readJson(DEPLOYMENT_FILE)
  return defineArcNetwork(arcMainnet, {
    rpcUrls: [PRIMARY_RPC, SECONDARY_RPC],
    ...(deployment?.address ? { splitter: deployment.address } : {}),
  })
}

export function clientFor(url, config = networkConfig()) {
  return createPublicClient({ chain: toViemChain(config), transport: http(url, { retryCount: 3, timeout: 20_000 }) })
}

/** Loads the proof wallet file (payer key and helper wallets), which lives outside the repository. */
export function loadWallets() {
  const path = process.env.LASTDOLLAR_WALLETS ?? join(homedir(), '.lastdollar', 'proof-wallets.env')
  if (!existsSync(path)) throw new Error(`Proof wallet file not found at ${path}`)
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) env[m[1]] = m[2]
  }
  return env
}

export function splitterArtifact() {
  const path = join(ROOT, 'contracts', 'out', 'LastDollarSplitter.sol', 'LastDollarSplitter.json')
  if (!existsSync(path)) throw new Error('Run `pnpm test:contracts` (forge build) first.')
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return {
    abi: json.abi,
    bytecode: json.bytecode.object,
    deployedBytecode: json.deployedBytecode.object,
    runtimeHash: keccak256(json.deployedBytecode.object),
    metadata: json.metadata,
  }
}

export async function assertMainnet(client, label) {
  const id = await client.getChainId()
  if (id !== 5042) throw new Error(`${label} reports chain ${id}; refusing to continue (expected Arc mainnet 5042).`)
  return id
}
