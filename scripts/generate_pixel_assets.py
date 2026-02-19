#!/usr/bin/env python3
from __future__ import annotations

import json
import importlib.util
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw

SIZE = 32
FRAMES = 4

ROOT = Path('/Users/fengnian/my-game')
OUT_ROOT = ROOT / 'assets' / 'generated' / 'pixel_pack_v1'
FRAMES_ROOT = OUT_ROOT / 'frames'
SHEETS_ROOT = OUT_ROOT / 'sheets'
PREVIEW_ROOT = OUT_ROOT / 'preview_4x'
SPRITE_GENERATOR_PATH = Path('/Users/fengnian/.agents/skills/sprite-sheet-generator/scripts/sprite_sheet_generator.py')

DIRECTION8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
DIRECTION4 = ['n', 'e', 's', 'w']

PALETTE = {
    'outline': (10, 15, 30, 255),
    'hero_armor_light': (151, 177, 212, 255),
    'hero_armor_mid': (93, 124, 170, 255),
    'hero_armor_dark': (52, 74, 110, 255),
    'hero_glow': (63, 220, 255, 255),
    'hero_boot': (101, 73, 45, 255),
    'hero_shadow': (23, 33, 54, 255),

    'z_skin': (130, 171, 97, 255),
    'z_skin_dark': (82, 116, 57, 255),
    'z_cloth': (91, 81, 83, 255),
    'z_blood': (176, 42, 38, 255),

    'r_skin': (103, 137, 84, 255),
    'r_skin_dark': (61, 96, 46, 255),
    'r_cloth': (62, 67, 78, 255),
    'r_eye': (244, 88, 75, 255),

    'b_skin': (114, 92, 129, 255),
    'b_skin_dark': (71, 51, 88, 255),
    'b_cloth': (84, 64, 100, 255),
    'b_accent': (202, 115, 224, 255),
}

WALK_SWING = [0, 1, 0, -1]
ARM_SWING = [1, 0, -1, 0]
BOB = [0, -1, 0, 0]


def ensure_dirs() -> None:
    for p in [FRAMES_ROOT, SHEETS_ROOT, PREVIEW_ROOT]:
        p.mkdir(parents=True, exist_ok=True)


def new_canvas() -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def rect(draw: ImageDraw.ImageDraw, x0: int, y0: int, x1: int, y1: int, color: Tuple[int, int, int, int]) -> None:
    draw.rectangle([x0, y0, x1, y1], fill=color)


def px(draw: ImageDraw.ImageDraw, x: int, y: int, color: Tuple[int, int, int, int]) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        draw.point((x, y), fill=color)


def mirrored(img: Image.Image) -> Image.Image:
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def draw_weapon_front(draw: ImageDraw.ImageDraw, arm_shift: int) -> None:
    rect(draw, 9, 16 + arm_shift, 22, 17 + arm_shift, PALETTE['outline'])
    rect(draw, 10, 16 + arm_shift, 21, 17 + arm_shift, PALETTE['hero_glow'])
    rect(draw, 21, 15 + arm_shift, 22, 18 + arm_shift, PALETTE['hero_armor_dark'])


