/**
 * Enemy definitions - 10+ types with unique behaviors
 * Enemies scale with week number
 */

export type EnemyBehavior = 'chase' | 'run' | 'heavy' | 'ranged' | 'explode' | 'heal' | 'stealth' | 'elite' | 'boss_tyrant' | 'boss_necro' | 'boss_devourer';

export interface EnemyDef {
  id: string;
  name: string;
  nameCN: string;
  behavior: EnemyBehavior;
  baseHealth: number;
  baseDamage: number;
  speed: number;
  size: number; // pixel size for procedural sprite
  color: number;
  secondaryColor: number;
  healthPerWeek: number;
  damagePerWeek: number;
  xpValue: number;
  isBoss?: boolean;
  special?: string;
  unlockWeek: number; // first week this enemy can appear
  spawnWeight: number; // relative spawn frequency (higher = more common)
  lootTable?: LootEntry[];
}

export interface LootEntry {
  type: 'resource' | 'item' | 'xp';
  id: string;
  chance: number; // 0-1
  min: number;
  max: number;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  controlled: {
    id: 'controlled',
    name: 'Controlled',
    nameCN: '被控体',
    behavior: 'chase',
    baseHealth: 30,
    baseDamage: 8,
    speed: 60,
    size: 14,
    color: 0x666666,
    secondaryColor: 0xff0000,
    healthPerWeek: 15,
    damagePerWeek: 3,
    xpValue: 5,
    unlockWeek: 1,
    spawnWeight: 40,
    lootTable: [
      { type: 'resource', id: 'scrap', chance: 0.3, min: 1, max: 3 },
    ],
  },
  runner: {
    id: 'runner',
    name: 'Runner',
    nameCN: '狂奔体',
    behavior: 'run',
    baseHealth: 15,
    baseDamage: 5,
    speed: 140,
    size: 11,
    color: 0xaaaa33,
    secondaryColor: 0xff4400,
    healthPerWeek: 8,
    damagePerWeek: 2,
    xpValue: 4,
    special: 'dash_weave',
    unlockWeek: 1,
    spawnWeight: 25,
    lootTable: [
      { type: 'resource', id: 'food', chance: 0.2, min: 1, max: 2 },
    ],
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    nameCN: '重装体',
    behavior: 'heavy',
    baseHealth: 100,
    baseDamage: 20,
    speed: 35,
    size: 20,
    color: 0x555555,
    secondaryColor: 0xcc0000,
    healthPerWeek: 40,
    damagePerWeek: 5,
    xpValue: 12,
    special: 'brace_surge',
    unlockWeek: 2,
    spawnWeight: 10,
    lootTable: [
      { type: 'resource', id: 'metal', chance: 0.4, min: 2, max: 5 },
      { type: 'resource', id: 'scrap', chance: 0.5, min: 1, max: 3 },
    ],
  },
  ranged: {
    id: 'ranged',
    name: 'Ranged',
    nameCN: '远程体',
    behavior: 'ranged',
    baseHealth: 25,
    baseDamage: 12,
    speed: 50,
    size: 13,
    color: 0x9933cc,
    secondaryColor: 0xff00ff,
    healthPerWeek: 12,
    damagePerWeek: 4,
    xpValue: 8,
    special: 'strafe_shot',
    unlockWeek: 2,
    spawnWeight: 12,
    lootTable: [
      { type: 'resource', id: 'ammo', chance: 0.3, min: 3, max: 8 },
    ],
  },
  exploder: {
    id: 'exploder',
    name: 'Exploder',
    nameCN: '爆破体',
    behavior: 'explode',
    baseHealth: 20,
    baseDamage: 30,
    speed: 70,
    size: 15,
    color: 0xff6600,
    secondaryColor: 0xffcc00,
    healthPerWeek: 10,
    damagePerWeek: 8,
    xpValue: 10,
    special: 'explode_on_death',
    unlockWeek: 3,
    spawnWeight: 8,
    lootTable: [
      { type: 'resource', id: 'scrap', chance: 0.5, min: 2, max: 5 },
    ],
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    nameCN: '治愈体',
    behavior: 'heal',
    baseHealth: 40,
    baseDamage: 5,
    speed: 45,
    size: 14,
    color: 0x00cc66,
    secondaryColor: 0x00ff88,
    healthPerWeek: 20,
    damagePerWeek: 2,
    xpValue: 15,
    special: 'heal_nearby',
    unlockWeek: 3,
    spawnWeight: 5,
    lootTable: [
      { type: 'resource', id: 'medical', chance: 0.5, min: 1, max: 3 },
    ],
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth',
    nameCN: '隐形体',
    behavior: 'stealth',
    baseHealth: 20,
    baseDamage: 15,
    speed: 80,
    size: 12,
    color: 0x333366,
    secondaryColor: 0x6666ff,
    healthPerWeek: 10,
    damagePerWeek: 5,
    xpValue: 12,
    special: 'invisibility',
    unlockWeek: 3,
    spawnWeight: 6,
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    nameCN: '精英体',
    behavior: 'elite',
    baseHealth: 80,
    baseDamage: 18,
    speed: 70,
    size: 17,
    color: 0xcc6600,
    secondaryColor: 0xffaa00,
    healthPerWeek: 30,
    damagePerWeek: 6,
    xpValue: 25,
    special: 'random_buff',
    unlockWeek: 2,
    spawnWeight: 4,
    lootTable: [
      { type: 'resource', id: 'metal', chance: 0.5, min: 3, max: 7 },
      { type: 'resource', id: 'energyCore', chance: 0.1, min: 1, max: 1 },
    ],
  },

