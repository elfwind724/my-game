import Phaser from 'phaser';
import {
  gameState,
  type GearAffix,
  type GearItem,
  type GearRarity,
  type GearStatBonuses,
  type GearWeaponType,
} from '../state/GameState';

interface GearRarityStyle {
  label: string;
  color: number;
  uiColor: string;
  powerMul: number;
}

interface GearAffixTemplate {
  id: string;
  kind: 'prefix' | 'suffix';
  nameCN: string;
  statKey: keyof GearStatBonuses;
  valueMin: number;
  valueMax: number;
  descType: 'percent' | 'flat';
  themes?: string[];
  weapons?: GearWeaponType[];
}

interface LegendaryPowerTemplate {
  id: string;
  nameCN: string;
  descCN: string;
  bonuses: Partial<GearStatBonuses>;
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
  orbit: '环绕刀刃',
  holy_water: '圣水',
  lightning_ring: '闪电环',
  boomerang: '回旋镖',
};

const SOURCE_THEME_LABELS: Record<string, string> = {
  ruins: '城区残骸',
  wilds: '荒野狩猎',
  depths: '洞穴矿脉',
  torrent: '河流淘金',
  apex: '首领战利',
};

const PREFIX_BY_RARITY: Record<GearRarity, string[]> = {
  common: ['民用', '改装', '训练', '简易'],
  magic: ['战术', '极光', '脉冲', '协同'],
  rare: ['特勤', '疾风', '裂隙', '星火'],
  epic: ['深空', '风暴', '寂光', '黑曜'],
  legendary: ['龙焰', '苍穹', '灭域', '天启'],
  mythic: ['弑神', '深渊', '终焉', '永恒'],
};

const SUFFIX_BY_RARITY: Record<GearRarity, string[]> = {
  common: ['框架', '组件', '模块'],
  magic: ['核心', '矩阵', '接口'],
  rare: ['棱镜', '谱系', '阵列'],
  epic: ['回路', '协议', '奇点'],
  legendary: ['界域', '终端', '天幕'],
  mythic: ['神谕', '王座', '终焉'],
};

const AFFIX_TEMPLATES: GearAffixTemplate[] = [
  { id: 'berserk', kind: 'prefix', nameCN: '狂暴', statKey: 'damageMul', valueMin: 0.06, valueMax: 0.18, descType: 'percent', themes: ['depths', 'apex'] },
  { id: 'rapid', kind: 'prefix', nameCN: '疾速', statKey: 'fireRateMul', valueMin: 0.05, valueMax: 0.16, descType: 'percent', themes: ['wilds', 'ruins'] },
  { id: 'farshot', kind: 'prefix', nameCN: '远星', statKey: 'rangeMul', valueMin: 0.08, valueMax: 0.22, descType: 'percent', themes: ['ruins', 'apex'], weapons: ['pistol', 'rifle', 'laser', 'boomerang'] },
  { id: 'overflow', kind: 'prefix', nameCN: '溢流', statKey: 'projectileBonus', valueMin: 1, valueMax: 2, descType: 'flat', themes: ['torrent', 'apex'], weapons: ['shotgun', 'flamethrower', 'orbit', 'holy_water', 'lightning_ring'] },
  { id: 'sunder', kind: 'suffix', nameCN: '破界', statKey: 'pierceBonus', valueMin: 1, valueMax: 2, descType: 'flat', themes: ['depths', 'apex'], weapons: ['rifle', 'laser', 'boomerang'] },
  { id: 'storm', kind: 'suffix', nameCN: '雷幕', statKey: 'chainBonus', valueMin: 1, valueMax: 2, descType: 'flat', themes: ['torrent', 'ruins'], weapons: ['lightning_ring', 'rifle', 'laser'] },
  { id: 'ember', kind: 'suffix', nameCN: '余烬', statKey: 'explosionRadiusMul', valueMin: 0.14, valueMax: 0.42, descType: 'percent', themes: ['depths', 'wilds'], weapons: ['rocket', 'holy_water', 'flamethrower'] },
  { id: 'tide', kind: 'suffix', nameCN: '潮汐', statKey: 'speedMul', valueMin: 0.05, valueMax: 0.16, descType: 'percent', themes: ['torrent'], weapons: ['pistol', 'rifle', 'boomerang', 'holy_water'] },
  { id: 'vigil', kind: 'prefix', nameCN: '守夜', statKey: 'damageMul', valueMin: 0.04, valueMax: 0.12, descType: 'percent', themes: ['wilds'], weapons: ['orbit', 'holy_water', 'lightning_ring'] },
  { id: 'salvage', kind: 'suffix', nameCN: '回收', statKey: 'projectileBonus', valueMin: 1, valueMax: 1, descType: 'flat', themes: ['ruins'], weapons: ['pistol', 'shotgun', 'rifle'] },
];

