import { expect, test } from '@playwright/test'

test.describe('marketing site', () => {
  test('landing page shows the product promise and honest sample labelling', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Send exactly what you intend.')
    await expect(page.getByText('Illustrative sample').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'View mainnet proof' })).toHaveAttribute('href', '/proof')
    await expect(page.getByRole('link', { name: /Open app/ }).first()).toBeVisible()
  })

  test('every public route renders', async ({ page }) => {
    for (const [path, heading] of [
      ['/proof', 'Mainnet proof'],
      ['/developers', 'Arc payments, without re-deriving the hard parts.'],
      ['/docs', 'LastDollar docs'],
      ['/docs/sdk', 'SDK guide'],
      ['/docs/payment-math', 'Payment math'],
      ['/privacy', 'Privacy'],
      ['/security', 'Security'],
    ] as const) {
      const res = await page.goto(path)
      expect(res?.status(), path).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    }
  })

  test('unknown routes show the 404 page', async ({ page }) => {
    const res = await page.goto('/nope-not-here')
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing at this address.')
  })

  test('theme choice persists across reloads without changing the default for others', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('radio', { name: 'Dark theme' }).first().click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('radio', { name: 'Light theme' }).first().click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('system theme follows the OS preference', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await ctx.close()
  })

  test('mobile menu is keyboard accessible', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } })
    const page = await ctx.newPage()
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Open menu' })
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('link', { name: 'Proof' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await dialog.getByRole('link', { name: 'Developers' }).click()
    await expect(page).toHaveURL(/\/developers$/)
    await expect(page.getByRole('dialog')).toBeHidden()
    await ctx.close()
  })

  test('proof page is useful without a wallet and labels evidence types', async ({ page }) => {
    await page.goto('/proof')
    await expect(page.getByText(/Read-only RPC checks/)).toBeVisible()
    await expect(page.getByText('Local runs, not chain evidence')).toBeVisible()
    await expect(page.getByText('Simulation and computation, not transactions')).toBeVisible()
  })
})
