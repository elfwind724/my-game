/**
 * GameState - Central state management singleton
 * Replaces window.runState with a proper typed system
 * Supports save/load via localStorage
 */

import type { BaseJob } from '../data/base';

export interface InventoryItem {
  id: string;
  name: string;
  nameCN: string;
  type: 'material' | 'consumable' | 'blueprint' | 'questItem';
  count: number;
  icon?: string;
}

export interface WeaponSlot {
  id: string;
  level: number;
  evolved: boolean;
  evolvedId?: string;
}

export interface PassiveSlot {
  id: string;
  level: number;
}

export interface QuestProgress {
  questId: string;
  status: 'active' | 'completed' | 'failed';
  objectives: Record<string, number>; // objectiveId -> progress
  startDay: number;
}

export interface PlayerStats {
  maxHealth: number;
  damage: number;
  fireRate: number;
  moveSpeed: number;
  armor: number;
  critChance: number;
  critDamage: number;
  xpMultiplier: number;
  pickupRadius: number;
  regen: number;
}

export interface RunStatistics {
  enemiesKilled: number;
  elitesKilled: number;
  bossesKilled: number;
  buildingsPlaced: number;
  resourcesGathered: number;
  companionsRecruited: number;
  daysSurvived: number;
  bloodMoonsSurvived: number;
  questsCompleted: number;
  damageDealt: number;
  damageTaken: number;
  itemsCrafted: number;
  weaponsEvolved: number;
  highestCombo: number;
  survivalTime: number; // seconds
}

export interface Resources {
  wood: number;
  metal: number;
  food: number;
  water: number;
  scrap: number;
  medical: number;
  ammo: number;
  energyCore: number; // rare crafting material
  bitcoin: number; // used for AR glasses market
}

export interface CompanionData {
  id: string;
  name: string;
  role: 'tank' | 'sniper' | 'medic';
  level: number;
  bulletEffect: string;
  textureKey?: string;
  status: 'party' | 'base';
  job: BaseJob;
  advancedClass?: string;
  promotionTier?: 0 | 1;
  profile?: CompanionProfile;
}

export interface CompanionProfile {
  gender: '男' | '女';
  age: number;
  profession: string;
  background: string;
  personality: string;
  hobbies: string[];
  traits: string[];
  signatureSkill: string;
  chatterSeed: number;
}

export interface BaseState {
  powerCapacity: number;
  powerUsed: number;
  foodProduction: number;
  foodConsumption: number;
  foodDeficit: number;
  jobSlots: Record<BaseJob, number>;
  jobAssigned: Record<BaseJob, number>;
}

export type GearWeaponType = 'pistol' | 'shotgun' | 'rifle' | 'flamethrower' | 'laser' | 'rocket';
export type GearRarity = 'common' | 'magic' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type BitcoinPerkId =
  | 'arsenal_overclock'
  | 'loot_router'
  | 'satoshi_black_card'
  | 'boss_hunter_protocol';

export interface GearStatBonuses {
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  projectileBonus: number;
}

export interface GearItem {
  uid: string;
  nameCN: string;
  weaponType: GearWeaponType;
  rarity: GearRarity;
  itemLevel: number;
  droppedDay: number;
  droppedWeek: number;
  sourceTag?: string;
  sellValue: number;
  bonuses: GearStatBonuses;
}

export interface BitcoinPerkDef {
  id: BitcoinPerkId;
  nameCN: string;
  descCN: string;
  cost: number;
}

export interface BitcoinPerkBonuses {
  weaponDamageMul: number;
  projectileBonus: number;
  lootGainMul: number;
  gearDropChanceMul: number;
  gearRarityBias: number;
  sellValueMul: number;
  bossDamageMul: number;
}

export type PermanentUpgradeChoice = 'damage' | 'vitality' | 'mobility';
export type PermanentTalentBranch = 'turret' | 'companion' | 'economy';
export type DayChallengeBranch = 'stable' | 'adventure' | 'extreme';
export type PermanentTalentNodeId =
  | 'turret_core'
  | 'turret_matrix'
  | 'turret_fortress'
  | 'companion_drill'
  | 'companion_link'
  | 'companion_command'
  | 'economy_salvage'
  | 'economy_logistics'
  | 'economy_fund';

export interface MetaProgression {
  bitcoinBank: number;
  permanentUpgrades: Record<PermanentUpgradeChoice, number>;
  permanentTalents: Record<PermanentTalentNodeId, number>;
  dayChallengeMastery: Record<DayChallengeBranch, number>;
  dayOpsRenown: number;
}

export interface PermanentTalentBonuses {
  turretDamageMul: number;
  turretFireRateMul: number;
  turretHealthMul: number;
  companionDamageMul: number;
  companionFireRateMul: number;
  companionDayGainMul: number;
  economyLootMul: number;
  economyDayGainMul: number;
  economyBitcoinMul: number;
  economyFoodUseMul: number;
}

export interface PermanentTalentChoice {
  id: PermanentTalentNodeId;
  branch: PermanentTalentBranch;
  branchCN: string;
  nameCN: string;
  descCN: string;
  level: number;
  nextLevel: number;
  maxLevel: number;
}

