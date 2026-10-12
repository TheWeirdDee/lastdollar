import { expect, test } from '@playwright/test'
import { ACCOUNTS, connect, installWalletStub } from './wallet-stub'

const RPC = 'http://127.0.0.1:8547'

test.describe('wallet states', () => {
  test('disconnected app explains itself and never requests a signature', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC })
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Connect a wallet to start' })).toBeVisible()
    await expect(page.getByText(/Test network/).first()).toBeVisible()
    const log = await page.evaluate(() => (window as unknown as { __stub: { log: string[] } }).__stub.log)
    expect(log).not.toContain('eth_requestAccounts')
    expect(log).not.toContain('eth_sendTransaction')
    // Exactly one connect control in the header.
    await expect(page.locator('header').getByRole('button', { name: 'Connect wallet' })).toHaveCount(1)
  })

  test('connects, shows the balance and both technical views, and disconnects', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC })
    await page.goto('/app')
    await connect(page)
    await expect(page.getByText('USDC balance')).toBeVisible()
    await page.getByText('Technical details: one balance, two views').click()
    await expect(page.getByText('Native view (18 decimals)')).toBeVisible()
    await expect(page.getByText(/never added together/)).toBeVisible()
    await page.getByRole('button', { name: /0xf39F/ }).click()
    await page.getByRole('menuitem', { name: 'Disconnect' }).click()
    await expect(page.getByRole('heading', { name: 'Connect a wallet to start' })).toBeVisible()
  })

  test('declined connection is explained', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC })
    await page.goto('/app')
    await page.evaluate(() => ((window as unknown as { __stub: { reject: boolean } }).__stub.reject = true))
    await page.getByRole('button', { name: 'Connect wallet' }).first().click()
    await page.getByRole('button', { name: /Test Wallet/ }).click()
    await expect(page.getByText('The connection request was declined in your wallet.')).toBeVisible()
  })

  test('wrong network blocks quoting until the user switches', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC, chainId: 1 })
    await page.goto('/app/send')
    await connect(page)
    await expect(page.getByText(/Your wallet is on chain 1/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Switch to Local test chain to quote/ })).toBeDisabled()
    await page.getByRole('button', { name: /Switch to Local test chain/ }).first().click()
    await expect(page.getByText(/Your wallet is on chain 1/)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Get quote' })).toBeEnabled()
  })

  test('session survives a refresh without signing anything', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC })
    await page.goto('/app')
    await connect(page)
    await page.reload()
    await expect(page.getByRole('button', { name: new RegExp(ACCOUNTS[0].slice(0, 6)) })).toBeVisible()
    const log = await page.evaluate(() => (window as unknown as { __stub: { log: string[] } }).__stub.log)
    expect(log).not.toContain('eth_sendTransaction')
  })
})
