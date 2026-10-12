import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 8547
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const bin = (n: string) => {
  const local = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? `${n}.exe` : n)
  return existsSync(local) ? local : n // CI installs Foundry on PATH
}
export const PID_FILE = join(tmpdir(), 'lastdollar-e2e-anvil.pid')

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(`http://127.0.0.1:${PORT}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result
}

export default async function globalSetup() {
  const anvil = spawn(bin('anvil'), ['--port', String(PORT), '--chain-id', '5042', '--base-fee', '20000000000', '--silent'], {
    detached: false,
    stdio: 'ignore',
  })
  writeFileSync(PID_FILE, String(anvil.pid))
  for (let i = 0; i < 100; i++) {
    try {
      await rpc('eth_chainId')
      break
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  const art = (name: string) => JSON.parse(readFileSync(join(ROOT, 'contracts', 'out', `${name}.sol`, `${name}.json`), 'utf8'))
  // The SDK reads USDC.balanceOf at 0x3600…; a view-only mock mirrors Arc's truncation locally.
  await rpc('anvil_setCode', ['0x3600000000000000000000000000000000000000', art('MockArcUsdcView').deployedBytecode.object])
  // Deploy the real splitter from anvil account 0 at nonce 0 (deterministic address).
  const from = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  const hash = await rpc('eth_sendTransaction', [{ from, data: art('LastDollarSplitter').bytecode.object, gas: '0x100000' }])
  for (let i = 0; i < 50; i++) {
    const r = (await rpc('eth_getTransactionReceipt', [hash])) as { contractAddress?: string } | null
    if (r?.contractAddress) break
    await new Promise((res) => setTimeout(res, 100))
  }
}
