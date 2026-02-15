#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import random
from PIL import Image, ImageOps, ImageDraw, ImageFilter

ROOT = Path('/Users/fengnian/my-game')
OUT = ROOT / 'public/assets/third_party/itch-adapted'
OUT.mkdir(parents=True, exist_ok=True)

# Source packs
ZERIE = ROOT / 'assets/itch/extracted/zerie-tiny-rpg/Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc/Characters(100x100)'
CAINOS = ROOT / 'assets/itch/extracted/cainos-topdown-basic/Texture'
PIXEL_CRAWLER = ROOT / 'temp/Pixel Crawler - Free Pack'
KENNEY = ROOT / 'temp/kenney_micro-roguelike'

# Handpicked floor-like tiles only (strictly excludes decorative icon tiles).
KENNEY_FLOOR_IDS = [1, 48, 49, 50, 51, 80, 81, 82, 83]
KENNEY_PATH_IDS = [16, 19, 50, 51]


def load_frame(sheet: Path, frame_w: int, frame_h: int, index_x: int = 0, index_y: int = 0) -> Image.Image:
    img = Image.open(sheet).convert('RGBA')
    x0 = index_x * frame_w
    y0 = index_y * frame_h
    return img.crop((x0, y0, x0 + frame_w, y0 + frame_h))


def load_optional_frame(sheet: Path, frame_w: int, frame_h: int, index_x: int = 0, index_y: int = 0) -> Image.Image | None:
    if not sheet.exists():
        return None
    return load_frame(sheet, frame_w, frame_h, index_x=index_x, index_y=index_y)


