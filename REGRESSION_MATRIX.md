# Regression matrix

| Case | Result | Evidence |
| --- | --- | --- |
| ERC-20 retained-cap balance one unit short | PASS | `packages/sdk/test/quote.test.ts`: rejects valid revalidation result. |
| Existing SDK unit/quote/receipt/batch suite | PASS | 72 tests, run 2026-10-12. |
| SDK integration suite | PASS | 8 tests, run 2026-10-12. |
| Native 18-decimal parsing | PASS (existing) | `packages/sdk/test/units.test.ts`. |
| ERC-20 six-decimal parsing | PASS (existing) | `packages/sdk/test/units.test.ts`. |
| Quote changes / late async result in browser | NOT RUN | Requires browser regression test. |
| Full-address review keyboard/mobile behavior | NOT RUN | Requires browser/emulated viewport inspection. |
| Hosted wallet/signing/replacement persistence | NOT RUN | Requires owner-controlled wallet and explicit spending authorization. |