export interface DayChallengeMasteryBonuses {
  stableDangerMitigationMul: number;
  stableRewardMul: number;
  adventureRewardMul: number;
  adventureBitcoinMul: number;
  extremeDamageMul: number;
  extremeXpMul: number;
}

export interface DayOpsRenownBonuses {
  dayRewardMul: number;
  dayXpMul: number;
  nightDirectiveDamageMul: number;
  prepCapBonus: number;
}

export interface GameStateData {
  // Day / Time
  currentDay: number;
  currentWeek: number;
  timeOfDay: number; // 0-100
  isNight: boolean;
  isBloodMoon: boolean;

  // Player
  playerLevel: number;
  playerExp: number;
  expToNextLevel: number;
  skillPoints: number;

  // Combat stats (base, before passives)
  baseStats: PlayerStats;

  // Resources
  resources: Resources;

  // Inventory
  inventory: InventoryItem[];

  // Weapons (VS style - max 6 slots)
  weapons: WeaponSlot[];
  maxWeaponSlots: number;

  // Passives (VS style - max 6 slots)
  passives: PassiveSlot[];
  maxPassiveSlots: number;

  // Companions
  companions: CompanionData[];

  // Base management
  base: BaseState;

  // Buildings placed
  buildings: Array<{ id: string; type: string; x: number; y: number; tier: number; health: number }>;

  // Quests
  activeQuests: QuestProgress[];
  completedQuestIds: string[];
  questTier: number;

  // Skills unlocked (permanent upgrades)
  unlockedSkills: string[];

  // Story progress
  storyFlags: Record<string, boolean>;

  // Statistics
  stats: RunStatistics;

  // Unlocks (persistent across runs)
  unlockedWeapons: string[];
  unlockedCharacters: string[];

  // AR Glasses collection
  collectedGlasses: string[];
  equippedGlasses: string; // currently equipped glasses ID

  // Wave tracking
  currentWave: number;
  totalKills: number;

  // Persistent progression across loops
  meta: MetaProgression;

  // Persistent loot arsenal (Diablo-like gear)
  gearStash: GearItem[];
  equippedGearSlots: Record<GearWeaponType, string | null>;
  bitcoinPerks: Record<BitcoinPerkId, boolean>;
}

const DEFAULT_STATS: PlayerStats = {
  maxHealth: 100,
  damage: 10,
  fireRate: 400,
  moveSpeed: 200,
  armor: 0,
  critChance: 5,
  critDamage: 150,
  xpMultiplier: 1,
  pickupRadius: 50,
  regen: 0,
};

const DEFAULT_RESOURCES: Resources = {
  wood: 30,
  metal: 15,
  food: 10,
  water: 10,
  scrap: 5,
  medical: 2,
  ammo: 20,
  energyCore: 0,
  bitcoin: 0,
};

interface PermanentTalentNodeDef {
  id: PermanentTalentNodeId;
  branch: PermanentTalentBranch;
  branchCN: string;
  nameCN: string;
  descCN: string;
  maxLevel: number;
  requires?: PermanentTalentNodeId;
}

const PERMANENT_TALENT_DEFS: PermanentTalentNodeDef[] = [
  {
    id: 'turret_core',
    branch: 'turret',
    branchCN: '炮塔流',
    nameCN: '火控核心',
    descCN: '炮塔伤害永久提升（每级+8%）',
    maxLevel: 5,
  },
  {
    id: 'turret_matrix',
    branch: 'turret',
    branchCN: '炮塔流',
    nameCN: '并行矩阵',
    descCN: '炮塔射速永久提升（每级+6%）',
    maxLevel: 4,
    requires: 'turret_core',
  },
  {
    id: 'turret_fortress',
    branch: 'turret',
    branchCN: '炮塔流',
    nameCN: '堡垒框架',
    descCN: '炮塔耐久永久提升（每级+12%）',
    maxLevel: 3,
    requires: 'turret_matrix',
  },
  {
    id: 'companion_drill',
    branch: 'companion',
    branchCN: '伙伴流',
    nameCN: '协同演练',
    descCN: '伙伴伤害永久提升（每级+7%）',
    maxLevel: 5,
  },
  {
    id: 'companion_link',
    branch: 'companion',
    branchCN: '伙伴流',
    nameCN: '战术链路',
    descCN: '伙伴射速永久提升（每级+5%）',
    maxLevel: 4,
    requires: 'companion_drill',
  },
  {
    id: 'companion_command',
    branch: 'companion',
    branchCN: '伙伴流',
    nameCN: '联队指挥',
    descCN: '伙伴白天产出永久提升（每级+6%）',
    maxLevel: 3,
    requires: 'companion_link',
  },
  {
    id: 'economy_salvage',
    branch: 'economy',
    branchCN: '经济流',
    nameCN: '战地回收',
    descCN: '战利品掉落永久提升（每级+8%）',
    maxLevel: 5,
  },
  {
    id: 'economy_logistics',
    branch: 'economy',
    branchCN: '经济流',
    nameCN: '后勤网络',
    descCN: '白天产出提升且食物消耗下降（每级+8%/-5%）',
    maxLevel: 4,
    requires: 'economy_salvage',
  },
  {
    id: 'economy_fund',
    branch: 'economy',
    branchCN: '经济流',
    nameCN: '资本运作',
    descCN: '比特币结算提升（每级+18%）',
    maxLevel: 3,
    requires: 'economy_logistics',
  },
];

