// Proves the SDK installs and works from its packed tarball, outside this workspace.
// Packs @lastdollar/arc, installs it with viem into a fresh temp project, then checks ESM import,
// CommonJS require and TypeScript declarations.
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './lib.mjs'

const sdkDir = join(ROOT, 'packages', 'sdk')
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' })

run('pnpm build', sdkDir)
const dir = mkdtempSync(join(tmpdir(), 'lastdollar-pack-'))
try {
  run(`npm pack --pack-destination "${dir}"`, sdkDir)
  const tarball = readdirSync(dir).find((f) => f.endsWith('.tgz'))
  if (!tarball) throw new Error('npm pack produced no tarball')
  const files = run(`tar -tzf "${tarball}"`, dir)
  for (const required of ['package/dist/index.js', 'package/dist/index.cjs', 'package/dist/index.d.ts', 'package/README.md', 'package/LICENSE']) {
    if (!files.includes(required)) throw new Error(`tarball is missing ${required}`)
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }))
  run(`npm install --no-audit --no-fund ./${tarball} viem@2.57.4 typescript@5.9.3`, dir)

  writeFileSync(
    join(dir, 'esm.mjs'),
    `import { parseUsdc, maxTokenAmount6, formatUsdc, arcMainnet, SDK_VERSION } from '@lastdollar/arc'
if (arcMainnet.chainId !== 5042) throw new Error('config')
const m = maxTokenAmount6(parseUsdc('1.5') + 123n, parseUsdc('0.001'), 1_500_000n)
if (m !== 1_499_000n) throw new Error('math ' + m)
console.log('esm ok', SDK_VERSION, formatUsdc(parseUsdc('2.5')))`,
  )
  writeFileSync(
    join(dir, 'cjs.cjs'),
    `const { toToken6Floor, SCALE } = require('@lastdollar/arc')
if (toToken6Floor(SCALE * 7n + 5n) !== 7n) throw new Error('cjs')
console.log('cjs ok')`,
  )
  writeFileSync(
    join(dir, 'types.ts'),
    `import { quoteExactPayment, type PaymentQuote, type LastDollarErrorCode, parseUsdc } from '@lastdollar/arc'
import type { PublicClient } from 'viem'
export async function q(publicClient: PublicClient): Promise<PaymentQuote> {
  const code: LastDollarErrorCode = 'STALE_QUOTE'
  void code
  return quoteExactPayment({ publicClient, account: '0x0000000000000000000000000000000000000001', recipient: '0x0000000000000000000000000000000000000002', amount18: parseUsdc('1'), mode: 'erc20' })
}`,
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', noEmit: true, skipLibCheck: false } }),
  )
  console.log(run('node esm.mjs', dir).trim())
  console.log(run('node cjs.cjs', dir).trim())
  run('npx tsc -p tsconfig.json', dir)
  console.log('types ok')
  console.log(`Packed artifact ${tarball} installs and works outside the workspace.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
