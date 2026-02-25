/**
 * Building definitions - expanded from original BuildingTypes.ts
 * Material tiers, upgrade paths, expanded types
 */

import type { BaseJob } from './base';

export type BuildingCategory = 'defense' | 'turret' | 'production' | 'utility' | 'special';
export type BuildingFilterCategory = BuildingCategory | 'all';

export interface BuildingDef {
  id: string;
  name: string;
  nameCN: string;
  category: BuildingCategory;
  description: string;
  descriptionCN: string;
  tier: number; // 1-4
  maxTier: number;
  health: number;
  healthPerTier: number;
  cost: Record<string, number>; // resources
  upgradeCost?: Record<string, number>; // cost to upgrade to next tier
  size: number; // grid cells (1 = 64px)
  color: number;
  secondaryColor: number;
  special?: string;
  production?: { resource: string; amount: number; interval: number }; // per day
  powerProvided?: number; // adds to base power capacity
  powerUse?: number; // consumes power when active
  jobType?: BaseJob;
  jobSlots?: number;
}

export interface BuildingRequirement {
  buildingId: string;
  minCount: number;
}

export interface BuildingMorphUpgradeDef {
  fromId: string;
  toId: string;
  nameCN: string;
  requiresDay?: number;
  requiresBuildings?: BuildingRequirement[];
  costMul?: number;
}

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  // ===== DEFENSE =====
  wall: {
    id: 'wall',
    name: 'Wall',
    nameCN: '防护墙',
    category: 'defense',
    description: 'Basic defensive wall',
    descriptionCN: '基础防护墙，阻挡被控体',
    tier: 1,
    maxTier: 4,
    health: 100,
    healthPerTier: 100,
    cost: { wood: 5 },
    upgradeCost: { wood: 5, metal: 3 },
    size: 1,
    color: 0x8b6914,
    secondaryColor: 0xa67c00,
  },
  reinforced_wall: {
    id: 'reinforced_wall',
    name: 'Reinforced Wall',
    nameCN: '强化护盾墙',
    category: 'defense',
    description: 'Metal-reinforced wall',
    descriptionCN: '金属加固的护盾墙',
    tier: 2,
    maxTier: 4,
    health: 300,
    healthPerTier: 150,
    cost: { wood: 10, metal: 5 },
    upgradeCost: { metal: 10, scrap: 5 },
    size: 1,
    color: 0x666666,
    secondaryColor: 0x888888,
  },
  gate: {
    id: 'gate',
    name: 'Gate',
    nameCN: '防护门',
    category: 'defense',
    description: 'Opens for allies, blocks enemies',
    descriptionCN: '对友军开放，阻挡敌人',
    tier: 1,
    maxTier: 3,
    health: 150,
    healthPerTier: 100,
    cost: { wood: 8, metal: 3 },
    size: 1,
    color: 0x8b6914,
    secondaryColor: 0x0ea5e9,
  },
  spike_trap: {
    id: 'spike_trap',
    name: 'Spike Trap',
    nameCN: '电磁陷阱',
    category: 'defense',
    description: 'Damages enemies passing over it',
    descriptionCN: '对经过的敌人造成伤害',
    tier: 1,
    maxTier: 3,
    health: 50,
    healthPerTier: 30,
    cost: { metal: 5, scrap: 3 },
    size: 1,
    color: 0xcc6600,
    secondaryColor: 0xff9900,
    special: 'damage_aura',
  },
  electric_fence: {
    id: 'electric_fence',
    name: 'Electric Fence',
    nameCN: '电网围栏',
    category: 'defense',
    description: 'Slows and damages enemies',
    descriptionCN: '减速并伤害接触的敌人',
    tier: 2,
    maxTier: 3,
    health: 80,
    healthPerTier: 40,
    cost: { metal: 8, scrap: 5 },
    size: 1,
    color: 0x4488ff,
    secondaryColor: 0x66aaff,
    special: 'slow_damage',
  },
  mine_field: {
    id: 'mine_field',
    name: 'Mine Field',
    nameCN: '地雷区',
    category: 'defense',
    description: 'Explodes when enemy steps on it',
    descriptionCN: '敌人踩到时爆炸',
    tier: 2,
    maxTier: 2,
    health: 10,
    healthPerTier: 0,
    cost: { metal: 5, ammo: 10 },
    size: 1,
    color: 0x884400,
    secondaryColor: 0xff4400,
    special: 'mine',
  },

  // ===== TURRETS =====
  turret: {
    id: 'turret',
    name: 'AR Turret',
    nameCN: 'AR自动炮台',
    category: 'turret',
    description: 'Auto-targeting turret',
    descriptionCN: 'AI辅助瞄准，自动攻击',
    tier: 1,
    maxTier: 3,
    health: 200,
    healthPerTier: 100,
    cost: { metal: 15, scrap: 10 },
    upgradeCost: { metal: 15, scrap: 10, ammo: 10 },
    size: 1,
    color: 0x336699,
    secondaryColor: 0x0ea5e9,
    special: 'auto_fire',
    powerUse: 2,
  },
  laser_turret: {
    id: 'laser_turret',
    name: 'Laser Turret',
    nameCN: '激光炮台',
    category: 'turret',
    description: 'High-energy laser beam',
    descriptionCN: '高能激光束，穿透力极强',
    tier: 2,
    maxTier: 3,
    health: 250,
    healthPerTier: 120,
    cost: { metal: 25, energyCore: 1, scrap: 10 },
    size: 1,
    color: 0x006666,
    secondaryColor: 0x00ffff,
    special: 'laser_fire',
    powerUse: 3,
  },
  slow_turret: {
    id: 'slow_turret',
    name: 'Slow Turret',
    nameCN: '减速炮台',
    category: 'turret',
    description: 'Slows enemies in range',
    descriptionCN: '减缓范围内敌人移动速度',
    tier: 1,
    maxTier: 3,
    health: 150,
    healthPerTier: 80,
    cost: { metal: 12, scrap: 8 },
    size: 1,
    color: 0x336699,
    secondaryColor: 0x93c5fd,
    special: 'slow_aura',
    powerUse: 2,
  },
  missile_turret: {
    id: 'missile_turret',
    name: 'Missile Turret',
    nameCN: '导弹炮台',
    category: 'turret',
    description: 'Fires explosive missiles',
    descriptionCN: '发射爆炸性导弹',
    tier: 3,
    maxTier: 3,
    health: 300,
    healthPerTier: 150,
    cost: { metal: 30, ammo: 20, energyCore: 2 },
    size: 1,
    color: 0x663333,
    secondaryColor: 0xff4400,
    special: 'missile_fire',
    powerUse: 4,
  },

  // ===== PRODUCTION =====
  generator: {
    id: 'generator',
    name: 'Generator',
    nameCN: '发电站',
    category: 'production',
    description: 'Generates power and produces metal',
    descriptionCN: '提供电力上限，并产出金属零件',
    tier: 1,
    maxTier: 3,
    health: 100,
    healthPerTier: 50,
    cost: { wood: 10, metal: 10 },
    size: 1,
    color: 0x996633,
    secondaryColor: 0xfbbf24,
    production: { resource: 'metal', amount: 5, interval: 1 },
    powerProvided: 10,
    jobType: 'power',
    jobSlots: 1,
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    nameCN: '种植舱',
    category: 'production',
    description: 'Produces food each day',
    descriptionCN: '每天产出食物',
    tier: 1,
    maxTier: 3,
    health: 80,
    healthPerTier: 40,
    cost: { wood: 10, water: 5 },
    size: 1,
    color: 0x339933,
    secondaryColor: 0x66cc66,
    production: { resource: 'food', amount: 5, interval: 1 },
    jobType: 'farm',
    jobSlots: 2,
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    nameCN: '厨房',
    category: 'production',
    description: 'Turns ingredients into meals',
    descriptionCN: '将食材加工为口粮，提升幸福感',
    tier: 1,
    maxTier: 3,
    health: 90,
    healthPerTier: 40,
    cost: { wood: 12, metal: 6, water: 4 },
    size: 1,
    color: 0x665544,
    secondaryColor: 0xfbbf24,
    production: { resource: 'food', amount: 2, interval: 1 },
    jobType: 'kitchen',
    jobSlots: 2,
  },
  water_collector: {
    id: 'water_collector',
    name: 'Water Collector',
    nameCN: '净水装置',
    category: 'production',
    description: 'Produces water each day',
    descriptionCN: '每天净化水资源',
    tier: 1,
    maxTier: 3,
    health: 80,
    healthPerTier: 40,
    cost: { wood: 8, scrap: 5 },
    size: 1,
    color: 0x336699,
    secondaryColor: 0x66aaff,
    production: { resource: 'water', amount: 5, interval: 1 },
  },
  ammo_factory: {
    id: 'ammo_factory',
    name: 'Ammo Factory',
    nameCN: '弹药工厂',
    category: 'production',
    description: 'Produces ammo each day',
    descriptionCN: '每天产出弹药',
    tier: 2,
    maxTier: 3,
    health: 120,
    healthPerTier: 60,
    cost: { metal: 15, scrap: 10 },
    size: 1,
    color: 0x666633,
    secondaryColor: 0x999966,
    production: { resource: 'ammo', amount: 10, interval: 1 },
    jobType: 'workshop',
    jobSlots: 1,
  },

  // ===== UTILITY =====
  medical_station: {
    id: 'medical_station',
    name: 'Medical Station',
    nameCN: '医疗站',
    category: 'utility',
    description: 'Heals nearby units',
    descriptionCN: '恢复附近单位生命值',
    tier: 1,
    maxTier: 3,
    health: 100,
    healthPerTier: 50,
    cost: { wood: 5, medical: 5 },
    size: 1,
    color: 0xcc3333,
    secondaryColor: 0xff6666,
    special: 'heal_aura',
    jobType: 'medical',
    jobSlots: 1,
  },
  radar: {
    id: 'radar',
    name: 'Radar',
    nameCN: '信号塔',
    category: 'utility',
    description: 'Reveals enemies on minimap',
    descriptionCN: '显示小地图上的敌人位置',
    tier: 1,
    maxTier: 2,
    health: 80,
    healthPerTier: 40,
    cost: { metal: 10, scrap: 8 },
    size: 1,
    color: 0x336699,
    secondaryColor: 0x0ea5e9,
    special: 'radar',
    jobType: 'workshop',
    jobSlots: 1,
  },
  storage: {
    id: 'storage',
    name: 'Storage Vault',
    nameCN: '物资仓库',
    category: 'utility',
    description: 'Increases resource capacity',
    descriptionCN: '增加资源存储上限',
    tier: 1,
    maxTier: 3,
    health: 120,
    healthPerTier: 60,
    cost: { wood: 15, metal: 5 },
    size: 1,
    color: 0x996633,
    secondaryColor: 0xcc9966,
    special: 'storage',
    jobType: 'workshop',
    jobSlots: 1,
  },
  workbench: {
    id: 'workbench',
    name: 'Workbench',
    nameCN: '工作台',
    category: 'utility',
    description: 'Used for crafting items',
    descriptionCN: '用于制造物品',
    tier: 1,
    maxTier: 3,
    health: 100,
    healthPerTier: 50,
    cost: { wood: 10, metal: 8, scrap: 5 },
    size: 1,
    color: 0x996633,
    secondaryColor: 0xfbbf24,
    special: 'crafting',
    jobType: 'workshop',
    jobSlots: 1,
  },
  room_quarters: {
    id: 'room_quarters',
    name: 'Room Quarters',
    nameCN: '宿舍房间',
    category: 'utility',
    description: 'Personal room for survivors',
    descriptionCN: '伙伴住宿房间，提升基地生活感',
    tier: 1,
    maxTier: 3,
    health: 120,
    healthPerTier: 60,
    cost: { wood: 14, metal: 4, scrap: 4 },
    size: 1,
    color: 0x6b7280,
    secondaryColor: 0x94a3b8,
    special: 'housing',
  },
  bunk_bed: {
    id: 'bunk_bed',
    name: 'Bunk Bed',
    nameCN: '双层床位',
    category: 'utility',
    description: 'Resting furniture for companions',
    descriptionCN: '供伙伴休息的床位',
    tier: 1,
    maxTier: 2,
    health: 70,
    healthPerTier: 30,
    cost: { wood: 6, scrap: 4 },
    size: 1,
    color: 0x475569,
    secondaryColor: 0x93c5fd,
    special: 'rest',
  },
  guard_post: {
    id: 'guard_post',
    name: 'Guard Post',
    nameCN: '哨岗',
    category: 'defense',
    description: 'Watch point that strengthens defense line',
    descriptionCN: '提升防线控制能力的哨岗',
    tier: 1,
    maxTier: 3,
    health: 180,
    healthPerTier: 90,
    cost: { wood: 8, metal: 6 },
    size: 1,
    color: 0x334155,
    secondaryColor: 0xfbbf24,
    special: 'watch',
  },
  kitchen_station: {
    id: 'kitchen_station',
    name: 'Kitchen Station',
    nameCN: '炊事台',
    category: 'production',
    description: 'Small station that prepares daily rations',
    descriptionCN: '小型炊事台，稳定产出口粮',
    tier: 1,
    maxTier: 3,
    health: 90,
    healthPerTier: 35,
    cost: { wood: 8, water: 3, scrap: 3 },
    size: 1,
    color: 0x7c3f1d,
    secondaryColor: 0xf59e0b,
    production: { resource: 'food', amount: 2, interval: 1 },
    jobType: 'kitchen',
    jobSlots: 1,
  },

  // ===== SPECIAL =====
  teleporter: {
    id: 'teleporter',
    name: 'Teleporter',
    nameCN: '传送门',
    category: 'special',
    description: 'Fast travel between two points',
    descriptionCN: '在两个传送门之间快速移动',
    tier: 3,
    maxTier: 3,
    health: 200,
    healthPerTier: 100,
    cost: { energyCore: 3, metal: 20, scrap: 15 },
    size: 1,
    color: 0x6633cc,
    secondaryColor: 0xaa66ff,
    special: 'teleport',
  },
  shield_generator: {
    id: 'shield_generator',
    name: 'Shield Generator',
    nameCN: '护盾发生器',
    category: 'special',
    description: 'Creates protective energy field',
    descriptionCN: '产生保护性能量场',
    tier: 3,
    maxTier: 3,
    health: 300,
    healthPerTier: 150,
    cost: { energyCore: 5, metal: 30 },
    size: 1,
    color: 0x0066cc,
    secondaryColor: 0x00aaff,
    special: 'shield_aura',
  },
  campfire: {
    id: 'campfire',
    name: 'Light',
    nameCN: '光能灯',
    category: 'utility',
    description: 'Illuminates surrounding area',
    descriptionCN: '照亮周围区域',
    tier: 1,
    maxTier: 2,
    health: 50,
    healthPerTier: 25,
    cost: { wood: 3 },
    size: 1,
    color: 0xff9933,
    secondaryColor: 0xffcc66,
    special: 'light',
  },
  flag: {
    id: 'flag',
    name: 'Awakened Flag',
    nameCN: '觉醒旗帜',
    category: 'utility',
    description: 'Marks your territory',
    descriptionCN: '标记觉醒者领地',
    tier: 1,
    maxTier: 1,
    health: 30,
    healthPerTier: 0,
    cost: { wood: 2 },
    size: 1,
    color: 0x0ea5e9,
    secondaryColor: 0x38bdf8,
  },
};

