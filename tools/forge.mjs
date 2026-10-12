// Runs forge from ~/.foundry/bin when present, otherwise from PATH (CI).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './lib.mjs'

const local = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'forge.exe' : 'forge')
const r = spawnSync(existsSync(local) ? local : 'forge', process.argv.slice(2), { cwd: join(ROOT, 'contracts'), stdio: 'inherit' })
process.exit(r.status ?? 1)