const EMPTY_TALENT_LEVELS: Record<PermanentTalentNodeId, number> = {
  turret_core: 0,
  turret_matrix: 0,
  turret_fortress: 0,
  companion_drill: 0,
  companion_link: 0,
  companion_command: 0,
  economy_salvage: 0,
  economy_logistics: 0,
  economy_fund: 0,
};

const EMPTY_DAY_CHALLENGE_MASTERY: Record<DayChallengeBranch, number> = {
  stable: 0,
  adventure: 0,
  extreme: 0,
};

const EMPTY_EQUIPPED_GEAR_SLOTS: Record<GearWeaponType, string | null> = {
  pistol: null,
  shotgun: null,
  rifle: null,
  flamethrower: null,
  laser: null,
  rocket: null,
};

const EMPTY_BITCOIN_PERKS: Record<BitcoinPerkId, boolean> = {
  arsenal_overclock: false,
  loot_router: false,
  satoshi_black_card: false,
  boss_hunter_protocol: false,
};

export const BITCOIN_PERK_DEFS: BitcoinPerkDef[] = [
  {
    id: 'arsenal_overclock',
    nameCN: '军械超频协议',
    descCN: '全武器伤害+18%，并额外+1投射物',
    cost: 12,
  },
  {
    id: 'loot_router',
    nameCN: '战利路由器',
    descCN: '资源掉落提高，装备掉率提升',
    cost: 10,
  },
  {
    id: 'satoshi_black_card',
    nameCN: '中本黑卡',
    descCN: '出售装备收益提升，稀有掉率略增',
    cost: 16,
  },
  {
    id: 'boss_hunter_protocol',
    nameCN: '猎首协议',
    descCN: '对Boss伤害大幅提升',
    cost: 18,
  },
];

function createDefaultState(): GameStateData {
  return {
    currentDay: 1,
    currentWeek: 1,
    timeOfDay: 0,
    isNight: false,
    isBloodMoon: false,

    playerLevel: 1,
    playerExp: 0,
    expToNextLevel: 100,
    skillPoints: 0,

    baseStats: { ...DEFAULT_STATS },
    resources: { ...DEFAULT_RESOURCES },
    inventory: [],

    weapons: [{ id: 'ar_basic', level: 1, evolved: false }],
    maxWeaponSlots: 6,

    passives: [],
    maxPassiveSlots: 6,

    companions: [],

    base: {
      powerCapacity: 6,
      powerUsed: 0,
      foodProduction: 0,
      foodConsumption: 0,
      foodDeficit: 0,
      jobSlots: { idle: 0, kitchen: 0, farm: 0, power: 0, medical: 0, workshop: 0 },
      jobAssigned: { idle: 0, kitchen: 0, farm: 0, power: 0, medical: 0, workshop: 0 },
    },
    buildings: [],

    activeQuests: [],
    completedQuestIds: [],
    questTier: 1,

    unlockedSkills: [],
    storyFlags: {},

    stats: {
      enemiesKilled: 0,
      elitesKilled: 0,
      bossesKilled: 0,
      buildingsPlaced: 0,
      resourcesGathered: 0,
      companionsRecruited: 0,
      daysSurvived: 0,
      bloodMoonsSurvived: 0,
      questsCompleted: 0,
      damageDealt: 0,
      damageTaken: 0,
      itemsCrafted: 0,
      weaponsEvolved: 0,
      highestCombo: 0,
      survivalTime: 0,
    },

    unlockedWeapons: ['ar_basic'],
    unlockedCharacters: ['feng_teacher'],

    collectedGlasses: ['inmo_air_x', 'xreal_air_1s'],
    equippedGlasses: 'inmo_air_x',

    currentWave: 0,
    totalKills: 0,

    meta: {
      bitcoinBank: 0,
      permanentUpgrades: {
        damage: 0,
        vitality: 0,
        mobility: 0,
      },
      permanentTalents: { ...EMPTY_TALENT_LEVELS },
      dayChallengeMastery: { ...EMPTY_DAY_CHALLENGE_MASTERY },
      dayOpsRenown: 0,
    },
    gearStash: [],
    equippedGearSlots: { ...EMPTY_EQUIPPED_GEAR_SLOTS },
    bitcoinPerks: { ...EMPTY_BITCOIN_PERKS },
  };
}

const SAVE_KEY = 'emergence_save';

class GameStateManager {
  private state: GameStateData;
  private static instance: GameStateManager | null = null;

  private constructor() {
    this.state = createDefaultState();
  }

  static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  // --- Accessors ---
  get data(): GameStateData {
    return this.state;
  }

  get resources(): Resources {
    return this.state.resources;
  }

  get stats(): RunStatistics {
    return this.state.stats;
  }

  get meta(): MetaProgression {
    return this.state.meta;
  }

  // --- Resource Management ---
  addResource(type: keyof Resources, amount: number): void {
    this.state.resources[type] = Math.max(0, this.state.resources[type] + amount);
  }