def hero_front(frame: int) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]
    b = BOB[frame]

    rect(draw, 11, 29, 20, 30, PALETTE['hero_shadow'])

    rect(draw, 12, 6 + b, 19, 11 + b, PALETTE['hero_armor_mid'])
    rect(draw, 13, 7 + b, 18, 10 + b, PALETTE['hero_armor_light'])
    rect(draw, 13, 9 + b, 18, 9 + b, PALETTE['hero_glow'])
    rect(draw, 12, 6 + b, 19, 6 + b, PALETTE['outline'])

    rect(draw, 11, 12 + b, 20, 21 + b, PALETTE['hero_armor_mid'])
    rect(draw, 12, 13 + b, 19, 19 + b, PALETTE['hero_armor_light'])
    rect(draw, 13, 16 + b, 18, 17 + b, PALETTE['hero_armor_dark'])

    rect(draw, 9, 14 + a + b, 10, 20 + a + b, PALETTE['hero_armor_mid'])
    rect(draw, 21, 14 - a + b, 22, 20 - a + b, PALETTE['hero_armor_mid'])

    rect(draw, 12, 22 + max(0, s) + b, 14, 28 + max(0, s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 17, 22 + max(0, -s) + b, 19, 28 + max(0, -s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 12, 28 + max(0, s) + b, 14, 29 + max(0, s) + b, PALETTE['hero_boot'])
    rect(draw, 17, 28 + max(0, -s) + b, 19, 29 + max(0, -s) + b, PALETTE['hero_boot'])

    draw_weapon_front(draw, -a // 2)
    return img


def hero_back(frame: int) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]
    b = BOB[frame]

    rect(draw, 11, 29, 20, 30, PALETTE['hero_shadow'])

    rect(draw, 12, 6 + b, 19, 11 + b, PALETTE['hero_armor_dark'])
    rect(draw, 13, 7 + b, 18, 10 + b, PALETTE['hero_armor_mid'])
    rect(draw, 14, 8 + b, 17, 9 + b, PALETTE['hero_armor_light'])

    rect(draw, 11, 12 + b, 20, 21 + b, PALETTE['hero_armor_dark'])
    rect(draw, 12, 13 + b, 19, 19 + b, PALETTE['hero_armor_mid'])
    rect(draw, 13, 16 + b, 18, 18 + b, PALETTE['hero_armor_light'])

    rect(draw, 9, 14 - a + b, 10, 20 - a + b, PALETTE['hero_armor_dark'])
    rect(draw, 21, 14 + a + b, 22, 20 + a + b, PALETTE['hero_armor_dark'])

    rect(draw, 12, 22 + max(0, s) + b, 14, 28 + max(0, s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 17, 22 + max(0, -s) + b, 19, 28 + max(0, -s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 12, 28 + max(0, s) + b, 14, 29 + max(0, s) + b, PALETTE['hero_boot'])
    rect(draw, 17, 28 + max(0, -s) + b, 19, 29 + max(0, -s) + b, PALETTE['hero_boot'])

    rect(draw, 11, 17 + b, 20, 18 + b, PALETTE['hero_glow'])
    return img


def hero_side_right(frame: int) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    b = BOB[frame]

    rect(draw, 11, 29, 20, 30, PALETTE['hero_shadow'])

    rect(draw, 13, 6 + b, 18, 11 + b, PALETTE['hero_armor_mid'])
    rect(draw, 14, 7 + b, 18, 10 + b, PALETTE['hero_armor_light'])
    rect(draw, 17, 8 + b, 18, 9 + b, PALETTE['hero_glow'])

    rect(draw, 13, 12 + b, 19, 21 + b, PALETTE['hero_armor_mid'])
    rect(draw, 14, 13 + b, 18, 19 + b, PALETTE['hero_armor_light'])

    rect(draw, 12, 14 + b, 13, 20 + b, PALETTE['hero_armor_dark'])
    rect(draw, 19, 15 + b, 20, 21 + b, PALETTE['hero_armor_dark'])

    rect(draw, 14, 22 + max(0, s) + b, 16, 28 + max(0, s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 17, 22 + max(0, -s) + b, 18, 28 + max(0, -s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 14, 28 + max(0, s) + b, 16, 29 + max(0, s) + b, PALETTE['hero_boot'])
    rect(draw, 17, 28 + max(0, -s) + b, 18, 29 + max(0, -s) + b, PALETTE['hero_boot'])

    rect(draw, 20, 16 + b, 27, 17 + b, PALETTE['outline'])
    rect(draw, 21, 16 + b, 26, 17 + b, PALETTE['hero_glow'])
    rect(draw, 26, 15 + b, 27, 18 + b, PALETTE['hero_armor_dark'])
    return img


def hero_diag_down_right(frame: int) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]
    b = BOB[frame]

    rect(draw, 11, 29, 21, 30, PALETTE['hero_shadow'])

    rect(draw, 12, 6 + b, 19, 11 + b, PALETTE['hero_armor_mid'])
    rect(draw, 13, 7 + b, 18, 10 + b, PALETTE['hero_armor_light'])
    rect(draw, 16, 9 + b, 18, 10 + b, PALETTE['hero_glow'])

    rect(draw, 11, 12 + b, 20, 21 + b, PALETTE['hero_armor_mid'])
    rect(draw, 12, 13 + b, 19, 19 + b, PALETTE['hero_armor_light'])

    rect(draw, 10, 14 + a + b, 11, 20 + a + b, PALETTE['hero_armor_dark'])
    rect(draw, 20, 15 - a + b, 22, 21 - a + b, PALETTE['hero_armor_dark'])

    rect(draw, 12, 22 + max(0, s) + b, 15, 28 + max(0, s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 17, 22 + max(0, -s) + b, 19, 28 + max(0, -s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 12, 28 + max(0, s) + b, 15, 29 + max(0, s) + b, PALETTE['hero_boot'])
    rect(draw, 17, 28 + max(0, -s) + b, 19, 29 + max(0, -s) + b, PALETTE['hero_boot'])

    for i in range(7):
        px(draw, 20 + i, 16 + i // 2 + b, PALETTE['outline'])
    for i in range(5):
        px(draw, 21 + i, 16 + i // 2 + b, PALETTE['hero_glow'])
    return img


def hero_diag_up_right(frame: int) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]
    b = BOB[frame]

    rect(draw, 11, 29, 21, 30, PALETTE['hero_shadow'])

    rect(draw, 12, 6 + b, 19, 11 + b, PALETTE['hero_armor_dark'])
    rect(draw, 13, 7 + b, 18, 10 + b, PALETTE['hero_armor_mid'])

    rect(draw, 11, 12 + b, 20, 21 + b, PALETTE['hero_armor_mid'])
    rect(draw, 12, 13 + b, 19, 19 + b, PALETTE['hero_armor_light'])

    rect(draw, 10, 14 - a + b, 11, 20 - a + b, PALETTE['hero_armor_dark'])
    rect(draw, 20, 15 + a + b, 22, 21 + a + b, PALETTE['hero_armor_dark'])

    rect(draw, 12, 22 + max(0, s) + b, 15, 28 + max(0, s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 17, 22 + max(0, -s) + b, 19, 28 + max(0, -s) + b, PALETTE['hero_armor_dark'])
    rect(draw, 12, 28 + max(0, s) + b, 15, 29 + max(0, s) + b, PALETTE['hero_boot'])
    rect(draw, 17, 28 + max(0, -s) + b, 19, 29 + max(0, -s) + b, PALETTE['hero_boot'])

    for i in range(7):
        px(draw, 20 + i, 17 - i // 2 + b, PALETTE['outline'])
    for i in range(5):
        px(draw, 21 + i, 17 - i // 2 + b, PALETTE['hero_glow'])
    return img


def draw_zombie_front(frame: int, kind: str) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]

    cfg = {
        'walker': {'skin': 'z_skin', 'skin_d': 'z_skin_dark', 'cloth': 'z_cloth', 'w': 9, 'h': 10, 'eye': PALETTE['z_blood']},
        'runner': {'skin': 'r_skin', 'skin_d': 'r_skin_dark', 'cloth': 'r_cloth', 'w': 7, 'h': 9, 'eye': PALETTE['r_eye']},
        'brute': {'skin': 'b_skin', 'skin_d': 'b_skin_dark', 'cloth': 'b_cloth', 'w': 12, 'h': 11, 'eye': PALETTE['b_accent']},
    }[kind]

    cx = 16
    hw = cfg['w'] // 2

    rect(draw, 10, 29, 22, 30, PALETTE['hero_shadow'])

    rect(draw, cx - hw, 7, cx + hw, 11, PALETTE[cfg['skin']])
    rect(draw, cx - hw + 1, 8, cx + hw - 1, 10, PALETTE[cfg['skin_d']])
    px(draw, cx - 2, 9, cfg['eye'])
    px(draw, cx + 2, 9, cfg['eye'])

    rect(draw, cx - hw - 1, 12, cx + hw + 1, 21, PALETTE[cfg['cloth']])
    rect(draw, cx - hw, 13, cx + hw, 19, PALETTE[cfg['skin_d']])

    rect(draw, cx - hw - 3, 14 + a, cx - hw - 2, 21 + a, PALETTE[cfg['skin_d']])
    rect(draw, cx + hw + 2, 14 - a, cx + hw + 3, 21 - a, PALETTE[cfg['skin_d']])

    rect(draw, cx - 4, 22 + max(0, s), cx - 2, 28 + max(0, s), PALETTE[cfg['skin_d']])
    rect(draw, cx + 2, 22 + max(0, -s), cx + 4, 28 + max(0, -s), PALETTE[cfg['skin_d']])

    if kind == 'runner':
        rect(draw, cx - 1, 13, cx + 1, 20, PALETTE[cfg['skin']])
    if kind == 'brute':
        rect(draw, cx - hw - 1, 15, cx + hw + 1, 17, PALETTE['b_accent'])
    return img


def draw_zombie_back(frame: int, kind: str) -> Image.Image:
    img = draw_zombie_front(frame, kind)
    draw = ImageDraw.Draw(img)
    rect(draw, 12, 9, 20, 10, PALETTE['outline'])
    if kind == 'runner':
        rect(draw, 13, 8, 19, 8, PALETTE['outline'])
    return img


def draw_zombie_side_right(frame: int, kind: str) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]

    cfg = {
        'walker': {'skin': 'z_skin', 'skin_d': 'z_skin_dark', 'cloth': 'z_cloth', 'w': 6},
        'runner': {'skin': 'r_skin', 'skin_d': 'r_skin_dark', 'cloth': 'r_cloth', 'w': 5},
        'brute': {'skin': 'b_skin', 'skin_d': 'b_skin_dark', 'cloth': 'b_cloth', 'w': 8},
    }[kind]

    rect(draw, 10, 29, 22, 30, PALETTE['hero_shadow'])

    rect(draw, 13, 7, 13 + cfg['w'], 11, PALETTE[cfg['skin']])
    rect(draw, 14, 8, 13 + cfg['w'], 10, PALETTE[cfg['skin_d']])
    px(draw, 13 + cfg['w'], 9, PALETTE['z_blood'] if kind == 'walker' else (PALETTE['r_eye'] if kind == 'runner' else PALETTE['b_accent']))

    rect(draw, 13, 12, 14 + cfg['w'], 21, PALETTE[cfg['cloth']])
    rect(draw, 14, 13, 13 + cfg['w'], 19, PALETTE[cfg['skin_d']])

    rect(draw, 12, 15, 13, 21, PALETTE[cfg['skin_d']])
    rect(draw, 15 + cfg['w'], 15, 16 + cfg['w'], 21, PALETTE[cfg['skin_d']])

    rect(draw, 14, 22 + max(0, s), 16, 28 + max(0, s), PALETTE[cfg['skin_d']])
    rect(draw, 17, 22 + max(0, -s), 18, 28 + max(0, -s), PALETTE[cfg['skin_d']])

    if kind == 'brute':
        rect(draw, 12, 13, 15 + cfg['w'], 15, PALETTE['b_accent'])
    return img


def hero_direction_frame(direction: str, frame: int) -> Image.Image:
    if direction == 's':
        return hero_front(frame)
    if direction == 'n':
        return hero_back(frame)
    if direction == 'e':
        return hero_side_right(frame)
    if direction == 'w':
        return mirrored(hero_side_right(frame))
    if direction == 'se':
        return hero_diag_down_right(frame)
    if direction == 'sw':
        return mirrored(hero_diag_down_right(frame))
    if direction == 'ne':
        return hero_diag_up_right(frame)
    if direction == 'nw':
        return mirrored(hero_diag_up_right(frame))
    raise ValueError(direction)


def zombie_direction_frame(kind: str, direction: str, frame: int) -> Image.Image:
    if direction == 's':
        return draw_zombie_front(frame, kind)
    if direction == 'n':
        return draw_zombie_back(frame, kind)
    if direction == 'e':
        return draw_zombie_side_right(frame, kind)
    if direction == 'w':
        return mirrored(draw_zombie_side_right(frame, kind))
    raise ValueError(direction)


def write_frame(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def load_sprite_sheet_generator():
    spec = importlib.util.spec_from_file_location('sprite_sheet_generator_skill', SPRITE_GENERATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Cannot load sprite sheet generator from {SPRITE_GENERATOR_PATH}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.SpriteSheetGenerator


def generate_sheet(frame_dir: Path, out_png: Path, grid: Tuple[int, int], size: Tuple[int, int] = (32, 32), padding: int = 0) -> List[Path]:
    SpriteSheetGenerator = load_sprite_sheet_generator()
    generator = SpriteSheetGenerator()
    generator.add_images_from_dir(str(frame_dir))
    generator.generate(str(out_png), grid=grid, sprite_size=size, padding=padding)
    files = sorted([p for p in frame_dir.iterdir() if p.suffix.lower() == '.png'])
    return files


def build_metadata(files: List[Path], cols: int, rows: int, frame_size: int, out_json: Path, tag_name: str, dirs: List[str], frames_per_dir: int) -> None:
    frames = {}
    for idx, fp in enumerate(files):
        row = idx // cols
        col = idx % cols
        frames[fp.stem] = {
            'frame': {
                'x': col * frame_size,
                'y': row * frame_size,
                'w': frame_size,
                'h': frame_size,
            },
            'duration': 120,
        }

    animations = {}
    for d_i, d in enumerate(dirs):
        seq = []
        for f in range(frames_per_dir):
            name = files[d_i * frames_per_dir + f].stem
            seq.append(name)
        animations[f'{tag_name}_{d}'] = seq

    payload = {
        'meta': {
            'image': out_json.with_suffix('.png').name,
            'size': {'w': cols * frame_size, 'h': rows * frame_size},
            'frameWidth': frame_size,
            'frameHeight': frame_size,
            'directions': dirs,
            'framesPerDirection': frames_per_dir,
        },
        'frames': frames,
        'animations': animations,
    }
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def build_preview(src_png: Path, out_png: Path, scale: int = 4) -> None:
    img = Image.open(src_png).convert('RGBA')
    up = img.resize((img.width * scale, img.height * scale), resample=Image.NEAREST)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    up.save(out_png)


def generate_frames() -> Dict[str, Path]:
    paths = {}

    hero_dir = FRAMES_ROOT / 'hero_8dir_walk'
    hero_dir.mkdir(parents=True, exist_ok=True)
    idx = 0
    for d in DIRECTION8:
        for f in range(FRAMES):
            img = hero_direction_frame(d, f)
            write_frame(img, hero_dir / f'f{idx:03d}_hero_{d}_walk_{f}.png')
            idx += 1
    paths['hero'] = hero_dir

    for z in ['walker', 'runner', 'brute']:
        z_dir = FRAMES_ROOT / f'zombie_{z}_4dir_walk'
        z_dir.mkdir(parents=True, exist_ok=True)
        z_idx = 0
        for d in DIRECTION4:
            for f in range(FRAMES):
                img = zombie_direction_frame(z, d, f)
                write_frame(img, z_dir / f'f{z_idx:03d}_zombie_{z}_{d}_walk_{f}.png')
                z_idx += 1
        paths[f'zombie_{z}'] = z_dir

    master = FRAMES_ROOT / 'master_pack'
    master.mkdir(parents=True, exist_ok=True)
    m_idx = 0
    for source in [paths['hero'], paths['zombie_walker'], paths['zombie_runner'], paths['zombie_brute']]:
        for fp in sorted(source.iterdir()):
            if fp.suffix.lower() != '.png':
                continue
            img = Image.open(fp).convert('RGBA')
            write_frame(img, master / f'f{m_idx:03d}_{fp.stem}.png')
            m_idx += 1
    paths['master'] = master
    return paths


def main() -> None:
    ensure_dirs()
    frame_dirs = generate_frames()

    hero_png = SHEETS_ROOT / 'hero_8dir_walk_32.png'
    hero_files = generate_sheet(frame_dirs['hero'], hero_png, grid=(FRAMES, len(DIRECTION8)))
    build_metadata(hero_files, cols=FRAMES, rows=len(DIRECTION8), frame_size=SIZE,
                   out_json=SHEETS_ROOT / 'hero_8dir_walk_32.json', tag_name='hero_walk', dirs=DIRECTION8, frames_per_dir=FRAMES)
    build_preview(hero_png, PREVIEW_ROOT / 'hero_8dir_walk_32_preview4x.png')

    for z in ['walker', 'runner', 'brute']:
        z_png = SHEETS_ROOT / f'zombie_{z}_4dir_walk_32.png'
        files = generate_sheet(frame_dirs[f'zombie_{z}'], z_png, grid=(FRAMES, len(DIRECTION4)))
        build_metadata(files, cols=FRAMES, rows=len(DIRECTION4), frame_size=SIZE,
                       out_json=SHEETS_ROOT / f'zombie_{z}_4dir_walk_32.json', tag_name=f'zombie_{z}_walk', dirs=DIRECTION4, frames_per_dir=FRAMES)
        build_preview(z_png, PREVIEW_ROOT / f'zombie_{z}_4dir_walk_32_preview4x.png')

    master_png = SHEETS_ROOT / 'survivor_plus_3zombies_master_32.png'
    master_files = generate_sheet(frame_dirs['master'], master_png, grid=(10, 8))
    master_payload = {
        'meta': {
            'image': master_png.name,
            'frameWidth': SIZE,
            'frameHeight': SIZE,
            'count': len(master_files),
            'layout': {'cols': 10, 'rows': 8},
            'order': ['hero_8dir_walk', 'zombie_walker_4dir_walk', 'zombie_runner_4dir_walk', 'zombie_brute_4dir_walk'],
        },
        'frames': {},
    }
    for idx, fp in enumerate(master_files):
        row = idx // 10
        col = idx % 10
        master_payload['frames'][fp.stem] = {
            'x': col * SIZE,
            'y': row * SIZE,
            'w': SIZE,
            'h': SIZE,
        }
    (SHEETS_ROOT / 'survivor_plus_3zombies_master_32.json').write_text(
        json.dumps(master_payload, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    build_preview(master_png, PREVIEW_ROOT / 'survivor_plus_3zombies_master_32_preview4x.png')

    print('Generated frames at:', FRAMES_ROOT)
    print('Generated sheets at:', SHEETS_ROOT)
    print('Generated previews at:', PREVIEW_ROOT)


if __name__ == '__main__':
    main()
