import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy', description: 'What LastDollar stores, where, and what it never collects.' }

export default function PrivacyPage() {
  return (
    <article className="prose-ld mx-auto px-4 pb-20 pt-12 sm:px-6">
      <h1>Privacy</h1>
      <p>
        This page describes what the LastDollar web app actually does with data, as implemented in the public source. It has not been reviewed by a lawyer and is not a contract.
      </p>
      <h2>No accounts, no backend</h2>
      <p>
        LastDollar has no user accounts, no login, no database and no application server that receives your data. The pages are served as static files and run in your browser.
      </p>
      <h2>What is stored in your browser</h2>
      <ul>
        <li>
          <strong>Theme preference</strong> (light, dark or system) in localStorage under <code>lastdollar-theme</code>.
        </li>
        <li>
          <strong>App-tracked payments</strong>: for payments you make with this app, the transaction hash, chain, your public address, recipients, amounts, quoted fees and status, under keys
          beginning <code>lastdollar:v1:history</code>. You can clear them on the History page.
        </li>
        <li>
          <strong>A short-lived signing lock</strong> (<code>lastdollar:v1:lock</code>) that stops the same account signing two payments at once from different tabs.
        </li>
        <li>
          <strong>Wallet connection state</strong> kept by the wagmi library so the app can reconnect on refresh. Reconnecting never signs anything.
        </li>
      </ul>
      <p>None of this leaves your browser through LastDollar. None of it is a secret: it contains no private keys, recovery phrases or signatures.</p>
      <h2>Who else sees requests</h2>
      <ul>
        <li>
          <strong>Arc RPC providers.</strong> To read balances, estimate fees and fetch receipts, your browser sends requests containing public addresses and transaction hashes to the Arc RPC
          endpoint (by default <code>rpc.mainnet.arc.io</code>). That provider can see your IP address and those requests.
        </li>
        <li>
          <strong>Your wallet.</strong> Your wallet extension sees the transactions you are asked to sign and follows its own privacy policy.
        </li>
        <li>
          <strong>The hosting provider.</strong> The site host receives standard web request logs (IP address, user agent, requested path).
        </li>
        <li>
          <strong>The Arc explorer</strong>, only if you follow a link to it.
        </li>
      </ul>
      <h2>What LastDollar never does</h2>
      <ul>
        <li>Ask for, store or transmit a private key or recovery phrase.</li>
        <li>Run analytics, tracking pixels, advertising or third-party scripts.</li>
        <li>Sign or send a transaction without your explicit approval in your wallet.</li>
      </ul>
      <h2>Public by nature</h2>
      <p>
        Transactions on Arc are public and permanent. Anyone can see the sender, recipients, amounts and fees of a payment once it is on chain. Clearing local history does not change that.
      </p>
      <p>
        Questions or corrections: open an issue in the <Link href="/developers">public repository</Link>.
      </p>
    </article>
  )
}
