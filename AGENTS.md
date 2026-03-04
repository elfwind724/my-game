# AGENTS.md

## Cursor Cloud specific instructions

This is a **Phaser 3 browser game** (Zombie Survival Roguelike) — a purely client-side application with no backend.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server | `npm run dev` | 3000 | Only service needed; serves game + HMR |

### Key commands

- **Dev server**: `npm run dev` (serves at http://localhost:3000)
- **Type check**: `npx tsc --noEmit`
- **Build**: `npm run build` (runs `tsc && vite build`, outputs to `dist/`)
- **No linter configured** — use `tsc --noEmit` for static analysis

### Non-obvious notes

- The game uses Chinese (Simplified) localization throughout the UI. Menu button labels are in Chinese (e.g. "开始觉醒" = Start Game).
- There are no automated test suites (no Jest/Vitest/Mocha). The `test:game` script uses Playwright for screenshot-based testing but is Mac-specific and optional.
- The `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters` enabled — unused variables will cause `tsc` to fail.
- Asset generation scripts in `scripts/` require Python 3 but are optional (only needed for regenerating pixel art assets).
