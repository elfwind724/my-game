/**
 * Passive item definitions - Vampire Survivors style
 * Each passive provides stat bonuses that scale with level (max 5)
 * Specific passives are required for weapon evolution
 */

export interface PassiveDef {
  id: string;
  name: string;
  nameCN: string;
  description: string;
  descriptionCN: string;
  icon: string; // emoji for now
  color: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  // Stat bonuses per level
  effects: PassiveEffect[];
}

export interface PassiveEffect {
  stat: 'damage' | 'fireRate' | 'armor' | 'regen' | 'range' | 'critChance' |
        'critDamage' | 'pickupRadius' | 'moveSpeed' | 'maxHealth' | 'xpMultiplier';
  valuePerLevel: number;
  isPercentage: boolean; // true = multiply, false = add flat
}

export const PASSIVE_DEFS: Record<string, PassiveDef> = {
  energy_core: {
    id: 'energy_core',
    name: 'Energy Core',
    nameCN: '能量核心',
    description: '+20% damage per level',
    descriptionCN: '每级伤害 +20%',
    icon: '🔋',
    color: 0xef4444,
    rarity: 'uncommon',
    effects: [{ stat: 'damage', valuePerLevel: 20, isPercentage: true }],
  },
  speed_chip: {
    id: 'speed_chip',
    name: 'Speed Chip',
    nameCN: '加速芯片',
    description: '+15% fire rate per level',
    descriptionCN: '每级射速 +15%',
    icon: '⚡',
    color: 0xfbbf24,
    rarity: 'common',
    effects: [{ stat: 'fireRate', valuePerLevel: 15, isPercentage: true }],
  },
  shield_module: {
    id: 'shield_module',
    name: 'Shield Module',
    nameCN: '护盾模块',
    description: '+8 armor per level',
    descriptionCN: '每级护甲 +8',
    icon: '🛡',
    color: 0x06b6d4,
    rarity: 'common',
    effects: [{ stat: 'armor', valuePerLevel: 8, isPercentage: false }],
  },
  nano_repair: {
    id: 'nano_repair',
    name: 'Nano Repair',
    nameCN: '纳米修复',
    description: '+1 HP/sec regen per level',
    descriptionCN: '每级生命恢复 +1/秒',
    icon: '💚',
    color: 0x22c55e,
    rarity: 'uncommon',
    effects: [
      { stat: 'regen', valuePerLevel: 1, isPercentage: false },
      { stat: 'maxHealth', valuePerLevel: 10, isPercentage: false },
    ],
  },
  range_ext: {
    id: 'range_ext',
    name: 'Range Extension',
    nameCN: '扩展范围',
    description: '+25% attack range per level',
    descriptionCN: '每级攻击范围 +25%',
    icon: '🎯',
    color: 0x8b5cf6,
    rarity: 'common',
    effects: [{ stat: 'range', valuePerLevel: 25, isPercentage: true }],
  },
  crit_protocol: {
    id: 'crit_protocol',
    name: 'Crit Protocol',
    nameCN: '暴击协议',
    description: '+10% crit chance per level',
    descriptionCN: '每级暴击率 +10%',
    icon: '💥',
    color: 0xf43f5e,
    rarity: 'rare',
    effects: [
      { stat: 'critChance', valuePerLevel: 10, isPercentage: false },
      { stat: 'critDamage', valuePerLevel: 15, isPercentage: false },
    ],
  },
  magnet_field: {
    id: 'magnet_field',
    name: 'Magnet Field',
    nameCN: '磁力场',
    description: '+50% pickup radius per level',
    descriptionCN: '每级拾取范围 +50%',
    icon: '🧲',
    color: 0x3b82f6,
    rarity: 'common',
    effects: [
      { stat: 'pickupRadius', valuePerLevel: 50, isPercentage: true },
      { stat: 'xpMultiplier', valuePerLevel: 5, isPercentage: true },
    ],
  },
  time_dilation: {
    id: 'time_dilation',
    name: 'Time Dilation',
    nameCN: '时间膨胀',
    description: '+10% move speed per level',
    descriptionCN: '每级移动速度 +10%',
    icon: '🏃',
    color: 0x14b8a6,
    rarity: 'common',
    effects: [{ stat: 'moveSpeed', valuePerLevel: 10, isPercentage: true }],
  },
};

export function getAllPassives(): PassiveDef[] {
  return Object.values(PASSIVE_DEFS);
}

export function getPassiveById(id: string): PassiveDef | undefined {
  return PASSIVE_DEFS[id];
}
