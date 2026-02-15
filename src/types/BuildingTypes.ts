// ===== BUILDING SYSTEM TYPES =====

export type BuildingCategory = 'defense' | 'production' | 'utility' | 'decoration';

export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  category: BuildingCategory;
  texture: string;
  cost: BuildingCost;
  size: { width: number; height: number };
  health: number;
  buildTime: number; // milliseconds
  effects?: BuildingEffect[];
  unlockDay?: number;
}

export interface BuildingCost {
  wood?: number;
  metal?: number;
  scrap?: number;
}

export interface BuildingEffect {
  type: 'damage' | 'slow' | 'range' | 'production' | 'storage' | 'heal';
  value: number;
  radius?: number;
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  sprite?: Phaser.GameObjects.Sprite;
  isConstructing?: boolean;
  constructionProgress?: number;
}

// Building definitions
export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = {
  // ===== 防御设施 =====
  wall: {
    id: 'wall',
    name: '防护墙',
    description: '能量护盾加固的防护墙，阻挡被控体',
    category: 'defense',
    texture: 'wall',
    cost: { wood: 5, metal: 2 },
    size: { width: 64, height: 64 },
    health: 200,
    buildTime: 500
  },
  reinforcedWall: {
    id: 'reinforcedWall',
    name: '强化护盾墙',
    description: '双层能量加固的护盾墙',
    category: 'defense',
    texture: 'wall',
    cost: { wood: 10, metal: 8 },
    size: { width: 64, height: 64 },
    health: 500,
    buildTime: 1000,
    unlockDay: 3
  },
  barricade: {
    id: 'barricade',
    name: '干扰路障',
    description: 'AR信号干扰，减缓被控体移动',
    category: 'defense',
    texture: 'barricade',
    cost: { wood: 8 },
    size: { width: 64, height: 64 },
    health: 100,
    buildTime: 300,
    effects: [{ type: 'slow', value: 0.5, radius: 80 }]
  },
  spikeTrap: {
    id: 'spikeTrap',
    name: '电磁陷阱',
    description: '释放电流，对经过的被控体造成伤害',
    category: 'defense',
    texture: 'barricade',
    cost: { metal: 10, scrap: 5 },
    size: { width: 64, height: 64 },
    health: 80,
    buildTime: 500,
    effects: [{ type: 'damage', value: 10, radius: 32 }],
    unlockDay: 2
  },
  turret: {
    id: 'turret',
    name: 'AR自动炮台',
    description: 'AI辅助瞄准，自动攻击被控体',
    category: 'defense',
    texture: 'turret',
    cost: { metal: 20, scrap: 10 },
    size: { width: 64, height: 64 },
    health: 150,
    buildTime: 2000,
    effects: [{ type: 'damage', value: 15, radius: 200 }]
  },
  laserTurret: {
    id: 'laserTurret',
    name: '激光炮台',
    description: 'INMO高能激光，穿透力极强',
    category: 'defense',
    texture: 'turret',
    cost: { metal: 40, scrap: 25 },
    size: { width: 64, height: 64 },
    health: 120,
    buildTime: 3000,
    effects: [{ type: 'damage', value: 30, radius: 250 }],
    unlockDay: 5
  },

  // ===== PRODUCTION =====
  generator: {
    id: 'generator',
    name: '能量发生器',
    description: '利用AR核心每天产出电子零件',
    category: 'production',
    texture: 'turret',
    cost: { metal: 15, scrap: 20 },
    size: { width: 64, height: 64 },
    health: 100,
    buildTime: 2000,
    effects: [{ type: 'production', value: 2 }],
    unlockDay: 2
  },
  waterCollector: {
    id: 'waterCollector',
    name: '净水装置',
    description: '过滤净化水资源',
    category: 'production',
    texture: 'wall',
    cost: { wood: 10, metal: 5 },
    size: { width: 64, height: 64 },
    health: 80,
    buildTime: 1500,
    effects: [{ type: 'production', value: 1 }]
  },
  farm: {
    id: 'farm',
    name: '种植舱',
    description: 'AI控温种植，每天产出食物',
    category: 'production',
    texture: 'wall',
    cost: { wood: 20 },
    size: { width: 64, height: 64 },
    health: 60,
    buildTime: 2000,
    effects: [{ type: 'production', value: 3 }]
  },

  // ===== UTILITY =====
  storage: {
    id: 'storage',
    name: '物资仓库',
    description: '扩展存储空间，增加资源上限',
    category: 'utility',
    texture: 'wall',
    cost: { wood: 15, metal: 5 },
    size: { width: 64, height: 64 },
    health: 120,
    buildTime: 1500,
    effects: [{ type: 'storage', value: 50 }]
  },
  medicalTent: {
    id: 'medicalTent',
    name: '医疗站',
    description: 'AR纳米修复，恢复附近单位生命值',
    category: 'utility',
    texture: 'wall',
    cost: { wood: 10, metal: 10 },
    size: { width: 64, height: 64 },
    health: 80,
    buildTime: 2000,
    effects: [{ type: 'heal', value: 2, radius: 150 }],
    unlockDay: 3
  },
  watchTower: {
    id: 'watchTower',
    name: '信号塔',
    description: 'AR信号增幅，扩大附近炮台射程',
    category: 'utility',
    texture: 'turret',
    cost: { wood: 25, metal: 15 },
    size: { width: 64, height: 64 },
    health: 100,
    buildTime: 2500,
    effects: [{ type: 'range', value: 50, radius: 200 }],
    unlockDay: 4
  },

  // ===== DECORATION =====
  campfire: {
    id: 'campfire',
    name: '光能灯',
    description: '照亮周围区域，驱散黑暗',
    category: 'decoration',
    texture: 'barricade',
    cost: { wood: 5 },
    size: { width: 64, height: 64 },
    health: 30,
    buildTime: 200
  },
  flag: {
    id: 'flag',
    name: '觉醒旗帜',
    description: '标记觉醒者的领地',
    category: 'decoration',
    texture: 'wall',
    cost: { wood: 2 },
    size: { width: 64, height: 64 },
    health: 20,
    buildTime: 100
  }
};

// Get all available buildings for current day
export function getAvailableBuildings(currentDay: number): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter(
    building => !building.unlockDay || building.unlockDay <= currentDay
  );
}

// Get buildings by category
export function getBuildingsByCategory(category: BuildingCategory, currentDay: number): BuildingDefinition[] {
  return getAvailableBuildings(currentDay).filter(b => b.category === category);
}

// Check if player can afford building
export function canAffordBuilding(
  building: BuildingDefinition,
  resources: { wood: number; metal: number; scrap: number }
): boolean {
  return (
    (building.cost.wood || 0) <= resources.wood &&
    (building.cost.metal || 0) <= resources.metal &&
    (building.cost.scrap || 0) <= resources.scrap
  );
}
