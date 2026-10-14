import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import index from '@/generated/docs-index.json'

/** Public documentation, in reading order. Internal working files are not published as pages. */
const ORDER = ['architecture', 'sdk', 'payment-math', 'economics', 'security', 'network-verification', 'mainnet-proof', 'testing', 'deployment', 'design-direction']
const HIDDEN = new Set(['manual-steps', 'submission'])

/** One-line summaries used on the docs index and as each doc page's description. */
export const docBlurbs: Record<string, string> = {
  architecture: 'Components, the payment lifecycle, trust boundaries and the evidence pipeline.',
  sdk: 'Install, configure, and use every SDK function. Units, errors, wallet behaviour.',
  'payment-math': 'The integer arithmetic behind affordability, send-max, fee budgets and rounding.',
  economics: 'What a payment costs on Arc, measured fees, batch costs and why send-max leaves a remainder.',
  security: 'Trust boundaries, threat model, contract properties and known limitations.',
  'network-verification': 'Each Arc mainnet fact, where it came from, and how it was checked live.',
  'mainnet-proof': 'How mainnet evidence is produced, verified and re-checked.',
  testing: 'Unit, contract, integration and browser test layers, and how to run them.',
  deployment: 'Deploying the web app and the splitter contract.',
  'design-direction': 'Reference research and the visual system behind the interface.',
}

export interface DocMeta {
  slug: string
  title: string
  file: string
}

export const docs: DocMeta[] = (index as DocMeta[])
  .filter((d) => !HIDDEN.has(d.slug))
  .sort((a, b) => {
    const ia = ORDER.indexOf(a.slug)
    const ib = ORDER.indexOf(b.slug)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

export async function readDoc(slug: string): Promise<{ meta: DocMeta; body: string } | undefined> {
  const meta = docs.find((d) => d.slug === slug)
  if (!meta) return undefined
  const body = await readFile(join(process.cwd(), 'src', 'generated', 'docs', meta.file), 'utf8')
  return { meta, body }
}
