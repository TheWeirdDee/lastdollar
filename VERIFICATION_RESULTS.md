# Verification results

Environment: Windows, Node `v24.13.1`, pnpm `11.5.0`; baseline source SHA `e072f94be19827be5e4b2f28e1cbc6562ab2a8b3` plus uncommitted fix set.

| Command | Result |
| --- | --- |
| `pnpm --filter @lastdollar/arc test -- --run` | PASS — 6 files, 72 tests. |
| `pnpm test:integration` | PASS — 1 file, 8 tests. |
| `pnpm typecheck` | Previously completed PASS before the history schema addition; final full run exceeded this session command window before a completion result. |
| `pnpm lint` | PASS. |
| `pnpm test:pack` | Did not complete within this session command window (it installs a clean temporary npm consumer). |
| `pnpm build` | Did not complete within this session command window; Next build started after content sync. |

Network/evidence/browser/Foundry/CI/deployed-site verification has not been claimed as performed.
