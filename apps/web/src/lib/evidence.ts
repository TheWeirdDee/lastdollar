import proofs from '@/generated/proofs.json'

export interface EvidenceLine {
  recipient: `0x${string}`
  amount18: string
}

export interface MainnetEntry {
  id: string
  label: string
  evidenceType: 'mainnet'
  kind: 'exact' | 'max' | 'batch'
  mode: 'native' | 'erc20'
  chainId: number
  hash: `0x${string}`
  blockNumber: string
  blockTimestamp?: string
  from: `0x${string}`
  to?: `0x${string}`
  splitter?: `0x${string}`
  intended: EvidenceLine[]
  delivered: EvidenceLine[]
  tokenAmount6?: string
  /** The reviewed quote. Null when no pre-signing review was recorded for this hash. */
  quote: {
    blockNumber: string
    balance18: string
    token6: string
    gasEstimate: string
    gasLimit: string
    maxFeePerGas: string
    maxPriorityFeePerGas: string
    estimatedFee18: string
    maxFeeBudget18: string
    maxDebit18: string
    iterations: number
  } | null
  /** Caps in the broadcast transaction (recorded when the reviewed quote is unknown). */
  submitted?: { gasLimit: string; maxFeePerGas: string; maxPriorityFeePerGas?: string; maxFeeBudget18: string }
  reviewedQuote?: string
  intendedSource?: string
  actual: {
    gasUsed: string
    effectiveGasPrice: string
    fee18: string
    feeWithinBudget?: boolean
    feeWithinSubmittedCap?: boolean
    walletModifiedParameters?: boolean
    mirroredNativeLogs?: number
  }
  sender: { before18: string; beforeToken6: string; after18: string; afterToken6: string; afterSubMicro18: string }
  result: string
  issues: string[]
  verification: { primaryRpc: string; independentRpc: string; independentStatus: string; rpcsAgree: boolean; verifiedAt: string }
  sdkVersion: string
  /** Chain data alone cannot establish execution channel or wallet identity. */
  provenance?: { channel: 'unknown' | 'sdk-script' | 'browser-wallet'; source: string; reviewedEvidence?: string }
}

export interface SimulationEntry {
  id: string
  label: string
  evidenceType: 'simulation'
  mode: 'native' | 'erc20'
  blockNumber: string
  from: `0x${string}`
  attemptedAmount18: string
  balance18: string
  token6: string
  feeCaps: { gasLimit: string; maxFeePerGas: string }
  outcome: { simulated: 'success' | 'failure'; message: string }
  method: string
  note?: string
  recordedAt: string
}

/** A signed transaction submitted to mainnet and rejected by the node before inclusion (no fee). */
export interface RejectionEntry {
  id: string
  label: string
  evidenceType: 'rejection'
  mode: 'native' | 'erc20'
  blockNumber: string
  from: `0x${string}`
  attemptedAmount18: string
  balance18: string
  feeCaps: { gasLimit: string; maxFeePerGas: string }
  outcome: { rejected: boolean; message: string }
  method: string
  recordedAt: string
}

export interface ComputationEntry {
  id: string
  label: string
  evidenceType: 'computation'
  mode: 'native' | 'erc20'
  blockNumber: string
  baseline: { gasEstimate: string; maxFeePerGas: string; budget18: string; amount18: string }
  lastDollar: { gasLimit: string; maxFeePerGas: string; budget18: string; amount18: string }
  note: string
  recordedAt: string
}

export type EvidenceEntry = MainnetEntry | SimulationEntry | ComputationEntry | RejectionEntry

interface ProofsFile {
  schema: number
  wallets?: Record<string, string>
  splitter?: string | null
  entries: EvidenceEntry[]
}

export const evidence = proofs as unknown as ProofsFile
export const mainnetEntries = evidence.entries.filter((e): e is MainnetEntry => e.evidenceType === 'mainnet')
export const simulationEntries = evidence.entries.filter((e): e is SimulationEntry => e.evidenceType === 'simulation')
export const rejectionEntries = evidence.entries.filter((e): e is RejectionEntry => e.evidenceType === 'rejection')
export const computationEntries = evidence.entries.filter((e): e is ComputationEntry => e.evidenceType === 'computation')
export const hasMainnetEvidence = mainnetEntries.length > 0
