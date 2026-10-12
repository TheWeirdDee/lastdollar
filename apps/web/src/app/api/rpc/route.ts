import { arcMainnet } from '@lastdollar/arc'

/**
 * Same-origin, read-only relay to Arc's official RPC endpoints.
 *
 * Some browsers, extensions and networks block pages from calling crypto RPC hosts directly.
 * This relay lets the app read chain state through its own origin. It only forwards read
 * methods: it cannot send, sign or broadcast anything (wallets broadcast on their own).
 */
export const dynamic = 'force-dynamic'

const UPSTREAMS = arcMainnet.rpcUrls
const READ_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getBalance',
  'eth_call',
  'eth_estimateGas',
  'eth_getTransactionCount',
  'eth_getCode',
  'eth_maxPriorityFeePerGas',
  'eth_gasPrice',
  'eth_feeHistory',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'net_version',
])
const MAX_BODY = 64 * 1024

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown }

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

async function forward(body: string): Promise<Response | undefined> {
  for (const url of UPSTREAMS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) return res
    } catch {
      /* try the next official endpoint */
    }
  }
  return undefined
}

export async function POST(request: Request) {
  const text = await request.text()
  if (text.length > MAX_BODY) return Response.json(rpcError(null, -32600, 'Request too large'), { status: 413 })
  let payload: RpcRequest | RpcRequest[]
  try {
    payload = JSON.parse(text) as RpcRequest | RpcRequest[]
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 })
  }
  const calls = Array.isArray(payload) ? payload : [payload]
  if (calls.length === 0 || calls.length > 20) return Response.json(rpcError(null, -32600, 'Invalid batch size'), { status: 400 })
  const blocked = calls.find((c) => !c || typeof c !== 'object' || typeof c.method !== 'string' || !READ_METHODS.has(c.method))
  if (blocked) {
    const invalid = blocked as RpcRequest
    return Response.json(rpcError(invalid?.id, -32601, `Method not allowed through this read-only relay: ${String(invalid?.method)}`), { status: 403 })
  }

  const upstream = await forward(text)
  if (!upstream) return Response.json(rpcError(calls[0]?.id, -32603, 'All Arc RPC endpoints are unreachable right now'), { status: 502 })
  return new Response(await upstream.text(), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
