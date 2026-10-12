import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installWalletStub } from './wallet-stub'

const ROUTES = ['/', '/app', '/app/send', '/app/batch', '/app/history', '/proof', '/developers', '/docs', '/docs/sdk', '/security', '/privacy']
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440]
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'evidence', 'test-results', 'screens')

test.describe('responsive layout', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`no horizontal overflow at any width (${theme})`, async ({ browser }) => {
      test.setTimeout(240_000)
      mkdirSync(SHOTS, { recursive: true })
      const problems: string[] = []
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
        const page = await ctx.newPage()
        await installWalletStub(page, { rpcUrl: 'http://127.0.0.1:8547' })
        for (const route of ROUTES) {
          await page.goto(route)
          await page.waitForLoadState('networkidle')
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          if (overflow > 1) problems.push(`${route} @${width}px overflows by ${overflow}px`)
          if ([320, 390, 1440].includes(width)) {
            await page.screenshot({ path: join(SHOTS, `${theme}-${width}${route.replace(/\//g, '_') || '_home'}.png`), fullPage: true })
          }
        }
        await ctx.close()
      }
      expect(problems).toEqual([])
    })
  }
})

test.describe('accessibility (axe, WCAG 2.2 AA rules)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`principal routes have no serious violations (${theme})`, async ({ browser }) => {
      test.setTimeout(180_000)
      const ctx = await browser.newContext({ colorScheme: theme })
      const page = await ctx.newPage()
      const found: string[] = []
      for (const route of ROUTES) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        for (const v of results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
          found.push(`${route}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`)
        }
      }
      await ctx.close()
      expect(found).toEqual([])
    })
  }
})
