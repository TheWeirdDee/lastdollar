import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy', description: 'What LastDollar stores, where, and what it never collects.' }

export default function PrivacyPage() {
  return (
    <article className="prose-ld mx-auto px-4 pb-20 pt-12 sm:px-6">
      <h1>Privacy</h1>
      <p>
        This page describes what the LastDollar web app actually does with data, as implemented in the public source. It has not been reviewed by a lawyer and is not a contract.
      </p>
      <h2>No accounts, no database</h2>
      <p>
        LastDollar has no user accounts, no login and no database. Pages run in your browser. The only server code is a read-only relay at <code>/api/rpc</code> that forwards chain reads
        (balances, fee data, receipts) to Arc&apos;s official RPC endpoints when your browser cannot reach them directly. It cannot send or sign anything, and it stores nothing.
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
          <strong>Review snapshots</strong>: just before your wallet opens, the exact public terms you reviewed (recipients, amounts, gas limit and fee caps) are saved under keys
          beginning <code>lastdollar:v1:review</code>, so a later receipt can be compared with what you approved. They expire after 30 days and are removed when you clear history for that
          account.
        </li>
        <li>
          <strong>A short-lived signing lock</strong> (<code>lastdollar:v1:lock</code>) that stops the same account signing two payments at once from different tabs.
        </li>
        <li>
          <strong>Wallet connection state</strong> kept by the wagmi library so the app can reconnect on refresh. Reconnecting never signs anything.
        </li>
      </ul>
      <p>LastDollar does not intentionally transmit this local history to an application database, but browser extensions, backups, device sharing, and the providers described below may have their own data handling. None of these values is a private key, recovery phrase or signature.</p>
      <h2>Who else sees requests</h2>
      <ul>
        <li>
          <strong>Arc RPC providers and the relay.</strong> To read balances, estimate fees and fetch receipts, requests containing public addresses and transaction hashes go through the
          app&apos;s relay (hosted on Vercel) or directly from your browser to Arc&apos;s official RPC endpoints. The host and the RPC provider can see those requests; the relay does not log or keep them.
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
        Questions or corrections: open an issue in the <a href="https://github.com/TheWeirdDee/lastdollar/issues" target="_blank" rel="noreferrer">public repository</a>.
      </p>
    </article>
  )
}
