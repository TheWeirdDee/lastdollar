// Runs the automated suites and records pass/fail counts in evidence/test-results/summary.json.
// These are local test results, not chain evidence; the proof page labels them that way.
// Usage: pnpm test:record   (browser tests are read from apps/web e2e.json if present)
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ROOT, readJson, writeJson } from './lib.mjs'

const sdk = join(ROOT, 'packages', 'sdk')
const out = join(ROOT, 'evidence', 'test-results')
const suites = []

function vitest(name, kind, args) {
  const file = join(out, `${name.replace(/\W+/g, '-').toLowerCase()}.json`)
  try {
    execSync(`npx vitest run ${args} --reporter=json --outputFile="${file}"`, { cwd: sdk, stdio: 'pipe' })
  } catch {
    /* failures are recorded from the report */
  }
  const r = readJson(file, {})
  suites.push({ name, kind, passed: r.numPassedTests ?? 0, failed: (r.numFailedTests ?? 0) + (r.numTotalTests ? 0 : 1) })
}

vitest('SDK unit and property tests', 'unit / property (deterministic mock RPC)', '')
vitest('SDK integration on local anvil', 'integration (local chain, real signing)', '--config vitest.integration.config.ts')

const localForge = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'forge.exe' : 'forge')
const forge = existsSync(localForge) ? localForge : 'forge'
try {
  const raw = execSync(`"${forge}" test --json`, { cwd: join(ROOT, 'contracts'), stdio: 'pipe', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const json = JSON.parse(raw.slice(raw.indexOf('{')))
  let passed = 0
  let failed = 0
  for (const suite of Object.values(json)) {
    for (const t of Object.values(suite.test_results)) t.status === 'Success' ? passed++ : failed++
  }
  suites.push({ name: 'LastDollarSplitter contract tests', kind: 'contract (Foundry: unit, fuzz, invariant)', passed, failed })
} catch (e) {
  suites.push({ name: 'LastDollarSplitter contract tests', kind: 'contract (Foundry)', passed: 0, failed: 1, error: String(e.message).slice(0, 200) })
}

const e2eFile = join(out, 'e2e.json')
if (existsSync(e2eFile)) {
  const r = JSON.parse(readFileSync(e2eFile, 'utf8'))
  suites.push({
    name: 'Browser end-to-end (Playwright)',
    kind: 'browser (local anvil + labelled wallet stub, axe, 7 widths x 2 themes)',
    passed: r.stats?.expected ?? 0,
    failed: (r.stats?.unexpected ?? 0) + (r.stats?.flaky ?? 0),
  })
}

// The commit the suites ran against, plus whether the working tree had uncommitted changes.
const testedCommit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim().length > 0
const summary = { recordedAt: new Date().toISOString(), testedCommit, workingTreeClean: !dirty, suites }
writeJson(join(out, 'summary.json'), summary)
console.table(suites.map(({ name, passed, failed }) => ({ name, passed, failed })))
process.exit(suites.some((s) => s.failed) ? 1 : 0)
