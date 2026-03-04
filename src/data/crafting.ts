/**
 * Crafting recipes - 7 Days to Die style
 * Categories: Weapons, Ammo, Medicine, Building Materials, Special Items
 */

export interface CraftingRecipe {
  id: string;
  name: string;
  nameCN: string;
  category: 'weapon' | 'ammo' | 'medicine' | 'building' | 'special';
  description: string;
  descriptionCN: string;
  costs: Record<string, number>; // resource id -> amount
  result: {
    type: 'resource' | 'item' | 'building_kit';
    id: string;
    amount: number;
  };
  craftTime: number; // seconds
  unlockDay: number; // day when recipe becomes available
}

export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {
  // ===== BUILDING MATERIALS =====
  reinforced_wall_kit: {
    id: 'reinforced_wall_kit',
    name: 'Reinforced Wall Kit',
    nameCN: '强化墙体套件',
    category: 'building',
    description: 'Upgrade wood walls to metal',
    descriptionCN: '将木质墙壁升级为金属墙',
    costs: { wood: 10, metal: 5 },
    result: { type: 'building_kit', id: 'reinforced_wall', amount: 1 },
    craftTime: 3,
    unlockDay: 1,
  },
  concrete_wall_kit: {
    id: 'concrete_wall_kit',
    name: 'Concrete Wall Kit',
    nameCN: '混凝土墙套件',
    category: 'building',
    description: 'Extremely durable concrete wall',
    descriptionCN: '极其坚固的混凝土墙体',
    costs: { metal: 15, scrap: 10 },
    result: { type: 'building_kit', id: 'concrete_wall', amount: 1 },
    craftTime: 5,
    unlockDay: 7,
  },
  energy_wall_kit: {
    id: 'energy_wall_kit',
    name: 'Energy Shield Kit',
    nameCN: '能量护盾套件',
    category: 'building',
    description: 'High-tech energy shield wall',
    descriptionCN: '高科技能量护盾墙',
    costs: { metal: 20, energyCore: 3 },
    result: { type: 'building_kit', id: 'energy_wall', amount: 1 },
    craftTime: 8,
    unlockDay: 14,
  },
  turret_blueprint: {
    id: 'turret_blueprint',
    name: 'Turret Blueprint',
    nameCN: '炮台蓝图',
    category: 'building',
    description: 'Build an automated turret',
    descriptionCN: '建造自动炮台的蓝图',
    costs: { metal: 20, scrap: 10 },
    result: { type: 'building_kit', id: 'turret', amount: 1 },
    craftTime: 5,
    unlockDay: 3,
  },
  laser_turret_blueprint: {
    id: 'laser_turret_blueprint',
    name: 'Laser Turret Blueprint',
    nameCN: '激光炮台蓝图',
    category: 'building',
    description: 'Build a laser turret',
    descriptionCN: '建造激光炮台的蓝图',
    costs: { metal: 30, energyCore: 2, scrap: 15 },
    result: { type: 'building_kit', id: 'laser_turret', amount: 1 },
    craftTime: 8,
    unlockDay: 14,
  },

  // ===== MEDICINE =====
  medkit_basic: {
    id: 'medkit_basic',
    name: 'Basic Medkit',
    nameCN: '基础医疗包',
    category: 'medicine',
    description: 'Restores 30 HP',
    descriptionCN: '恢复30点生命值',
    costs: { medical: 2 },
    result: { type: 'item', id: 'medkit_basic', amount: 1 },
    craftTime: 2,
    unlockDay: 1,
  },
  medkit_advanced: {
    id: 'medkit_advanced',
    name: 'Advanced Medkit',
    nameCN: '高级医疗包',
    category: 'medicine',
    description: 'Restores 80 HP',
    descriptionCN: '恢复80点生命值',
    costs: { medical: 5, scrap: 3 },
    result: { type: 'item', id: 'medkit_advanced', amount: 1 },
    craftTime: 4,
    unlockDay: 5,
  },
  stim_pack: {
    id: 'stim_pack',
    name: 'Stim Pack',
    nameCN: '兴奋剂',
    category: 'medicine',
    description: '+50% speed for 30s',
    descriptionCN: '30秒内移动速度 +50%',
    costs: { medical: 3, ammo: 5 },
    result: { type: 'item', id: 'stim_pack', amount: 1 },
    craftTime: 3,
    unlockDay: 3,
  },

  // ===== AMMO & WEAPONS =====
  ammo_pack: {
    id: 'ammo_pack',
    name: 'Ammo Pack',
    nameCN: '弹药包',
    category: 'ammo',
    description: 'Extra ammo supply',
    descriptionCN: '额外弹药补给',
    costs: { metal: 5, scrap: 3 },
    result: { type: 'resource', id: 'ammo', amount: 20 },
    craftTime: 2,
    unlockDay: 1,
  },
  weapon_mod: {
    id: 'weapon_mod',
    name: 'Weapon Mod',
    nameCN: '武器改装件',
    category: 'weapon',
    description: 'Random weapon enhancement',
    descriptionCN: '随机武器强化',
    costs: { scrap: 15, metal: 10 },
    result: { type: 'item', id: 'weapon_mod', amount: 1 },
    craftTime: 5,
    unlockDay: 5,
  },

  // ===== SPECIAL =====
  ar_amplifier: {
    id: 'ar_amplifier',
    name: 'AR Amplifier',
    nameCN: 'AR增幅器',
    category: 'special',
    description: '+1 weapon slot permanently',
    descriptionCN: '永久增加1个武器槽位',
    costs: { energyCore: 5, metal: 20, scrap: 15 },
    result: { type: 'item', id: 'ar_amplifier', amount: 1 },
    craftTime: 10,
    unlockDay: 14,
  },
  beacon: {
    id: 'beacon',
    name: 'Distress Beacon',
    nameCN: '求救信标',
    category: 'special',
    description: 'Recruit a random companion',
    descriptionCN: '召唤一名随机队友',
    costs: { energyCore: 2, scrap: 10 },
    result: { type: 'item', id: 'beacon', amount: 1 },
    craftTime: 5,
    unlockDay: 3,
  },
  radar_chip: {
    id: 'radar_chip',
    name: 'Radar Chip',
    nameCN: '雷达芯片',
    category: 'special',
    description: 'Reveals map area',
    descriptionCN: '揭示地图区域',
    costs: { scrap: 8, metal: 5 },
    result: { type: 'item', id: 'radar_chip', amount: 1 },
    craftTime: 3,
    unlockDay: 5,
  },
  // ===== ADVANCED BUILDING =====
  watchtower_blueprint: {
    id: 'watchtower_blueprint',
    name: 'Watchtower Blueprint',
    nameCN: '瞭望塔蓝图',
    category: 'building',
    description: 'Build a watchtower for extended vision',
    descriptionCN: '建造瞭望塔以扩大视野',
    costs: { wood: 12, metal: 8, scrap: 5 },
    result: { type: 'building_kit', id: 'watchtower', amount: 1 },
    craftTime: 4,
    unlockDay: 3,
  },
  signal_jammer_blueprint: {
    id: 'signal_jammer_blueprint',
    name: 'Signal Jammer Blueprint',
    nameCN: '信号干扰器蓝图',
    category: 'building',
    description: 'Build a signal jammer to reduce enemy spawns',
    descriptionCN: '建造信号干扰器减少敌人生成',
    costs: { metal: 15, scrap: 10, energyCore: 1 },
    result: { type: 'building_kit', id: 'signal_jammer', amount: 1 },
    craftTime: 6,
    unlockDay: 7,
  },
  research_lab_blueprint: {
    id: 'research_lab_blueprint',
    name: 'Research Lab Blueprint',
    nameCN: '研究所蓝图',
    category: 'building',
    description: 'Build a research lab for advanced crafting',
    descriptionCN: '建造研究所解锁高级制造',
    costs: { metal: 20, scrap: 15, energyCore: 1 },
    result: { type: 'building_kit', id: 'research_lab', amount: 1 },
    craftTime: 8,
    unlockDay: 5,
  },
  flame_turret_blueprint: {
    id: 'flame_turret_blueprint',
    name: 'Flame Turret Blueprint',
    nameCN: '火焰炮台蓝图',
    category: 'building',
    description: 'Build a flame turret for area control',
    descriptionCN: '建造火焰炮台用于区域控制',
    costs: { metal: 18, scrap: 12, ammo: 8 },
    result: { type: 'building_kit', id: 'flame_turret', amount: 1 },
    craftTime: 6,
    unlockDay: 7,
  },
  sniper_nest_blueprint: {
    id: 'sniper_nest_blueprint',
    name: 'Sniper Nest Blueprint',
    nameCN: '狙击巢蓝图',
    category: 'building',
    description: 'Build a sniper nest for long-range defense',
    descriptionCN: '建造狙击巢用于远程防御',
    costs: { metal: 20, ammo: 15, scrap: 10 },
    result: { type: 'building_kit', id: 'sniper_nest', amount: 1 },
    craftTime: 6,
    unlockDay: 7,
  },
  // ===== ADVANCED MEDICINE =====
  combat_stim: {
    id: 'combat_stim',
    name: 'Combat Stimulant',
    nameCN: '战斗兴奋剂',
    category: 'medicine',
    description: '+30% damage for 30s',
    descriptionCN: '30秒内伤害 +30%',
    costs: { medical: 4, ammo: 3, scrap: 2 },
    result: { type: 'item', id: 'combat_stim', amount: 1 },
    craftTime: 4,
    unlockDay: 7,
  },
  shield_potion: {
    id: 'shield_potion',
    name: 'Shield Potion',
    nameCN: '护盾药剂',
    category: 'medicine',
    description: '+50 temporary shield',
    descriptionCN: '获得50点临时护盾',
    costs: { medical: 3, energyCore: 1 },
    result: { type: 'item', id: 'shield_potion', amount: 1 },
    craftTime: 5,
    unlockDay: 10,
  },
  // ===== ADVANCED AMMO =====
  incendiary_ammo: {
    id: 'incendiary_ammo',
    name: 'Incendiary Ammo',
    nameCN: '燃烧弹药',
    category: 'ammo',
    description: 'Ammo that sets enemies on fire',
    descriptionCN: '点燃敌人的特殊弹药',
    costs: { ammo: 10, scrap: 5, metal: 3 },
    result: { type: 'item', id: 'incendiary_ammo', amount: 1 },
    craftTime: 3,
    unlockDay: 5,
  },
  emp_grenade: {
    id: 'emp_grenade',
    name: 'EMP Grenade',
    nameCN: 'EMP手雷',
    category: 'weapon',
    description: 'Stuns all enemies in area',
    descriptionCN: '区域内击晕所有敌人',
    costs: { energyCore: 1, metal: 8, scrap: 5 },
    result: { type: 'item', id: 'emp_grenade', amount: 3 },
    craftTime: 5,
    unlockDay: 10,
  },
};

export function getRecipesForCategory(category: string): CraftingRecipe[] {
  return Object.values(CRAFTING_RECIPES).filter(r => r.category === category);
}

export function getAvailableRecipes(currentDay: number): CraftingRecipe[] {
  return Object.values(CRAFTING_RECIPES).filter(r => r.unlockDay <= currentDay);
}

export const CRAFT_CATEGORIES = [
  { id: 'building', nameCN: '建筑', icon: '🏗' },
  { id: 'weapon', nameCN: '武器', icon: '⚔' },
  { id: 'ammo', nameCN: '弹药', icon: '🔫' },
  { id: 'medicine', nameCN: '医疗', icon: '💊' },
  { id: 'special', nameCN: '特殊', icon: '⭐' },
];