  spendResource(type: keyof Resources, amount: number): boolean {
    if (this.state.resources[type] >= amount) {
      this.state.resources[type] -= amount;
      return true;
    }
    return false;
  }

  canAfford(costs: Partial<Resources>): boolean {
    for (const [key, amount] of Object.entries(costs)) {
      if ((this.state.resources[key as keyof Resources] || 0) < (amount || 0)) {
        return false;
      }
    }
    return true;
  }

  spendResources(costs: Partial<Resources>): boolean {
    if (!this.canAfford(costs)) return false;
    for (const [key, amount] of Object.entries(costs)) {
      if (amount) {
        this.state.resources[key as keyof Resources] -= amount;
      }
    }
    return true;
  }

  // --- Inventory ---
  addInventoryItem(item: Omit<InventoryItem, 'count'>, count: number = 1): void {
    const existing = this.state.inventory.find(i => i.id === item.id);
    if (existing) {
      existing.count += count;
    } else {
      this.state.inventory.push({ ...item, count });
    }
  }

  removeInventoryItem(id: string, count: number = 1): boolean {
    const idx = this.state.inventory.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.state.inventory[idx].count -= count;
    if (this.state.inventory[idx].count <= 0) {
      this.state.inventory.splice(idx, 1);
    }
    return true;
  }

  getInventoryCount(id: string): number {
    return this.state.inventory.find(i => i.id === id)?.count ?? 0;
  }

  // --- Gear / Arsenal ---
  addGearToStash(item: GearItem): void {
    if (!item?.uid) return;
    this.state.gearStash.push(item);
    this.sortGearStashInPlace();
    const maxStashSize = 320;
    if (this.state.gearStash.length > maxStashSize) {
      const overflow = this.state.gearStash.length - maxStashSize;
      this.state.gearStash.splice(this.state.gearStash.length - overflow, overflow);
    }
  }

  getGearStash(): GearItem[] {
    this.sortGearStashInPlace();
    return [...this.state.gearStash];
  }

  getEquippedGearForWeapon(weaponType: GearWeaponType): GearItem | null {
    const uid = this.state.equippedGearSlots?.[weaponType];
    if (!uid) return null;
    return this.state.gearStash.find(item => item.uid === uid) || null;
  }

  getWeaponGearBonuses(weaponType: GearWeaponType): GearStatBonuses {
    const defaults: GearStatBonuses = {
      damageMul: 1,
      fireRateMul: 1,
      speedMul: 1,
      projectileBonus: 0,
    };
    const equipped = this.getEquippedGearForWeapon(weaponType);
    const perk = this.getBitcoinPerkBonuses();
    if (!equipped) {
      return {
        damageMul: Number((defaults.damageMul * perk.weaponDamageMul).toFixed(3)),
        fireRateMul: defaults.fireRateMul,
        speedMul: defaults.speedMul,
        projectileBonus: defaults.projectileBonus + perk.projectileBonus,
      };
    }
    return {
      damageMul: Number((equipped.bonuses.damageMul * perk.weaponDamageMul).toFixed(3)),
      fireRateMul: Number((equipped.bonuses.fireRateMul || 1).toFixed(3)),
      speedMul: Number((equipped.bonuses.speedMul || 1).toFixed(3)),
      projectileBonus: Math.max(0, Math.floor((equipped.bonuses.projectileBonus || 0) + perk.projectileBonus)),
    };
  }

  equipGear(uid: string): { ok: boolean; message: string; weaponType?: GearWeaponType } {
    const found = this.state.gearStash.find(item => item.uid === uid);
    if (!found) return { ok: false, message: '装备不存在' };
    this.state.equippedGearSlots[found.weaponType] = found.uid;
    return {
      ok: true,
      message: `已装备 ${found.nameCN}`,
      weaponType: found.weaponType,
    };
  }

  unequipGear(weaponType: GearWeaponType): { ok: boolean; message: string } {
    if (!this.state.equippedGearSlots[weaponType]) {
      return { ok: false, message: '该栏位没有装备' };
    }
    this.state.equippedGearSlots[weaponType] = null;
    return { ok: true, message: '已卸下装备' };
  }

  sellGear(uid: string): { ok: boolean; btc: number; message: string } {
    const idx = this.state.gearStash.findIndex(item => item.uid === uid);
    if (idx < 0) return { ok: false, btc: 0, message: '装备不存在' };
    const item = this.state.gearStash[idx];
    const sellMul = this.getBitcoinPerkBonuses().sellValueMul;
    const btc = Number((Math.max(0.01, item.sellValue) * sellMul).toFixed(3));
    this.state.gearStash.splice(idx, 1);
    (Object.keys(this.state.equippedGearSlots) as GearWeaponType[]).forEach((weaponType) => {
      if (this.state.equippedGearSlots[weaponType] === uid) {
        this.state.equippedGearSlots[weaponType] = null;
      }
    });
    this.addResource('bitcoin', btc);
    return { ok: true, btc, message: `出售 ${item.nameCN} 获得 ₿${btc.toFixed(3)}` };
  }