export function getBuildingsForCategory(category: BuildingFilterCategory): BuildingDef[] {
  if (category === 'all') return Object.values(BUILDING_DEFS);
  return Object.values(BUILDING_DEFS).filter(b => b.category === category);
}

export const BUILD_CATEGORIES: Array<{ id: BuildingFilterCategory; nameCN: string; icon: string }> = [
  { id: 'all', nameCN: '全部', icon: '📦' },
  { id: 'defense', nameCN: '防御', icon: '🛡' },
  { id: 'turret', nameCN: '炮台', icon: '🔫' },
  { id: 'production', nameCN: '生产', icon: '⚙' },
  { id: 'utility', nameCN: '设施', icon: '🏠' },
  { id: 'special', nameCN: '特殊', icon: '⭐' },
];

export const BUILDING_MORPH_UPGRADES: BuildingMorphUpgradeDef[] = [
  {
    fromId: 'wall',
    toId: 'reinforced_wall',
    nameCN: '墙体加固',
    requiresDay: 2,
    requiresBuildings: [{ buildingId: 'workbench', minCount: 1 }],
    costMul: 0.68,
  },
  {
    fromId: 'turret',
    toId: 'slow_turret',
    nameCN: '炮塔控场改装',
    requiresDay: 2,
    requiresBuildings: [{ buildingId: 'workbench', minCount: 1 }],
    costMul: 0.72,
  },
  {
    fromId: 'turret',
    toId: 'laser_turret',
    nameCN: '炮塔激光改装',
    requiresDay: 3,
    requiresBuildings: [
      { buildingId: 'workbench', minCount: 1 },
      { buildingId: 'radar', minCount: 1 },
    ],
    costMul: 0.74,
  },
  {
    fromId: 'laser_turret',
    toId: 'missile_turret',
    nameCN: '炮塔导弹改装',
    requiresDay: 5,
    requiresBuildings: [
      { buildingId: 'workbench', minCount: 2 },
      { buildingId: 'radar', minCount: 1 },
      { buildingId: 'ammo_factory', minCount: 1 },
    ],
    costMul: 0.78,
  },
  {
    fromId: 'kitchen_station',
    toId: 'kitchen',
    nameCN: '炊事台升级厨房',
    requiresDay: 2,
    requiresBuildings: [{ buildingId: 'workbench', minCount: 1 }],
    costMul: 0.68,
  },
  {
    fromId: 'room_quarters',
    toId: 'bunk_bed',
    nameCN: '宿舍改造床位',
    requiresDay: 2,
    requiresBuildings: [{ buildingId: 'workbench', minCount: 1 }],
    costMul: 0.62,
  },
];