def trim_and_fit(img: Image.Image, out_w: int, out_h: int, target_h: int) -> Image.Image:
    alpha = img.split()[-1]
    # Ignore almost-transparent fringe pixels to avoid huge invisible margins.
    mask = alpha.point(lambda a: 255 if a > 20 else 0)
    bbox = mask.getbbox()
    if bbox:
        img = img.crop(bbox)
    scale = max(1, int(round(target_h / max(1, img.height))))
    resized = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
    if resized.height > target_h:
        ratio = target_h / resized.height
        resized = resized.resize((max(1, int(resized.width * ratio)), target_h), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    x = (out_w - resized.width) // 2
    y = out_h - resized.height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def tint_rgb(img: Image.Image, mul_r: float, mul_g: float, mul_b: float) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (
                max(0, min(255, int(r * mul_r))),
                max(0, min(255, int(g * mul_g))),
                max(0, min(255, int(b * mul_b))),
                a,
            )
    return img


def alpha_mul(img: Image.Image, mul: float) -> Image.Image:
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (r, g, b, max(0, min(255, int(a * mul))))
    return out


def build_characters() -> None:
    soldier_idle = load_frame(ZERIE / 'Soldier/Soldier/Soldier-Idle.png', 100, 100, index_x=2, index_y=0)
    orc_idle = load_frame(ZERIE / 'Orc/Orc/Orc-Idle.png', 100, 100, index_x=2, index_y=0)

    # Prefer Pixel Crawler protagonists so player and companion are clearly different.
    knight_idle = load_optional_frame(
        PIXEL_CRAWLER / "Entities/Npc's/Knight/Idle/Idle-Sheet.png",
        32,
        32,
        index_x=1,
        index_y=0,
    )
    rogue_idle = load_optional_frame(
        PIXEL_CRAWLER / "Entities/Npc's/Rogue/Idle/Idle-Sheet.png",
        32,
        32,
        index_x=1,
        index_y=0,
    )
    knight_run = load_optional_frame(
        PIXEL_CRAWLER / "Entities/Npc's/Knight/Run/Run-Sheet.png",
        64,
        64,
        index_x=1,
        index_y=0,
    )
    wizard_idle = load_optional_frame(
        PIXEL_CRAWLER / "Entities/Npc's/Wizzard/Idle/Idle-Sheet.png",
        32,
        32,
        index_x=1,
        index_y=0,
    )
    rogue_run = load_optional_frame(
        PIXEL_CRAWLER / "Entities/Npc's/Rogue/Run/Run-Sheet.png",
        64,
        64,
        index_x=1,
        index_y=0,
    )

    # Fill more canvas height so in-game scale looks substantial.
    player_src = knight_idle if knight_idle is not None else soldier_idle
    companion_src = rogue_idle if rogue_idle is not None else soldier_idle
    tank_src = knight_run if knight_run is not None else orc_idle
    zombie_src = wizard_idle if wizard_idle is not None else orc_idle
    runner_src = rogue_run if rogue_run is not None else orc_idle

    player = trim_and_fit(player_src, 32, 32, 32)
    companion = trim_and_fit(companion_src, 32, 32, 28)
    companion = tint_rgb(companion, 0.88, 1.08, 1.22)
    zombie = tint_rgb(trim_and_fit(zombie_src, 32, 32, 29), 0.90, 1.12, 0.84)
    runner = tint_rgb(trim_and_fit(runner_src, 32, 32, 30), 1.10, 0.95, 0.90)
    tank = tint_rgb(trim_and_fit(tank_src, 48, 48, 43), 1.06, 0.94, 1.07)

    player.save(OUT / 'player.png')
    companion.save(OUT / 'companion.png')
    zombie.save(OUT / 'zombie.png')
    runner.save(OUT / 'runner.png')
    tank.save(OUT / 'tank.png')


def crop_cell(img: Image.Image, cx: int, cy: int, cell: int) -> Image.Image:
    return img.crop((cx * cell, cy * cell, (cx + 1) * cell, (cy + 1) * cell))


def scale2(img: Image.Image) -> Image.Image:
    return img.resize((img.width * 2, img.height * 2), Image.Resampling.NEAREST)


def fit_center(img: Image.Image, out_w: int, out_h: int, target_w: int, target_h: int) -> Image.Image:
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        img = img.crop(bbox)
    resized = ImageOps.contain(img, (target_w, target_h), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    x = (out_w - resized.width) // 2
    y = (out_h - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def avg_rgb(img: Image.Image) -> tuple[float, float, float]:
    px = img.convert('RGBA').load()
    w, h = img.size
    r_sum = g_sum = b_sum = c = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            r_sum += r
            g_sum += g
            b_sum += b
            c += 1
    if c == 0:
        return (0.0, 0.0, 0.0)
    return (r_sum / c, g_sum / c, b_sum / c)


def color_distance(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def tile_metrics(img: Image.Image) -> tuple[int, float, float]:
    px = img.convert('RGBA').load()
    w, h = img.size
    colors: set[tuple[int, int, int]] = set()
    filled = 0
    edge_sum = 0.0
    edge_n = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 10:
                continue
            filled += 1
            colors.add((r, g, b))

    for y in range(h):
        for x in range(w - 1):
            r1, g1, b1, a1 = px[x, y]
            r2, g2, b2, a2 = px[x + 1, y]
            if a1 <= 10 and a2 <= 10:
                continue
            g1v = 0.299 * r1 + 0.587 * g1 + 0.114 * b1
            g2v = 0.299 * r2 + 0.587 * g2 + 0.114 * b2
            edge_sum += abs(g1v - g2v)
            edge_n += 1
    for y in range(h - 1):
        for x in range(w):
            r1, g1, b1, a1 = px[x, y]
            r2, g2, b2, a2 = px[x, y + 1]
            if a1 <= 10 and a2 <= 10:
                continue
            g1v = 0.299 * r1 + 0.587 * g1 + 0.114 * b1
            g2v = 0.299 * r2 + 0.587 * g2 + 0.114 * b2
            edge_sum += abs(g1v - g2v)
            edge_n += 1

    fill_ratio = filled / max(1, w * h)
    edge = edge_sum / max(1, edge_n)
    return len(colors), edge, fill_ratio


def load_kenney_tiles() -> list[tuple[Image.Image, tuple[float, float, float]]]:
    tile_dir = KENNEY / 'Tiles/Colored'
    if not tile_dir.exists():
        return []
    tiles: list[tuple[Image.Image, tuple[float, float, float]]] = []
    for path in sorted(tile_dir.glob('tile_*.png')):
        img = Image.open(path).convert('RGBA')
        tiles.append((img, avg_rgb(img)))
    return tiles


def pick_tile_palette(
    samples: list[tuple[Image.Image, tuple[float, float, float]]],
    target: tuple[int, int, int],
    count: int = 10
) -> list[Image.Image]:
    ranked = sorted(samples, key=lambda s: color_distance(s[1], target))
    return [s[0] for s in ranked[:max(1, count)]]


def pick_ground_tiles(
    samples: list[tuple[Image.Image, tuple[float, float, float]]],
    target: tuple[int, int, int],
    count: int = 10
) -> list[Image.Image]:
    scored: list[tuple[float, Image.Image]] = []
    for img, avg in samples:
        unique, edge, fill_ratio = tile_metrics(img)
        # Filter out icon/object tiles from Kenney pack.
        if fill_ratio < 0.88:
            continue
        if unique < 3 or unique > 42:
            continue
        if edge > 38:
            continue
        dist = color_distance(avg, target)
        # Prefer low edge contrast for clean background readability.
        score = dist + edge * 0.8 + unique * 0.4
        scored.append((score, img))
    scored.sort(key=lambda x: x[0])
    if not scored:
        return pick_tile_palette(samples, target, count)
    return [img for _, img in scored[:max(1, count)]]


def tiled_patch(
    tiles: list[Image.Image],
    out_w: int,
    out_h: int,
    scale: int = 2,
    seed: int | None = None,
    allow_flip: bool = True
) -> Image.Image:
    if not tiles:
        return Image.new('RGBA', (out_w, out_h), (70, 80, 96, 255))
    if seed is not None:
        random.seed(seed)
    tile_w = max(1, tiles[0].width * scale)
    tile_h = max(1, tiles[0].height * scale)
    patch = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    for y in range(0, out_h, tile_h):
        for x in range(0, out_w, tile_w):
            tile = random.choice(tiles)
            if allow_flip and random.random() < 0.35:
                tile = ImageOps.mirror(tile)
            if allow_flip and random.random() < 0.22:
                tile = ImageOps.flip(tile)
            tile = tile.resize((tile_w, tile_h), Image.Resampling.NEAREST)
            patch.alpha_composite(tile, (x, y))
    return patch


def load_kenney_tile_by_id(tile_id: int) -> Image.Image | None:
    p = KENNEY / 'Tiles/Colored' / f'tile_{tile_id:04d}.png'
    if not p.exists():
        return None
    return Image.open(p).convert('RGBA')


def load_kenney_tiles_by_ids(tile_ids: list[int]) -> list[Image.Image]:
    tiles: list[Image.Image] = []
    for tid in tile_ids:
        tile = load_kenney_tile_by_id(tid)
        if tile is not None:
            tiles.append(tile)
    return tiles


def tint_overlay(img: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    overlay = Image.new('RGBA', img.size, (color[0], color[1], color[2], alpha))
    return Image.alpha_composite(img, overlay)


def add_soft_blocks(img: Image.Image, seed: int, intensity: int = 28) -> Image.Image:
    random.seed(seed)
    out = img.copy()
    draw = ImageDraw.Draw(out, 'RGBA')
    w, h = out.size
    for _ in range(120):
        x = random.randint(0, w - 32)
        y = random.randint(0, h - 32)
        s = random.choice([16, 20, 24, 28, 32])
        c = random.randint(92, 165)
        low = max(1, min(intensity, intensity // 3))
        a = random.randint(low, max(low, intensity))
        draw.rectangle((x, y, x + s, y + s), fill=(c, c + random.randint(-8, 8), c + random.randint(-12, 12), a))
    return out


def build_projectiles() -> None:
    hands_path = PIXEL_CRAWLER / 'Weapons/Hands/Hands.png'
    if hands_path.exists():
        hands = Image.open(hands_path).convert('RGBA')
        hand_a = hands.crop((0, 0, 32, 32))
        hand_b = hands.crop((0, 32, 32, 64))
        hand_c = hands.crop((0, 64, 32, 96))
        core_a = fit_center(hand_a, 16, 16, 12, 12)
        core_b = fit_center(hand_b, 16, 16, 12, 12)
        core_c = fit_center(hand_c, 16, 16, 12, 12)
    else:
        arrow = Image.open(
            ROOT / 'assets/itch/extracted/zerie-tiny-rpg/Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc/Arrow(Projectile)/Arrow01(32x32).png'
        ).convert('RGBA')
        core_a = fit_center(arrow, 16, 16, 15, 8)
        core_b = core_a.copy()
        core_c = core_a.copy()

    normal = tint_rgb(core_a.copy(), 0.72, 1.05, 1.35)
    scatter = tint_rgb(core_b.copy(), 0.74, 1.10, 1.48)
    pulse = tint_rgb(core_c.copy(), 0.56, 1.28, 1.55)
    flame = tint_rgb(core_b.copy(), 1.45, 0.95, 0.55)
    pierce = tint_rgb(core_c.copy(), 0.55, 1.35, 1.45)
    cannon = tint_rgb(core_a.copy(), 1.20, 0.80, 1.35)
    frost = tint_rgb(core_b.copy(), 0.80, 1.20, 1.50)
    chain = tint_rgb(core_c.copy(), 1.15, 0.75, 1.50)

    # Add readable pixel halo + bright core for combat visibility.
    def with_halo(img: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
        halo = Image.new('RGBA', img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(halo)
        # Wide outer glow
        d.ellipse((0, 2, 16, 14), fill=(rgb[0], rgb[1], rgb[2], 36))
        # Core glow
        d.ellipse((3, 5, 13, 11), fill=(rgb[0], rgb[1], rgb[2], 72))
        # Front sparkle
        d.rectangle((12, 7, 15, 9), fill=(255, 255, 255, 110))
        # Tail streak
        d.rectangle((1, 7, 6, 9), fill=(rgb[0], rgb[1], rgb[2], 56))
        out = Image.alpha_composite(halo, img)
        return out

    with_halo(normal, (96, 220, 255)).save(OUT / 'bullet.png')
    with_halo(scatter, (126, 205, 255)).save(OUT / 'bullet_scatter.png')
    with_halo(pulse, (40, 232, 255)).save(OUT / 'bullet_pulse.png')
    with_halo(flame, (255, 168, 60)).save(OUT / 'bullet_flame.png')
    with_halo(pierce, (100, 235, 255)).save(OUT / 'bullet_pierce.png')
    with_halo(cannon, (214, 140, 255)).save(OUT / 'bullet_cannon.png')
    with_halo(frost, (171, 217, 255)).save(OUT / 'bullet_frost.png')
    with_halo(chain, (208, 128, 255)).save(OUT / 'bullet_chain.png')


def build_world_base_map(_kenney_samples: list[tuple[Image.Image, tuple[float, float, float]]]) -> None:
    w, h = 2000, 1500
    world = Image.new('RGBA', (w, h), (88, 99, 114, 255))
    draw = ImageDraw.Draw(world, 'RGBA')
    zones = [
        ((0, 0, w // 2, h // 2), (102, 115, 134), 0),
        ((w // 2, 0, w, h // 2), (111, 127, 109), 1),
        ((0, h // 2, w // 2, h), (130, 120, 106), 2),
        ((w // 2, h // 2, w, h), (104, 116, 132), 3),
    ]
    for (x0, y0, x1, y1), color, zone_idx in zones:
        draw.rectangle((x0, y0, x1, y1), fill=(color[0], color[1], color[2], 255))
        rnd = random.Random(8100 + zone_idx)
        # Very light texture only; avoid noisy black-dot look.
        for _ in range(420):
            bx = rnd.randint(x0, x1 - 10)
            by = rnd.randint(y0, y1 - 10)
            bw = rnd.choice([6, 8, 10, 12, 14])
            bh = rnd.choice([6, 8, 10, 12, 14])
            delta = rnd.randint(-8, 8)
            draw.rectangle(
                (bx, by, bx + bw, by + bh),
                fill=(
                    max(0, min(255, color[0] + delta)),
                    max(0, min(255, color[1] + delta)),
                    max(0, min(255, color[2] + delta)),
                    255,
                ),
            )
        # Subtle lane-like lines for readability.
        line_col = (
            max(0, min(255, color[0] - 6)),
            max(0, min(255, color[1] - 6)),
            max(0, min(255, color[2] - 6)),
            255,
        )
        for gy in range(y0 + 12, y1, 64):
            draw.line((x0, gy, x1, gy), fill=line_col, width=1)
        for gx in range(x0 + 12, x1, 64):
            draw.line((gx, y0, gx, y1), fill=line_col, width=1)

    draw = ImageDraw.Draw(world, 'RGBA')
    # Subtle darkening for gameplay readability (opaque blend, no transparency holes).
    shade = Image.new('RGBA', (w, h), (14, 20, 34, 34))
    world = Image.alpha_composite(world, shade)
    draw = ImageDraw.Draw(world, 'RGBA')

    # Keep center roads visually stable and readable.
    draw.rectangle((952, 0, 1048, h), fill=(24, 31, 45, 255))
    draw.rectangle((0, 702, w, 798), fill=(24, 31, 45, 255))
    draw.rectangle((984, 0, 1016, h), fill=(10, 16, 28, 255))
    draw.rectangle((0, 734, w, 766), fill=(10, 16, 28, 255))
    for y in range(10, h, 34):
        draw.rectangle((997, y, 1003, y + 12), fill=(206, 216, 236, 255))
    for x in range(10, w, 34):
        draw.rectangle((x, 747, x + 12, 753), fill=(206, 216, 236, 255))

    world.save(OUT / 'world_base_map.png')


def build_structures() -> None:
    wall_sheet = Image.open(CAINOS / 'TX Tileset Wall.png').convert('RGBA')
    props_sheet = Image.open(CAINOS / 'TX Props.png').convert('RGBA')
    sliced_dir = ROOT / 'assets/itch/sliced/cainos-topdown-basic'
    kenney_samples = load_kenney_tiles()

    wall = scale2(crop_cell(wall_sheet, 1, 6, 32))
    wall_v2 = scale2(crop_cell(wall_sheet, 2, 6, 32))
    wall_v3 = scale2(crop_cell(wall_sheet, 3, 6, 32))

    reinforced = scale2(crop_cell(wall_sheet, 1, 9, 32))
    reinforced_v2 = scale2(crop_cell(wall_sheet, 2, 9, 32))
    reinforced_v3 = scale2(crop_cell(wall_sheet, 4, 9, 32))

    gate_base = scale2(crop_cell(props_sheet, 0, 2, 64))
    gate_v2 = tint_rgb(gate_base.copy(), 0.78, 0.95, 1.20)
    gate_v3 = tint_rgb(gate_base.copy(), 1.15, 0.90, 0.90)

    # Counter/workbench from props (full 64x64 cells)
    counter = crop_cell(props_sheet, 5, 1, 64)
    workbench = crop_cell(props_sheet, 5, 2, 64)

    wall.save(OUT / 'wall.png')
    wall_v2.save(OUT / 'wall_v2.png')
    wall_v3.save(OUT / 'wall_v3.png')
    reinforced.save(OUT / 'reinforced_wall.png')
    reinforced_v2.save(OUT / 'reinforced_wall_v2.png')
    reinforced_v3.save(OUT / 'reinforced_wall_v3.png')
    gate_base.save(OUT / 'gate.png')
    gate_v2.save(OUT / 'gate_v2.png')
    gate_v3.save(OUT / 'gate_v3.png')
    counter.save(OUT / 'store_counter.png')
    workbench.save(OUT / 'workbench.png')

    # Village surfaces: clean, low-noise tiles for readable base interior.
    vg = Image.new('RGBA', (64, 64), (68, 86, 110, 255))
    vgd = ImageDraw.Draw(vg, 'RGBA')
    for y in range(0, 64, 8):
        vgd.line((0, y, 64, y), fill=(74, 93, 118, 255), width=1)
    for x in range(0, 64, 8):
        vgd.line((x, 0, x, 64), fill=(72, 90, 114, 255), width=1)
    for y in range(0, 64, 16):
        for x in range(0, 64, 16):
            vgd.rectangle((x + 1, y + 1, x + 6, y + 6), fill=(78, 97, 122, 255))

    vp = Image.new('RGBA', (64, 64), (98, 82, 68, 255))
    vpd = ImageDraw.Draw(vp, 'RGBA')
    for y in range(0, 64, 8):
        shade = 118 if (y // 8) % 2 == 0 else 108
        vpd.rectangle((0, y, 63, y + 7), fill=(shade, shade - 18, shade - 28, 255))
    for x in range(0, 64, 16):
        vpd.line((x, 0, x, 64), fill=(72, 58, 46, 255), width=2)

    vg.save(OUT / 'village_ground.png')
    vp.save(OUT / 'village_path.png')

    # Kenney pack usage: controlled UI/build icons only (avoid world background noise).
    kenney_build_icon = load_kenney_tile_by_id(33)
    if kenney_build_icon is not None:
        fit_center(kenney_build_icon, 16, 16, 14, 14).save(OUT / 'build_icon_kenney.png')
    kenney_turret_icon = load_kenney_tile_by_id(30)
    if kenney_turret_icon is not None:
        fit_center(kenney_turret_icon, 16, 16, 14, 14).save(OUT / 'turret_icon_kenney.png')

    supply_crate_src = sliced_dir / 'supply_crate.png'
    if supply_crate_src.exists():
        Image.open(supply_crate_src).convert('RGBA').save(OUT / 'supply_crate.png')

    build_world_base_map(kenney_samples)


def main() -> None:
    build_characters()
    build_projectiles()
    build_structures()
    print('generated:', OUT)


if __name__ == '__main__':
    main()
