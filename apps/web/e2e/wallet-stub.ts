import type { Page } from '@playwright/test'

/**
 * TEST DOUBLE. An EIP-1193 provider announced via EIP-6963 that forwards to the local anvil
 * chain, whose dev accounts are unlocked. Tests control it through window.__stub:
 * account, chainId, reject (decline the next request), and a log of every method called.
 */
export const ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
] as const

export async function installWalletStub(page: Page, opts: { rpcUrl: string; account?: string; chainId?: number }) {
  await page.addInitScript(
    ({ rpcUrl, account, chainId }) => {
      type Listener = (...args: unknown[]) => void
      const listeners: Record<string, Listener[]> = {}
      const state = {
        account,
        chainId,
        // Like a real wallet, remember the site permission across reloads (per tab).
        connected: sessionStorage.getItem('__stub_connected') === '1',
        reject: false,
        log: [] as string[],
      }
      ;(window as unknown as { __stub: typeof state }).__stub = state
      const emit = (event: string, ...args: unknown[]) => (listeners[event] ?? []).forEach((l) => l(...args))
      ;(window as unknown as { __stubEmit: typeof emit }).__stubEmit = emit
      let id = 0
      const forward = async (method: string, params: unknown[]) => {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        })
        const json = await res.json()
        if (json.error) throw Object.assign(new Error(json.error.message), { code: json.error.code, data: json.error.data })
        return json.result
      }
      const provider = {
        isLastDollarTestStub: true,
        async request({ method, params = [] }: { method: string; params?: unknown[] }) {
          state.log.push(method)
          const decline = () => {
            state.reject = false
            throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
          }
          switch (method) {
            case 'eth_requestAccounts':
              if (state.reject) decline()
              state.connected = true
              sessionStorage.setItem('__stub_connected', '1')
              return [state.account]
            case 'eth_accounts':
              return state.connected ? [state.account] : []
            case 'eth_chainId':
              return `0x${state.chainId.toString(16)}`
            case 'wallet_switchEthereumChain': {
              if (state.reject) decline()
              const target = parseInt((params[0] as { chainId: string }).chainId, 16)
              state.chainId = target
              emit('chainChanged', `0x${target.toString(16)}`)
              return null
            }
            case 'wallet_requestPermissions':
              return null
            case 'wallet_revokePermissions':
              state.connected = false
              sessionStorage.removeItem('__stub_connected')
              return null
            case 'eth_sendTransaction': {
              if (state.reject) decline()
              const tx = { ...(params[0] as Record<string, unknown>), from: state.account }
              return forward('eth_sendTransaction', [tx])
            }
            default:
              return forward(method, params as unknown[])
          }
        },
        on(event: string, l: Listener) {
          ;(listeners[event] ??= []).push(l)
        },
        removeListener(event: string, l: Listener) {
          listeners[event] = (listeners[event] ?? []).filter((x) => x !== l)
        },
      }
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({
              info: { uuid: '6b1c0f2e-0000-4000-8000-000000000001', name: 'Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'test.lastdollar' },
              provider,
            }),
          }),
        )
      window.addEventListener('eip6963:requestProvider', announce)
      announce()
    },
    { rpcUrl: opts.rpcUrl, account: opts.account ?? ACCOUNTS[0], chainId: opts.chainId ?? 5042 },
  )
}

export async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet' }).first().click()
  await page.getByRole('button', { name: /Test Wallet/ }).click()
  await page.getByRole('button', { name: /0xf39F|0x7099|0x3C44/ }).first().waitFor()
}

export async function anvil(method: string, params: unknown[] = []) {
  const res = await fetch('http://127.0.0.1:8547', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result
}
