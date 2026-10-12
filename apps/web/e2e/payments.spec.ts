import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, anvil, connect, installWalletStub } from './wallet-stub'

const RPC = 'http://127.0.0.1:8547'
const BOB = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const CAROL = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'

async function fillSend(page: Page, recipient: string, amount?: string) {
  await page.getByLabel('Recipient address').fill(recipient)
  if (amount !== undefined) await page.getByLabel('Amount the recipient receives').fill(amount)
}

async function chooseNative(page: Page) {
  await page.locator('label', { hasText: /^Native$/ }).click()
}

test.describe('send', () => {
  test.beforeEach(async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC })
    await page.goto('/app/send')
    await connect(page)
  })

  test('invalid inputs are summarised and never rounded', async ({ page }) => {
    await fillSend(page, '0x1234', '1.1234567')
    await page.getByRole('button', { name: 'Get quote' }).click()
    const summary = page.getByRole('alert').filter({ hasText: 'before quoting' })
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('not a valid address')
    await expect(summary).toContainText('at most 6 decimal places')
    await fillSend(page, '0x0000000000000000000000000000000000000000', '1')
    await page.getByRole('button', { name: 'Get quote' }).click()
    await expect(page.getByText('Arc does not allow sending value to the zero address.').first()).toBeVisible()
  })

  test('exact native payment: quote, review, sign, receipt, history', async ({ page }) => {
    await fillSend(page, BOB, '1.5')
    await chooseNative(page)
    await page.getByRole('button', { name: 'Get quote' }).click()
    const review = page.getByRole('region', { name: 'Payment review' })
    await expect(review).toContainText('Recipient receives')
    await expect(review).toContainText('1.50')
    await expect(review).toContainText('Estimated network fee')
    await expect(review).toContainText('Maximum fee budget')
    await page.getByRole('button', { name: 'Review payment' }).click()
    const sign = page.getByRole('button', { name: 'Recheck and sign in wallet' })
    await expect(sign).toBeDisabled()
    await page.getByRole('checkbox').check()
    await sign.click()
    // Local anvil has no Arc EIP-7708 native transfer logs, so the app must refuse to claim
    // verification even though value moved. Mainnet evidence covers the verified path.
    await expect(page.getByRole('heading', { name: 'Receipt needs attention' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('No native transfer log found for this transaction.')).toBeVisible()
    await page.getByRole('link', { name: 'Full receipt' }).click()
    await expect(page.getByRole('heading', { name: 'Receipt', level: 1 })).toBeVisible()
    await expect(page.getByText('Executed successfully')).toBeVisible()
    await page.goto('/app/history')
    await expect(page.getByText('Exact · Native')).toBeVisible()
  })

  test('declining in the wallet returns to review with nothing sent', async ({ page }) => {
    await fillSend(page, BOB, '0.25')
    await chooseNative(page)
    await page.getByRole('button', { name: 'Get quote' }).click()
    await page.getByRole('button', { name: 'Review payment' }).click()
    await page.getByRole('checkbox').check()
    await page.evaluate(() => ((window as unknown as { __stub: { reject: boolean } }).__stub.reject = true))
    await page.getByRole('button', { name: 'Recheck and sign in wallet' }).click()
    await expect(page.getByText('You declined the request in your wallet. Nothing was sent.')).toBeVisible()
  })

  test('send-max: a balance change after review requires renewed review', async ({ page }) => {
    await fillSend(page, CAROL)
    await page.locator('label', { hasText: 'Send maximum' }).click()
    await chooseNative(page)
    await page.getByRole('button', { name: 'Get quote' }).click()
    await expect(page.getByRole('region', { name: 'Payment review' })).toContainText('Send maximum')
    await page.getByRole('button', { name: 'Review payment' }).click()
    await page.getByRole('checkbox').check()
    const before = (await anvil('eth_getBalance', [ACCOUNTS[0], 'latest'])) as string
    await anvil('anvil_setBalance', [ACCOUNTS[0], `0x${(BigInt(before) - 10n ** 17n).toString(16)}`])
    await page.getByRole('button', { name: 'Recheck and sign in wallet' }).click()
    await expect(page.getByRole('heading', { name: 'Conditions changed before signing' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'amount 1' })).toBeVisible()
    const log = await page.evaluate(() => (window as unknown as { __stub: { log: string[] } }).__stub.log)
    expect(log).not.toContain('eth_sendTransaction')
    await page.getByRole('button', { name: 'Review updated terms' }).click()
    await expect(page.getByText('Updated terms. Review them before signing.')).toBeVisible()
  })

  test('changing account discards the quote', async ({ page }) => {
    await fillSend(page, BOB, '1')
    await page.getByRole('button', { name: 'Get quote' }).click()
    await expect(page.getByRole('button', { name: 'Review payment' })).toBeVisible()
    await page.evaluate((acct) => {
      const w = window as unknown as { __stub: { account: string }; __stubEmit: (e: string, a: unknown) => void }
      w.__stub.account = acct
      w.__stubEmit('accountsChanged', [acct])
    }, ACCOUNTS[1])
    await expect(page.getByText(/previous quote was discarded/)).toBeVisible()
  })
})

