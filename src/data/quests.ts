/**
 * Quest definitions - 7 Days to Die style missions
 */

export type QuestType = 'clear' | 'fetch' | 'escort' | 'build' | 'survive' | 'story';

export interface QuestObjective {
  id: string;
  type: 'kill' | 'collect' | 'build' | 'visit' | 'survive_time' | 'protect';
  targetId?: string; // enemy type, item id, building type, or zone name
  targetCount: number;
  descriptionCN: string;
}

export interface QuestReward {
  resources?: Record<string, number>;
  xp?: number;
  skillPoints?: number;
  items?: Array<{ id: string; count: number }>;
  unlocks?: string[]; // weapon/passive/character unlocks
}

export interface QuestDef {
  id: string;
  name: string;
  nameCN: string;
  type: QuestType;
  tier: number; // 1, 2, or 3
  description: string;
  descriptionCN: string;
  giver: string; // NPC id
  objectives: QuestObjective[];
  rewards: QuestReward;
  unlockDay: number;
  prerequisiteQuest?: string;
  isRepeatable: boolean;
}

export const NPC_TRADERS = {
  data_merchant: {
    id: 'data_merchant',
    name: '数据交易员',
    role: '比特币兑换',
    color: 0xfbbf24,
    greeting: '资源和比特币，今天你打算怎么做仓位？',
  },
  awakened_leader: {
    id: 'awakened_leader',
    name: '任务官',
    role: '随机任务',
    color: 0x0ea5e9,
    greeting: '今日任务已刷新，随时可以接单。',
  },
  weapon_smith: {
    id: 'weapon_smith',
    name: '宝岛眼镜店',
    role: 'AR眼镜商店',
    color: 0xef4444,
    greeting: '欢迎试戴，今天有不错的镜片。',
  },
};