const LEGENDARY_POWERS: Record<GearWeaponType, LegendaryPowerTemplate[]> = {
  pistol: [
    { id: 'pistol_echo', nameCN: '镜返协议', descCN: '射程提升，并追加穿透', bonuses: { rangeMul: 1.18, pierceBonus: 1 } },
  ],
  shotgun: [
    { id: 'shotgun_hellbloom', nameCN: '地狱散华', descCN: '额外弹片并强化爆裂范围', bonuses: { projectileBonus: 2, explosionRadiusMul: 1.28 } },
  ],
  rifle: [
    { id: 'rifle_grid', nameCN: '交织矩阵', descCN: '射速、射程与穿透同步提升', bonuses: { fireRateMul: 1.14, rangeMul: 1.16, pierceBonus: 1 } },
  ],
  flamethrower: [
    { id: 'flame_wind', nameCN: '余烬风暴', descCN: '焚烧铺场更快，火焰范围更大', bonuses: { fireRateMul: 1.12, explosionRadiusMul: 1.34, projectileBonus: 1 } },
  ],
  laser: [
    { id: 'laser_null', nameCN: '零域切割', descCN: '极大强化穿透与射程', bonuses: { rangeMul: 1.24, pierceBonus: 2 } },
  ],
  rocket: [
    { id: 'rocket_comet', nameCN: '彗星坠落', descCN: '爆炸范围与伤害大幅提升', bonuses: { damageMul: 1.14, explosionRadiusMul: 1.42 } },
  ],
  orbit: [
    { id: 'orbit_phalanx', nameCN: '守夜环阵', descCN: '额外环刃并提升持续压制力', bonuses: { projectileBonus: 1, damageMul: 1.12, speedMul: 1.08 } },
  ],
  holy_water: [
    { id: 'holy_rain', nameCN: '圣痕雨', descCN: '投射数量增加，冲击范围扩大', bonuses: { projectileBonus: 1, explosionRadiusMul: 1.32 } },
  ],
  lightning_ring: [
    { id: 'ring_eye', nameCN: '风暴之眼', descCN: '链电分叉数提升，并追加一枚电环', bonuses: { chainBonus: 2, projectileBonus: 1 } },
  ],
  boomerang: [
    { id: 'boomerang_rift', nameCN: '裂返曲线', descCN: '回旋切割速度与穿透同步加强', bonuses: { speedMul: 1.14, pierceBonus: 1, rangeMul: 1.12 } },
  ],
};

let gearSeed = 0;

