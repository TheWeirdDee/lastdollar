import { SCALE } from '@lastdollar/arc'
import { Ban, BadgeCheck, Beaker, Calculator, CircleDashed, ExternalLink, FlaskConical, Network, TerminalSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Reverify } from './reverify'
import { CodeBlock } from '@/components/code'
import { Badge, Card } from '@/components/ui'
import networkCheck from '@/generated/network-check.json'
import testSummary from '@/generated/test-summary.json'
import { computationEntries, hasMainnetEvidence, mainnetEntries, rejectionEntries, simulationEntries, type MainnetEntry } from '@/lib/evidence'
import { addressUrl, formatTime, gweiString, shortAddress, shortHash, txUrl, usd, usdExact } from '@/lib/format'
import { APP_VERSION, REPO_URL, splitterDeployment } from '@/lib/network'

export const metadata: Metadata = {
  title: 'Mainnet proof',
  description: 'Real Arc mainnet transactions, verified on two RPC providers, with simulations and tests labelled separately.',
}

type NetworkCheck = {
  checkedAt?: string
  passed?: boolean
  rpcs?: { url: string; chainId?: number; latestBlock?: string; baseFeePerGas?: string; nextBaseFeeFromExtraData?: string; error?: string }[]
  token?: { address: string; decimals: number; symbol: string; name: string }
  balanceViews?: { address: string; native18: string; token6: string; truncationHolds: boolean; subMicro18: string }[]
  restrictions?: { zeroAddressValueTransfer?: string; nativeTransferGasToEoa?: string }
}
type TestSummary = { recordedAt?: string; suites?: { name: string; passed: number; failed: number; kind: string }[] }

const nc = networkCheck as NetworkCheck
const ts = testSummary as TestSummary

function Section({ id, icon, title, kind, children }: { id: string; icon: React.ReactNode; title: string; kind: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
          <span className="text-accent [&>svg]:size-5">{icon}</span>
          {title}
        </h2>
        {kind}
      </div>
      {children}
    </section>
  )
}

