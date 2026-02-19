export type V2Action = 'walk' | 'attack' | 'hurt' | 'death';
export type EnemyV2Archetype = 'walker' | 'runner' | 'brute';

export const V2_FRAME_SIZE = 32;
export const HERO_V2_ROW_WIDTH = 16;
export const ENEMY_V2_ROW_WIDTH = 15;

export const HERO_V2_TEXTURE_KEY = 'hero_v2';
export const HERO_V2_SHEET_PATH = '/assets/generated/pixel_pack_v2/sheets/hero_8dir_full_v2_32.png';

export const ENEMY_V2_TEXTURE_KEYS: Record<EnemyV2Archetype, string> = {
  walker: 'zombie_v2_walker',
  runner: 'zombie_v2_runner',
  brute: 'zombie_v2_brute',
};

export const ENEMY_V2_SHEET_PATHS: Record<EnemyV2Archetype, string> = {
  walker: '/assets/generated/pixel_pack_v2/sheets/zombie_walker_4dir_full_v2_32.png',
  runner: '/assets/generated/pixel_pack_v2/sheets/zombie_runner_4dir_full_v2_32.png',
  brute: '/assets/generated/pixel_pack_v2/sheets/zombie_brute_4dir_full_v2_32.png',
};

export const HERO_V2_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type HeroV2Direction = (typeof HERO_V2_DIRECTIONS)[number];

export const ENEMY_V2_DIRECTIONS = ['n', 'e', 's', 'w'] as const;
export type EnemyV2Direction = (typeof ENEMY_V2_DIRECTIONS)[number];

export interface ActionFrameDef {
  start: number;
  count: number;
  frameRate: number;
  repeat: number;
}

export const HERO_V2_ACTIONS: Record<V2Action, ActionFrameDef> = {
  walk: { start: 0, count: 4, frameRate: 10, repeat: -1 },
  attack: { start: 4, count: 4, frameRate: 16, repeat: 0 },
  hurt: { start: 8, count: 2, frameRate: 10, repeat: 0 },
  death: { start: 10, count: 6, frameRate: 8, repeat: 0 },
};

export const ENEMY_V2_ACTIONS: Record<V2Action, ActionFrameDef> = {
  walk: { start: 0, count: 4, frameRate: 9, repeat: -1 },
  attack: { start: 4, count: 4, frameRate: 14, repeat: 0 },
  hurt: { start: 8, count: 2, frameRate: 10, repeat: 0 },
  death: { start: 10, count: 5, frameRate: 8, repeat: 0 },
};

export function mapLegacyEnemyTypeToV2Archetype(enemyType: string): EnemyV2Archetype {
  if (enemyType === 'runner') return 'runner';
  if (enemyType === 'tank') return 'brute';
  return 'walker';
}

export function heroAnimKey(dir: HeroV2Direction, action: V2Action): string {
  return `hero_${dir}_${action}`;
}

export function enemyAnimKey(kind: EnemyV2Archetype, dir: EnemyV2Direction, action: V2Action): string {
  return `zombie_${kind}_${dir}_${action}`;
}

export function getHeroFrameIndex(dir: HeroV2Direction, action: V2Action, frameOffset = 0): number {
  const row = HERO_V2_DIRECTIONS.indexOf(dir);
  const act = HERO_V2_ACTIONS[action];
  return row * HERO_V2_ROW_WIDTH + act.start + frameOffset;
}

export function getEnemyFrameIndex(dir: EnemyV2Direction, action: V2Action, frameOffset = 0): number {
  const row = ENEMY_V2_DIRECTIONS.indexOf(dir);
  const act = ENEMY_V2_ACTIONS[action];
  return row * ENEMY_V2_ROW_WIDTH + act.start + frameOffset;
}

export function buildFrameRange(
  row: number,
  rowWidth: number,
  start: number,
  count: number
): number[] {
  const first = row * rowWidth + start;
  const frames: number[] = [];
  for (let i = 0; i < count; i += 1) {
    frames.push(first + i);
  }
  return frames;
}

export function getActionDurationMs(actionDef: ActionFrameDef): number {
  return Math.round((actionDef.count / Math.max(1, actionDef.frameRate)) * 1000);
}