  getBitcoinPerkDefs(): BitcoinPerkDef[] {
    return [...BITCOIN_PERK_DEFS];
  }

  purchaseBitcoinPerk(perkId: BitcoinPerkId): { ok: boolean; message: string } {
    const def = BITCOIN_PERK_DEFS.find(item => item.id === perkId);
    if (!def) return { ok: false, message: '未知强化项' };
    if (this.state.bitcoinPerks[perkId]) return { ok: false, message: '该强化已购买' };
    if ((this.state.resources.bitcoin || 0) < def.cost) return { ok: false, message: '比特币不足' };
    this.spendResource('bitcoin', def.cost);
    this.state.bitcoinPerks[perkId] = true;
    return { ok: true, message: `已激活强化：${def.nameCN}` };
  }

  getBitcoinPerkBonuses(): BitcoinPerkBonuses {
    const perks = {
      ...EMPTY_BITCOIN_PERKS,
      ...(this.state.bitcoinPerks || {}),
    };
    return {
      weaponDamageMul: perks.arsenal_overclock ? 1.18 : 1,
      projectileBonus: perks.arsenal_overclock ? 1 : 0,
      lootGainMul: perks.loot_router ? 1.18 : 1,
      gearDropChanceMul: perks.loot_router ? 1.42 : 1,
      gearRarityBias: perks.satoshi_black_card ? 0.08 : 0,
      sellValueMul: perks.satoshi_black_card ? 1.45 : 1,
      bossDamageMul: perks.boss_hunter_protocol ? 1.28 : 1,
    };
  }

  // --- Weapons (VS style) ---
  addWeapon(weaponId: string): boolean {
    if (this.state.weapons.length >= this.state.maxWeaponSlots) return false;
    if (this.state.weapons.some(w => w.id === weaponId)) return false;
    this.state.weapons.push({ id: weaponId, level: 1, evolved: false });
    return true;
  }

  upgradeWeapon(weaponId: string): boolean {
    const weapon = this.state.weapons.find(w => w.id === weaponId);
    if (!weapon || weapon.level >= 8) return false;
    weapon.level++;
    return true;
  }

  evolveWeapon(weaponId: string, evolvedId: string): boolean {
    const weapon = this.state.weapons.find(w => w.id === weaponId);
    if (!weapon || weapon.evolved) return false;
    weapon.evolved = true;
    weapon.evolvedId = evolvedId;
    this.state.stats.weaponsEvolved++;
    return true;
  }

  hasWeapon(weaponId: string): boolean {
    return this.state.weapons.some(w => w.id === weaponId);
  }

  // --- Passives (VS style) ---
  addPassive(passiveId: string): boolean {
    if (this.state.passives.length >= this.state.maxPassiveSlots) return false;
    if (this.state.passives.some(p => p.id === passiveId)) return false;
    this.state.passives.push({ id: passiveId, level: 1 });
    return true;
  }

  upgradePassive(passiveId: string): boolean {
    const passive = this.state.passives.find(p => p.id === passiveId);
    if (!passive || passive.level >= 5) return false;
    passive.level++;
    return true;
  }

  hasPassive(passiveId: string): boolean {
    return this.state.passives.some(p => p.id === passiveId);
  }

  // --- Experience ---
  addExperience(amount: number): boolean {
    const xpAmount = Math.floor(amount * this.state.baseStats.xpMultiplier);
    if (xpAmount <= 0) return false;
    this.state.playerExp += xpAmount;
    let leveled = false;
    while (this.state.playerExp >= this.state.expToNextLevel) {
      this.state.playerExp -= this.state.expToNextLevel;
      this.state.playerLevel++;
      const day = Math.max(1, this.state.currentDay || 1);
      const growthMul = day <= 3
        ? 1.12
        : day <= 7
          ? 1.15
          : day <= 12
            ? 1.18
            : 1.22;
      const flatGain = day <= 3
        ? 14
        : day <= 7
          ? 20
          : day <= 12
            ? 28
            : 36;
      this.state.expToNextLevel = Math.floor(this.state.expToNextLevel * growthMul) + flatGain;
      leveled = true;
    }
    return leveled;
  }

  // --- Day Cycle ---
  advanceDay(): void {
    this.state.currentDay++;
    this.state.stats.daysSurvived = this.state.currentDay - 1;
    this.state.currentWeek = Math.ceil(this.state.currentDay / 7);
    this.state.isBloodMoon = this.state.currentDay % 7 === 0;
  }

  getDayInWeek(): number {
    return ((this.state.currentDay - 1) % 7) + 1;
  }

  getDaysUntilBloodMoon(): number {
    return 7 - this.getDayInWeek();
  }

  // --- Computed Stats (base + passives) ---
  getComputedStats(): PlayerStats {
    const base = { ...this.state.baseStats };
    // Passives modify stats - will be computed by EvolutionSystem
    return base;
  }

