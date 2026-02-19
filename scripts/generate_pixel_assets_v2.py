#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw

SIZE = 32

ROOT = Path('/Users/fengnian/my-game')
OUT_ROOT = ROOT / 'assets' / 'generated' / 'pixel_pack_v2'
FRAMES_ROOT = OUT_ROOT / 'frames'
SHEETS_ROOT = OUT_ROOT / 'sheets'
PREVIEW_ROOT = OUT_ROOT / 'preview_4x'
SPRITE_GENERATOR_PATH = Path('/Users/fengnian/.agents/skills/sprite-sheet-generator/scripts/sprite_sheet_generator.py')

DIRECTION8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
DIRECTION4 = ['n', 'e', 's', 'w']

HERO_ACTIONS = {'walk': 4, 'attack': 4, 'hurt': 2, 'death': 6}
HERO_ACTION_ORDER = ['walk', 'attack', 'hurt', 'death']

ZOMBIE_ACTIONS = {'walk': 4, 'attack': 4, 'hurt': 2, 'death': 5}
ZOMBIE_ACTION_ORDER = ['walk', 'attack', 'hurt', 'death']

PALETTE = {
    'outline': (8, 12, 23, 255),

    'hero_armor_light': (148, 175, 207, 255),
    'hero_armor_mid': (86, 116, 160, 255),
    'hero_armor_dark': (42, 61, 95, 255),
    'hero_glow': (66, 220, 255, 255),
    'hero_boot': (94, 66, 43, 255),
    'hero_shadow': (15, 22, 37, 255),
    'hero_blood': (166, 34, 31, 255),

    'z_skin': (119, 161, 87, 255),
    'z_skin_dark': (72, 105, 51, 255),
    'z_cloth': (78, 70, 74, 255),
    'z_blood': (170, 40, 39, 255),

    'r_skin': (97, 128, 78, 255),
    'r_skin_dark': (57, 90, 44, 255),
    'r_cloth': (53, 58, 67, 255),
    'r_eye': (245, 83, 76, 255),

    'b_skin': (108, 83, 122, 255),
    'b_skin_dark': (66, 48, 82, 255),
    'b_cloth': (76, 58, 92, 255),
    'b_accent': (204, 114, 230, 255),

    'grime_1': (21, 30, 44, 255),
    'grime_2': (34, 44, 61, 255),
    'grime_3': (55, 61, 70, 255),
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


def shift_image(img: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, (dx, dy), img)
    return out


def tint_red(img: Image.Image, amount: float) -> Image.Image:
    amount = max(0.0, min(0.95, amount))
    out = img.copy()
    pix = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            nr = min(255, int(r + (255 - r) * amount * 0.55))
            ng = max(0, int(g * (1 - amount * 0.48)))
            nb = max(0, int(b * (1 - amount * 0.58)))
            pix[x, y] = (nr, ng, nb, a)
    return out


def collapse_image(img: Image.Image, progress: float, blood: Tuple[int, int, int, int]) -> Image.Image:
    progress = max(0.0, min(1.0, progress))
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

    nw = min(SIZE, max(8, int(SIZE * (1 + 0.20 * progress))))
    nh = max(5, int(SIZE * (1 - 0.70 * progress)))
    body = img.resize((nw, nh), resample=Image.NEAREST)

    x = (SIZE - nw) // 2 + int((progress - 0.5) * 2)
    y = SIZE - nh - int(progress * 2)
    out.paste(body, (x, y), body)

    d = ImageDraw.Draw(out)
    blood_w = 8 + int(9 * progress)
    blood_h = 1 + int(3 * progress)
    bx = SIZE // 2 - blood_w // 2
    by = SIZE - 2 - blood_h
    rect(d, bx, by, bx + blood_w, by + blood_h, blood)
    for i in range(2 + int(progress * 4)):
        px(d, bx + i * 2, by - 1, blood)
    return out


def add_distress(img: Image.Image, entity: str, action: str, direction: str, frame: int, blood_bias: float) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out)
    rng = random.Random(f'{entity}|{action}|{direction}|{frame}')

    pix = out.load()
    body = []
    edge = []
    for y in range(6, 30):
        for x in range(6, 26):
            if pix[x, y][3] == 0:
                continue
            body.append((x, y))
            if x <= 10 or x >= 21 or y <= 9 or y >= 26:
                edge.append((x, y))

    grime_pool = [PALETTE['grime_1'], PALETTE['grime_2'], PALETTE['grime_3']]
    grime_count = 14 if entity.startswith('hero') else 18
    for _ in range(grime_count):
        if not body:
            break
        x, y = rng.choice(body)
        current = pix[x, y]
        if current[3] == 0:
            continue
        if rng.random() < blood_bias:
            color = PALETTE['hero_blood'] if entity.startswith('hero') else PALETTE['z_blood']
            pix[x, y] = color
        elif rng.random() < 0.7:
            pix[x, y] = rng.choice(grime_pool)

    tear_count = 3 if action != 'death' else 5
    for _ in range(tear_count):
        if not edge:
            break
        x, y = rng.choice(edge)
        if rng.random() < 0.55:
            pix[x, y] = (0, 0, 0, 0)

    if action == 'death':
        for i in range(5):
            bx = 10 + i * 2 + rng.randint(0, 1)
            by = 28 + rng.randint(0, 1)
            px(draw, bx, by, PALETTE['hero_blood'] if entity.startswith('hero') else PALETTE['z_blood'])

    return out


