// ===== SKILL SYSTEM TYPES =====

// Bullet effect types for companions and skills
export type BulletEffectType = 
  | 'normal'
  | 'explosive'
  | 'piercing'
  | 'frozen'
  | 'burning'
  | 'poison'
  | 'chain'
  | 'homing'
  | 'scatter'
  | 'laser';

export interface BulletEffect {
  type: BulletEffectType;
  damage: number;
  speed: number;
  color: number;
  size: number;
  // Special properties
  explosionRadius?: number;
  pierceCount?: number;
  slowAmount?: number;
  burnDamage?: number;
  poisonDamage?: number;
  chainCount?: number;
  homingStrength?: number;
  scatterCount?: number;
}

// Player skill tree
export interface PlayerSkill {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  currentLevel: number;
  effects: SkillEffect[];
  unlockCost: number;
  upgradeCostMultiplier: number;
}

export interface SkillEffect {
  type: 'damage' | 'speed' | 'health' | 'fireRate' | 'range' | 'crit' | 'armor' | 'regen';
  valuePerLevel: number;
  isPercentage: boolean;
}

// Companion skill configuration
export type CompanionRole = 'tank' | 'sniper' | 'medic';

export interface CompanionConfig {
  id: string;
  name: string;
  level: number;
  bulletEffect: BulletEffect;
  stats: CompanionStats;
  role?: CompanionRole;
  specialAbility?: SpecialAbility;
  advancedClass?: string;
  promotionTier?: 0 | 1;
}

export interface CompanionStats {
  damage: number;
  fireRate: number;
  range: number;
  health: number;
  speed: number;
}

export interface SpecialAbility {
  id: string;
  name: string;
  cooldown: number;
  duration?: number;
  effect: string;
}

// Predefined bullet effect templates
export const BULLET_EFFECTS: Record<BulletEffectType, BulletEffect> = {
  normal: {
    type: 'normal',
    damage: 10,
    speed: 450,
    color: 0xfbbf24,
    size: 1
  },
  explosive: {
    type: 'explosive',
    damage: 8,
    speed: 350,
    color: 0xef4444,
    size: 1.3,
    explosionRadius: 60
  },
  piercing: {
    type: 'piercing',
    damage: 12,
    speed: 500,
    color: 0x22d3ee,
    size: 0.8,
    pierceCount: 3
  },
  frozen: {
    type: 'frozen',
    damage: 6,
    speed: 400,
    color: 0x93c5fd,
    size: 1.1,
    slowAmount: 0.5
  },
  burning: {
    type: 'burning',
    damage: 7,
    speed: 420,
    color: 0xf97316,
    size: 1,
    burnDamage: 3
  },
  poison: {
    type: 'poison',
    damage: 5,
    speed: 380,
    color: 0x84cc16,
    size: 0.9,
    poisonDamage: 2
  },
  chain: {
    type: 'chain',
    damage: 8,
    speed: 480,
    color: 0xa855f7,
    size: 1,
    chainCount: 2
  },
  homing: {
    type: 'homing',
    damage: 9,
    speed: 350,
    color: 0xec4899,
    size: 1,
    homingStrength: 0.1
  },
  scatter: {
    type: 'scatter',
    damage: 4,
    speed: 400,
    color: 0xfbbf24,
    size: 0.6,
    scatterCount: 5
  },
  laser: {
    type: 'laser',
    damage: 15,
    speed: 800,
    color: 0xfef3c7,
    size: 0.5
  }
};