test.describe('batch', () => {
  test.beforeEach(async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC, account: ACCOUNTS[2] })
    await page.goto('/app/batch')
    await connect(page)
  })

  test('CSV import reports row-level errors and loads rows as written', async ({ page }) => {
    const csv = ['recipient,amount,reference', `${BOB},1.1234567,too-precise`, `0x123,1,bad`, `${CAROL},2,ok`].join('\n')
    await page.locator('input[type=file]').setInputFiles({ name: 'payouts.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    const report = page.getByRole('alert').filter({ hasText: 'payouts.csv has problems' })
    await expect(report).toContainText('Line 2')
    await expect(report).toContainText('Line 3')
    await expect(page.getByLabel('Recipient 3 address')).toHaveValue(CAROL)
    await expect(page.getByLabel('Recipient 1 amount in USDC')).toHaveValue('1.1234567')
    await expect(page.getByRole('button', { name: 'Quote batch' })).toBeDisabled()
  })

  test('repeated recipients need explicit acknowledgement, then one atomic transaction pays all', async ({ page }) => {
    await page.getByLabel('Recipient 1 address').fill(BOB)
    await page.getByLabel('Recipient 1 amount in USDC').fill('0.1')
    await page.getByLabel('Recipient 2 address').fill(CAROL)
    await page.getByLabel('Recipient 2 amount in USDC').fill('0.2')
    await page.getByRole('button', { name: 'Add recipient' }).click()
    await page.getByLabel('Recipient 3 address').fill(BOB)
    await page.getByLabel('Recipient 3 amount in USDC').fill('0.3')
    await expect(page.getByText('appears more than once')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quote batch' })).toBeDisabled()
    await page.getByLabel('Pay each row separately. Rows are never merged.').check()
    const bob0 = BigInt((await anvil('eth_getBalance', [BOB, 'latest'])) as string)
    await page.getByRole('button', { name: 'Quote batch' }).click()
    const review = page.getByRole('region', { name: 'Payment review' })
    await expect(review).toContainText('3 recipients receive')
    await expect(review).toContainText('0.60')
    await page.getByRole('button', { name: 'Review payment' }).click()
    await page.getByRole('checkbox', { name: /all 3 recipients/ }).check()
    await page.getByRole('button', { name: 'Recheck and sign in wallet' }).click()
    await expect(page.getByRole('heading', { name: 'Receipt needs attention' })).toBeVisible({ timeout: 30_000 })
    const bob1 = BigInt((await anvil('eth_getBalance', [BOB, 'latest'])) as string)
    expect(bob1 - bob0).toBe(4n * 10n ** 17n)
  })
})

test.describe('history and receipts', () => {
  test('pending records recover after refresh and resolve from chain data', async ({ page }) => {
    await installWalletStub(page, { rpcUrl: RPC, account: ACCOUNTS[1] })
    const hash = (await anvil('eth_sendTransaction', [{ from: ACCOUNTS[1], to: BOB, value: '0x2386f26fc10000' }])) as `0x${string}`
    await page.goto('/app/history')
    await page.evaluate(
      ({ hash, account, bob }) => {
        localStorage.setItem(
          `lastdollar:v1:history:5042:${account.toLowerCase()}`,
          JSON.stringify([
            {
              v: 1,
              hash,
              chainId: 5042,
              account,
              kind: 'exact',
              mode: 'native',
              nonce: 0,
              quoteId: `0x${'00'.repeat(32)}`,
              createdAt: Date.now(),
              status: 'pending',
              recipients: [{ recipient: bob, amount18: '10000000000000000' }],
              total18: '10000000000000000',
            },
          ]),
        )
      },
      { hash, account: ACCOUNTS[1], bob: BOB },
    )
    await connect(page)
    await page.reload()
    // Resolves away from "Pending" using the receipt; never fabricated. On anvil there are no Arc
    // EIP-7708 logs, so the honest resolution is "Mismatch" rather than "Verified".
    const row = page.getByRole('link', { name: /Exact · Native/ })
    await expect(row).toContainText('Mismatch', { timeout: 20_000 })
    await expect(row).not.toContainText('Pending')
  })

  test('unknown hashes are shown as not found, not as failed', async ({ page }) => {
    await page.goto(`/app/transactions/0x${'ab'.repeat(32)}`)
    await expect(page.getByText(/Not found on Local test chain/)).toBeVisible()
    await expect(page.getByText(/never shown as failed or paid/)).toBeVisible()
  })

  test('malformed hashes 404', async ({ page }) => {
    const res = await page.goto('/app/transactions/0x1234')
    expect(res?.status()).toBe(404)
  })
})
