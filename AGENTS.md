# AGENTS.md

## Cursor Cloud specific instructions

This is a client-side-only Phaser 3 browser game (TypeScript + Vite). There is no backend, database, or external service dependency.

### Services

| Service | Command | URL |
|---|---|---|
| Vite dev server | `npm run dev` | http://localhost:3000 |

### Key commands

- **Dev server**: `npm run dev` (port 3000)
- **Type check**: `npx tsc --noEmit`
- **Build**: `npm run build` (runs `tsc && vite build`, outputs to `dist/`)
- **Lint**: No dedicated linter configured; TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) serves as the primary code quality check via `npx tsc --noEmit`.

### Notes

- Node 22 works fine for development despite `netlify.toml` specifying Node 20 for production builds.
- The game UI is in Chinese. Level-up screens, combat stats, and menus are all rendered in Chinese characters.
- The game auto-starts into gameplay (day/night cycle with base defense). There is no separate "start game" button on fresh load — the game boots directly into the scene.
- `package-lock.json` is present; use `npm install` (not yarn/pnpm).
