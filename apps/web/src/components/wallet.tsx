'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ChevronDown, Copy, ExternalLink, LogOut, Wallet as WalletIcon, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { classifyError } from '@lastdollar/arc'
import { Button, Callout, cx } from './ui'
import { addressUrl, shortAddress } from '@/lib/format'
import { appNetwork, isTestMode } from '@/lib/network'
import { useWallet } from '@/lib/use-arc'

function useConnectorList() {
  const connectors = useConnectors()
  // Prefer EIP-6963 announced wallets; keep the generic injected entry only if nothing announced.
  const announced = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected')
  return announced.length > 0 ? announced : connectors
}

export function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const connectors = useConnectorList()
  const connect = useConnect()
  const [error, setError] = useState<string>()
  const [pendingId, setPendingId] = useState<string>()
  const hasInjected = useSyncExternalStore(
    () => () => {},
    () => 'ethereum' in window,
    () => true,
  )
  const hasProvider = hasInjected || connectors.some((c) => c.id !== 'injected')

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setError(undefined); onOpenChange(o) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-soft focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Connect a wallet</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Connecting shares your public address with this page. It does not sign or send anything.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label="Close">
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <ul className="mt-5 space-y-2">
            {connectors.map((c) => (
              <li key={c.uid}>
                <button
                  type="button"
                  disabled={!!pendingId}
                  onClick={async () => {
                    setError(undefined)
                    setPendingId(c.uid)
                    try {
                      await connect.mutateAsync({ connector: c })
                      onOpenChange(false)
                    } catch (err) {
                      const e = classifyError(err)
                      setError(e.code === 'USER_REJECTED' ? 'The connection request was declined in your wallet.' : e.message)
                    } finally {
                      setPendingId(undefined)
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-left transition-colors hover:border-border-strong disabled:opacity-60"
                >
                  {c.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt="" className="size-7 rounded-md" />
                  ) : (
                    <span className="inline-flex size-7 items-center justify-center rounded-md bg-surface-2">
                      <WalletIcon className="size-4" aria-hidden />
                    </span>
                  )}
                  <span className="flex-1 font-medium">{c.id === 'injected' ? 'Browser wallet' : c.name}</span>
                  {pendingId === c.uid ? <span className="text-xs text-muted">Check your wallet…</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {!hasProvider ? (
            <Callout tone="warning" className="mt-4" icon={<AlertTriangle />} title="No browser wallet detected">
              Install an EVM wallet extension, or open this page inside your mobile wallet&apos;s built-in browser. WalletConnect is not supported in this version.
            </Callout>
          ) : null}
          {error ? (
            <Callout tone="danger" className="mt-4" role="alert">
              {error}
            </Callout>
          ) : null}
          <p className="mt-4 text-xs text-muted">LastDollar never asks for a recovery phrase or private key.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function WalletButton({ className }: { className?: string }) {
  const { address, isConnected, status } = useWallet()
  const disconnect = useDisconnect()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  if (!isConnected) {
    return (
      <>
        <Button size="sm" className={className} aria-label="Connect wallet" onClick={() => setOpen(true)} loading={status === 'reconnecting' || status === 'connecting'} loadingText="Connecting">
          <WalletIcon className="size-4" aria-hidden />
          Connect<span className="hidden sm:inline"> wallet</span>
        </Button>
        <ConnectDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }
  return (
    <div className={cx('relative', className)} ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium transition-colors hover:border-border-strong"
      >
        <span className="size-2 rounded-full bg-success" aria-hidden />
        <span className="font-mono text-xs">{shortAddress(address)}</span>
        <ChevronDown className="size-3.5 text-muted" aria-hidden />
      </button>
      {menu ? (
        <div role="menu" className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-soft">
          <p className="px-2.5 py-2 font-mono text-xs break-all text-muted">{address}</p>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2"
            onClick={() => {
              void navigator.clipboard.writeText(address!).catch(() => undefined)
              setMenu(false)
            }}
          >
            <Copy className="size-4" aria-hidden /> Copy address
          </button>
          {!isTestMode ? (
            <a role="menuitem" href={addressUrl(address!)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2">
              <ExternalLink className="size-4" aria-hidden /> View on explorer
            </a>
          ) : null}
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger hover:bg-surface-2"
            onClick={() => {
              disconnect.mutate()
              setMenu(false)
            }}
          >
            <LogOut className="size-4" aria-hidden /> Disconnect
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function NetworkPill() {
  const { isConnected, onAppChain } = useWallet()
  const wrong = isConnected && !onAppChain
  return (
    <span
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium',
        wrong ? 'border-warning/40 bg-warning-soft text-warning' : 'border-border bg-surface text-muted',
      )}
      title={wrong ? 'Your wallet is on a different network' : `${appNetwork.name} · chain ${appNetwork.chainId}`}
    >
      <span className={cx('size-1.5 rounded-full', wrong ? 'bg-warning' : isTestMode ? 'bg-warning' : 'bg-success')} aria-hidden />
      {wrong ? 'Wrong network' : isTestMode ? 'Test chain' : 'Arc mainnet'}
    </span>
  )
}

export function WrongNetworkBanner() {
  const { isConnected, onAppChain, walletChainId } = useWallet()
  const switchChain = useSwitchChain()
  const [error, setError] = useState<string>()
  if (!isConnected || onAppChain) return null
  return (
    <div className="border-b border-warning/30 bg-warning-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="flex items-start gap-2 text-sm text-warning" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Your wallet is on chain {walletChainId}. Payments here run on {appNetwork.name} (chain {appNetwork.chainId}). Nothing will be sent until you switch.
            {error ? <span className="block text-danger">{error}</span> : null}
          </span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          loading={switchChain.isPending}
          loadingText="Confirm in wallet"
          onClick={async () => {
            setError(undefined)
            try {
              await switchChain.mutateAsync({ chainId: appNetwork.chainId })
            } catch (err) {
              const e = classifyError(err)
              setError(e.code === 'USER_REJECTED' ? 'Switch declined in your wallet.' : `Could not switch: ${e.message}`)
            }
          }}
        >
          Switch to {appNetwork.name}
        </Button>
      </div>
    </div>
  )
}