  // ===== ADVANCED ENEMIES =====
  swarm: {
    id: 'swarm',
    name: 'Swarm',
    nameCN: '蜂群体',
    behavior: 'chase',
    baseHealth: 8,
    baseDamage: 3,
    speed: 110,
    size: 9,
    color: 0xaacc00,
    secondaryColor: 0xddff33,
    healthPerWeek: 4,
    damagePerWeek: 1,
    xpValue: 2,
    special: 'pack_rush',
    unlockWeek: 1,
    spawnWeight: 30,
    lootTable: [
      { type: 'resource', id: 'scrap', chance: 0.15, min: 1, max: 1 },
    ],
  },
  shield_bearer: {
    id: 'shield_bearer',
    name: 'Shield Bearer',
    nameCN: '护盾体',
    behavior: 'heavy',
    baseHealth: 120,
    baseDamage: 12,
    speed: 40,
    size: 18,
    color: 0x3366cc,
    secondaryColor: 0x66aaff,
    healthPerWeek: 50,
    damagePerWeek: 4,
    xpValue: 18,
    special: 'shield_regen',
    unlockWeek: 2,
    spawnWeight: 6,
    lootTable: [
      { type: 'resource', id: 'metal', chance: 0.5, min: 3, max: 6 },
      { type: 'resource', id: 'scrap', chance: 0.3, min: 2, max: 4 },
    ],
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    nameCN: '狂暴体',
    behavior: 'chase',
    baseHealth: 60,
    baseDamage: 14,
    speed: 75,
    size: 16,
    color: 0xcc3300,
    secondaryColor: 0xff6600,
    healthPerWeek: 25,
    damagePerWeek: 5,
    xpValue: 14,
    special: 'enrage_on_hit',
    unlockWeek: 2,
    spawnWeight: 8,
    lootTable: [
      { type: 'resource', id: 'food', chance: 0.3, min: 2, max: 4 },
      { type: 'resource', id: 'ammo', chance: 0.2, min: 2, max: 5 },
    ],
  },
  spitter: {
    id: 'spitter',
    name: 'Spitter',
    nameCN: '毒液体',
    behavior: 'ranged',
    baseHealth: 30,
    baseDamage: 8,
    speed: 55,
    size: 14,
    color: 0x33cc33,
    secondaryColor: 0x00ff66,
    healthPerWeek: 15,
    damagePerWeek: 3,
    xpValue: 10,
    special: 'acid_pool',
    unlockWeek: 3,
    spawnWeight: 7,
    lootTable: [
      { type: 'resource', id: 'medical', chance: 0.25, min: 1, max: 2 },
      { type: 'resource', id: 'water', chance: 0.2, min: 1, max: 3 },
    ],
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    nameCN: '召唤体',
    behavior: 'ranged',
    baseHealth: 50,
    baseDamage: 6,
    speed: 35,
    size: 16,
    color: 0x660099,
    secondaryColor: 0xaa33ff,
    healthPerWeek: 20,
    damagePerWeek: 2,
    xpValue: 20,
    special: 'summon_minions',
    unlockWeek: 3,
    spawnWeight: 4,
    lootTable: [
      { type: 'resource', id: 'energyCore', chance: 0.15, min: 1, max: 1 },
      { type: 'resource', id: 'scrap', chance: 0.4, min: 2, max: 4 },
    ],
  },
  parasite: {
    id: 'parasite',
    name: 'Parasite',
    nameCN: '寄生体',
    behavior: 'stealth',
    baseHealth: 18,
    baseDamage: 10,
    speed: 90,
    size: 10,
    color: 0x996633,
    secondaryColor: 0xcc9966,
    healthPerWeek: 8,
    damagePerWeek: 4,
    xpValue: 8,
    special: 'life_drain',
    unlockWeek: 2,
    spawnWeight: 9,
    lootTable: [
      { type: 'resource', id: 'medical', chance: 0.35, min: 1, max: 3 },
    ],
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    nameCN: '投弹体',
    behavior: 'ranged',
    baseHealth: 35,
    baseDamage: 22,
    speed: 45,
    size: 15,
    color: 0xcc6633,
    secondaryColor: 0xff9933,
    healthPerWeek: 15,
    damagePerWeek: 7,
    xpValue: 12,
    special: 'lob_attack',
    unlockWeek: 3,
    spawnWeight: 5,
    lootTable: [
      { type: 'resource', id: 'ammo', chance: 0.4, min: 3, max: 8 },
      { type: 'resource', id: 'scrap', chance: 0.3, min: 2, max: 4 },
    ],
  },

