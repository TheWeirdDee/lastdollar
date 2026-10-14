// Builds the splitter contract from a fresh clone: installs forge-std if missing, then `forge build`.
// `pnpm verify:evidence` needs this artifact to compare the local build with the deployed bytecode.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './lib.mjs'

const local = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'forge.exe' : 'forge')
const forge = existsSync(local) ? local : 'forge'
const cwd = join(ROOT, 'contracts')
const run = (args) => {
  const r = spawnSync(forge, args, { cwd, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

if (!existsSync(join(cwd, 'lib', 'forge-std', 'src', 'Test.sol'))) run(['install', 'foundry-rs/forge-std', '--no-git'])
run(['build'])