export const QUEST_DEFS: Record<string, QuestDef> = {
  // ===== TIER 1: Week 1 (Days 1-7) =====
  story_awakening: {
    id: 'story_awakening',
    name: 'The Awakening',
    nameCN: '觉醒之路',
    type: 'story',
    tier: 1,
    description: 'Defeat your first enemies and establish a base',
    descriptionCN: '击败你的第一批敌人，建立基地',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_10', type: 'kill', targetCount: 10, descriptionCN: '消灭10个被控体' },
      { id: 'build_3', type: 'build', targetId: 'wall', targetCount: 3, descriptionCN: '建造3面防护墙' },
    ],
    rewards: {
      resources: { scrap: 20, metal: 10 },
      xp: 100,
      skillPoints: 1,
    },
    unlockDay: 1,
    isRepeatable: false,
  },
  clear_city_1: {
    id: 'clear_city_1',
    name: 'City Sweep',
    nameCN: '城市扫荡',
    type: 'clear',
    tier: 1,
    description: 'Clear enemies from the city ruins',
    descriptionCN: '清除城市废墟区域的敌人',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_city', type: 'kill', targetCount: 20, descriptionCN: '在城市区域消灭20个敌人' },
    ],
    rewards: {
      resources: { metal: 15, scrap: 10 },
      xp: 80,
    },
    unlockDay: 2,
    isRepeatable: true,
  },
  fetch_supplies: {
    id: 'fetch_supplies',
    name: 'Supply Run',
    nameCN: '物资搜寻',
    type: 'fetch',
    tier: 1,
    description: 'Gather resources for the base',
    descriptionCN: '为基地收集物资',
    giver: 'data_merchant',
    objectives: [
      { id: 'collect_wood', type: 'collect', targetId: 'wood', targetCount: 30, descriptionCN: '收集30个木材' },
      { id: 'collect_metal', type: 'collect', targetId: 'metal', targetCount: 15, descriptionCN: '收集15个金属' },
    ],
    rewards: {
      resources: { food: 20, medical: 5 },
      xp: 60,
    },
    unlockDay: 1,
    isRepeatable: true,
  },
  build_defense: {
    id: 'build_defense',
    name: 'Fortify Base',
    nameCN: '加固基地',
    type: 'build',
    tier: 1,
    description: 'Build defensive structures',
    descriptionCN: '建造防御工事',
    giver: 'awakened_leader',
    objectives: [
      { id: 'build_walls', type: 'build', targetId: 'wall', targetCount: 8, descriptionCN: '建造8面防护墙' },
      { id: 'build_turret', type: 'build', targetId: 'turret', targetCount: 1, descriptionCN: '建造1座炮台' },
    ],
    rewards: {
      resources: { ammo: 30, scrap: 15 },
      xp: 100,
      skillPoints: 1,
    },
    unlockDay: 3,
    isRepeatable: false,
  },
  survive_first_night: {
    id: 'survive_first_night',
    name: 'First Night',
    nameCN: '初夜求生',
    type: 'survive',
    tier: 1,
    description: 'Survive your first night',
    descriptionCN: '在第一个夜晚幸存下来',
    giver: 'awakened_leader',
    objectives: [
      { id: 'survive', type: 'survive_time', targetCount: 1, descriptionCN: '幸存到第一个黎明' },
    ],
    rewards: {
      resources: { wood: 20, food: 10 },
      xp: 50,
    },
    unlockDay: 1,
    isRepeatable: false,
  },

  // ===== TIER 2: Week 2 (Days 8-14) =====
  story_survivors: {
    id: 'story_survivors',
    name: 'Finding Survivors',
    nameCN: '寻找幸存者',
    type: 'story',
    tier: 2,
    description: 'Rescue survivors hiding in the industrial zone',
    descriptionCN: '在工业区搜救幸存者',
    giver: 'awakened_leader',
    objectives: [
      { id: 'rescue_3', type: 'protect', targetCount: 3, descriptionCN: '营救3名幸存者' },
    ],
    rewards: {
      xp: 200,
      skillPoints: 2,
    },
    unlockDay: 8,
    prerequisiteQuest: 'story_awakening',
    isRepeatable: false,
  },
  weapon_upgrade: {
    id: 'weapon_upgrade',
    name: 'Weapon Enhancement',
    nameCN: '武器强化',
    type: 'fetch',
    tier: 2,
    description: 'Collect materials for weapon modification',
    descriptionCN: '收集材料来改装武器',
    giver: 'awakened_leader',
    objectives: [
      { id: 'collect_metal', type: 'collect', targetId: 'metal', targetCount: 40, descriptionCN: '收集40个金属' },
      { id: 'collect_core', type: 'collect', targetId: 'energyCore', targetCount: 2, descriptionCN: '收集2个能量核心' },
    ],
    rewards: {
      items: [{ id: 'weapon_mod', count: 2 }],
      xp: 150,
    },
    unlockDay: 8,
    isRepeatable: true,
  },
  elite_hunt: {
    id: 'elite_hunt',
    name: 'Elite Hunt',
    nameCN: '精英猎杀',
    type: 'clear',
    tier: 2,
    description: 'Eliminate elite enemies',
    descriptionCN: '击杀精英敌人',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_elite', type: 'kill', targetId: 'elite', targetCount: 5, descriptionCN: '击杀5个精英体' },
    ],
    rewards: {
      resources: { energyCore: 2, metal: 20 },
      xp: 200,
      skillPoints: 1,
    },
    unlockDay: 10,
    isRepeatable: true,
  },

  // ===== TIER 3: Week 3+ (Days 15+) =====
  story_ai_core: {
    id: 'story_ai_core',
    name: 'AI Core Discovery',
    nameCN: '发现AI核心',
    type: 'story',
    tier: 3,
    description: 'Locate and analyze the AI Supreme Core',
    descriptionCN: '寻找并分析AI最高核心',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_boss', type: 'kill', targetId: 'boss', targetCount: 1, descriptionCN: '击败一个AI核心体' },
      { id: 'collect_core', type: 'collect', targetId: 'energyCore', targetCount: 10, descriptionCN: '收集10个能量核心' },
    ],
    rewards: {
      xp: 500,
      skillPoints: 3,
      unlocks: ['cannon'],
    },
    unlockDay: 15,
    prerequisiteQuest: 'story_survivors',
    isRepeatable: false,
  },
  story_final: {
    id: 'story_final',
    name: 'Final Assault',
    nameCN: '最终决战',
    type: 'story',
    tier: 3,
    description: 'Assault the AI Supreme Core',
    descriptionCN: '向AI最高核心发起总攻',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_bosses', type: 'kill', targetId: 'boss', targetCount: 3, descriptionCN: '击败3个AI核心体' },
      { id: 'survive_30', type: 'survive_time', targetCount: 30, descriptionCN: '存活到第30天' },
    ],
    rewards: {
      xp: 1000,
      skillPoints: 5,
    },
    unlockDay: 21,
    prerequisiteQuest: 'story_ai_core',
    isRepeatable: false,
  },
  boss_challenge: {
    id: 'boss_challenge',
    name: 'Boss Challenge',
    nameCN: 'Boss挑战',
    type: 'clear',
    tier: 3,
    description: 'Defeat a boss enemy',
    descriptionCN: '击败一个Boss级AI核心体',
    giver: 'awakened_leader',
    objectives: [
      { id: 'kill_boss', type: 'kill', targetId: 'boss', targetCount: 1, descriptionCN: '击败1个AI核心体' },
    ],
    rewards: {
      resources: { energyCore: 5 },
      xp: 300,
    },
    unlockDay: 15,
    isRepeatable: true,
  },
};

export function getQuestsForTier(tier: number): QuestDef[] {
  return Object.values(QUEST_DEFS).filter(q => q.tier === tier);
}

export function getAvailableQuests(day: number, completedIds: string[]): QuestDef[] {
  return Object.values(QUEST_DEFS).filter(q => {
    if (q.unlockDay > day) return false;
    if (!q.isRepeatable && completedIds.includes(q.id)) return false;
    if (q.prerequisiteQuest && !completedIds.includes(q.prerequisiteQuest)) return false;
    return true;
  });
}
