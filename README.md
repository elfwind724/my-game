# Phaser 3 TypeScript Vite Template

Template for zombie survival roguelike game with Phaser 3, TypeScript, and Vite.

## Quick Start

```bash
cd templates/phaser-3-ts-vite/
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
src/
├── main.ts           # Entry point
└── scenes/
    ├── BootScene.ts  # Asset loading
    ├── MenuScene.ts  # Main menu
    ├── GameScene.ts  # Core gameplay
    └── UIScene.ts    # HUD overlay
```

## Features Included

- ✅ Player movement (WASD/Arrows)
- ✅ Auto-targeting and firing
- ✅ Zombie spawning and AI
- ✅ Collision detection
- ✅ Health system
- ✅ Resource tracking
- ✅ Kill counter
- ✅ Day tracking
- ✅ Pixel art graphics (procedurally generated)
- ✅ Camera follow
- ✅ World bounds

## Next Steps

See `~/.gemini/antigravity/skills/web-game-dev/references/` for:

1. **architecture.md** - Add ECS pattern for scalability
2. **tower-defense.md** - Advanced auto-targeting
3. **companions.md** - Recruit NPCs
4. **base-building.md** - Place buildings
5. **exploration.md** - Day phase exploration
6. **game-design.md** - Roguelike progression

## Build for Production

```bash
npm run build
# Output in dist/
```

## itch 素材导入（合规模式）

不走爬虫抓下载接口，只做「发现 + 手动下载 + 本地导入」：

```bash
# 1) 初始化目录与清单
npm run assets:init

# 2) 发现免费素材条目（默认源: https://itch.io/game-assets/free.xml）
npm run assets:discover

# 3) 把你本地已下载的素材包映射进游戏
node scripts/itch_assets.mjs ingest \
  --slug neon-pack \
  --from "/你的本地素材目录" \
  --map "player=hero.png,zombie=enemy.png,wall=wall.png" \
  --source "https://itch.io/..." \
  --license "CC-BY 4.0" \
  --attribution "Author Name"
```

导入后会更新：
- `src/data/assetOverrides.ts`（游戏加载的素材覆盖清单）
- `assets/itch/asset-overrides.json`
- `assets/itch/attribution.json`
- `public/assets/third_party/<slug>/...`

## Key Game Constants

```typescript
// Resolution: 320x180 (scales to fit window)
// Tile size: 32x32 pixels
// Player speed: 200 px/s
// Zombie speed: 80 px/s
// Bullet speed: 400 px/s
// Fire rate: 500ms
```