// Player skill definitions
export const PLAYER_SKILLS: PlayerSkill[] = [
  {
    id: 'marksmanship',
    name: '神枪手',
    description: '提升基础伤害',
    maxLevel: 10,
    currentLevel: 0,
    effects: [{ type: 'damage', valuePerLevel: 5, isPercentage: false }],
    unlockCost: 0,
    upgradeCostMultiplier: 1.5
  },
  {
    id: 'quickDraw',
    name: '快速射击',
    description: '提升射击速度',
    maxLevel: 8,
    currentLevel: 0,
    effects: [{ type: 'fireRate', valuePerLevel: 8, isPercentage: true }],
    unlockCost: 50,
    upgradeCostMultiplier: 1.8
  },
  {
    id: 'sharpEye',
    name: '锐眼',
    description: '提升暴击率',
    maxLevel: 5,
    currentLevel: 0,
    effects: [{ type: 'crit', valuePerLevel: 5, isPercentage: true }],
    unlockCost: 100,
    upgradeCostMultiplier: 2
  },
  {
    id: 'vitality',
    name: '活力',
    description: '提升最大生命值',
    maxLevel: 10,
    currentLevel: 0,
    effects: [{ type: 'health', valuePerLevel: 10, isPercentage: false }],
    unlockCost: 0,
    upgradeCostMultiplier: 1.4
  },
  {
    id: 'ironSkin',
    name: '铁皮',
    description: '减少受到的伤害',
    maxLevel: 6,
    currentLevel: 0,
    effects: [{ type: 'armor', valuePerLevel: 3, isPercentage: false }],
    unlockCost: 75,
    upgradeCostMultiplier: 2
  },
  {
    id: 'regeneration',
    name: '再生',
    description: '缓慢恢复生命值',
    maxLevel: 5,
    currentLevel: 0,
    effects: [{ type: 'regen', valuePerLevel: 1, isPercentage: false }],
    unlockCost: 150,
    upgradeCostMultiplier: 2.5
  },
  {
    id: 'longRange',
    name: '远程专家',
    description: '提升射程',
    maxLevel: 5,
    currentLevel: 0,
    effects: [{ type: 'range', valuePerLevel: 15, isPercentage: true }],
    unlockCost: 80,
    upgradeCostMultiplier: 1.6
  },
  {
    id: 'sprinter',
    name: '疾跑者',
    description: '提升移动速度',
    maxLevel: 5,
    currentLevel: 0,
    effects: [{ type: 'speed', valuePerLevel: 10, isPercentage: true }],
    unlockCost: 60,
    upgradeCostMultiplier: 1.5
  }
];

// 微信群友名字 (觉醒者)
export const COMPANION_NAMES = [
  '王大力', '李静远', '林小雅', '赵铁柱', '陈锐',
  '周慧心', '张伟', '刘芳', '杨静', '黄磊',
  '吴晓波', '孙丽', '马超', '高翔', '郑凯',
  '何小龙', '宋雨', '钱多多', '蒋明辉', '唐心怡'
];

// 微信群友职业
export const COMPANION_PROFESSIONS: Record<string, string> = {
  '王大力': '健身教练',
  '李静远': '摄影师',
  '林小雅': '护士',
  '赵铁柱': '建筑工人',
  '陈锐': '程序员',
  '周慧心': '心理医生',
  '张伟': '退伍军人',
  '刘芳': '化学老师',
  '杨静': '黑客',
  '黄磊': '厨师',
  '吴晓波': '商人',
  '孙丽': '武术教练',
  '马超': '电工',
  '高翔': '飞行员',
  '郑凯': '消防员',
  '何小龙': '快递员',
  '宋雨': '画家',
  '钱多多': '会计',
  '蒋明辉': '工程师',
  '唐心怡': '医生'
};

// AR能力称号
export const COMPANION_TITLES = [
  '能量弹', '爆破手', '穿甲者', '冰冻者', '灼烧者',
  '毒雾师', '闪电链', '追踪者', '散射手', '激光师'
];

// 角色中文名
export const ROLE_NAMES_CN: Record<CompanionRole, string> = {
  tank: '前锋',
  sniper: '狙击',
  medic: '医疗'
};

// Generate random companion (微信群友)
export function generateRandomCompanion(level: number = 1): CompanionConfig {
  const effectTypes = Object.keys(BULLET_EFFECTS) as BulletEffectType[];
  const randomEffect = effectTypes[Math.floor(Math.random() * effectTypes.length)];
  const baseEffect = { ...BULLET_EFFECTS[randomEffect] };

  // Scale by level
  baseEffect.damage = Math.floor(baseEffect.damage * (1 + level * 0.1));
  baseEffect.speed = Math.floor(baseEffect.speed * (1 + level * 0.05));

  const name = COMPANION_NAMES[Math.floor(Math.random() * COMPANION_NAMES.length)];
  const profession = COMPANION_PROFESSIONS[name] || '觉醒者';
  const abilityTitle = COMPANION_TITLES[effectTypes.indexOf(randomEffect)] || '战士';

  const roles: CompanionRole[] = ['tank', 'sniper', 'medic'];
  const role = roles[Math.floor(Math.random() * roles.length)];

  return {
    id: `companion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${name}(${profession}·${abilityTitle})`,
    level,
    role,
    bulletEffect: baseEffect,
    stats: {
      damage: baseEffect.damage,
      fireRate: 1000 - level * 50,
      range: 200 + level * 20,
      health: 50 + level * 10,
      speed: 150 + level * 5
    }
  };
}
