import { gameState, type GearItem, type GearRarity, type GearWeaponType } from '../state/GameState';

interface GearRarityStyle {
  label: string;
  color: number;
  uiColor: string;
  powerMul: number;
}

const GEAR_RARITY_STYLES: Record<GearRarity, GearRarityStyle> = {
  common: { label: '普通', color: 0x94a3b8, uiColor: '#94a3b8', powerMul: 1 },
  magic: { label: '魔法', color: 0x3b82f6, uiColor: '#3b82f6', powerMul: 1.18 },
  rare: { label: '稀有', color: 0x10b981, uiColor: '#10b981', powerMul: 1.38 },
  epic: { label: '史诗', color: 0xa855f7, uiColor: '#a855f7', powerMul: 1.66 },
  legendary: { label: '传说', color: 0xf59e0b, uiColor: '#f59e0b', powerMul: 2.05 },
  mythic: { label: '神话', color: 0xef4444, uiColor: '#ef4444', powerMul: 2.5 },
};

const WEAPON_LABELS: Record<GearWeaponType, string> = {
  pistol: '基础激光',
  shotgun: '散射光波',
  rifle: '脉冲连射',
  flamethrower: '烈焰射线',
  laser: '穿透光束',
  rocket: '能量炮',
};

const PREFIX_BY_RARITY: Record<GearRarity, string[]> = {
  common: ['民用', '改装', '训练', '简易'],
  magic: ['战术', '极光', '脉冲', '协同'],
  rare: ['特勤', '疾风', '裂隙', '星火'],
  epic: ['深空', '风暴', '寂光', '黑曜'],
  legendary: ['龙焰', '苍穹', '灭域', '天启'],
  mythic: ['弑神', '深渊', '终焉', '永恒'],
};

const SUFFIX_POOL: string[] = [
  '模块',
  '核心',
  '框架',
  '引擎',
  '算法',
  '矩阵',
  'Mk-II',
  'Mk-III',
  'Mk-IV',
];

let gearSeed = 0;

