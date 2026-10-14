import type { Metadata } from 'next'
import Link from 'next/link'
import { splitterDeployment } from '@/lib/network'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({ title: 'Security', description: 'LastDollar security model, review status and limitations.', path: '/security' })

export default function SecurityPage() {
  return (
    <article className="prose-ld mx-auto px-4 pb-20 pt-12 sm:px-6">
      <h1>Security</h1>
      <p>
        <strong>Review status:</strong> LastDollar has internal automated tests and has not had an external security audit. Treat it as early, open-source software and keep amounts modest.
      </p>
      <h2>Model</h2>
      <ul>
        <li>
          <strong>Non-custodial.</strong> Your wallet holds your keys and approves every transaction. The app and SDK only prepare requests and read chain data.
        </li>
        <li>
          <strong>One reviewed request per signature.</strong> Immediately before your wallet opens, the app re-reads your balance, nonce and fees and re-simulates the exact request. If the
          recipients, amounts or maximum debit would change, signing stops and you review the new terms.
        </li>
        <li>
          <strong>Chain is the source of truth.</strong> A payment is shown as verified only after its receipt is read and its transfer logs match what you reviewed. Missing receipts are shown as
          pending or unknown, never as success or failure.
        </li>
        <li>
          <strong>Mainnet only.</strong> The production app is pinned to Arc mainnet (chain 5042). It never switches your wallet network without your confirmation, and refuses to send from
          another chain.
        </li>
      </ul>
      <h2>The batch contract</h2>
      <p>
        LastDollarSplitter is about 60 lines of Solidity with no owner, no upgrade path, no fees and no receive function. It requires <code>msg.value</code> to equal the exact sum of payouts,
        forwards each amount in the same call, uses a reentrancy lock, and reverts the whole batch if any payout fails. It never reads its own balance, so a forced deposit cannot change
        accounting. Source: <code>contracts/src/LastDollarSplitter.sol</code>
        {splitterDeployment.address ? (
          <>
            ; deployed at <code>{splitterDeployment.address}</code>
          </>
        ) : null}
        .
      </p>
      <p>
        It is covered by 22 Foundry tests, including malicious and reverting receivers, reentrancy attempts, value mismatches, recipient limits, overflow, fuzzing and invariants. That is
        internal testing, not an audit.
      </p>
      <h2 id="limitations">Known limitations</h2>
      <ul>
        <li>Quotes are conditional. Fees can change between quote and inclusion; the maximum fee budget bounds what you authorise, not what you will pay.</li>
        <li>Wallets can rewrite gas limits and fee caps. LastDollar detects and reports this in the receipt but cannot prevent it.</li>
        <li>Send-max leaves a remainder: the unused fee budget, plus balance below one micro-USDC in ERC-20 mode.</li>
        <li>A reverted transaction still costs gas. Simulation reduces but does not eliminate this risk.</li>
        <li>History is local to one browser and covers only payments made through this app.</li>
        <li>Browser wallets are discovered via EIP-6963 and injected providers. WalletConnect and smart-contract-wallet batching are not supported in this version.</li>
        <li>Recipient names (ENS-style) are not resolved. Only 0x addresses are accepted.</li>
        <li>The splitter blocks payouts to itself and to the zero address, but cannot know whether an address is the one you meant.</li>
      </ul>
      <h2>Reporting a vulnerability</h2>
      <p>
        Please open a private security advisory on the GitHub repository rather than a public issue. More detail is in the <Link href="/docs/security">security documentation</Link>.
      </p>
    </article>
  )
}
