import { existsSync, readFileSync, rmSync } from 'node:fs'
import { PID_FILE } from './global-setup'

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return
  const pid = Number(readFileSync(PID_FILE, 'utf8'))
  try {
    process.kill(pid)
  } catch {
    /* already stopped */
  }
  rmSync(PID_FILE, { force: true })
}