function rollRarity(
  itemLevel: number,
  isBoss: boolean,
  isElite: boolean,
  perkBias: number
): GearRarity {
  const growth = Math.min(0.28, itemLevel * 0.006);
  const bossBias = isBoss ? 0.25 : 0;
  const eliteBias = isElite ? 0.12 : 0;
  const bias = growth + bossBias + eliteBias + Math.max(0, perkBias);
  let common = 0.58 - bias * 0.7;
  let magic = 0.25 - bias * 0.26;
  let rare = 0.11 + bias * 0.36;
  let epic = 0.045 + bias * 0.34;
  let legendary = 0.012 + bias * 0.2;
  let mythic = 0.003 + bias * 0.06;
  if (isBoss) {
    legendary += 0.08;
    mythic += 0.03;
    common *= 0.22;
  }
  if (isElite) {
    rare += 0.04;
    epic += 0.03;
    common *= 0.7;
  }
  const weights: Array<[GearRarity, number]> = [
    ['common', Math.max(0.02, common)],
    ['magic', Math.max(0.02, magic)],
    ['rare', Math.max(0.01, rare)],
    ['epic', Math.max(0.005, epic)],
    ['legendary', Math.max(0.002, legendary)],
    ['mythic', Math.max(0.001, mythic)],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, w] of weights) {
    roll -= w;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

function pickWeaponType(enemyData: any): GearWeaponType {
  const behavior = String(enemyData?.behavior || enemyData?.enemyType || 'chase');
  if (behavior.includes('ranged')) return Math.random() < 0.65 ? 'rifle' : 'laser';
  if (behavior.includes('heavy')) return Math.random() < 0.5 ? 'shotgun' : 'rocket';
  if (behavior.includes('explode')) return 'rocket';
  if (behavior.includes('stealth')) return Math.random() < 0.5 ? 'pistol' : 'rifle';
  if (behavior.includes('boss')) {
    const pool: GearWeaponType[] = ['laser', 'rocket', 'rifle', 'shotgun'];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool: GearWeaponType[] = ['pistol', 'shotgun', 'rifle', 'flamethrower', 'laser', 'rocket'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function createItemName(rarity: GearRarity, weaponType: GearWeaponType, itemLevel: number): string {
  const prefixPool = PREFIX_BY_RARITY[rarity] || PREFIX_BY_RARITY.common;
  const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
  const suffix = SUFFIX_POOL[Math.floor(Math.random() * SUFFIX_POOL.length)];
  const lvTag = `Lv.${Math.max(1, itemLevel)}`;
  return `${prefix}${WEAPON_LABELS[weaponType]}·${suffix} ${lvTag}`;
}

function computeProjectileBonus(rarity: GearRarity, weaponType: GearWeaponType): number {
  const base =
    rarity === 'mythic' ? 2 :
      rarity === 'legendary' ? 1 :
        rarity === 'epic' ? (Math.random() < 0.4 ? 1 : 0) :
          0;
  if (weaponType === 'flamethrower' || weaponType === 'shotgun') {
    return Math.min(3, base + (Math.random() < 0.3 ? 1 : 0));
  }
  return base;
}

function calcSellValue(rarity: GearRarity, itemLevel: number): number {
  const rarityFactor =
    rarity === 'common' ? 0.24 :
      rarity === 'magic' ? 0.48 :
        rarity === 'rare' ? 0.9 :
          rarity === 'epic' ? 1.7 :
            rarity === 'legendary' ? 3.3 : 5.2;
  const lvFactor = 1 + itemLevel * 0.08;
  return Number((Math.max(0.02, rarityFactor * lvFactor)).toFixed(3));
}

export class GearLootSystem {
  static getRarityStyle(rarity: GearRarity): GearRarityStyle {
    return GEAR_RARITY_STYLES[rarity];
  }

  static tryRollDrop(enemyData: any): GearItem | null {
    if (!enemyData) return null;
    const day = Math.max(1, gameState.data.currentDay || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const wave = Math.max(1, gameState.data.currentWave || 1);
    const isBoss = !!enemyData.isBoss;
    const isElite = enemyData.behavior === 'elite' || enemyData.enemyType === 'elite';
    const lootPerk = gameState.getBitcoinPerkBonuses();
    const baseChance = isBoss
      ? 1
      : isElite
        ? 0.22
        : enemyData.behavior === 'heavy' || enemyData.enemyType === 'heavy'
          ? 0.12
          : 0.065;
    const dropChance = Math.min(1, baseChance * lootPerk.gearDropChanceMul);
    if (Math.random() > dropChance) return null;

    const weaponType = pickWeaponType(enemyData);
    const itemLevel = Math.max(1, Math.floor(day * 0.8 + week * 1.4 + wave * 0.55 + Math.random() * 2));
    const rarity = rollRarity(itemLevel, isBoss, isElite, lootPerk.gearRarityBias);
    const rarityStyle = GEAR_RARITY_STYLES[rarity];
    const baseScale = rarityStyle.powerMul * (1 + itemLevel * 0.016);
    const damageMul = Number((1 + 0.04 * baseScale + Math.random() * 0.03 * baseScale).toFixed(3));
    const fireRateMul = Number((1 + 0.022 * baseScale + Math.random() * 0.02 * baseScale).toFixed(3));
    const speedMul = Number((1 + 0.015 * baseScale + Math.random() * 0.015 * baseScale).toFixed(3));
    const projectileBonus = computeProjectileBonus(rarity, weaponType);
    const nameCN = createItemName(rarity, weaponType, itemLevel);
    const sellValue = calcSellValue(rarity, itemLevel);
    gearSeed += 1;

    return {
      uid: `gear_${Date.now()}_${gearSeed}`,
      nameCN,
      weaponType,
      rarity,
      itemLevel,
      droppedDay: day,
      droppedWeek: week,
      sourceTag: String(enemyData.enemyType || enemyData.behavior || 'unknown'),
      sellValue,
      bonuses: {
        damageMul,
        fireRateMul,
        speedMul,
        projectileBonus,
      },
    };
  }
}