  // --- Save / Load ---
  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (_e) {
      // localStorage might be unavailable
    }
  }

  load(): boolean {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaults = createDefaultState();
        this.state = {
          ...defaults,
          ...parsed,
          resources: {
            ...defaults.resources,
            ...(parsed.resources || {}),
          },
          base: {
            ...defaults.base,
            ...(parsed.base || {}),
            jobSlots: {
              ...defaults.base.jobSlots,
              ...(parsed.base?.jobSlots || {}),
            },
            jobAssigned: {
              ...defaults.base.jobAssigned,
              ...(parsed.base?.jobAssigned || {}),
            },
          },
          stats: {
            ...defaults.stats,
            ...(parsed.stats || {}),
          },
          meta: {
            ...defaults.meta,
            ...(parsed.meta || {}),
            permanentUpgrades: {
              ...defaults.meta.permanentUpgrades,
              ...(parsed.meta?.permanentUpgrades || {}),
            },
            permanentTalents: {
              ...defaults.meta.permanentTalents,
              ...(parsed.meta?.permanentTalents || {}),
            },
            dayChallengeMastery: {
              ...defaults.meta.dayChallengeMastery,
              ...(parsed.meta?.dayChallengeMastery || {}),
            },
            dayOpsRenown: Math.max(0, Number(parsed.meta?.dayOpsRenown || 0)),
          },
          equippedGearSlots: {
            ...defaults.equippedGearSlots,
            ...(parsed.equippedGearSlots || {}),
          },
          bitcoinPerks: {
            ...defaults.bitcoinPerks,
            ...(parsed.bitcoinPerks || {}),
          },
        };
        this.state.gearStash = Array.isArray(parsed.gearStash)
          ? parsed.gearStash.filter((item: any) => item && typeof item.uid === 'string')
          : [];
        this.sanitizeEquippedGearSlots();
        this.applyMetaBonusesToRun();
        return true;
      }
    } catch (_e) {
      // corrupted save
    }
    return false;
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  // --- Reset ---
  resetRun(): void {
    const unlocks = {
      unlockedWeapons: [...this.state.unlockedWeapons],
      unlockedCharacters: [...this.state.unlockedCharacters],
      collectedGlasses: [...(this.state.collectedGlasses || [])],
      equippedGlasses: this.state.equippedGlasses || 'inmo_air_x',
      gearStash: [...(this.state.gearStash || [])],
      equippedGearSlots: {
        ...EMPTY_EQUIPPED_GEAR_SLOTS,
        ...(this.state.equippedGearSlots || {}),
      },
      bitcoinPerks: {
        ...EMPTY_BITCOIN_PERKS,
        ...(this.state.bitcoinPerks || {}),
      },
      meta: {
        bitcoinBank: Number((this.state.meta?.bitcoinBank || 0).toFixed(3)),
        permanentUpgrades: {
          damage: this.state.meta?.permanentUpgrades?.damage || 0,
          vitality: this.state.meta?.permanentUpgrades?.vitality || 0,
          mobility: this.state.meta?.permanentUpgrades?.mobility || 0,
        },
        permanentTalents: {
          ...EMPTY_TALENT_LEVELS,
          ...(this.state.meta?.permanentTalents || {}),
        },
        dayChallengeMastery: {
          ...EMPTY_DAY_CHALLENGE_MASTERY,
          ...(this.state.meta?.dayChallengeMastery || {}),
        },
        dayOpsRenown: Math.max(0, Number(this.state.meta?.dayOpsRenown || 0)),
      },
    };
    this.state = createDefaultState();
    this.state.unlockedWeapons = unlocks.unlockedWeapons;
    this.state.unlockedCharacters = unlocks.unlockedCharacters;
    this.state.collectedGlasses = unlocks.collectedGlasses;
    this.state.equippedGlasses = unlocks.equippedGlasses;
    this.state.gearStash = unlocks.gearStash;
    this.state.equippedGearSlots = unlocks.equippedGearSlots;
    this.state.bitcoinPerks = unlocks.bitcoinPerks;
    this.state.meta = unlocks.meta;
    this.sanitizeEquippedGearSlots();
    this.applyMetaBonusesToRun();
  }

  bankRunBitcoin(): number {
    const runBitcoin = Math.max(0, this.state.resources.bitcoin || 0);
    const bonuses = this.getPermanentTalentBonuses();
    const settled = Number((runBitcoin * bonuses.economyBitcoinMul).toFixed(3));
    this.state.meta.bitcoinBank = Number((this.state.meta.bitcoinBank + settled).toFixed(3));
    this.state.resources.bitcoin = this.state.meta.bitcoinBank;
    return settled;
  }

  getPermanentTalentChoices(): PermanentTalentChoice[] {
    const branches: PermanentTalentBranch[] = ['turret', 'companion', 'economy'];
    const talents = this.state.meta.permanentTalents || EMPTY_TALENT_LEVELS;
    const picks: PermanentTalentChoice[] = [];

    branches.forEach(branch => {
      const node = this.getNextTalentNodeForBranch(branch);
      if (!node) return;
      const currentLevel = talents[node.id] || 0;
      picks.push({
        id: node.id,
        branch: node.branch,
        branchCN: node.branchCN,
        nameCN: node.nameCN,
        descCN: node.descCN,
        level: currentLevel,
        nextLevel: Math.min(node.maxLevel, currentLevel + 1),
        maxLevel: node.maxLevel,
      });
    });

    return picks;
  }

  applyPermanentTalentChoice(choiceId: PermanentTalentNodeId): {
    id: PermanentTalentNodeId;
    branchCN: string;
    nameCN: string;
    level: number;
    maxLevel: number;
  } | null {
    const def = PERMANENT_TALENT_DEFS.find(item => item.id === choiceId);
    if (!def) return null;
    if (!this.state.meta.permanentTalents) {
      this.state.meta.permanentTalents = { ...EMPTY_TALENT_LEVELS };
    }
    const levels = this.state.meta.permanentTalents;

    const current = levels[choiceId] || 0;
    if (current >= def.maxLevel) return null;
    if (def.requires && (levels[def.requires] || 0) <= 0) return null;

    levels[choiceId] = current + 1;
    this.applyMetaBonusesToRun();
    return {
      id: choiceId,
      branchCN: def.branchCN,
      nameCN: def.nameCN,
      level: levels[choiceId],
      maxLevel: def.maxLevel,
    };
  }

  getPermanentTalentBonuses(): PermanentTalentBonuses {
    const levels = {
      ...EMPTY_TALENT_LEVELS,
      ...(this.state.meta?.permanentTalents || {}),
    };
    const turretDamageMul = 1 + levels.turret_core * 0.08;
    const turretFireRateMul = 1 + levels.turret_matrix * 0.06;
    const turretHealthMul = 1 + levels.turret_fortress * 0.12;
    const companionDamageMul = 1 + levels.companion_drill * 0.07;
    const companionFireRateMul = 1 + levels.companion_link * 0.05;
    const companionDayGainMul = 1 + levels.companion_command * 0.06;
    const economyLootMul = 1 + levels.economy_salvage * 0.08;
    const economyDayGainMul = 1 + levels.economy_logistics * 0.08;
    const economyBitcoinMul = 1 + levels.economy_fund * 0.18;
    const economyFoodUseMul = Math.max(0.72, 1 - levels.economy_logistics * 0.05);

    return {
      turretDamageMul: Number(turretDamageMul.toFixed(3)),
      turretFireRateMul: Number(turretFireRateMul.toFixed(3)),
      turretHealthMul: Number(turretHealthMul.toFixed(3)),
      companionDamageMul: Number(companionDamageMul.toFixed(3)),
      companionFireRateMul: Number(companionFireRateMul.toFixed(3)),
      companionDayGainMul: Number(companionDayGainMul.toFixed(3)),
      economyLootMul: Number(economyLootMul.toFixed(3)),
      economyDayGainMul: Number(economyDayGainMul.toFixed(3)),
      economyBitcoinMul: Number(economyBitcoinMul.toFixed(3)),
      economyFoodUseMul: Number(economyFoodUseMul.toFixed(3)),
    };
  }

  getDayChallengeMasteryLevels(): Record<DayChallengeBranch, number> {
    return {
      ...EMPTY_DAY_CHALLENGE_MASTERY,
      ...(this.state.meta?.dayChallengeMastery || {}),
    };
  }

  getDayChallengeMasteryBonuses(): DayChallengeMasteryBonuses {
    const levels = this.getDayChallengeMasteryLevels();
    const stableDangerMitigationMul = Math.max(0.72, 1 - levels.stable * 0.018);
    const stableRewardMul = 1 + levels.stable * 0.012;
    const adventureRewardMul = 1 + levels.adventure * 0.02;
    const adventureBitcoinMul = 1 + levels.adventure * 0.016;
    const extremeDamageMul = 1 + levels.extreme * 0.018;
    const extremeXpMul = 1 + levels.extreme * 0.014;
    return {
      stableDangerMitigationMul: Number(stableDangerMitigationMul.toFixed(3)),
      stableRewardMul: Number(stableRewardMul.toFixed(3)),
      adventureRewardMul: Number(adventureRewardMul.toFixed(3)),
      adventureBitcoinMul: Number(adventureBitcoinMul.toFixed(3)),
      extremeDamageMul: Number(extremeDamageMul.toFixed(3)),
      extremeXpMul: Number(extremeXpMul.toFixed(3)),
    };
  }

  addDayChallengeMastery(branch: DayChallengeBranch, gain: number = 1): number {
    if (!this.state.meta.dayChallengeMastery) {
      this.state.meta.dayChallengeMastery = { ...EMPTY_DAY_CHALLENGE_MASTERY };
    }
    const safeGain = Math.min(5, Math.max(1, Math.floor(gain || 0)));
    const next = Math.max(0, (this.state.meta.dayChallengeMastery[branch] || 0) + safeGain);
    this.state.meta.dayChallengeMastery[branch] = next;
    return next;
  }

  getDayOpsRenown(): number {
    return Math.max(0, Number(this.state.meta?.dayOpsRenown || 0));
  }

  getDayOpsRenownBonuses(): DayOpsRenownBonuses {
    const renown = this.getDayOpsRenown();
    const dayRewardMul = 1 + Math.min(0.52, renown * 0.015);
    const dayXpMul = 1 + Math.min(0.42, renown * 0.012);
    const nightDirectiveDamageMul = 1 + Math.min(0.34, renown * 0.01);
    const prepCapBonus = Math.min(8, Math.floor(renown / 4));
    return {
      dayRewardMul: Number(dayRewardMul.toFixed(3)),
      dayXpMul: Number(dayXpMul.toFixed(3)),
      nightDirectiveDamageMul: Number(nightDirectiveDamageMul.toFixed(3)),
      prepCapBonus,
    };
  }

  addDayOpsRenown(gain: number = 1): number {
    const safeGain = Math.min(6, Math.max(0, Math.floor(gain || 0)));
    this.state.meta.dayOpsRenown = Math.max(0, Number((this.state.meta.dayOpsRenown || 0) + safeGain));
    return this.state.meta.dayOpsRenown;
  }

  getPermanentUpgradeChoices(): Array<{ id: PermanentUpgradeChoice; nameCN: string; descCN: string }> {
    const lv = this.state.meta.permanentUpgrades;
    return [
      {
        id: 'damage',
        nameCN: '武器协议',
        descCN: `永久伤害 +6%（当前Lv.${lv.damage}）`,
      },
      {
        id: 'vitality',
        nameCN: '生存韧性',
        descCN: `永久生命 +12（当前Lv.${lv.vitality}）`,
      },
      {
        id: 'mobility',
        nameCN: '机动强化',
        descCN: `永久移速 +5（当前Lv.${lv.mobility}）`,
      },
    ];
  }

  applyPermanentUpgrade(choice: PermanentUpgradeChoice): { level: number; nameCN: string } {
    this.state.meta.permanentUpgrades[choice] = (this.state.meta.permanentUpgrades[choice] || 0) + 1;
    this.applyMetaBonusesToRun();
    const names: Record<PermanentUpgradeChoice, string> = {
      damage: '武器协议',
      vitality: '生存韧性',
      mobility: '机动强化',
    };
    return {
      level: this.state.meta.permanentUpgrades[choice],
      nameCN: names[choice],
    };
  }

  private sortGearStashInPlace(): void {
    const rarityRank = (rarity: GearRarity): number => {
      if (rarity === 'mythic') return 6;
      if (rarity === 'legendary') return 5;
      if (rarity === 'epic') return 4;
      if (rarity === 'rare') return 3;
      if (rarity === 'magic') return 2;
      return 1;
    };
    this.state.gearStash.sort((a, b) => {
      const rarityDelta = rarityRank(b.rarity) - rarityRank(a.rarity);
      if (rarityDelta !== 0) return rarityDelta;
      const levelDelta = (b.itemLevel || 0) - (a.itemLevel || 0);
      if (levelDelta !== 0) return levelDelta;
      return (b.sellValue || 0) - (a.sellValue || 0);
    });
  }

  private sanitizeEquippedGearSlots(): void {
    const stashSet = new Set((this.state.gearStash || []).map(item => item.uid));
    (Object.keys(this.state.equippedGearSlots) as GearWeaponType[]).forEach((weaponType) => {
      const uid = this.state.equippedGearSlots[weaponType];
      if (!uid) return;
      if (!stashSet.has(uid)) {
        this.state.equippedGearSlots[weaponType] = null;
      }
    });
  }

  private applyMetaBonusesToRun(): void {
    const defaults = createDefaultState();
    const lv = this.state.meta.permanentUpgrades;
    this.state.baseStats.maxHealth = defaults.baseStats.maxHealth + lv.vitality * 12;
    this.state.baseStats.damage = Number((defaults.baseStats.damage * Math.pow(1.06, lv.damage)).toFixed(2));
    this.state.baseStats.moveSpeed = defaults.baseStats.moveSpeed + lv.mobility * 5;
    this.state.resources.bitcoin = Number((this.state.meta.bitcoinBank || 0).toFixed(3));
  }

  private getNextTalentNodeForBranch(branch: PermanentTalentBranch): PermanentTalentNodeDef | null {
    const levels = this.state.meta?.permanentTalents || EMPTY_TALENT_LEVELS;
    const nodes = PERMANENT_TALENT_DEFS.filter(node => node.branch === branch);
    for (const node of nodes) {
      const current = levels[node.id] || 0;
      if (current >= node.maxLevel) continue;
      if (node.requires && (levels[node.requires] || 0) <= 0) continue;
      return node;
    }
    return null;
  }

  // --- Legacy compatibility (for gradual migration) ---
  toLegacyRunState(): Record<string, any> {
    return {
      day: this.state.currentDay,
      time: this.state.timeOfDay,
      phase: this.state.isNight ? 'night' : 'day',
      resources: this.state.resources,
      companions: this.state.companions,
      buildings: this.state.buildings,
      base: this.state.base,
      unlockedWeapons: this.state.unlockedWeapons,
      stats: this.state.stats,
    };
  }

  syncFromLegacy(runState: any): void {
    if (!runState) return;
    if (runState.resources) {
      Object.assign(this.state.resources, runState.resources);
    }
    if (runState.base) {
      Object.assign(this.state.base, runState.base);
    }
    if (runState.stats) {
      Object.assign(this.state.stats, runState.stats);
    }
    if (runState.day) this.state.currentDay = runState.day;
  }
}

// Export singleton
export const gameState = GameStateManager.getInstance();
export type { GameStateManager };