function getSourceTheme(enemyData: any): string {
  const behavior = String(enemyData?.behavior || enemyData?.enemyType || 'chase');
  if (enemyData?.isBoss) return 'apex';
  if (behavior.includes('heavy') || behavior.includes('tank') || behavior.includes('explode')) return 'depths';
  if (behavior.includes('stealth') || behavior.includes('ranged')) return 'ruins';
  if (behavior.includes('swarm') || behavior.includes('fast') || behavior.includes('wolf')) return 'wilds';
  return Math.random() < 0.22 ? 'torrent' : 'ruins';
}

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
  if (behavior.includes('explode')) return Math.random() < 0.7 ? 'rocket' : 'holy_water';
  if (behavior.includes('stealth')) return Math.random() < 0.5 ? 'pistol' : 'boomerang';
  if (behavior.includes('boss')) {
    const pool: GearWeaponType[] = ['laser', 'rocket', 'rifle', 'shotgun', 'lightning_ring', 'orbit'];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool: GearWeaponType[] = ['pistol', 'shotgun', 'rifle', 'flamethrower', 'laser', 'rocket', 'boomerang', 'holy_water', 'lightning_ring', 'orbit'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getAffixCountByRarity(rarity: GearRarity): number {
  if (rarity === 'magic') return 1;
  if (rarity === 'rare') return 2;
  if (rarity === 'epic') return 3;
  if (rarity === 'legendary') return 3;
  if (rarity === 'mythic') return 4;
  return 0;
}

function createItemName(
  rarity: GearRarity,
  weaponType: GearWeaponType,
  itemLevel: number,
  affixes: GearAffix[],
  legendaryPowerCN?: string
): string {
  const fallbackPrefixPool = PREFIX_BY_RARITY[rarity] || PREFIX_BY_RARITY.common;
  const fallbackSuffixPool = SUFFIX_BY_RARITY[rarity] || SUFFIX_BY_RARITY.common;
  const prefixAffix = affixes.find((affix) => affix.kind === 'prefix')?.nameCN
    || fallbackPrefixPool[Math.floor(Math.random() * fallbackPrefixPool.length)];
  const suffixAffix = affixes.find((affix) => affix.kind === 'suffix')?.nameCN
    || fallbackSuffixPool[Math.floor(Math.random() * fallbackSuffixPool.length)];
  const lvTag = `Lv.${Math.max(1, itemLevel)}`;
  const legendaryTag = legendaryPowerCN ? `${legendaryPowerCN}·` : '';
  return `${legendaryTag}${prefixAffix}${WEAPON_LABELS[weaponType]}·${suffixAffix} ${lvTag}`;
}

function calcSellValue(rarity: GearRarity, itemLevel: number, affixCount: number, hasLegendaryPower: boolean): number {
  const rarityFactor =
    rarity === 'common' ? 0.24 :
      rarity === 'magic' ? 0.48 :
        rarity === 'rare' ? 0.9 :
          rarity === 'epic' ? 1.7 :
            rarity === 'legendary' ? 3.3 : 5.2;
  const lvFactor = 1 + itemLevel * 0.08;
  const affixFactor = 1 + affixCount * 0.18 + (hasLegendaryPower ? 0.46 : 0);
  return Number((Math.max(0.02, rarityFactor * lvFactor * affixFactor)).toFixed(3));
}

function applyBonusValue(bonuses: GearStatBonuses, statKey: keyof GearStatBonuses, value: number): void {
  if (statKey === 'projectileBonus' || statKey === 'pierceBonus' || statKey === 'chainBonus') {
    const current = Math.max(0, Number(bonuses[statKey] || 0));
    bonuses[statKey] = Math.max(0, Math.round(current + value));
    return;
  }
  const current = Number(bonuses[statKey] || 1);
  bonuses[statKey] = Number((current + value).toFixed(3));
}

function scaleAffixValue(template: GearAffixTemplate, rarity: GearRarity, itemLevel: number): number {
  const t = Phaser.Math.FloatBetween(template.valueMin, template.valueMax);
  const rarityBias =
    rarity === 'magic' ? 0.95 :
      rarity === 'rare' ? 1.05 :
        rarity === 'epic' ? 1.12 :
          rarity === 'legendary' ? 1.22 : rarity === 'mythic' ? 1.32 : 0.88;
  const levelBias = 1 + Math.min(0.24, itemLevel * 0.008);
  const raw = t * rarityBias * levelBias;
  if (template.descType === 'flat') return Math.max(1, Math.round(raw));
  return Number(raw.toFixed(3));
}

function formatAffixDesc(template: GearAffixTemplate, value: number): string {
  if (template.descType === 'flat') {
    const sign = value >= 0 ? '+' : '';
    const label =
      template.statKey === 'projectileBonus' ? '额外投射' :
        template.statKey === 'pierceBonus' ? '穿透次数' :
          template.statKey === 'chainBonus' ? '链电分叉' : template.nameCN;
    return `${label}${sign}${value}`;
  }
  const sign = value >= 0 ? '+' : '';
  const label =
    template.statKey === 'damageMul' ? '伤害' :
      template.statKey === 'fireRateMul' ? '攻速' :
        template.statKey === 'speedMul' ? '弹速' :
          template.statKey === 'rangeMul' ? '射程' :
            template.statKey === 'explosionRadiusMul' ? '爆裂范围' : template.nameCN;
  return `${label}${sign}${Math.round(value * 100)}%`;
}

function buildAffix(
  template: GearAffixTemplate,
  rarity: GearRarity,
  itemLevel: number
): GearAffix {
  const value = scaleAffixValue(template, rarity, itemLevel);
  return {
    id: `${template.id}_${Math.round(value * 1000)}`,
    kind: template.kind,
    nameCN: template.nameCN,
    descCN: formatAffixDesc(template, value),
    tier: Math.max(1, Math.min(5, Math.floor(itemLevel / 5) + (rarity === 'mythic' ? 2 : rarity === 'legendary' ? 1 : 0))),
    statKey: template.statKey,
    value,
  };
}

function pickWeightedTemplate(
  templates: GearAffixTemplate[],
  theme: string,
  weaponType: GearWeaponType,
  usedIds: Set<string>
): GearAffixTemplate | null {
  const pool = templates
    .filter((template) => !usedIds.has(template.id))
    .map((template) => {
      let weight = 1;
      if (template.themes?.includes(theme)) weight += 1.6;
      if (template.weapons?.includes(weaponType)) weight += 1.2;
      return { template, weight };
    })
    .filter((entry) => entry.weight > 0);
  if (pool.length <= 0) return null;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.template;
  }
  return pool[0]?.template || null;
}

function rollAffixes(
  rarity: GearRarity,
  weaponType: GearWeaponType,
  itemLevel: number,
  sourceTheme: string
): GearAffix[] {
  const affixCount = getAffixCountByRarity(rarity);
  if (affixCount <= 0) return [];
  const usedIds = new Set<string>();
  const results: GearAffix[] = [];
  const prefixPool = AFFIX_TEMPLATES.filter((affix) => affix.kind === 'prefix');
  const suffixPool = AFFIX_TEMPLATES.filter((affix) => affix.kind === 'suffix');

  const firstPrefix = pickWeightedTemplate(prefixPool, sourceTheme, weaponType, usedIds);
  if (firstPrefix) {
    usedIds.add(firstPrefix.id);
    results.push(buildAffix(firstPrefix, rarity, itemLevel));
  }
  if (results.length < affixCount) {
    const firstSuffix = pickWeightedTemplate(suffixPool, sourceTheme, weaponType, usedIds);
    if (firstSuffix) {
      usedIds.add(firstSuffix.id);
      results.push(buildAffix(firstSuffix, rarity, itemLevel));
    }
  }
  while (results.length < affixCount) {
    const template = pickWeightedTemplate(AFFIX_TEMPLATES, sourceTheme, weaponType, usedIds);
    if (!template) break;
    usedIds.add(template.id);
    results.push(buildAffix(template, rarity, itemLevel));
  }
  return results;
}

function rollLegendaryPower(rarity: GearRarity, weaponType: GearWeaponType): LegendaryPowerTemplate | null {
  if (rarity !== 'legendary' && rarity !== 'mythic') return null;
  const pool = LEGENDARY_POWERS[weaponType] || [];
  if (pool.length <= 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createBaseBonuses(rarity: GearRarity, itemLevel: number, weaponType: GearWeaponType): GearStatBonuses {
  const rarityStyle = GEAR_RARITY_STYLES[rarity];
  const baseScale = rarityStyle.powerMul * (1 + itemLevel * 0.016);
  return {
    damageMul: Number((1 + 0.04 * baseScale + Math.random() * 0.03 * baseScale).toFixed(3)),
    fireRateMul: Number((1 + 0.022 * baseScale + Math.random() * 0.02 * baseScale).toFixed(3)),
    speedMul: Number((1 + 0.015 * baseScale + Math.random() * 0.015 * baseScale).toFixed(3)),
    projectileBonus: weaponType === 'flamethrower' || weaponType === 'shotgun'
      ? (rarity === 'legendary' || rarity === 'mythic' ? 1 : 0)
      : 0,
    rangeMul: 1,
    pierceBonus: 0,
    chainBonus: 0,
    explosionRadiusMul: 1,
  };
}

export class GearLootSystem {
  static getRarityStyle(rarity: GearRarity): GearRarityStyle {
    return GEAR_RARITY_STYLES[rarity];
  }

  static getThemeLabel(theme?: string): string {
    if (!theme) return '未知来源';
    return SOURCE_THEME_LABELS[theme] || theme;
  }

  static formatAffixSummary(item: GearItem, limit: number = 3): string {
    const names = (item.affixes || []).slice(0, limit).map((affix) => affix.nameCN);
    if (item.legendaryPowerCN) names.unshift(item.legendaryPowerCN);
    return names.join(' · ');
  }

  static formatBonusSummary(item: GearItem): string {
    const parts: string[] = [
      `伤x${item.bonuses.damageMul.toFixed(2)}`,
      `速x${item.bonuses.fireRateMul.toFixed(2)}`,
      `弹+${Math.max(0, item.bonuses.projectileBonus || 0)}`,
    ];
    if ((item.bonuses.rangeMul || 1) > 1.03) parts.push(`程+${Math.round(((item.bonuses.rangeMul || 1) - 1) * 100)}%`);
    if ((item.bonuses.pierceBonus || 0) > 0) parts.push(`穿+${item.bonuses.pierceBonus}`);
    if ((item.bonuses.chainBonus || 0) > 0) parts.push(`链+${item.bonuses.chainBonus}`);
    if ((item.bonuses.explosionRadiusMul || 1) > 1.04) parts.push(`爆+${Math.round(((item.bonuses.explosionRadiusMul || 1) - 1) * 100)}%`);
    return parts.join(' ');
  }

  static tryRollDrop(enemyData: any): GearItem | null {
    if (!enemyData) return null;
    const day = Math.max(1, gameState.data.currentDay || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const wave = Math.max(1, gameState.data.currentWave || 1);
    const isBoss = !!enemyData.isBoss;
    const isElite = enemyData.behavior === 'elite' || enemyData.enemyType === 'elite';
    const lootPerk = gameState.getBitcoinPerkBonuses();
    const sourceTheme = getSourceTheme(enemyData);
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
    const affixes = rollAffixes(rarity, weaponType, itemLevel, sourceTheme);
    const legendaryPower = rollLegendaryPower(rarity, weaponType);
    const bonuses = createBaseBonuses(rarity, itemLevel, weaponType);
    affixes.forEach((affix) => applyBonusValue(bonuses, affix.statKey, affix.value));
    if (legendaryPower) {
      Object.entries(legendaryPower.bonuses).forEach(([key, value]) => {
        if (typeof value === 'number') {
          applyBonusValue(bonuses, key as keyof GearStatBonuses, value);
        }
      });
    }
    const nameCN = createItemName(rarity, weaponType, itemLevel, affixes, legendaryPower?.nameCN);
    const sellValue = calcSellValue(rarity, itemLevel, affixes.length, !!legendaryPower);
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
      sourceTheme,
      sellValue,
      bonuses,
      affixes,
      legendaryPowerCN: legendaryPower?.nameCN,
    };
  }
}
