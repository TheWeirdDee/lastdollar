// Deploys LastDollarSplitter with a browser wallet (MetaMask). Serves a local page on
// http://localhost:9545 that asks the wallet to sign the contract creation. No key ever leaves the
// wallet. After broadcast, this script verifies the runtime bytecode on two RPCs and writes
// evidence/mainnet/splitter-deployment.json.
// Usage: pnpm deploy:browser
import { createServer } from 'node:http'
import { keccak256 } from 'viem'
import { arcMainnet, formatUsdc } from '@lastdollar/arc'
import { DEPLOYMENT_FILE, PRIMARY_RPC, SECONDARY_RPC, assertMainnet, clientFor, readJson, splitterArtifact, writeJson } from './lib.mjs'

const PORT = 9545
if (readJson(DEPLOYMENT_FILE)?.address && !process.argv.includes('--force')) {
  console.log('Splitter already deployed; see', DEPLOYMENT_FILE)
  process.exit(0)
}
const art = splitterArtifact()
const primary = clientFor(PRIMARY_RPC)
const secondary = clientFor(SECONDARY_RPC)
await assertMainnet(primary, 'primary RPC')
await assertMainnet(secondary, 'verification RPC')
const block = await primary.getBlock()
const maxFeePerGas = (block.baseFeePerGas * 125n) / 100n

const page = `<!doctype html><meta charset="utf-8"><title>Deploy LastDollarSplitter</title>
<style>body{font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px;background:#0c0d0f;color:#edede9}button{font:inherit;padding:12px 18px;border-radius:10px;border:0;background:#8098ff;color:#0c0d0f;cursor:pointer}button:disabled{opacity:.5}code{word-break:break-all}.box{border:1px solid #2a2e34;border-radius:12px;padding:16px;margin:16px 0}</style>
<h1>Deploy LastDollarSplitter on Arc mainnet</h1>
<div class="box">Network: Arc (chain 5042)<br>Action: contract creation (no recipient, no value)<br>Expected fee: about ${formatUsdc(441_693n * block.baseFeePerGas)} USDC; maximum <span id="max"></span> USDC<br>Runtime bytecode keccak: <code>${art.runtimeHash}</code></div>
<button id="go">Connect and deploy</button>
<p id="log"></p>
<script>
const log = (t) => (document.getElementById('log').innerHTML += t + '<br>')
const DATA = '${art.bytecode}'
document.getElementById('go').onclick = async () => {
  const btn = document.getElementById('go'); btn.disabled = true
  try {
    const eth = window.ethereum
    if (!eth) throw new Error('No browser wallet found. Open this page in the Chrome profile that has MetaMask.')
    const [from] = await eth.request({ method: 'eth_requestAccounts' })
    log('Account: ' + from)
    if ((await eth.request({ method: 'eth_chainId' })) !== '0x13b2') {
      log('Switching wallet to Arc mainnet...')
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x13b2' }] })
    }
    const est = await fetch('/estimate?from=' + from).then((r) => r.json())
    if (est.error) throw new Error(est.error)
    document.getElementById('max').textContent = est.maxUsdc
    log('Gas limit ' + est.gas + '. MetaMask sets the fee (expected about ' + est.expectedUsdc + ' USDC). Confirm in MetaMask.')
    const hash = await eth.request({ method: 'eth_sendTransaction', params: [{ from, data: DATA, gas: est.gasHex }] })
    log('Broadcast: <code>' + hash + '</code>. Verifying...')
    const res = await fetch('/done?hash=' + hash + '&from=' + from).then((r) => r.json())
    log(res.ok ? 'Deployed at <code>' + res.address + '</code>. Bytecode verified on two RPCs. You can close this tab.' : 'Problem: ' + res.error)
  } catch (e) { log('Stopped: ' + (e.message || e)); btn.disabled = false }
}
</script>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const json = (o) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
  }
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(page)
    }
    if (url.pathname === '/estimate') {
      const from = url.searchParams.get('from')
      const [gas, balance] = await Promise.all([primary.estimateGas({ account: from, data: art.bytecode }), primary.getBalance({ address: from })])
      const limit = (gas * 12n) / 10n
      if (balance < limit * maxFeePerGas) return json({ error: 'Balance is below the maximum deployment fee.' })
      return json({ gas: limit, gasHex: `0x${limit.toString(16)}`, maxUsdc: formatUsdc(limit * maxFeePerGas), expectedUsdc: formatUsdc(gas * block.baseFeePerGas) })
    }
    if (url.pathname === '/done') {
      const hash = url.searchParams.get('hash')
      console.log(`Broadcast ${hash}`)
      const receipt = await primary.waitForTransactionReceipt({ hash, timeout: 120_000 })
      if (receipt.status !== 'success' || !receipt.contractAddress) return json({ ok: false, error: `receipt status ${receipt.status}` })
      const [c1, c2] = await Promise.all([
        primary.getCode({ address: receipt.contractAddress }),
        secondary.getCode({ address: receipt.contractAddress, blockNumber: receipt.blockNumber }),
      ])
      const meta = typeof art.metadata === 'string' ? JSON.parse(art.metadata) : art.metadata
      const record = {
        network: { name: 'Arc', chainId: 5042 },
        address: receipt.contractAddress,
        deployer: receipt.from,
        signer: 'browser wallet (MetaMask)',
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        fee18: receipt.gasUsed * receipt.effectiveGasPrice,
        compiler: meta.compiler.version,
        settings: { optimizer: meta.settings.optimizer, evmVersion: meta.settings.evmVersion, metadata: meta.settings.metadata },
        source: 'contracts/src/LastDollarSplitter.sol',
        localRuntimeKeccak: art.runtimeHash,
        onchainRuntimeKeccak: keccak256(c1),
        runtimeMatches: keccak256(c1) === art.runtimeHash,
        independentRpcRuntimeMatches: keccak256(c2) === art.runtimeHash,
        explorer: `${arcMainnet.explorerUrl}/address/${receipt.contractAddress}`,
        explorerVerification: 'pending',
        deployedAt: new Date().toISOString(),
      }
      writeJson(DEPLOYMENT_FILE, record)
      console.log(JSON.stringify(record, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
      json({ ok: record.runtimeMatches && record.independentRpcRuntimeMatches, address: record.address, error: record.runtimeMatches ? undefined : 'bytecode mismatch' })
      setTimeout(() => process.exit(0), 500)
      return
    }
    res.writeHead(404).end()
  } catch (e) {
    json({ error: String(e.shortMessage ?? e.message) })
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`Open http://localhost:${PORT} in the browser that has MetaMask.`))
