import type { Resources } from '../state/GameState';

export type BuildZone = 'any' | 'inner' | 'outer';

export interface BuildingRequirement {
  buildingId: string;
  minCount: number;
}

export interface BuildingEcologyDef {
  roleCN: string;
  chainCN: string;
  zone: BuildZone;
  unlockDay?: number;
  requires?: BuildingRequirement[];
  dailyInput?: Partial<Resources>;
  upkeep?: Partial<Resources>;
  score?: {
    defense?: number;
    sustain?: number;
    industry?: number;
    comfort?: number;
    intel?: number;
  };
}

export interface BasePlacementRule {
  innerCenterX: number;
  innerCenterY: number;
  innerRadius: number;
  outerMinRadius: number;
}

export const BASE_PLACEMENT_RULE: BasePlacementRule = {
  innerCenterX: 1000,
  innerCenterY: 750,
  innerRadius: 350,
  outerMinRadius: 180,
};

export const BUILDING_ECOLOGY: Record<string, BuildingEcologyDef> = {
  wall: {
    roleCN: '防线基底',
    chainCN: '防线基础模块',
    zone: 'any',
    upkeep: { wood: 1 },
    score: { defense: 5 },
  },
  reinforced_wall: {
    roleCN: '重防骨架',
    chainCN: '防线强化（需基础墙体）',
    zone: 'any',
    requires: [{ buildingId: 'wall', minCount: 8 }],
    upkeep: { metal: 1 },
    score: { defense: 9 },
  },
  gate: {
    roleCN: '通行节点',
    chainCN: '封闭防线通行口',
    zone: 'any',
    requires: [{ buildingId: 'wall', minCount: 4 }],
    upkeep: { scrap: 1 },
    score: { defense: 4, comfort: 1 },
  },
  spike_trap: {
    roleCN: '近距阻截',
    chainCN: '外围陷阱链',
    zone: 'outer',
    requires: [{ buildingId: 'wall', minCount: 6 }],
    upkeep: { scrap: 1 },
    score: { defense: 4 },
  },
  electric_fence: {
    roleCN: '电网缓冲',
    chainCN: '需供电的外围阻截',
    zone: 'outer',
    unlockDay: 2,
    requires: [
      { buildingId: 'generator', minCount: 1 },
      { buildingId: 'wall', minCount: 8 },
    ],
    upkeep: { metal: 1, scrap: 1 },
    score: { defense: 6, intel: 1 },
  },
  mine_field: {
    roleCN: '爆破阻断',
    chainCN: '外圈高压爆破点',
    zone: 'outer',
    unlockDay: 3,
    requires: [
      { buildingId: 'workbench', minCount: 1 },
      { buildingId: 'wall', minCount: 8 },
    ],
    upkeep: { ammo: 2, scrap: 1 },
    score: { defense: 8 },
  },
  turret: {
    roleCN: '自动火力',
    chainCN: '基础防空火力网',
    zone: 'outer',
    requires: [
      { buildingId: 'generator', minCount: 1 },
      { buildingId: 'workbench', minCount: 1 },
    ],
    upkeep: { ammo: 1, scrap: 1 },
    score: { defense: 7, industry: 1 },
  },
  slow_turret: {
    roleCN: '控场炮台',
    chainCN: '火力网减速控制链',
    zone: 'outer',
    unlockDay: 2,
    requires: [
      { buildingId: 'turret', minCount: 1 },
      { buildingId: 'generator', minCount: 1 },
    ],
    upkeep: { ammo: 1, scrap: 1 },
    score: { defense: 8, intel: 1 },
  },
  laser_turret: {
    roleCN: '穿透火力',
    chainCN: '高能火力链（供电+侦测）',
    zone: 'outer',
    unlockDay: 4,
    requires: [
      { buildingId: 'generator', minCount: 2 },
      { buildingId: 'radar', minCount: 1 },
    ],
    upkeep: { energyCore: 1, scrap: 2 },
    score: { defense: 12, industry: 2 },
  },
  missile_turret: {
    roleCN: '区域轰炸',
    chainCN: '末端高压火力链',
    zone: 'outer',
    unlockDay: 6,
    requires: [
      { buildingId: 'ammo_factory', minCount: 1 },
      { buildingId: 'laser_turret', minCount: 1 },
    ],
    upkeep: { ammo: 3, metal: 1 },
    score: { defense: 15, industry: 2 },
  },
  generator: {
    roleCN: '能源核心',
    chainCN: '全基地供电主链',
    zone: 'inner',
    upkeep: { scrap: 1 },
    score: { industry: 6, sustain: 2 },
  },
  water_collector: {
    roleCN: '净水保障',
    chainCN: '生活生产水路',
    zone: 'inner',
    upkeep: { scrap: 1 },
    score: { sustain: 6 },
  },
  farm: {
    roleCN: '基础农业',
    chainCN: '净水 -> 农场 -> 厨房',
    zone: 'inner',
    requires: [{ buildingId: 'water_collector', minCount: 1 }],
    dailyInput: { water: 2 },
    upkeep: { wood: 1 },
    score: { sustain: 8, comfort: 1 },
  },
  kitchen_station: {
    roleCN: '口粮前置',
    chainCN: '轻量厨房节点',
    zone: 'inner',
    requires: [{ buildingId: 'water_collector', minCount: 1 }],
    dailyInput: { water: 1, food: 1 },
    upkeep: { wood: 1 },
    score: { sustain: 5, comfort: 2 },
  },
  kitchen: {
    roleCN: '口粮加工',
    chainCN: '农场/口粮加工终端',
    zone: 'inner',
    unlockDay: 2,
    requires: [
      { buildingId: 'farm', minCount: 1 },
      { buildingId: 'water_collector', minCount: 1 },
    ],
    dailyInput: { food: 2, water: 1 },
    upkeep: { wood: 1, scrap: 1 },
    score: { sustain: 9, comfort: 4 },
  },
  ammo_factory: {
    roleCN: '军备制造',
    chainCN: '工坊 -> 弹药制造链',
    zone: 'inner',
    unlockDay: 3,
    requires: [
      { buildingId: 'workbench', minCount: 1 },
      { buildingId: 'generator', minCount: 1 },
    ],
    dailyInput: { metal: 2, scrap: 1 },
    upkeep: { scrap: 1 },
    score: { industry: 10, defense: 2 },
  },
  storage: {
    roleCN: '物流仓储',
    chainCN: '仓储中枢（影响全链路效率）',
    zone: 'inner',
    upkeep: { wood: 1, scrap: 1 },
    score: { industry: 5, sustain: 3 },
  },
  workbench: {
    roleCN: '制造中枢',
    chainCN: '制造链入口',
    zone: 'inner',
    unlockDay: 2,
    requires: [
      { buildingId: 'storage', minCount: 1 },
      { buildingId: 'generator', minCount: 1 },
    ],
    upkeep: { scrap: 1 },
    score: { industry: 8 },
  },
  medical_station: {
    roleCN: '医疗保障',
    chainCN: '水路+仓储医疗链',
    zone: 'inner',
    unlockDay: 2,
    requires: [
      { buildingId: 'water_collector', minCount: 1 },
      { buildingId: 'storage', minCount: 1 },
    ],
    dailyInput: { water: 1, scrap: 1 },
    upkeep: { medical: 1 },
    score: { sustain: 6, comfort: 3 },
  },
  radar: {
    roleCN: '侦测节点',
    chainCN: '夜战预警与指挥链',
    zone: 'inner',
    unlockDay: 3,
    requires: [{ buildingId: 'generator', minCount: 1 }],
    upkeep: { scrap: 1 },
    score: { intel: 8, defense: 2 },
  },
  room_quarters: {
    roleCN: '生活宿舍',
    chainCN: '人口扩容与舒适度',
    zone: 'inner',
    requires: [{ buildingId: 'wall', minCount: 6 }],
    upkeep: { food: 1, water: 1 },
    score: { comfort: 7, sustain: 2 },
  },
  bunk_bed: {
    roleCN: '人口扩展',
    chainCN: '宿舍升级链',
    zone: 'inner',
    requires: [{ buildingId: 'room_quarters', minCount: 1 }],
    upkeep: { food: 1 },
    score: { comfort: 5, sustain: 1 },
  },
  guard_post: {
    roleCN: '哨戒指挥',
    chainCN: '防线巡逻链',
    zone: 'inner',
    requires: [{ buildingId: 'wall', minCount: 10 }],
    upkeep: { ammo: 1 },
    score: { defense: 6, intel: 2 },
  },
  teleporter: {
    roleCN: '远程机动',
    chainCN: '高阶机动链',
    zone: 'inner',
    unlockDay: 6,
    requires: [
      { buildingId: 'generator', minCount: 2 },
      { buildingId: 'radar', minCount: 1 },
    ],
    upkeep: { energyCore: 1, scrap: 2 },
    score: { industry: 6, intel: 4, comfort: 2 },
  },
  shield_generator: {
    roleCN: '防线护盾',
    chainCN: '终端防御链',
    zone: 'inner',
    unlockDay: 7,
    requires: [
      { buildingId: 'generator', minCount: 2 },
      { buildingId: 'workbench', minCount: 1 },
      { buildingId: 'storage', minCount: 1 },
    ],
    upkeep: { energyCore: 1, metal: 1 },
    score: { defense: 14, industry: 2 },
  },
  campfire: {
    roleCN: '生活氛围',
    chainCN: '舒适度与恢复',
    zone: 'inner',
    requires: [{ buildingId: 'room_quarters', minCount: 1 }],
    upkeep: { wood: 1 },
    score: { comfort: 4, sustain: 1 },
  },
  flag: {
    roleCN: '领地标识',
    chainCN: '基地核心锚点',
    zone: 'inner',
    score: { defense: 2, comfort: 1, intel: 1 },
  },
};

export function getBuildingEcology(buildingId: string): BuildingEcologyDef | null {
  return BUILDING_ECOLOGY[buildingId] || null;
}
