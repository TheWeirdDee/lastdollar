// Copies public evidence and documentation from the repository into src/generated so the app
// renders exactly what is committed. Runs before dev and build.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..', '..')
const out = resolve(here, '..', 'src', 'generated')
mkdirSync(join(out, 'docs'), { recursive: true })

const read = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback)
writeFileSync(join(out, 'proofs.json'), JSON.stringify(read(join(root, 'evidence', 'mainnet', 'proofs.json'), { schema: 1, entries: [] }), null, 2))
writeFileSync(join(out, 'deployment.json'), JSON.stringify(read(join(root, 'evidence', 'mainnet', 'splitter-deployment.json'), {}), null, 2))
writeFileSync(join(out, 'network-check.json'), JSON.stringify(read(join(root, 'evidence', 'network-check.json'), {}), null, 2))
writeFileSync(join(out, 'test-summary.json'), JSON.stringify(read(join(root, 'evidence', 'test-results', 'summary.json'), {}), null, 2))

const docsDir = join(root, 'docs')
const docs = []
for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort()) {
  const body = readFileSync(join(docsDir, file), 'utf8')
  const title = (/^#\s+(.+)$/m.exec(body)?.[1] ?? file).trim()
  const slug = file.replace(/\.md$/, '')
  writeFileSync(join(out, 'docs', file), body)
  docs.push({ slug, title, file })
}
writeFileSync(join(out, 'docs-index.json'), JSON.stringify(docs, null, 2))
console.log(`synced ${docs.length} docs and evidence into src/generated`)