def draw_weapon_front(draw: ImageDraw.ImageDraw, arm_shift: int) -> None:
    rect(draw, 9, 16 + arm_shift, 22, 17 + arm_shift, PALETTE['outline'])
    rect(draw, 10, 16 + arm_shift, 21, 17 + arm_shift, PALETTE['hero_glow'])
    rect(draw, 21, 15 + arm_shift, 22, 18 + arm_shift, PALETTE['hero_armor_dark'])


def draw_attack_trail(draw: ImageDraw.ImageDraw, direction: str, power: int, color: Tuple[int, int, int, int]) -> None:
    if power <= 0:
        return
    if direction in {'e', 'ne', 'se'}:
        for i in range(4 + power * 2):
            px(draw, 23 + i, 16 - i // 3, color)
    elif direction in {'w', 'nw', 'sw'}:
        for i in range(4 + power * 2):
            px(draw, 8 - i, 16 - i // 3, color)
    elif direction == 'n':
        for i in range(4 + power * 2):
            px(draw, 16 + i // 3, 10 - i, color)
    else:
        for i in range(4 + power * 2):
            px(draw, 16 + i // 3, 21 + i, color)


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


def hero_direction_walk(direction: str, frame: int) -> Image.Image:
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


def hero_frame(action: str, direction: str, frame: int) -> Image.Image:
    if action == 'walk':
        img = hero_direction_walk(direction, frame % HERO_ACTIONS['walk'])
        return add_distress(img, 'hero', action, direction, frame, blood_bias=0.12)

    if action == 'attack':
        attack_recoil = [0, -1, 0, 1]
        img = hero_direction_walk(direction, frame % HERO_ACTIONS['walk'])
        img = shift_image(img, attack_recoil[frame], 0)
        draw = ImageDraw.Draw(img)
        power = [1, 2, 3, 2][frame]
        draw_attack_trail(draw, direction, power, PALETTE['hero_glow'])
        if frame == 2:
            draw_attack_trail(draw, direction, power + 1, PALETTE['hero_armor_light'])
        return add_distress(img, 'hero', action, direction, frame, blood_bias=0.18)

    if action == 'hurt':
        img = hero_direction_walk(direction, 1)
        img = shift_image(img, -1 if frame == 0 else 1, -1 if frame == 1 else 0)
        img = tint_red(img, 0.28 if frame == 0 else 0.40)
        return add_distress(img, 'hero', action, direction, frame, blood_bias=0.35)

    if action == 'death':
        base = hero_direction_walk(direction, 0)
        progress = frame / (HERO_ACTIONS['death'] - 1)
        img = collapse_image(base, progress, PALETTE['hero_blood'])
        img = tint_red(img, 0.20 + progress * 0.25)
        return add_distress(img, 'hero', action, direction, frame, blood_bias=0.55)

    raise ValueError(action)


def draw_zombie_front(frame: int, kind: str) -> Image.Image:
    img, draw = new_canvas()
    s = WALK_SWING[frame]
    a = ARM_SWING[frame]

    cfg = {
        'walker': {'skin': 'z_skin', 'skin_d': 'z_skin_dark', 'cloth': 'z_cloth', 'w': 9, 'eye': PALETTE['z_blood']},
        'runner': {'skin': 'r_skin', 'skin_d': 'r_skin_dark', 'cloth': 'r_cloth', 'w': 7, 'eye': PALETTE['r_eye']},
        'brute': {'skin': 'b_skin', 'skin_d': 'b_skin_dark', 'cloth': 'b_cloth', 'w': 12, 'eye': PALETTE['b_accent']},
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
        'walker': {'skin': 'z_skin', 'skin_d': 'z_skin_dark', 'cloth': 'z_cloth', 'w': 6, 'eye': PALETTE['z_blood']},
        'runner': {'skin': 'r_skin', 'skin_d': 'r_skin_dark', 'cloth': 'r_cloth', 'w': 5, 'eye': PALETTE['r_eye']},
        'brute': {'skin': 'b_skin', 'skin_d': 'b_skin_dark', 'cloth': 'b_cloth', 'w': 8, 'eye': PALETTE['b_accent']},
    }[kind]

    rect(draw, 10, 29, 22, 30, PALETTE['hero_shadow'])

    rect(draw, 13, 7, 13 + cfg['w'], 11, PALETTE[cfg['skin']])
    rect(draw, 14, 8, 13 + cfg['w'], 10, PALETTE[cfg['skin_d']])
    px(draw, 13 + cfg['w'], 9, cfg['eye'])

    rect(draw, 13, 12, 14 + cfg['w'], 21, PALETTE[cfg['cloth']])
    rect(draw, 14, 13, 13 + cfg['w'], 19, PALETTE[cfg['skin_d']])

    rect(draw, 12, 15, 13, 21, PALETTE[cfg['skin_d']])
    rect(draw, 15 + cfg['w'], 15, 16 + cfg['w'], 21, PALETTE[cfg['skin_d']])

    rect(draw, 14, 22 + max(0, s), 16, 28 + max(0, s), PALETTE[cfg['skin_d']])
    rect(draw, 17, 22 + max(0, -s), 18, 28 + max(0, -s), PALETTE[cfg['skin_d']])

    if kind == 'brute':
        rect(draw, 12, 13, 15 + cfg['w'], 15, PALETTE['b_accent'])
    return img


def zombie_direction_walk(kind: str, direction: str, frame: int) -> Image.Image:
    if direction == 's':
        return draw_zombie_front(frame, kind)
    if direction == 'n':
        return draw_zombie_back(frame, kind)
    if direction == 'e':
        return draw_zombie_side_right(frame, kind)
    if direction == 'w':
        return mirrored(draw_zombie_side_right(frame, kind))
    raise ValueError(direction)


def draw_claw_trail(draw: ImageDraw.ImageDraw, direction: str, power: int, color: Tuple[int, int, int, int]) -> None:
    if direction == 'e':
        for i in range(3 + power):
            px(draw, 22 + i, 14 + (i % 2), color)
            px(draw, 22 + i, 17 + (i % 2), color)
    elif direction == 'w':
        for i in range(3 + power):
            px(draw, 9 - i, 14 + (i % 2), color)
            px(draw, 9 - i, 17 + (i % 2), color)
    elif direction == 'n':
        for i in range(3 + power):
            px(draw, 14 + (i % 2), 9 - i, color)
            px(draw, 17 + (i % 2), 9 - i, color)
    else:
        for i in range(3 + power):
            px(draw, 14 + (i % 2), 22 + i, color)
            px(draw, 17 + (i % 2), 22 + i, color)


def zombie_frame(kind: str, action: str, direction: str, frame: int) -> Image.Image:
    if action == 'walk':
        img = zombie_direction_walk(kind, direction, frame % ZOMBIE_ACTIONS['walk'])
        return add_distress(img, f'zombie_{kind}', action, direction, frame, blood_bias=0.24)

    if action == 'attack':
        img = zombie_direction_walk(kind, direction, frame % ZOMBIE_ACTIONS['walk'])
        recoil = [0, 1, 0, -1][frame]
        if direction in {'e', 'ne', 'se'}:
            img = shift_image(img, recoil, 0)
        elif direction in {'w', 'nw', 'sw'}:
            img = shift_image(img, -recoil, 0)
        draw = ImageDraw.Draw(img)
        power = [1, 2, 3, 2][frame]
        draw_claw_trail(draw, direction, power, PALETTE['z_blood'])
        if kind == 'runner':
            draw_claw_trail(draw, direction, max(1, power - 1), PALETTE['r_eye'])
        if kind == 'brute' and frame in {1, 2}:
            draw_claw_trail(draw, direction, power + 1, PALETTE['b_accent'])
        return add_distress(img, f'zombie_{kind}', action, direction, frame, blood_bias=0.38)

    if action == 'hurt':
        img = zombie_direction_walk(kind, direction, 0)
        img = shift_image(img, -1 if frame == 0 else 1, -1 if frame == 1 else 0)
        img = tint_red(img, 0.30 if frame == 0 else 0.45)
        return add_distress(img, f'zombie_{kind}', action, direction, frame, blood_bias=0.52)

    if action == 'death':
        base = zombie_direction_walk(kind, direction, 0)
        progress = frame / (ZOMBIE_ACTIONS['death'] - 1)
        blood = PALETTE['z_blood'] if kind != 'brute' else PALETTE['b_accent']
        img = collapse_image(base, progress, blood)
        img = tint_red(img, 0.24 + progress * 0.35)
        return add_distress(img, f'zombie_{kind}', action, direction, frame, blood_bias=0.68)

    raise ValueError(action)


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
    return sorted([p for p in frame_dir.iterdir() if p.suffix.lower() == '.png'])


def build_entity_metadata(
    files: List[Path],
    out_json: Path,
    cols: int,
    rows: int,
    directions: List[str],
    action_order: List[str],
    action_frames: Dict[str, int],
    prefix: str,
) -> None:
    frames: Dict[str, Dict[str, Dict[str, int] | int]] = {}
    for idx, fp in enumerate(files):
        row = idx // cols
        col = idx % cols
        frames[fp.stem] = {
            'frame': {'x': col * SIZE, 'y': row * SIZE, 'w': SIZE, 'h': SIZE},
            'duration': 120,
        }

    animations: Dict[str, List[str]] = {}
    per_row = cols
    for d_i, direction in enumerate(directions):
        row_start = d_i * per_row
        offset = 0
        for action in action_order:
            count = action_frames[action]
            seq = []
            for i in range(count):
                seq.append(files[row_start + offset + i].stem)
            animations[f'{prefix}_{direction}_{action}'] = seq
            offset += count

    payload = {
        'meta': {
            'image': out_json.with_suffix('.png').name,
            'size': {'w': cols * SIZE, 'h': rows * SIZE},
            'frameWidth': SIZE,
            'frameHeight': SIZE,
            'directions': directions,
            'actions': action_order,
            'framesPerDirection': sum(action_frames[a] for a in action_order),
            'actionFrames': action_frames,
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


def generate_hero_frames() -> Path:
    hero_dir = FRAMES_ROOT / 'hero_8dir_full'
    hero_dir.mkdir(parents=True, exist_ok=True)
    idx = 0
    for direction in DIRECTION8:
        for action in HERO_ACTION_ORDER:
            for frame in range(HERO_ACTIONS[action]):
                img = hero_frame(action, direction, frame)
                write_frame(img, hero_dir / f'f{idx:04d}_hero_{direction}_{action}_{frame}.png')
                idx += 1
    return hero_dir


def generate_zombie_frames(kind: str) -> Path:
    z_dir = FRAMES_ROOT / f'zombie_{kind}_4dir_full'
    z_dir.mkdir(parents=True, exist_ok=True)
    idx = 0
    for direction in DIRECTION4:
        for action in ZOMBIE_ACTION_ORDER:
            for frame in range(ZOMBIE_ACTIONS[action]):
                img = zombie_frame(kind, action, direction, frame)
                write_frame(img, z_dir / f'f{idx:04d}_zombie_{kind}_{direction}_{action}_{frame}.png')
                idx += 1
    return z_dir


def generate_master_pack(source_dirs: List[Tuple[str, Path]]) -> Tuple[Path, int]:
    master = FRAMES_ROOT / 'master_pack'
    master.mkdir(parents=True, exist_ok=True)
    idx = 0
    for _, source in source_dirs:
        for fp in sorted(source.iterdir()):
            if fp.suffix.lower() != '.png':
                continue
            img = Image.open(fp).convert('RGBA')
            write_frame(img, master / f'f{idx:04d}_{fp.stem}.png')
            idx += 1
    return master, idx


def build_master_metadata(files: List[Path], out_json: Path, cols: int, rows: int, groups: Dict[str, Tuple[int, int]]) -> None:
    payload = {
        'meta': {
            'image': out_json.with_suffix('.png').name,
            'frameWidth': SIZE,
            'frameHeight': SIZE,
            'count': len(files),
            'layout': {'cols': cols, 'rows': rows},
            'groups': {k: {'start': v[0], 'count': v[1]} for k, v in groups.items()},
        },
        'frames': {},
    }
    for idx, fp in enumerate(files):
        row = idx // cols
        col = idx % cols
        payload['frames'][fp.stem] = {'x': col * SIZE, 'y': row * SIZE, 'w': SIZE, 'h': SIZE}
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def main() -> None:
    ensure_dirs()

    hero_dir = generate_hero_frames()
    walker_dir = generate_zombie_frames('walker')
    runner_dir = generate_zombie_frames('runner')
    brute_dir = generate_zombie_frames('brute')

    hero_cols = sum(HERO_ACTIONS[a] for a in HERO_ACTION_ORDER)
    hero_rows = len(DIRECTION8)
    hero_png = SHEETS_ROOT / 'hero_8dir_full_v2_32.png'
    hero_files = generate_sheet(hero_dir, hero_png, grid=(hero_cols, hero_rows))
    build_entity_metadata(
        hero_files,
        SHEETS_ROOT / 'hero_8dir_full_v2_32.json',
        cols=hero_cols,
        rows=hero_rows,
        directions=DIRECTION8,
        action_order=HERO_ACTION_ORDER,
        action_frames=HERO_ACTIONS,
        prefix='hero',
    )
    build_preview(hero_png, PREVIEW_ROOT / 'hero_8dir_full_v2_32_preview4x.png')

    z_cols = sum(ZOMBIE_ACTIONS[a] for a in ZOMBIE_ACTION_ORDER)
    z_rows = len(DIRECTION4)
    for kind, d in [('walker', walker_dir), ('runner', runner_dir), ('brute', brute_dir)]:
        z_png = SHEETS_ROOT / f'zombie_{kind}_4dir_full_v2_32.png'
        z_files = generate_sheet(d, z_png, grid=(z_cols, z_rows))
        build_entity_metadata(
            z_files,
            SHEETS_ROOT / f'zombie_{kind}_4dir_full_v2_32.json',
            cols=z_cols,
            rows=z_rows,
            directions=DIRECTION4,
            action_order=ZOMBIE_ACTION_ORDER,
            action_frames=ZOMBIE_ACTIONS,
            prefix=f'zombie_{kind}',
        )
        build_preview(z_png, PREVIEW_ROOT / f'zombie_{kind}_4dir_full_v2_32_preview4x.png')

    source_dirs = [
        ('hero', hero_dir),
        ('zombie_walker', walker_dir),
        ('zombie_runner', runner_dir),
        ('zombie_brute', brute_dir),
    ]
    master_dir, total_count = generate_master_pack(source_dirs)
    master_cols = 16
    master_rows = (total_count + master_cols - 1) // master_cols
    master_png = SHEETS_ROOT / 'survivor_plus_3zombies_master_v2_32.png'
    master_files = generate_sheet(master_dir, master_png, grid=(master_cols, master_rows))

    groups: Dict[str, Tuple[int, int]] = {}
    offset = 0
    for name, d in source_dirs:
        count = len([p for p in d.iterdir() if p.suffix.lower() == '.png'])
        groups[name] = (offset, count)
        offset += count

    build_master_metadata(
        master_files,
        SHEETS_ROOT / 'survivor_plus_3zombies_master_v2_32.json',
        cols=master_cols,
        rows=master_rows,
        groups=groups,
    )
    build_preview(master_png, PREVIEW_ROOT / 'survivor_plus_3zombies_master_v2_32_preview4x.png')

    print('Generated V2 frames at:', FRAMES_ROOT)
    print('Generated V2 sheets at:', SHEETS_ROOT)
    print('Generated V2 previews at:', PREVIEW_ROOT)


if __name__ == '__main__':
    main()
