# 第一批素材接入计划（像素写实 + 科幻末日）

目标：先替换会强烈影响观感的 12 个 key，确保进入游戏就能明显看到画面变化。

## 1) 基地与地图（优先）

推荐素材包：
- `Pixel Art Top Down - Basic`（https://cainos.itch.io/pixel-art-top-down-basic）
- `Modern Interiors - RPG Tileset`（https://limezu.itch.io/moderninteriors）

映射 key（第一批）：
- `zone_city_tile`
- `zone_wasteland_tile`
- `zone_industry_tile`
- `zone_road_tile`
- `wall`
- `gate`
- `store_front`
- `store_counter`

## 2) 角色与敌人（第二批）

推荐素材包：
- `Cyberpunk Character Pack`（https://gbcamd.itch.io/cyberpunk-character-pack-top-down-pixel-art）

映射 key（第二批）：
- `player`
- `companion`
- `zombie`
- `runner`

## 3) 武器弹道与 UI（第三批）

推荐素材包：
- `Top-Down Spaceship pack`（https://viwium.itch.io/top-down-spaceship-pack）
- `Pixel UI`（https://unclemugsy.itch.io/pixel-ui）

映射 key（第三批）：
- `bullet`
- `missile_turret`
- `laser_turret`
- `ui_panel`（用于后续 UI 皮肤化）

## 导入命令模板

```bash
node scripts/itch_assets.mjs ingest \
  --slug cainos-topdown-basic \
  --from "/ABS/PATH/TO/EXTRACTED/PACK" \
  --map "zone_city_tile=city_tile.png,zone_wasteland_tile=wasteland_tile.png,zone_road_tile=road_tile.png,wall=wall.png,gate=gate.png" \
  --source "https://cainos.itch.io/pixel-art-top-down-basic" \
  --license "TO_BE_CONFIRMED" \
  --attribution "TO_BE_CONFIRMED"
```

说明：
- 当前游戏已支持 `ASSET_OVERRIDES` 覆盖加载。
- 只要 key 对齐，进入游戏会自动替换程序绘制素材。
