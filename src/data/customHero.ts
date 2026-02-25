import Phaser from 'phaser';

export type CustomHeroDirection = 'n' | 's' | 'e' | 'w';

export const CUSTOM_HERO_RAW_KEYS = {
  s: 'player_custom_src_s',
  w: 'player_custom_src_w',
  e: 'player_custom_src_e',
  n: 'player_custom_src_n',
} as const;

export const CUSTOM_HERO_RAW_PATHS = {
  s: '/assets/主角正面.png',
  w: '/assets/主角向左.png',
  e: '/assets/主角向右.png',
  n: '/assets/主角背面.png',
} as const;

export const CUSTOM_HERO_KEYS = {
  s: 'player_custom_s',
  w: 'player_custom_w',
  e: 'player_custom_e',
  n: 'player_custom_n',
} as const;

export function customHeroTextureKey(direction: CustomHeroDirection): string {
  return CUSTOM_HERO_KEYS[direction];
}

export function hasCustomHeroDirectionalTextures(scene: Phaser.Scene): boolean {
  return (
    scene.textures.exists(CUSTOM_HERO_KEYS.s)
    && scene.textures.exists(CUSTOM_HERO_KEYS.w)
    && scene.textures.exists(CUSTOM_HERO_KEYS.e)
    && scene.textures.exists(CUSTOM_HERO_KEYS.n)
  );
}

export function resolvePreferredHeroPortraitTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(CUSTOM_HERO_KEYS.s)) return CUSTOM_HERO_KEYS.s;
  return 'player';
}