  // ===== BOSSES =====
  boss_tyrant: {
    id: 'boss_tyrant',
    name: 'Tyrant Core',
    nameCN: 'AI核心·暴君',
    behavior: 'boss_tyrant',
    baseHealth: 800,
    baseDamage: 30,
    speed: 50,
    size: 30,
    color: 0xcc0000,
    secondaryColor: 0xff0000,
    healthPerWeek: 300,
    damagePerWeek: 10,
    xpValue: 200,
    isBoss: true,
    special: 'aoe_slam',
    unlockWeek: 1,
    spawnWeight: 0,
    lootTable: [
      { type: 'resource', id: 'energyCore', chance: 1, min: 2, max: 5 },
      { type: 'resource', id: 'metal', chance: 1, min: 10, max: 20 },
    ],
  },
  boss_necro: {
    id: 'boss_necro',
    name: 'Necro Core',
    nameCN: 'AI核心·死灵',
    behavior: 'boss_necro',
    baseHealth: 600,
    baseDamage: 15,
    speed: 40,
    size: 28,
    color: 0x660066,
    secondaryColor: 0xcc00cc,
    healthPerWeek: 250,
    damagePerWeek: 5,
    xpValue: 200,
    isBoss: true,
    special: 'summon_minions',
    unlockWeek: 2,
    spawnWeight: 0,
    lootTable: [
      { type: 'resource', id: 'energyCore', chance: 1, min: 3, max: 5 },
      { type: 'resource', id: 'medical', chance: 1, min: 5, max: 10 },
    ],
  },
  boss_devourer: {
    id: 'boss_devourer',
    name: 'Devourer Core',
    nameCN: 'AI核心·吞噬者',
    behavior: 'boss_devourer',
    baseHealth: 1000,
    baseDamage: 25,
    speed: 30,
    size: 35,
    color: 0x003300,
    secondaryColor: 0x00ff00,
    healthPerWeek: 400,
    damagePerWeek: 8,
    xpValue: 250,
    isBoss: true,
    special: 'pull_in',
    unlockWeek: 3,
    spawnWeight: 0,
    lootTable: [
      { type: 'resource', id: 'energyCore', chance: 1, min: 5, max: 8 },
    ],
  },
};

/**
 * Get enemy stats scaled for a specific week
 */
export function getEnemyForWeek(enemyId: string, week: number): EnemyDef | null {
  const base = ENEMY_DEFS[enemyId];
  if (!base) return null;
  const weekMult = Math.max(0, week - 1);
  return {
    ...base,
    baseHealth: base.baseHealth + base.healthPerWeek * weekMult,
    baseDamage: base.baseDamage + base.damagePerWeek * weekMult,
    speed: base.speed + weekMult * 3,
  };
}

/**
 * Get available enemy types for a given week
 */
export function getEnemiesForWeek(week: number): EnemyDef[] {
  return Object.values(ENEMY_DEFS)
    .filter(e => !e.isBoss && e.unlockWeek <= week);
}

/**
 * Get a random boss for the given week
 */
export function getRandomBoss(week: number): EnemyDef | null {
  const bosses = Object.values(ENEMY_DEFS).filter(e => e.isBoss && e.unlockWeek <= week);
  if (bosses.length === 0) return null;
  return bosses[Math.floor(Math.random() * bosses.length)];
}
