#!/usr/bin/env python3

from pathlib import Path
from PIL import Image

ROOT = Path("/Users/fengnian/my-game")
SRC = ROOT / "assets/itch/extracted/cainos-topdown-basic/Texture"
OUT = ROOT / "assets/itch/sliced/cainos-topdown-basic"
OUT.mkdir(parents=True, exist_ok=True)


def crop(src_name: str, box: tuple[int, int, int, int], out_name: str):
    src_path = SRC / src_name
    img = Image.open(src_path).convert("RGBA")
    tile = img.crop(box)
    tile.save(OUT / out_name)


def main():
    # Stone ground sheet (256x256), 32px grid
    crop("TX Tileset Stone Ground.png", (0, 0, 32, 32), "zone_city_tile.png")
    crop("TX Tileset Stone Ground.png", (160, 0, 192, 32), "zone_road_tile.png")
    crop("TX Tileset Stone Ground.png", (64, 96, 96, 128), "zone_industry_tile.png")
    crop("TX Tileset Stone Ground.png", (224, 224, 256, 256), "zone_wasteland_tile.png")

    # Wall/struct sheet (512x512), visual proxies for defense assets
    crop("TX Struct.png", (0, 0, 64, 64), "wall.png")
    crop("TX Struct.png", (448, 0, 512, 64), "gate.png")
    crop("TX Struct.png", (0, 128, 64, 192), "reinforced_wall.png")
    crop("TX Struct.png", (128, 256, 192, 320), "barricade.png")

    # Props sheet for base/store
    crop("TX Props.png", (224, 224, 288, 288), "storage.png")
    crop("TX Props.png", (32, 224, 96, 288), "workbench.png")
    crop("TX Props.png", (96, 224, 160, 288), "supply_crate.png")

    # Player sheet (128x128)
    crop("TX Player.png", (0, 0, 32, 32), "player.png")

    # Build larger storefront/counter placeholders from wall tiles
    wall = Image.open(OUT / "wall.png").convert("RGBA")
    store_front = Image.new("RGBA", (320, 170), (0, 0, 0, 0))
    for y in range(0, 170, 64):
        for x in range(0, 320, 64):
            store_front.alpha_composite(wall, (x, y))
    store_front.save(OUT / "store_front.png")

    counter = Image.new("RGBA", (120, 48), (0, 0, 0, 0))
    for y in range(0, 48, 32):
        for x in range(0, 120, 32):
            counter.alpha_composite(wall.resize((32, 32), Image.Resampling.NEAREST), (x, y))
    counter.save(OUT / "store_counter.png")

    print(f"sliced assets written to: {OUT}")


if __name__ == "__main__":
    main()
