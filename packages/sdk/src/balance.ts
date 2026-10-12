import { getAddress, isAddress, type Address, type PublicClient } from 'viem'
import { arcMainnet, type ArcNetworkConfig } from './config.js'
import { usdcAbi } from './abis.js'
import { LastDollarError, classifyError } from './errors.js'
import { subMicroRemainder, toToken6Floor } from './units.js'
import type { BalanceSnapshot } from './types.js'

export interface ReadArcBalanceInput {
  publicClient: PublicClient
  address: Address
  config?: ArcNetworkConfig
  /** Pin both reads to this block. Defaults to the latest block number at call time. */
  blockNumber?: bigint
}

/** Asserts that the client is connected to the configured chain. */
export async function assertClientChain(client: PublicClient, config: ArcNetworkConfig): Promise<void> {
  let chainId: number
  try {
    chainId = await client.getChainId()
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
  if (chainId !== config.chainId) {
    throw new LastDollarError(
      'WRONG_CHAIN',
      `RPC reports chain ${chainId}, expected ${config.chainId} (${config.name}).`,
      { details: { actual: chainId, expected: config.chainId } },
    )
  }
}

/**
 * Reads one USDC holding through both of Arc's views at the same block.
 * The two numbers describe the same funds and must never be added together.
 */
export async function readArcBalance(input: ReadArcBalanceInput): Promise<BalanceSnapshot> {
  const { publicClient, config = arcMainnet } = input
  if (!isAddress(input.address)) throw new LastDollarError('INVALID_RECIPIENT', 'Invalid account address.')
  const account = getAddress(input.address)
  await assertClientChain(publicClient, config)
  try {
    const blockNumber = input.blockNumber ?? (await publicClient.getBlockNumber({ cacheTime: 0 }))
    const [native18, token6] = await Promise.all([
      publicClient.getBalance({ address: account, blockNumber }),
      publicClient.readContract({
        address: config.usdc,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [account],
        blockNumber,
      }),
    ])
    return snapshotFrom(account, config.chainId, blockNumber, native18, token6)
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
}

export function snapshotFrom(
  account: Address,
  chainId: number,
  blockNumber: bigint,
  native18: bigint,
  token6: bigint,
): BalanceSnapshot {
  const expectedToken6 = toToken6Floor(native18)
  return {
    account,
    chainId,
    blockNumber,
    native18,
    token6,
    expectedToken6,
    subMicro18: subMicroRemainder(native18),
    viewsConsistent: expectedToken6 === token6,
  }
}
