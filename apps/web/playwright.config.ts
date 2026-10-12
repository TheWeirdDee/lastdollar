import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests run the production build against a LOCAL anvil chain that uses Arc's chain id,
 * with an injected EIP-1193 wallet stub (e2e/wallet-stub.ts). These are labelled automated tests:
 * the app shows a permanent "Test network" banner in this mode and nothing touches mainnet.
 */
export const ANVIL_PORT = 8547
export const APP_PORT = 3107
export const SPLITTER = '0x5FbDB2315678afecb367f032d93F642f64180aa3' // anvil account 0, nonce 0

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '../../evidence/test-results/e2e.json' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/sync-content.mjs && next build && next start -p ${APP_PORT}`,
    url: `http://127.0.0.1:${APP_PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_NETWORK_MODE: 'local-test',
      NEXT_PUBLIC_ARC_RPC_URL: `http://127.0.0.1:${ANVIL_PORT}`,
      NEXT_PUBLIC_SPLITTER_ADDRESS: SPLITTER,
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
})