function EntryCard({ e }: { e: MainnetEntry }) {
  const budget = BigInt(e.quote.maxFeeBudget18)
  const fee = BigInt(e.actual.fee18)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{e.label}</p>
          <p className="mt-0.5 text-xs text-muted">
            {e.kind} · {e.mode === 'native' ? 'native' : 'ERC-20'} · block {e.blockNumber}
            {e.blockTimestamp ? ` · ${formatTime(Number(e.blockTimestamp) * 1000)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="success" icon={<BadgeCheck className="size-3" aria-hidden />}>
            Mainnet · {e.result}
          </Badge>
          {e.signer ? <Badge tone="accent">{e.signer}</Badge> : <Badge tone="warning">Origin not recorded</Badge>}
          {e.verification.rpcsAgree ? <Badge tone="neutral">2 RPCs agree</Badge> : <Badge tone="danger">RPCs disagree</Badge>}
        </div>
      </div>
      <a href={txUrl(e.hash)} target="_blank" rel="noreferrer" className="mt-3 flex max-w-full items-start gap-1 font-mono text-xs text-accent underline underline-offset-4">
        <span className="min-w-0 break-all">{e.hash}</span> <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
      </a>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Recipient</th>
              <th className="px-3 py-2 text-right font-medium">Intended</th>
              <th className="px-3 py-2 text-right font-medium">Delivered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {e.intended.map((l, i) => (
              <tr key={`${l.recipient}-${i}`}>
                <td className="px-3 py-2 font-mono text-xs">{shortAddress(l.recipient, 6)}</td>
                <td className="tabular px-3 py-2 text-right">{usdExact(l.amount18)}</td>
                <td className="tabular px-3 py-2 text-right">{e.delivered[i] ? usdExact(e.delivered[i]!.amount18) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Estimated fee</dt>
          <dd className="tabular">{usd(e.quote.estimatedFee18)} USDC</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Maximum fee budget</dt>
          <dd className="tabular">{usd(e.quote.maxFeeBudget18)} USDC</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Actual fee</dt>
          <dd className="tabular">
            {usdExact(e.actual.fee18)} USDC <span className={fee <= budget ? 'text-success' : 'text-danger'}>{fee <= budget ? '(within budget)' : '(over budget)'}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Gas used / limit</dt>
          <dd className="tabular">
            {e.actual.gasUsed} / {e.quote.gasLimit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Effective gas price</dt>
          <dd className="tabular">{gweiString(e.actual.effectiveGasPrice)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Sender after</dt>
          <dd className="tabular">{usdExact(e.sender.after18)} USDC</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-border pt-4">
        <Reverify hash={e.hash} fee18={e.actual.fee18} delivered={e.delivered} />
      </div>
    </Card>
  )
}

export default function ProofPage() {
  const erc20Max = mainnetEntries.find((e) => e.id === 'erc20-max')
  const nativeMax = mainnetEntries.find((e) => e.id === 'native-max')
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-12 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="eyebrow">Evidence</p>
        <h1 className="display mt-2 text-[clamp(2.25rem,5vw,3.5rem)]">Mainnet proof</h1>
        <p className="mt-4 text-lg text-muted">
          {hasMainnetEvidence
            ? 'Each capability listed below is backed by a real Arc mainnet transaction, reconciled by the SDK and checked again on a second, independent RPC provider.'
            : 'Mainnet transaction proofs have not been recorded yet. This page shows only what exists today: the verified network configuration and local test results.'}{' '}
          Simulations, computations and tests are labelled for what they are.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge tone={hasMainnetEvidence ? 'success' : 'warning'}>{mainnetEntries.length} mainnet transactions</Badge>
          <Badge tone="neutral">{simulationEntries.length} dry runs</Badge>
          <Badge tone="neutral">{rejectionEntries.length} node rejections</Badge>
          <Badge tone="neutral">{computationEntries.length} computations</Badge>
          <Badge tone="neutral">Build {APP_VERSION}</Badge>
        </div>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {[
            ['#network', 'Network'],
            ['#contract', 'Contract'],
            ['#transactions', 'Transactions'],
            ['#baselines', 'Baselines'],
            ['#residuals', 'Residuals'],
            ['#tests', 'Tests'],
            ['#reproduce', 'Reproduce'],
            ['#limits', 'Limits'],
          ].map(([h, l]) => (
            <a key={h} href={h} className="text-accent underline-offset-4 hover:underline">
              {l}
            </a>
          ))}
        </nav>
      </header>

      <Section id="network" icon={<Network />} title="Verified network configuration" kind={<Badge tone="neutral">Read-only RPC checks{nc.checkedAt ? ` · ${formatTime(Date.parse(nc.checkedAt))}` : ''}</Badge>}>
        {nc.rpcs ? (
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="p-5">
              <dl className="divide-y divide-border text-sm">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">Chain ID</dt>
                  <dd className="tabular">5042 (Arc mainnet)</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">USDC ERC-20 interface</dt>
                  <dd className="min-w-0 font-mono text-xs break-all">{nc.token?.address}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">Decimals</dt>
                  <dd>Native 18 · ERC-20 {nc.token?.decimals}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">Base fee at check</dt>
                  <dd className="tabular">{gweiString(nc.rpcs[0]?.baseFeePerGas)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">Native transfer to EOA</dt>
                  <dd className="tabular">{nc.restrictions?.nativeTransferGasToEoa} gas</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="text-muted">Value to zero address</dt>
                  <dd className="text-right text-xs">{nc.restrictions?.zeroAddressValueTransfer}</dd>
                </div>
              </dl>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium">RPC providers reporting chain 5042</p>
              <ul className="mt-2 space-y-1 text-xs">
                {nc.rpcs.map((r) => (
                  <li key={r.url} className="flex flex-wrap justify-between gap-x-3">
                    <span className="min-w-0 truncate font-mono">{r.url.replace('https://', '')}</span>
                    <span className={r.chainId === 5042 ? 'text-success' : 'text-warning'}>{r.chainId === 5042 ? `block ${r.latestBlock}` : (r.error ?? 'unreachable')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-medium">Balance views at one block</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {nc.balanceViews?.map((b) => (
                  <li key={b.address}>
                    <span className="font-mono">{shortAddress(b.address)}</span>: floor({usdExact(b.native18)}) = {usd(BigInt(b.token6) * SCALE)} {b.truncationHolds ? 'holds' : 'FAILS'}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted">No network check recorded in this build.</p>
        )}
      </Section>

      <Section
        id="contract"
        icon={<BadgeCheck />}
        title="LastDollarSplitter deployment"
        kind={<Badge tone={splitterDeployment.address ? 'success' : 'warning'}>{splitterDeployment.address ? 'Deployed on mainnet' : 'Not yet deployed'}</Badge>}
      >
        {splitterDeployment.address ? (
          <Card className="p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Address</dt>
                <dd>
                  <a href={addressUrl(splitterDeployment.address)} className="font-mono text-xs break-all text-accent underline underline-offset-4">
                    {splitterDeployment.address}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Deployment transaction</dt>
                <dd>
                  <a href={txUrl(splitterDeployment.transactionHash!)} className="font-mono text-xs text-accent underline underline-offset-4">
                    {shortHash(splitterDeployment.transactionHash)}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Compiler</dt>
                <dd className="font-mono text-xs">{splitterDeployment.compiler}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Runtime bytecode</dt>
                <dd>{splitterDeployment.runtimeMatches ? 'Matches the local build of contracts/src/LastDollarSplitter.sol' : 'Mismatch'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Explorer source verification</dt>
                <dd>{splitterDeployment.explorerVerification === 'verified' ? 'Verified on the Arc explorer' : 'Not verified on the explorer; reproduce the bytecode match with pnpm verify:evidence.'}</dd>
              </div>
            </dl>
          </Card>
        ) : (
          <Card className="flex gap-3 p-5 text-sm text-muted">
            <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            The splitter contract is tested locally (22 Foundry tests including fuzz and invariants) but has not been deployed to Arc mainnet yet. Batch payments stay disabled in the app until it
            is.
          </Card>
        )}
      </Section>

      <Section id="transactions" icon={<BadgeCheck />} title="Mainnet transactions" kind={<Badge tone={hasMainnetEvidence ? 'success' : 'warning'}>Arc mainnet · real USDC</Badge>}>
        {hasMainnetEvidence ? (
          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            {mainnetEntries.map((e) => (
              <EntryCard key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <Card className="flex gap-3 p-5 text-sm text-muted">
            <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            No mainnet transactions have been recorded yet. This section lists only transactions that exist on Arc mainnet and verify on two RPC providers; nothing is shown in their place.
          </Card>
        )}
      </Section>

      <Section id="baselines" icon={<Calculator />} title="Baselines" kind={<Badge tone="neutral">Dry runs and computations: free checks, not payments</Badge>}>
        <p className="mb-5 max-w-3xl text-sm text-muted">
          A naive full-balance send was simulated with the same gas limit and fee caps LastDollar used. On Arc, <code>eth_call</code> accepted it, so simulation alone does not show the
          failure. A real signed naive native send was then submitted to mainnet: the node rejected it before inclusion, at no cost. A competent fee-aware approach written with plain viem is
          computed for comparison: it also works, which is the point. LastDollar&apos;s value is the full lifecycle, not a secret formula.
        </p>
        {simulationEntries.length || computationEntries.length || rejectionEntries.length ? (
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {rejectionEntries.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{r.label}</p>
                  <Badge tone="danger" icon={<Ban className="size-3" aria-hidden />}>
                    Mainnet · rejected before inclusion
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Tried to send the full balance of {usdExact(r.balance18)} USDC with a {r.feeCaps.gasLimit}-gas limit at {gweiString(r.feeCaps.maxFeePerGas)}.
                </p>
                <p className="mt-2 rounded-lg bg-surface-2 p-2 font-mono text-xs break-all">{r.outcome.message}</p>
                <p className="mt-2 text-xs text-muted">{r.method}</p>
              </Card>
            ))}
            {simulationEntries.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.label}</p>
                  <Badge tone="warning" icon={<FlaskConical className="size-3" aria-hidden />}>
                    Dry run, nothing sent · {s.outcome.simulated === 'success' ? 'accepted' : 'rejected'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Tried to send {usdExact(s.attemptedAmount18)} USDC from a balance of {usdExact(s.balance18)} at block {s.blockNumber}.
                </p>
                <p className="mt-2 rounded-lg bg-surface-2 p-2 font-mono text-xs break-all">{s.outcome.message}</p>
                <p className="mt-2 text-xs text-muted">{s.method}</p>
                {s.note ? <p className="mt-2 text-xs text-warning">{s.note}</p> : null}
              </Card>
            ))}
            {computationEntries.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{c.label}</p>
                  <Badge tone="neutral" icon={<Calculator className="size-3" aria-hidden />}>
                    Computation
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Plain viem amount</dt>
                    <dd className="tabular">{usdExact(c.baseline.amount18)}</dd>
                    <dd className="text-xs text-muted">budget {usd(c.baseline.budget18)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">LastDollar amount</dt>
                    <dd className="tabular">{usdExact(c.lastDollar.amount18)}</dd>
                    <dd className="text-xs text-muted">budget {usd(c.lastDollar.budget18)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">{c.note}</p>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Baselines are recorded alongside the send-max proofs and appear here once those run.</p>
        )}
      </Section>

      <Section id="residuals" icon={<Calculator />} title="Native versus ERC-20 residuals" kind={<Badge tone="neutral">Measured from mainnet receipts</Badge>}>
        {erc20Max && nativeMax ? (
          <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            {[erc20Max, nativeMax].map((e) => {
              const unused = BigInt(e.quote.maxFeeBudget18) - BigInt(e.actual.fee18)
              const rounding = e.mode === 'erc20' ? BigInt(e.sender.after18) - unused : 0n
              return (
                <Card key={e.id} className="p-5">
                  <p className="font-semibold">{e.mode === 'erc20' ? 'ERC-20 send-max' : 'Native send-max'}</p>
                  <dl className="mt-3 divide-y divide-border text-sm">
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">Left in wallet</dt>
                      <dd className="tabular">{usdExact(e.sender.after18)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">Unused fee budget</dt>
                      <dd className="tabular">{usdExact(unused)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">Token-rounding remainder</dt>
                      <dd className="tabular">{usdExact(rounding)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    {e.mode === 'erc20'
                      ? 'Remaining balance equals unused fee budget plus this additive token-rounding remainder. The final balance’s sub-micro portion alone is not necessarily the rounding remainder.'
                      : 'Native value keeps 18-decimal precision, so token-rounding remainder is zero and the remainder is the unused fee budget.'}
                  </p>
                </Card>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">Appears once both send-max proofs exist on mainnet.</p>
        )}
      </Section>

      <Section id="tests" icon={<Beaker />} title="Automated tests" kind={<Badge tone="neutral">Local runs, not chain evidence</Badge>}>
        {ts.suites?.length ? (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Suite</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 text-right font-medium">Passed</th>
                  <th className="px-4 py-2 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ts.suites.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-muted">{s.kind}</td>
                    <td className="tabular px-4 py-2 text-right">{s.passed}</td>
                    <td className="tabular px-4 py-2 text-right">{s.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ts.recordedAt ? <p className="border-t border-border px-4 py-2 text-xs text-muted">Recorded {formatTime(Date.parse(ts.recordedAt))}</p> : null}
          </Card>
        ) : (
          <p className="text-sm text-muted">Run the test commands below to reproduce.</p>
        )}
      </Section>

      <Section id="reproduce" icon={<TerminalSquare />} title="Reproduce" kind={<Badge tone="neutral">Anyone, no wallet needed</Badge>}>
        <CodeBlock
          title="shell"
          code={`git clone ${REPO_URL} && cd lastdollar
pnpm install && pnpm sdk:build
pnpm verify:network      # re-run the Arc mainnet validation gates
pnpm verify:evidence     # re-check every proof on two RPC providers
pnpm test && pnpm test:contracts && pnpm test:integration`}
        />
        <p className="mt-3 text-sm text-muted">
          Machine-readable evidence:{' '}
          <a className="text-accent underline underline-offset-4" href={`${REPO_URL}/blob/main/evidence/mainnet/proofs.json`}>
            evidence/mainnet/proofs.json
          </a>
          ,{' '}
          <a className="text-accent underline underline-offset-4" href={`${REPO_URL}/blob/main/evidence/network-check.json`}>
            evidence/network-check.json
          </a>
          .
        </p>
      </Section>

      <Section id="limits" icon={<CircleDashed />} title="What this evidence does not show" kind={null}>
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Proof transactions were signed by local proof wallets through the SDK, the same code the app runs, rather than through a browser wallet extension.</li>
          <li>Transfers moved value between wallets controlled for this proof. They demonstrate mechanics, not adoption or third-party usage.</li>
          <li>The splitter contract has internal tests and no external audit.</li>
          <li>Fee estimates reflect conditions at the time; a quote is never a fee guarantee.</li>
          <li>
            Two RPC providers agreeing is strong but not absolute independence. See <Link href="/docs/mainnet-proof" className="text-accent underline underline-offset-4">the proof methodology</Link>.
          </li>
        </ul>
      </Section>
    </div>
  )
}