export function getBuildingMorphUpgrade(fromId: string, toId: string): BuildingMorphUpgradeDef | null {
  return BUILDING_MORPH_UPGRADES.find((item) => item.fromId === fromId && item.toId === toId) || null;
}

export function getBuildingTierTechRequirements(targetTier: number): BuildingRequirement[] {
  if (targetTier <= 1) return [];
  if (targetTier === 2) return [{ buildingId: 'workbench', minCount: 1 }];
  if (targetTier === 3) {
    return [
      { buildingId: 'workbench', minCount: 1 },
      { buildingId: 'radar', minCount: 1 },
    ];
  }
  return [
    { buildingId: 'workbench', minCount: 2 },
    { buildingId: 'radar', minCount: 1 },
    { buildingId: 'generator', minCount: 1 },
  ];
}

export function getBuildingUpgradeHint(buildingId: string): string {
  const selfDef = BUILDING_DEFS[buildingId];
  if (!selfDef) return '';
  const paths = BUILDING_MORPH_UPGRADES.filter((item) => item.fromId === buildingId).map((item) => {
    const toName = BUILDING_DEFS[item.toId]?.nameCN || item.toId;
    return `→ ${toName}`;
  });
  const tierHint = selfDef.maxTier > selfDef.tier ? `同座标升阶至T${selfDef.maxTier}` : '';
  const merged = [tierHint, ...paths].filter(Boolean);
  if (merged.length <= 0) return '无可用升级分支';
  return `升级树: ${merged.join(' / ')}`;
}
