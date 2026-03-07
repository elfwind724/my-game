/**
 * GameScene - Central coordinator
 * Delegates to systems: DayCycle, Wave, Loot, Build, Weapon, Companion, Enemy, Player
 * Manages physics groups, collisions, and inter-system communication
 */
import Phaser from 'phaser';
import {
  gameState,
  type Resources,
  type CompanionData,
  type AutoBuildRule,
  type ConstructionTaskData,
  type ConstructionTaskKind,
  type PermanentTalentBonuses,
  type DayChallengeBranch,
  type DayChallengeMasteryBonuses,
  type DayOpsRenownBonuses,
  type GearWeaponType,
} from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import { WeatherSystem } from '../systems/WeatherSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { WeaponSystem, type WeaponType } from '../systems/WeaponSystem';
import { CompanionSystem } from '../systems/CompanionSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { PlayerSystem } from '../systems/PlayerSystem';
import { DayCycleSystem } from '../systems/DayCycleSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { LootSystem } from '../systems/LootSystem';
import { EvolutionSystem, type LevelUpProtocolId } from '../systems/EvolutionSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { BaseSystem } from '../systems/BaseSystem';
import { CompanionPersonalitySystem } from '../systems/CompanionPersonalitySystem';
import { GearLootSystem } from '../systems/GearLootSystem';
import { BASE_POWER_PER_TURRET } from '../data/base';
import { BUILDING_DEFS, getBuildingUpgradeHint } from '../data/buildings';
import { BASE_PLACEMENT_RULE } from '../data/buildingEcology';
import { WEAPON_DEFS } from '../data/weapons';
import {
  RUN_EVENT_ARC_LABELS,
  RUN_EVENT_CHAPTER_LABELS,
  RUN_EVENT_CHOICE_FACTION_DELTA,
  RUN_EVENT_CHAIN_STAGES,
  RUN_EVENT_DEFS,
  RUN_EVENT_FACTION_LABELS,
  RUN_EVENT_LORE_SNIPPETS,
  RUN_EVENT_META_BY_ID,
  type RunEventArc,
  type RunEventChainStageId,
  type RunEventFaction,
  type RunEventDef,
  type RunEventChoiceDef,
  type RunEventLoreSnippet,
  type RunEventPeriod,
} from '../data/runEvents';
import { LOOT_CODEX_BY_ID, LOOT_CODEX_ENTRIES } from '../data/lootCodex';
import { CompanionConfig } from '../types/SkillTypes';
import {
  HERO_V2_TEXTURE_KEY,
  HERO_V2_ACTIONS,
  ENEMY_V2_ACTIONS,
  ENEMY_V2_TEXTURE_KEYS,
  type HeroV2Direction,
  type EnemyV2Direction,
  type V2Action,
  type EnemyV2Archetype,
  getHeroFrameIndex,
  getEnemyFrameIndex,
  heroAnimKey,
  enemyAnimKey,
  getActionDurationMs,
  mapLegacyEnemyTypeToV2Archetype,
} from '../data/v2SpriteAnims';
import {
  customHeroTextureKey,
  hasCustomHeroDirectionalTextures,
} from '../data/customHero';
import { getCompanionMilestoneBonuses } from '../data/companionMilestones';
import { getWeaponMilestoneBonuses } from '../data/weaponMilestones';

interface CampInteractable {
  sprite: Phaser.GameObjects.Sprite;
  type: 'merchant' | 'commander' | 'weaponsmith';
  name: string;
  cooldown: number;
  lastInteract: number;
}

interface FacilityInteractable {
  id: 'kitchen' | 'quarters' | 'guard_post' | 'workbench';
  name: string;
  action: string;
  sprite: Phaser.GameObjects.Sprite;
  enterX: number;
  enterY: number;
  exitX: number;
  exitY: number;
  radius: number;
}

type WorldZoneId = 'base' | 'river' | 'forest' | 'city' | 'cave' | 'wasteland';
type ExplorationActionType = 'fish' | 'swim' | 'hunt' | 'scavenge' | 'cave_explore';

interface ExplorationSpot {
  id: string;
  zone: WorldZoneId;
  actionType: ExplorationActionType;
  name: string;
  hint: string;
  marker: Phaser.GameObjects.Container;
  statusText: Phaser.GameObjects.Text;
  color: number;
  x: number;
  y: number;
  radius: number;
  cooldown: number;
  lastInteract: number;
}

interface DayLifeSpotBonus {
  label: string;
  summary: string;
  rewardMul: number;
  dangerMul: number;
  bonusXp: number;
  expiresAt: number;
  color: string;
}

interface ConstructionSiteVisual {
  container: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  eta: Phaser.GameObjects.Text;
}

interface ResourceFloatingToastEntry {
  id: number;
  type: string;
  label: string;
  amount: number;
  text: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent | null;
  tween: Phaser.Tweens.Tween | null;
}

interface DayMiniGameProfile {
  title: string;
  hint: string;
  targetColor: number;
  perfectColor: number;
  trapColor: number;
  baseWidth: number;
  baseTargetSpeed: number;
  perfectRatio: number;
  riskyTargetWidthMul: number;
  riskyTargetSpeedMul: number;
  hasTrap: boolean;
  trapWidth: number;
}

interface DayMiniGameTheme {
  variant: 'river' | 'forest' | 'city' | 'cave';
  accent: number;
  accentText: string;
  icon: string;
  subtitle: string;
  panelColor: number;
  overlayColor: number;
  overlayAlpha: number;
  arenaColor: number;
  tileA: number;
  tileB: number;
  safeCardColor: number;
  riskyCardColor: number;
  buttonColor: number;
  buttonTextColor: string;
  protocolLevel: number;
  protocolLabel: string;
  protocolColor: number;
}

interface DayExplorationChallenge {
  id: string;
  branch: DayChallengeBranch;
  branchNameCN: string;
  actionType: ExplorationActionType;
  targetQuality: 'good' | 'perfect';
  required: number;
  progress: number;
  reward: {
    resources: Partial<Record<keyof Resources, number>>;
    xp: number;
    bitcoin?: number;
  };
  title: string;
  desc: string;
  dailyEffect: string;
  masteryGain: number;
  completed: boolean;
  day: number;
}

type DayOpsQualityRequirement = 'any' | 'good' | 'perfect';
type DayOpsStage = 'prep' | 'execute' | 'handoff' | 'done';

interface DayOpsContract {
  id: string;
  actionType: ExplorationActionType;
  title: string;
  desc: string;
  prepDesc: string;
  requiredQuality: DayOpsQualityRequirement;
  riskyOnly: boolean;
  target: number;
  progress: number;
  prepGain: number;
  stage: DayOpsStage;
  prepCost: Partial<Record<keyof Resources, number>>;
  handoffNpc: 'commander';
  renownGain: number;
  reward: {
    resources: Partial<Record<keyof Resources, number>>;
    xp: number;
    bitcoin?: number;
  };
  completed: boolean;
  day: number;
}

type NightDirectiveId = 'fortify' | 'assault' | 'salvage';

interface NightDirectiveDef {
  id: NightDirectiveId;
  nameCN: string;
  summaryCN: string;
  color: number;
  effects: {
    playerDamageMul: number;
    companionDamageMul: number;
    turretDamageMul: number;
    residentDamageMul: number;
    lootMul: number;
    xpMul: number;
    enemyPressureMul: number;
  };
}

interface CaveRaidEnemy {
  sprite: Phaser.GameObjects.Rectangle;
  visual: Phaser.GameObjects.Image | null;
  hp: number;
  maxHp: number;
  speed: number;
  vx: number;
  vy: number;
  kind: 'runner' | 'leaper' | 'spitter' | 'boss';
  touchDamage: number;
  isBoss: boolean;
  nextAttackAt: number;
  jumpCooldownUntil: number;
  groundY: number;
}

interface CaveRaidProjectile {
  sprite: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  lifeMs: number;
  damage: number;
  fromEnemy: boolean;
}

interface CaveRaidTrap {
  zone: Phaser.GameObjects.Rectangle;
  pulse: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image | null;
  armedAt: number;
  fireAt: number;
  fired: boolean;
  mode: 'floor' | 'drop';
  travelV: number;
}

interface CaveRaidSurface {
  x1: number;
  x2: number;
  y: number;
}

interface ForestHuntClue {
  sprite: Phaser.GameObjects.Image;
  pulse: Phaser.GameObjects.Ellipse;
}

interface CityScavengeLootNode {
  sprite: Phaser.GameObjects.Image;
  pulse: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
  weight: number;
  value: number;
  kind: 'supply' | 'medical' | 'tech' | 'stash';
  collected: boolean;
}

interface CityScavengePatrol {
  sprite: Phaser.GameObjects.Image;
  laneY: number;
  vx: number;
  width: number;
  height: number;
}

interface ResidentAssistTask {
  companionId: string;
  behavior: ResidentBehavior;
  expiresAt: number;
  rewardResource: keyof Resources;
  rewardAmount: number;
  rewardExp: number;
  assistLabel: string;
  chainStep: 1 | 2;
  marker: Phaser.GameObjects.Text;
}

type ResidentBehavior = 'fishing' | 'cooking' | 'guard' | 'sleep' | 'forage' | 'adventure' | 'stroll';
type ResidentMode = 'idle' | 'moving' | 'inside';

type DamageSource =
  | { type: 'player'; weaponType?: WeaponType | null }
  | { type: 'companion'; companionId?: string | null }
  | { type: 'turret'; turretId?: string | null };
type BulletVfxArchetype = 'kinetic' | 'scatter' | 'pulse' | 'flame' | 'pierce' | 'cannon' | 'frost' | 'chain' | 'orbit' | 'holy' | 'boomerang';

interface RunMutatorEffects {
  playerDamageMul: number;
  incomingDamageMul: number;
  enemyToughnessMul: number;
  companionDamageMul: number;
  turretDamageMul: number;
  nightResidentDamageMul: number;
  lootGainMul: number;
  dayActivityGainMul: number;
  dayFoodConsumptionMul: number;
  xpMul: number;
}

interface RunMutatorDef {
  id: string;
  nameCN: string;
  descCN: string;
  effects: Partial<RunMutatorEffects>;
}

const AUTO_LEVEL_COLOR_CYCLE: number[] = [
  0x22d3ee, 0x38bdf8, 0x34d399, 0xfacc15,
  0xfb923c, 0xf472b6, 0xa78bfa, 0xf43f5e,
];

const PROTOCOL_VISUAL_PROFILE: Record<LevelUpProtocolId, { color: number; baseFreq: number }> = {
  barrage_matrix: { color: 0x22d3ee, baseFreq: 186 },
  phase_lance: { color: 0x7dd3fc, baseFreq: 208 },
  overclock_link: { color: 0xf59e0b, baseFreq: 233 },
  echo_reactor: { color: 0xa78bfa, baseFreq: 247 },
  hunter_instinct: { color: 0x34d399, baseFreq: 175 },
  companion_sync: { color: 0x38bdf8, baseFreq: 196 },
};

const DEFAULT_RUN_MUTATOR_EFFECTS: RunMutatorEffects = {
  playerDamageMul: 1,
  incomingDamageMul: 1,
  enemyToughnessMul: 1,
  companionDamageMul: 1,
  turretDamageMul: 1,
  nightResidentDamageMul: 1,
  lootGainMul: 1,
  dayActivityGainMul: 1,
  dayFoodConsumptionMul: 1,
  xpMul: 1,
};

const RUN_MUTATOR_DEFS: RunMutatorDef[] = [
  {
    id: 'berserker_protocol',
    nameCN: '狂战协议',
    descCN: '玩家伤害+26%，但承伤+32%',
    effects: { playerDamageMul: 1.26, incomingDamageMul: 1.32 },
  },
  {
    id: 'scavenger_boom',
    nameCN: '拾荒热潮',
    descCN: '掉落与白天产出提高，但敌人更耐打',
    effects: { lootGainMul: 1.34, dayActivityGainMul: 1.24, enemyToughnessMul: 1.18 },
  },
  {
    id: 'night_watch',
    nameCN: '夜巡法令',
    descCN: '夜间驻守火力增强，白天产出略降',
    effects: { nightResidentDamageMul: 1.32, companionDamageMul: 1.1, dayActivityGainMul: 0.88 },
  },
  {
    id: 'lean_rations',
    nameCN: '紧缩配给',
    descCN: '经验获取提高，但每日食物消耗增加',
    effects: { xpMul: 1.2, dayFoodConsumptionMul: 1.44 },
  },
  {
    id: 'turret_overclock',
    nameCN: '炮塔超频',
    descCN: '炮塔输出提高，伙伴输出略降',
    effects: { turretDamageMul: 1.3, companionDamageMul: 0.92, enemyToughnessMul: 1.08 },
  },
];

const NIGHT_DIRECTIVE_DEFS: Record<NightDirectiveId, NightDirectiveDef> = {
  fortify: {
    id: 'fortify',
    nameCN: '坚守防线',
    summaryCN: '降低夜间压力，驻守火力更稳',
    color: 0x38bdf8,
    effects: {
      playerDamageMul: 1.08,
      companionDamageMul: 1.1,
      turretDamageMul: 1.12,
      residentDamageMul: 1.2,
      lootMul: 0.96,
      xpMul: 0.95,
      enemyPressureMul: 0.86,
    },
  },
  assault: {
    id: 'assault',
    nameCN: '猎杀出击',
    summaryCN: '正面清场，收益更高但压力更大',
    color: 0xef4444,
    effects: {
      playerDamageMul: 1.24,
      companionDamageMul: 1.2,
      turretDamageMul: 1.14,
      residentDamageMul: 1.08,
      lootMul: 1.18,
      xpMul: 1.2,
      enemyPressureMul: 1.22,
    },
  },
  salvage: {
    id: 'salvage',
    nameCN: '夜行回收',
    summaryCN: '维持战线并强化战利回收',
    color: 0xf59e0b,
    effects: {
      playerDamageMul: 1.06,
      companionDamageMul: 1.08,
      turretDamageMul: 1.08,
      residentDamageMul: 1.06,
      lootMul: 1.34,
      xpMul: 1.1,
      enemyPressureMul: 1.05,
    },
  },
};

const TURRET_PROMOTION_LEVEL = 20;
const TURRET_MAX_LEVEL = 40;
const TURRET_ADVANCED_CLASSES = [
  { nameCN: '轨道炮台', damageMul: 1.36, fireRateMul: 0.94, rangeMul: 1.22, bulletSpeedMul: 1.16, tint: 0xf97316 },
  { nameCN: '风暴电塔', damageMul: 1.2, fireRateMul: 0.72, rangeMul: 1.08, bulletSpeedMul: 1.24, tint: 0x22d3ee },
  { nameCN: '堡垒守护塔', damageMul: 1.28, fireRateMul: 0.86, rangeMul: 1.16, bulletSpeedMul: 1.08, tint: 0xa78bfa },
] as const;

const behaviorName: Record<ResidentBehavior, string> = {
  fishing: '钓鱼',
  cooking: '做饭',
  guard: '站岗',
  sleep: '睡觉',
  forage: '拾荒',
  adventure: '探险',
  stroll: '散步',
};

export default class GameScene extends Phaser.Scene {
  // Core game objects
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Physics groups
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private vsBullets!: Phaser.Physics.Arcade.Group;
  private companions!: Phaser.Physics.Arcade.Group;
  private companionBullets!: Phaser.Physics.Arcade.Group;
  private survivors!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.Group;
  private turrets!: Phaser.Physics.Arcade.Group;
  private turretBullets!: Phaser.Physics.Arcade.Group;

  // Systems
  private weatherSystem!: WeatherSystem;
  private animationSystem!: AnimationSystem;
  private weaponSystem!: WeaponSystem;
  private companionSystem!: CompanionSystem;
  private enemySystem!: EnemySystem;
  private playerSystem!: PlayerSystem;
  private dayCycleSystem!: DayCycleSystem;
  private waveSystem!: WaveSystem;
  private lootSystem!: LootSystem;

  // UI state
  private levelUpPanelOpen: boolean = false;
  private isCraftingPanelOpen: boolean = false;

  // State
  private isGameOver: boolean = false;
  private isBuildMode: boolean = false;
  private buildPreview: Phaser.GameObjects.Rectangle | null = null;
  private selectedBuildingId: string = 'wall';
  private buildPalette?: Phaser.GameObjects.Container;
  private buildPaletteText?: Phaser.GameObjects.Text;
  private buildPaletteBg?: Phaser.GameObjects.Rectangle;
  private buildIndex: number = 0;
  private buildList: string[] = [];
  private interactables: CampInteractable[] = [];
  private facilityInteractables: FacilityInteractable[] = [];
  private explorationSpots: ExplorationSpot[] = [];
  private explorationEdgeIndicators: Map<string, Phaser.GameObjects.Container> = new Map();
  private interactionHint!: Phaser.GameObjects.Text;
  private pendingInteractable: CampInteractable | null = null;
  private pendingFacility: FacilityInteractable | null = null;
  private pendingExplorationSpot: ExplorationSpot | null = null;
  private pendingResidentAssist: ResidentAssistTask | null = null;
  private currentFacility: FacilityInteractable | null = null;
  private facilityLockPosition: Phaser.Math.Vector2 | null = null;
  private facilityTransitioning: boolean = false;
  private facilityTransitionStartedAt: number = 0;
  private facilityTransitionFallback: Phaser.Time.TimerEvent | null = null;
  private lightingLayer!: Phaser.GameObjects.RenderTexture;
  private lightBrush!: Phaser.GameObjects.Image;
  private worldFeatureLayer!: Phaser.GameObjects.Container;
  private villageLayer!: Phaser.GameObjects.Container;
  private villageLights: { x: number; y: number; scale: number }[] = [];
  private lastPowerWarning: number = 0;
  private lastHungerWarning: number = 0;
  private lastStructureWarning: number = 0;
  private dayActivityUsage: Map<ExplorationActionType, number> = new Map();
  private explorationStatusNextAt: number = 0;
  private resourceToastSeed: number = 0;
  private resourceToastBaseX: number = 0;
  private resourceToastBaseY: number = 0;
  private resourceFloatingToasts: ResourceFloatingToastEntry[] = [];
  private resourceFloatingToastsByType: Map<string, ResourceFloatingToastEntry> = new Map();
  private lootLegendQueue: string[] = [];
  private lootLegendActiveResourceId: string | null = null;
  private lootLegendContainer: Phaser.GameObjects.Container | null = null;
  private lootLegendAutoCloseTimer: Phaser.Time.TimerEvent | null = null;
  private lootCodexCollected: Record<string, number> = {};
  private dayAdventureChain: number = 0;
  private dayAdventureLastAt: number = 0;
  private activeRunMutators: RunMutatorDef[] = [];
  private runMutatorEffects: RunMutatorEffects = { ...DEFAULT_RUN_MUTATOR_EFFECTS };
  private permanentTalentBonuses: PermanentTalentBonuses = gameState.getPermanentTalentBonuses();
  private dayChallengeMasteryBonuses: DayChallengeMasteryBonuses = gameState.getDayChallengeMasteryBonuses();
  private dayOpsRenownBonuses: DayOpsRenownBonuses = gameState.getDayOpsRenownBonuses();
  private runEventOpen: boolean = false;
  private runEventContainer: Phaser.GameObjects.Container | null = null;
  private pendingNightWaveStartAfterEvent: boolean = false;
  private pendingDayRunEventAfterChallenge: boolean = false;
  private runEventAutoPickTimer: Phaser.Time.TimerEvent | null = null;
  private runEventRecentHistory: Array<{ id: string; period: RunEventPeriod; arc: RunEventArc; day: number }> = [];
  private runEventRecentLorePieces: string[] = [];
  private runEventActiveLoreSnippet: RunEventLoreSnippet | null = null;
  private runEventMissStreak: Record<RunEventPeriod, number> = { day: 0, night: 0 };
  private runEventLastTriggerDay: Record<RunEventPeriod, number> = { day: -99, night: -99 };
  private runEventLastAnyTriggerDay: number = -99;
  private runEventLastAnyTriggerPeriod: RunEventPeriod | null = null;
  private runEventGlobalCooldownUntilDay: number = 1;
  private runEventCurrentChapter: 1 | 2 | 3 | 4 = 1;
  private runEventFactionStanding: Record<RunEventFaction, number> = {
    survivorUnion: 0,
    tradeRing: 0,
    citadelAI: 0,
    labRemnant: 0,
    mutantSwarm: 0,
  };
  private dayChallengeSelectionOpen: boolean = false;
  private dayChallengeSelectionContainer: Phaser.GameObjects.Container | null = null;
  private dayChallengePendingChoices: DayExplorationChallenge[] = [];
  private dayChallengeBranchSelected: DayChallengeBranch | null = null;
  private dayChallengeDayRewardMul: number = 1;
  private dayChallengeDayDangerMul: number = 1;
  private dayChallengeDayXpMul: number = 1;
  private dayChallengeBranchRecentActions: Record<DayChallengeBranch, ExplorationActionType[]> = {
    stable: [],
    adventure: [],
    extreme: [],
  };
  private dayOpsContracts: DayOpsContract[] = [];
  private dayOpsNightPrepStacks: number = 0;
  private nightDirectiveSelectionOpen: boolean = false;
  private nightDirectiveSelectionContainer: Phaser.GameObjects.Container | null = null;
  private nightDirectiveAutoPickTimer: Phaser.Time.TimerEvent | null = null;
  private nightDirectiveId: NightDirectiveId | null = null;
  private nightDirectiveEffects: NightDirectiveDef['effects'] = {
    playerDamageMul: 1,
    companionDamageMul: 1,
    turretDamageMul: 1,
    residentDamageMul: 1,
    lootMul: 1,
    xpMul: 1,
    enemyPressureMul: 1,
  };
  private nightDirectivePressureNextAt: number = 0;
  private daySpotMiniGameOpen: boolean = false;
  private daySpotMiniGameContainer: Phaser.GameObjects.Container | null = null;
  private daySpotMiniGameSpot: ExplorationSpot | null = null;
  private daySpotMiniGameRisk: 'safe' | 'risky' = 'safe';
  private daySpotMiniGameMode: ExplorationActionType = 'fish';
  private daySpotMiniGameCursor: number = 0.5;
  private daySpotMiniGameCursorDir: number = 1;
  private daySpotMiniGameTargetCenter: number = 0.5;
  private daySpotMiniGameTargetDir: number = 1;
  private daySpotMiniGameTargetWidth: number = 0.24;
  private daySpotMiniGamePerfectRatio: number = 0.4;
  private daySpotMiniGameTrapCenter: number = -1;
  private daySpotMiniGameTrapWidth: number = 0;
  private daySpotMiniGameProfile: DayMiniGameProfile | null = null;
  private daySpotMiniGameCursorVisual: Phaser.GameObjects.Rectangle | null = null;
  private daySpotMiniGameTargetVisual: Phaser.GameObjects.Rectangle | null = null;
  private daySpotMiniGamePerfectVisual: Phaser.GameObjects.Rectangle | null = null;
  private daySpotMiniGameTrapVisual: Phaser.GameObjects.Rectangle | null = null;
  private daySpotMiniGameTrapIcon: Phaser.GameObjects.Image | null = null;
  private daySpotMiniGameRoundText: Phaser.GameObjects.Text | null = null;
  private daySpotMiniGameStageText: Phaser.GameObjects.Text | null = null;
  private daySpotMiniGameActionLabel: Phaser.GameObjects.Text | null = null;
  private daySpotMiniGameRound: number = 1;
  private daySpotMiniGameRoundsTotal: number = 1;
  private daySpotMiniGameScore: number = 0;
  private daySpotMiniGameTrapHits: number = 0;
  private caveRaidMiniGameActive: boolean = false;
  private caveRaidResultResolved: boolean = false;
  private caveRaidArena: Phaser.Geom.Rectangle | null = null;
  private caveRaidGroundY: number = 0;
  private caveRaidSurfaces: CaveRaidSurface[] = [];
  private caveRaidPlayerSprite: Phaser.GameObjects.Rectangle | null = null;
  private caveRaidPlayerIcon: Phaser.GameObjects.Image | null = null;
  private caveRaidPlayerVy: number = 0;
  private caveRaidPlayerHpMax: number = 100;
  private caveRaidPlayerHp: number = 100;
  private caveRaidPlayerSpeed: number = 0.26;
  private caveRaidPlayerJumpForce: number = 0.46;
  private caveRaidPlayerGrounded: boolean = true;
  private caveRaidPlayerJumpCooldownUntil: number = 0;
  private caveRaidPlayerAttackCooldownUntil: number = 0;
  private caveRaidPlayerInvulUntil: number = 0;
  private caveRaidElapsedMs: number = 0;
  private caveRaidDurationMs: number = 36000;
  private caveRaidStage: 1 | 2 | 3 = 1;
  private caveRaidStageProgress: number = 0;
  private caveRaidStageObjective: number = 4;
  private caveRaidKills: number = 0;
  private caveRaidBossSpawned: boolean = false;
  private caveRaidBossKilled: boolean = false;
  private caveRaidBossSprite: Phaser.GameObjects.Rectangle | null = null;
  private caveRaidBossNextSkillAt: number = 0;
  private caveRaidNextSpawnAt: number = 0;
  private caveRaidNextTrapAt: number = 0;
  private caveRaidEnemyHpMul: number = 1;
  private caveRaidEnemySpeedMul: number = 1;
  private caveRaidEnemySpawnIntervalMs: number = 2100;
  private caveRaidMobileMoveX: number = 0;
  private caveRaidMobileMoveY: number = 0;
  private caveRaidStatusText: Phaser.GameObjects.Text | null = null;
  private caveRaidHpText: Phaser.GameObjects.Text | null = null;
  private caveRaidTimerText: Phaser.GameObjects.Text | null = null;
  private caveRaidEnemies: CaveRaidEnemy[] = [];
  private caveRaidProjectiles: CaveRaidProjectile[] = [];
  private caveRaidTraps: CaveRaidTrap[] = [];
  private forestHuntMiniGameActive: boolean = false;
  private forestHuntResultResolved: boolean = false;
  private forestHuntArena: Phaser.Geom.Rectangle | null = null;
  private forestHuntGroundY: number = 0;
  private forestHuntPlayerSprite: Phaser.GameObjects.Rectangle | null = null;
  private forestHuntPreySprite: Phaser.GameObjects.Rectangle | null = null;
  private forestHuntPlayerIcon: Phaser.GameObjects.Image | null = null;
  private forestHuntPreyIcon: Phaser.GameObjects.Image | null = null;
  private forestHuntHintIcon: Phaser.GameObjects.Image | null = null;
  private forestHuntSightVisual: Phaser.GameObjects.Rectangle | null = null;
  private forestHuntClue: ForestHuntClue | null = null;
  private forestHuntStatusText: Phaser.GameObjects.Text | null = null;
  private forestHuntPhaseText: Phaser.GameObjects.Text | null = null;
  private forestHuntAlertText: Phaser.GameObjects.Text | null = null;
  private forestHuntActionHintText: Phaser.GameObjects.Text | null = null;
  private forestHuntPhase: 'stealth' | 'burst' = 'stealth';
  private forestHuntPhaseElapsedMs: number = 0;
  private forestHuntStealthDurationMs: number = 5200;
  private forestHuntBurstDurationMs: number = 2400;
  private forestHuntRoundStealthSuccess: boolean = false;
  private forestHuntAlertMeter: number = 0;
  private forestHuntDetections: number = 0;
  private forestHuntBreathCooldownUntil: number = 0;
  private forestHuntPlayerSpeed: number = 0.24;
  private forestHuntPreyVx: number = 0.082;
  private forestHuntPreyFacing: number = 1;
  private forestHuntMobileMoveX: number = 0;
  private forestHuntBurstCursor: number = 0.5;
  private forestHuntBurstCursorDir: number = 1;
  private forestHuntBurstCursorSpeed: number = 0.00106;
  private forestHuntBurstTargetCenter: number = 0.5;
  private forestHuntBurstTargetDir: number = 1;
  private forestHuntBurstTargetSpeed: number = 0.00052;
  private forestHuntBurstTargetWidth: number = 0.22;
  private forestHuntBurstPerfectRatio: number = 0.42;
  private cityScavengeMiniGameActive: boolean = false;
  private cityScavengeResultResolved: boolean = false;
  private cityScavengeArena: Phaser.Geom.Rectangle | null = null;
  private cityScavengePlayerSprite: Phaser.GameObjects.Rectangle | null = null;
  private cityScavengeExtractZone: Phaser.GameObjects.Rectangle | null = null;
  private cityScavengeStatusText: Phaser.GameObjects.Text | null = null;
  private cityScavengeTimerText: Phaser.GameObjects.Text | null = null;
  private cityScavengeCarryText: Phaser.GameObjects.Text | null = null;
  private cityScavengeActionHintText: Phaser.GameObjects.Text | null = null;
  private cityScavengeRouteText: Phaser.GameObjects.Text | null = null;
  private cityScavengeRoute: 'alley' | 'market' | 'rooftop' = 'alley';
  private cityScavengeRouteSelected: boolean = false;
  private cityScavengeElapsedMs: number = 0;
  private cityScavengeTimeLimitMs: number = 15000;
  private cityScavengeCarryWeight: number = 0;
  private cityScavengeCarryCap: number = 20;
  private cityScavengeLootScore: number = 0;
  private cityScavengeScoreTarget: number = 24;
  private cityScavengePlayerBaseSpeed: number = 0.27;
  private cityScavengeMoveX: number = 0;
  private cityScavengeMoveY: number = 0;
  private cityScavengeTrapCooldownUntil: number = 0;
  private cityScavengeLanes: number[] = [];
  private cityScavengeLootNodes: CityScavengeLootNode[] = [];
  private cityScavengePatrols: CityScavengePatrol[] = [];
  private cityScavengeRouteRewardMul: number = 1;
  private cityScavengeRouteDangerMul: number = 1;
  private cityScavengeExtracted: boolean = false;
  private dayLifePulseTimer: Phaser.Time.TimerEvent | null = null;
  private daySpotBonuses: Map<string, DayLifeSpotBonus> = new Map();
  private dayExplorationChallenge: DayExplorationChallenge | null = null;
  private dayChallengeHintCooldownUntil: number = 0;
  private scavengeDurabilityStacks: number = 0;
  private scavengeDurabilityPenaltyUntil: number = 0;
  public scavengeDurabilityPenaltyStartAt: number = 0;
  public scavengeDurabilityPenaltyDurationMs: number = 0;

  // Last known companion data for roster sync
  private lastCompanionRosterSignature: string = '';

  // Base residents (visuals for companions stationed at base)
  private baseResidents: Map<string, Phaser.GameObjects.Container> = new Map();
  private baseResidentAssignments: Map<string, number> = new Map();
  private facilityOccupants: Map<FacilityInteractable['id'], string> = new Map();
  private baseLifePulseTimer: Phaser.Time.TimerEvent | null = null;
  private residentSocialPulseTimer: Phaser.Time.TimerEvent | null = null;
  private baseRoutineTimer: Phaser.Time.TimerEvent | null = null;
  private dayResidentEconomyTimer: Phaser.Time.TimerEvent | null = null;
  private residentDayYieldNextAt: Map<string, number> = new Map();
  private residentDefenseNextFireAt: Map<string, number> = new Map();
  private residentNightAnchorIndex: Map<string, number> = new Map();
  private constructionSiteVisuals: Map<string, ConstructionSiteVisual> = new Map();
  private constructionAssignedResidents: Map<string, string> = new Map();
  private constructionFxNextAt: Map<string, number> = new Map();
  private nextAutoBuildPlanAt: number = 0;
  private nextAutoBuildCrewSyncAt: number = 0;
  private nextAutoDutyDispatchSyncAt: number = 0;
  private nextAutoDutyDispatchTipAt: number = 0;
  private nextConstructionSummaryAt: number = 0;
  private nextScavengerCollectorSyncAt: number = 0;
  private residentAssistTask: ResidentAssistTask | null = null;
  private residentRecentChatter: Map<string, string[]> = new Map();
  private companionCombatRecentChatter: Map<string, string[]> = new Map();
  private companionCombatNextAt: Map<string, number> = new Map();

  // VS-style multi-weapon fire timers
  private weaponTimers: Map<string, number> = new Map();
  private vsWeaponPatternCounter: Map<string, number> = new Map();

  // Combo tracking
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private comboText: Phaser.GameObjects.Text | null = null;
  private killStreakCount: number = 0;
  private lastKillTime: number = 0;
  private turretIdSeed: number = 0;
  private bulletTrailTick: number = 0;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private attackKey?: Phaser.Input.Keyboard.Key;
  private moveLeftKey?: Phaser.Input.Keyboard.Key;
  private moveRightKey?: Phaser.Input.Keyboard.Key;
  private jumpKey?: Phaser.Input.Keyboard.Key;
  private emergencyExitKey?: Phaser.Input.Keyboard.Key;
  private interactionDebounceUntil: number = 0;
  private weaponMasteryKills: Record<WeaponType, number> = {
    pistol: 0, shotgun: 0, rifle: 0, flamethrower: 0, laser: 0, rocket: 0,
    orbit: 0, holy_water: 0, lightning_ring: 0, boomerang: 0,
  };
  private weaponMasteryLevels: Record<WeaponType, number> = {
    pistol: 1, shotgun: 1, rifle: 1, flamethrower: 1, laser: 1, rocket: 1,
    orbit: 1, holy_water: 1, lightning_ring: 1, boomerang: 1,
  };
  private weaponMasteryNextKills: Record<WeaponType, number> = {
    pistol: 14, shotgun: 14, rifle: 14, flamethrower: 14, laser: 14, rocket: 14,
    orbit: 14, holy_water: 14, lightning_ring: 14, boomerang: 14,
  };
  private arOverdriveCharge: number = 0;
  private arOverdriveActiveUntil: number = 0;
  private arOverdrivePulseAt: number = 0;
  private battleMomentum: number = 0;
  private battleMomentumBoostUntil: number = 0;
  private battleMomentumPulseAt: number = 0;
  private levelSurgeUntil: number = 0;
  private levelSurgePulseAt: number = 0;
  private protocolAuraContainer: Phaser.GameObjects.Container | null = null;
  private protocolAuraInner: Phaser.GameObjects.Arc | null = null;
  private protocolAuraOuter: Phaser.GameObjects.Arc | null = null;
  private protocolAuraNodes: Phaser.GameObjects.Arc[] = [];
  private protocolAuraColor: number = 0x22d3ee;
  private protocolAuraLevel: number = 0;
  private protocolAuraBoostUntil: number = 0;
  private protocolAuraPulseAt: number = 0;
  private currentPowerTier: 1 | 2 | 3 = 1;
  private lastAppliedUpgradeLevel: number = 0;
  private nextGearResonanceCheckAt: number = 0;
  private gearResonanceSignature: string = '';
  private gearResonanceDamageMul: number = 1;
  private gearResonanceFireRateMul: number = 1;
  private gearResonanceSpeedMul: number = 1;
  private gearResonanceProjectileBonus: number = 0;
  private gearResonanceLootMul: number = 1;
  private playerUpgrades: {
    fireRateBonus: number;
    damageBonus: number;
    healthRegen: number;
    moveSpeedBonus: number;
    companionDamage: number;
    turretFireRate: number;
  } = {
    fireRateBonus: 0,
    damageBonus: 0,
    healthRegen: 0,
    moveSpeedBonus: 0,
    companionDamage: 0,
    turretFireRate: 0,
  };
  private mobileViewport: boolean = false;
  private lowPerfMode: boolean = false;
  private ultraLowPerfMode: boolean = false;
  private nextCompanionRosterSyncAt: number = 0;
  private nextExplorationUiUpdateAt: number = 0;
  private nextResidentAssistUpdateAt: number = 0;
  private nextLightingUpdateAt: number = 0;
  private activeDamageNumberCount: number = 0;
  private frameCounter: number = 0;
  private playerFacingDir: HeroV2Direction = 's';
  private playerActionLockUntil: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(ua) && !/Windows|Macintosh|Linux x86/i.test(ua);
    if (isMobileDevice) return true;
    return window.innerWidth <= 768;
  }

  private isMobilePortraitViewport(): boolean {
    return this.mobileViewport && this.scale.height > this.scale.width;
  }

  private resolvePerformanceTier(): { low: boolean; ultra: boolean } {
    if (!this.mobileViewport || typeof navigator === 'undefined') {
      return { low: false, ultra: false };
    }
    const threads = navigator.hardwareConcurrency || 8;
    const memory = Number((navigator as any).deviceMemory || 0);
    const low = threads <= 6 || (memory > 0 && memory <= 4);
    const ultra = threads <= 4 || (memory > 0 && memory <= 2);
    return { low, ultra };
  }

  private getPlayerVisualScale(): number {
    return this.isMobilePortraitViewport() ? 3 : 2;
  }

  private getNpcVisualScale(): number {
    return this.isMobilePortraitViewport() ? 3 : 2;
  }

  private getResidentVisualScale(): number {
    return this.isMobilePortraitViewport() ? 3 : 2;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private getWorldMarkerFontBoost(): number {
    const gameW = this.cameras.main.width || 1;
    const scaleDisplayW = this.scale.displaySize.width || gameW;
    const canvasDisplayW = this.game.canvas?.getBoundingClientRect().width || scaleDisplayW;
    const displayW = Math.max(1, Math.min(scaleDisplayW, canvasDisplayW));
    let boost = gameW / displayW;
    const portrait = this.scale.height > this.scale.width;
    if (this.mobileViewport && portrait) boost = Math.max(boost, 1.45);
    return Phaser.Math.Clamp(boost, 1, 1.95);
  }

  private worldFs(base: number, min: number): string {
    const px = Math.max(min, Math.round(base * this.getWorldMarkerFontBoost()));
    return `${px}px`;
  }

  init(): void {
    events.off(GameEvents.GAME_OVER, this.gameOver, this);
    events.off(GameEvents.PLAYER_HIT);
    events.off(GameEvents.PLAYER_HEAL_REQUEST);
  }

  create(): void {
    // Ensure physics is running (may have been paused on previous death)
    this.physics.resume();
    (this as any)._lastToggleBaseAt = 0;
    (this as any)._lastToggleLeisureAt = 0;

    const mobileViewport = this.isMobileViewport();
    const mobilePortrait = mobileViewport && this.scale.height > this.scale.width;
    this.mobileViewport = mobileViewport;
    const perfTier = this.resolvePerformanceTier();
    this.lowPerfMode = perfTier.low;
    this.ultraLowPerfMode = perfTier.ultra;

    // Reset state
    gameState.resetRun();
    this.permanentTalentBonuses = gameState.getPermanentTalentBonuses();
    this.dayChallengeMasteryBonuses = gameState.getDayChallengeMasteryBonuses();
    this.dayOpsRenownBonuses = gameState.getDayOpsRenownBonuses();
    this.activeRunMutators = [];
    this.runMutatorEffects = { ...DEFAULT_RUN_MUTATOR_EFFECTS };
    this.runEventOpen = false;
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;
    this.runEventRecentHistory = [];
    this.runEventRecentLorePieces = [];
    this.runEventActiveLoreSnippet = null;
    this.runEventMissStreak = { day: 0, night: 0 };
    this.runEventLastTriggerDay = { day: -99, night: -99 };
    this.runEventLastAnyTriggerDay = -99;
    this.runEventLastAnyTriggerPeriod = null;
    this.runEventGlobalCooldownUntilDay = 1;
    this.runEventCurrentChapter = 1;
    this.runEventFactionStanding = {
      survivorUnion: 0,
      tradeRing: 0,
      citadelAI: 0,
      labRemnant: 0,
      mutantSwarm: 0,
    };
    this.lootLegendQueue = [];
    this.lootLegendActiveResourceId = null;
    this.lootLegendAutoCloseTimer?.remove(false);
    this.lootLegendAutoCloseTimer = null;
    this.lootLegendContainer?.destroy();
    this.lootLegendContainer = null;
    this.lootCodexCollected = {};
    this.pendingDayRunEventAfterChallenge = false;
    this.dayChallengeSelectionOpen = false;
    this.dayChallengeSelectionContainer?.destroy();
    this.dayChallengeSelectionContainer = null;
    this.dayChallengePendingChoices = [];
    this.dayChallengeBranchSelected = null;
    this.dayChallengeDayRewardMul = 1;
    this.dayChallengeDayDangerMul = 1;
    this.dayChallengeDayXpMul = 1;
    this.dayChallengeBranchRecentActions = { stable: [], adventure: [], extreme: [] };
    this.dayOpsContracts = [];
    this.dayOpsNightPrepStacks = 0;
    this.nightDirectiveSelectionOpen = false;
    this.nightDirectiveSelectionContainer?.destroy();
    this.nightDirectiveSelectionContainer = null;
    this.nightDirectiveAutoPickTimer?.remove(false);
    this.nightDirectiveAutoPickTimer = null;
    this.nightDirectiveId = null;
    this.nightDirectiveEffects = {
      playerDamageMul: 1,
      companionDamageMul: 1,
      turretDamageMul: 1,
      residentDamageMul: 1,
      lootMul: 1,
      xpMul: 1,
      enemyPressureMul: 1,
    };
    this.nightDirectivePressureNextAt = 0;
    this.daySpotMiniGameOpen = false;
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = null;
    this.daySpotMiniGameSpot = null;
    this.daySpotMiniGameRisk = 'safe';
    this.daySpotMiniGameMode = 'fish';
    this.daySpotMiniGameCursor = 0.5;
    this.daySpotMiniGameCursorDir = 1;
    this.daySpotMiniGameTargetCenter = 0.5;
    this.daySpotMiniGameTargetDir = 1;
    this.daySpotMiniGameTargetWidth = 0.24;
    this.daySpotMiniGamePerfectRatio = 0.4;
    this.daySpotMiniGameTrapCenter = -1;
    this.daySpotMiniGameTrapWidth = 0;
    this.daySpotMiniGameProfile = null;
    this.daySpotMiniGameCursorVisual = null;
    this.daySpotMiniGameTargetVisual = null;
    this.daySpotMiniGamePerfectVisual = null;
    this.daySpotMiniGameTrapVisual = null;
    this.daySpotMiniGameTrapIcon = null;
    this.daySpotMiniGameTrapIcon = null;
    this.daySpotMiniGameRoundText = null;
    this.daySpotMiniGameStageText = null;
    this.daySpotMiniGameActionLabel = null;
    this.daySpotMiniGameRound = 1;
    this.daySpotMiniGameRoundsTotal = 1;
    this.daySpotMiniGameScore = 0;
    this.daySpotMiniGameTrapHits = 0;
    this.caveRaidMiniGameActive = false;
    this.caveRaidResultResolved = false;
    this.caveRaidArena = null;
    this.caveRaidGroundY = 0;
    this.caveRaidSurfaces = [];
    this.caveRaidPlayerSprite = null;
    this.caveRaidPlayerIcon = null;
    this.caveRaidPlayerIcon = null;
    this.caveRaidPlayerVy = 0;
    this.caveRaidPlayerHpMax = 100;
    this.caveRaidPlayerHp = 100;
    this.caveRaidPlayerSpeed = 0.26;
    this.caveRaidPlayerJumpForce = 0.46;
    this.caveRaidPlayerGrounded = true;
    this.caveRaidPlayerJumpCooldownUntil = 0;
    this.caveRaidPlayerAttackCooldownUntil = 0;
    this.caveRaidPlayerInvulUntil = 0;
    this.caveRaidElapsedMs = 0;
    this.caveRaidDurationMs = 36000;
    this.caveRaidStage = 1;
    this.caveRaidStageProgress = 0;
    this.caveRaidStageObjective = 4;
    this.caveRaidKills = 0;
    this.caveRaidBossSpawned = false;
    this.caveRaidBossKilled = false;
    this.caveRaidBossSprite = null;
    this.caveRaidBossNextSkillAt = 0;
    this.caveRaidNextSpawnAt = 0;
    this.caveRaidNextTrapAt = 0;
    this.caveRaidEnemyHpMul = 1;
    this.caveRaidEnemySpeedMul = 1;
    this.caveRaidEnemySpawnIntervalMs = 2100;
    this.caveRaidMobileMoveX = 0;
    this.caveRaidMobileMoveY = 0;
    this.caveRaidStatusText = null;
    this.caveRaidHpText = null;
    this.caveRaidTimerText = null;
    this.caveRaidEnemies = [];
    this.caveRaidProjectiles = [];
    this.caveRaidTraps = [];
    this.forestHuntMiniGameActive = false;
    this.forestHuntResultResolved = false;
    this.forestHuntArena = null;
    this.forestHuntGroundY = 0;
    this.forestHuntPlayerSprite = null;
    this.forestHuntPreySprite = null;
    this.forestHuntPlayerIcon = null;
    this.forestHuntPreyIcon = null;
    this.forestHuntHintIcon = null;
    this.forestHuntSightVisual = null;
    this.forestHuntClue = null;
    this.forestHuntStatusText = null;
    this.forestHuntPhaseText = null;
    this.forestHuntAlertText = null;
    this.forestHuntActionHintText = null;
    this.forestHuntPhase = 'stealth';
    this.forestHuntPhaseElapsedMs = 0;
    this.forestHuntStealthDurationMs = 5200;
    this.forestHuntBurstDurationMs = 2400;
    this.forestHuntRoundStealthSuccess = false;
    this.forestHuntAlertMeter = 0;
    this.forestHuntDetections = 0;
    this.forestHuntBreathCooldownUntil = 0;
    this.forestHuntPlayerSpeed = 0.24;
    this.forestHuntPreyVx = 0.082;
    this.forestHuntPreyFacing = 1;
    this.forestHuntMobileMoveX = 0;
    this.forestHuntBurstCursor = 0.5;
    this.forestHuntBurstCursorDir = 1;
    this.forestHuntBurstCursorSpeed = 0.00106;
    this.forestHuntBurstTargetCenter = 0.5;
    this.forestHuntBurstTargetDir = 1;
    this.forestHuntBurstTargetSpeed = 0.00052;
    this.forestHuntBurstTargetWidth = 0.22;
    this.forestHuntBurstPerfectRatio = 0.42;
    this.cityScavengeMiniGameActive = false;
    this.cityScavengeResultResolved = false;
    this.cityScavengeArena = null;
    this.cityScavengePlayerSprite = null;
    this.cityScavengeExtractZone = null;
    this.cityScavengeStatusText = null;
    this.cityScavengeTimerText = null;
    this.cityScavengeCarryText = null;
    this.cityScavengeActionHintText = null;
    this.cityScavengeRouteText = null;
    this.cityScavengeRoute = 'alley';
    this.cityScavengeRouteSelected = false;
    this.cityScavengeElapsedMs = 0;
    this.cityScavengeTimeLimitMs = 15000;
    this.cityScavengeCarryWeight = 0;
    this.cityScavengeCarryCap = 20;
    this.cityScavengeLootScore = 0;
    this.cityScavengeScoreTarget = 24;
    this.cityScavengePlayerBaseSpeed = 0.27;
    this.cityScavengeMoveX = 0;
    this.cityScavengeMoveY = 0;
    this.cityScavengeTrapCooldownUntil = 0;
    this.cityScavengeLanes = [];
    this.cityScavengeLootNodes.forEach((node) => {
      node.sprite.destroy();
      node.pulse.destroy();
      node.label.destroy();
    });
    this.cityScavengeLootNodes = [];
    this.cityScavengePatrols.forEach((patrol) => patrol.sprite.destroy());
    this.cityScavengePatrols = [];
    this.cityScavengeRouteRewardMul = 1;
    this.cityScavengeRouteDangerMul = 1;
    this.cityScavengeExtracted = false;
    this.pendingNightWaveStartAfterEvent = false;
    this.rollRunMutators();
    this.isGameOver = false;
    this.isBuildMode = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.battleMomentum = 0;
    this.battleMomentumBoostUntil = 0;
    this.battleMomentumPulseAt = 0;
    this.interactables = [];
    this.facilityInteractables = [];
    this.explorationSpots = [];
    this.clearExplorationEdgeIndicators();
    this.pendingExplorationSpot = null;
    this.pendingFacility = null;
    this.pendingResidentAssist = null;
    this.currentFacility = null;
    this.facilityLockPosition = null;
    this.facilityTransitioning = false;
    this.facilityTransitionStartedAt = 0;
    this.facilityTransitionFallback?.remove(false);
    this.facilityTransitionFallback = null;
    this.weaponTimers.clear();
    this.vsWeaponPatternCounter.clear();
    this.turretIdSeed = 0;
    this.isCraftingPanelOpen = false;
    this.bulletTrailTick = 0;
    this.resetWeaponMasteryProgress();
    this.arOverdriveCharge = 0;
    this.arOverdriveActiveUntil = 0;
    this.arOverdrivePulseAt = 0;
    this.levelSurgeUntil = 0;
    this.levelSurgePulseAt = 0;
    this.protocolAuraContainer?.destroy();
    this.protocolAuraContainer = null;
    this.protocolAuraInner = null;
    this.protocolAuraOuter = null;
    this.protocolAuraNodes = [];
    this.protocolAuraColor = 0x22d3ee;
    this.protocolAuraLevel = 0;
    this.protocolAuraBoostUntil = 0;
    this.protocolAuraPulseAt = 0;
    this.nextGearResonanceCheckAt = 0;
    this.gearResonanceSignature = '';
    this.gearResonanceDamageMul = 1;
    this.gearResonanceFireRateMul = 1;
    this.gearResonanceSpeedMul = 1;
    this.gearResonanceProjectileBonus = 0;
    this.gearResonanceLootMul = 1;
    this.currentPowerTier = 1;
    this.lastAppliedUpgradeLevel = 0;
    this.playerUpgrades.fireRateBonus = 0;
    this.playerUpgrades.damageBonus = 0;
    this.playerUpgrades.healthRegen = 0;
    this.playerUpgrades.moveSpeedBonus = 0;
    this.playerUpgrades.companionDamage = 0;
    this.playerUpgrades.turretFireRate = 0;
    this.nextCompanionRosterSyncAt = 0;
    this.nextExplorationUiUpdateAt = 0;
    this.nextResidentAssistUpdateAt = 0;
    this.nextLightingUpdateAt = 0;
    this.activeDamageNumberCount = 0;
    this.frameCounter = 0;
    this.playerFacingDir = 's';
    this.playerActionLockUntil = 0;
    if (this.baseLifePulseTimer) {
      this.baseLifePulseTimer.remove(false);
      this.baseLifePulseTimer = null;
    }
    if (this.baseRoutineTimer) {
      this.baseRoutineTimer.remove(false);
      this.baseRoutineTimer = null;
    }
    if (this.dayResidentEconomyTimer) {
      this.dayResidentEconomyTimer.remove(false);
      this.dayResidentEconomyTimer = null;
    }
    if (this.dayLifePulseTimer) {
      this.dayLifePulseTimer.remove(false);
      this.dayLifePulseTimer = null;
    }
    this.facilityOccupants.clear();
    this.residentDayYieldNextAt.clear();
    this.residentDefenseNextFireAt.clear();
    this.residentNightAnchorIndex.clear();
    this.clearConstructionSiteVisuals();
    this.constructionAssignedResidents.clear();
    this.nextAutoBuildPlanAt = 0;
    this.nextAutoBuildCrewSyncAt = 0;
    this.nextAutoDutyDispatchSyncAt = 0;
    this.nextAutoDutyDispatchTipAt = 0;
    this.nextConstructionSummaryAt = 0;
    this.nextScavengerCollectorSyncAt = 0;
    this.residentRecentChatter.clear();
    this.companionCombatRecentChatter.clear();
    this.companionCombatNextAt.clear();
    this.dayActivityUsage.clear();
    this.daySpotBonuses.clear();
    this.dayExplorationChallenge = null;
    this.dayChallengeHintCooldownUntil = 0;
    this.scavengeDurabilityStacks = 0;
    this.scavengeDurabilityPenaltyUntil = 0;
    this.scavengeDurabilityPenaltyStartAt = 0;
    this.scavengeDurabilityPenaltyDurationMs = 0;
    this.explorationStatusNextAt = 0;
    this.resourceToastSeed = 0;
    this.resourceToastBaseX = 0;
    this.resourceToastBaseY = 0;
    this.clearResourceFloatingToasts();
    this.dayAdventureChain = 0;
    this.dayAdventureLastAt = 0;
    this.clearResidentAssistTask();

    // World
    this.physics.world.setBounds(0, 0, 2000, 1500);
    this.cameras.main.setBounds(0, 0, 2000, 1500);

    // Background & map
    this.createBackground();
    this.createExplorationWorld();

    // Lighting
    this.createLighting();

    // Bullet texture
    if (!this.textures.exists('bullet')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff);
      g.fillCircle(4, 4, 4);
      g.generateTexture('bullet', 8, 8);
    }

    // Player
    const hasCustomHero = hasCustomHeroDirectionalTextures(this);
    const playerTexture = hasCustomHero
      ? customHeroTextureKey('s')
      : (this.textures.exists(HERO_V2_TEXTURE_KEY) ? HERO_V2_TEXTURE_KEY : 'player');
    this.player = this.physics.add.sprite(1000, 750, playerTexture);
    if (playerTexture === HERO_V2_TEXTURE_KEY) {
      this.player.setFrame(getHeroFrameIndex('s', 'walk', 0));
    } else if (hasCustomHero) {
      this.player.setData('customFacingDir', 's');
    }
    const playerScale = this.getPlayerVisualScale();
    this.player.setScale(playerScale);
    this.player.setData('baseScaleX', playerScale);
    this.player.setData('baseScaleY', playerScale);
    this.player.setCollideWorldBounds(true);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setSize(16, 22);
    playerBody.setOffset(8, 10);
    playerBody.setMaxVelocity(200);
    this.cameras.main.startFollow(this.player);
    // Keep camera zoom integer to preserve crisp pixel edges on all displays.
    this.cameras.main.setZoom(1);

    // Physics groups
    this.enemies = this.physics.add.group();
    const bulletPoolSize = this.ultraLowPerfMode
      ? (mobilePortrait ? 300 : 400)
      : this.lowPerfMode
        ? (mobilePortrait ? 400 : 500)
        : mobileViewport ? (mobilePortrait ? 500 : 600) : 800;
    const vsBulletPoolSize = this.ultraLowPerfMode
      ? (mobilePortrait ? 500 : 600)
      : this.lowPerfMode
        ? (mobilePortrait ? 600 : 700)
        : mobileViewport ? (mobilePortrait ? 800 : 900) : 1200;
    const companionBulletPoolSize = this.ultraLowPerfMode
      ? 100
      : this.lowPerfMode
        ? (mobilePortrait ? 120 : 160)
        : mobileViewport ? (mobilePortrait ? 160 : 200) : 300;
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: bulletPoolSize, defaultKey: 'bullet' });
    this.vsBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: vsBulletPoolSize, defaultKey: 'bullet' });
    this.companionBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: companionBulletPoolSize, defaultKey: 'bullet' });
    this.companions = this.physics.add.group();
    this.survivors = this.physics.add.group();
    this.walls = this.physics.add.group({ immovable: true, allowGravity: false });
    this.turrets = this.physics.add.group({ immovable: true, allowGravity: false });
    this.turretBullets = this.physics.add.group();

    // Village & base
    this.createVillageScenery();
    BaseSystem.refreshBaseState();
    this.syncBaseResidents();
    this.baseLifePulseTimer = this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => this.emitBaseLifePulse(),
    });
    this.residentSocialPulseTimer = this.time.addEvent({
      delay: 5200,
      loop: true,
      callback: () => this.maybeEmitResidentSocialMoment(),
    });
    this.dayResidentEconomyTimer = this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => this.updateDayResidentEconomy(),
    });
    this.dayLifePulseTimer = this.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => this.maybeEmitDayLifeAtmosphere(),
    });

    // Initialize systems
    this.weatherSystem = new WeatherSystem(this, {
      lowPerfMode: this.lowPerfMode,
      ultraLowPerfMode: this.ultraLowPerfMode,
    });
    this.weatherSystem.enable();
    this.animationSystem = new AnimationSystem(this);
    this.weaponSystem = new WeaponSystem(this, this.bullets, [this.walls, this.turrets], []);
    this.companionSystem = new CompanionSystem(this, this.companions, this.player);
    this.enemySystem = new EnemySystem(this, this.enemies, this.player);
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.playerSystem = new PlayerSystem(this, this.player, this.cursors, this.playerUpgrades);
    this.applyDynamicPlayerUpgradeBonuses(false);

    this.dayCycleSystem = new DayCycleSystem(this);
    this.dayCycleSystem.start();

    this.waveSystem = new WaveSystem(this, this.enemies, this.player);
    this.lootSystem = new LootSystem(this, this.player);

    // Event listeners
    events.on(GameEvents.GAME_OVER, this.gameOver, this);
    events.on(GameEvents.PLAYER_HIT, this.onPlayerHitAnimation, this);
    events.on(GameEvents.NIGHT_START, this.onNightStart, this);
    events.on(GameEvents.DAY_START, this.onDayStart, this);
    events.on(GameEvents.PLAYER_LEVEL_UP, this.onLevelUp, this);
    events.on('levelup-choice-made', this.onLevelUpChoice, this);
    events.on('quest-completed', this.onQuestCompleted, this);
    events.on(GameEvents.LOOT_COLLECTED, this.onLootCollected, this);
    events.on('companion-status-changed', this.onCompanionStatusChanged, this);
    events.on('companion-bulk-status-changed', this.onCompanionBulkStatusChanged, this);
    events.on('companion-job-changed', this.onCompanionJobChanged, this);
    events.on('base-autobuild-updated', this.onAutoBuildConfigUpdated, this);
    events.on('select-build-item', this.onBuildSelection, this);
    events.on('crafting-panel-state', this.onCraftingPanelState, this);
    events.on('mobile-move', this.onMobileMove, this);
    events.on('mobile-interact', this.onMobileInteract, this);
    events.on('mobile-toggle-build', this.onMobileToggleBuild, this);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Collisions
    this.setupCollisions();

    // Input
    this.setupInput();

    // Launch UI
    this.scene.launch('UIScene');

    // Create HUD elements in game scene
    this.createHUD();
    this.createOrRefreshDayExplorationChallenge(true);
    this.createOrRefreshDayOpsContracts(true);
    this.updateGearResonanceState(true);
    this.showRunMutatorBriefing();

    // Sync companion presence with state
    this.syncCompanionPresence();

    // Initial sync
    events.emit('update-resources', gameState.data.resources);
    events.emit(GameEvents.WEAPON_CHANGED, { weapon: 'ar_basic', config: this.weaponSystem.getCurrentWeapon() });

    this.exposeGameTextState();
  }

  private exposeGameTextState(): void {
    (window as any).__in_game = true;
    (window as any).__force_bloodmoon_test = () => {
      gameState.data.currentDay = 7;
      gameState.data.currentWeek = Math.ceil(gameState.data.currentDay / 7);
      gameState.data.timeOfDay = 82;
      gameState.data.isNight = true;
      gameState.data.isBloodMoon = true;
      this.onNightStart();
      return 'ok';
    };
    (window as any).__debug_seed_base_companions = (count: number = 6) => {
      const safeCount = Phaser.Math.Clamp(Math.floor(count || 0), 1, 24);
      const names = ['王大力', '李静远', '张伟', '刘芳', '陈锐', '周慧心', '赵铁柱', '林小雅'];
      const roles: Array<'tank' | 'sniper' | 'medic'> = ['tank', 'sniper', 'medic'];
      const jobs: Array<'farm' | 'kitchen' | 'workshop' | 'power' | 'medical'> = ['farm', 'kitchen', 'workshop', 'power', 'medical'];
      for (let i = 0; i < safeCount; i += 1) {
        const role = roles[i % roles.length];
        const id = `dbg_base_${Date.now()}_${i}`;
        gameState.data.companions.push({
          id,
          name: `${names[i % names.length]}(${role === 'tank' ? '前锋' : role === 'sniper' ? '狙击' : '医疗'})`,
          role,
          level: Phaser.Math.Between(1, 18),
          bulletEffect: role === 'tank' ? 'explosive' : role === 'sniper' ? 'piercing' : 'homing',
          status: 'base',
          job: jobs[i % jobs.length],
          promotionTier: 0,
        });
        const added = gameState.data.companions[gameState.data.companions.length - 1];
        if (added) CompanionPersonalitySystem.ensureProfile(added);
      }
      BaseSystem.refreshBaseState();
      this.syncBaseResidents();
      this.syncCompanionPresence();
      events.emit('update-resources', gameState.data.resources);
      return {
        companions: gameState.data.companions.length,
        base: gameState.data.companions.filter((c) => c.status === 'base').length,
        population: {
          used: BaseSystem.getPopulationUsage(),
          cap: BaseSystem.getPopulationCapacity(),
        },
      };
    };
    (window as any).__debug_trigger_run_event = (period: RunEventPeriod = 'day') => {
      if (this.runEventOpen) return { ok: false, reason: 'already_open' };
      const picked = this.pickRunEventDef(period);
      if (!picked) return { ok: false, reason: 'no_event_pool' };
      this.showRunEventPanel(picked);
      if (period === 'night') {
        this.pendingNightWaveStartAfterEvent = true;
      }
      return { ok: true, period, id: picked.id };
    };
    (window as any).__debug_show_loot_legend = (resourceId: string = 'scrap') => {
      this.enqueueLootLegend(resourceId);
      return {
        ok: true,
        resourceId,
        queued: [...this.lootLegendQueue],
        active: this.lootLegendActiveResourceId,
      };
    };
    (window as any).__debug_spawn_loot_preview = (clusters: number = 1) => {
      const safeClusters = Phaser.Math.Clamp(Math.floor(clusters || 1), 1, 6);
      const previewLootTable = [
        { type: 'resource', id: 'wood', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'metal', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'food', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'water', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'scrap', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'medical', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'ammo', chance: 1, min: 1, max: 1 },
        { type: 'resource', id: 'energyCore', chance: 1, min: 1, max: 1 },
      ] as any;
      for (let i = 0; i < safeClusters; i += 1) {
        const radius = 40 + i * 20;
        const angle = (Math.PI * 2 * i) / Math.max(1, safeClusters);
        const dropX = this.player.x + Math.cos(angle) * radius;
        const dropY = this.player.y + Math.sin(angle) * radius;
        this.lootSystem.spawnLoot(dropX, dropY, previewLootTable, 0, 1);
      }
      return { ok: true, clusters: safeClusters };
    };
    (window as any).__debug_open_cave_raid = () => {
      if (this.dayChallengeSelectionOpen) {
        const fallbackChoice = this.dayChallengePendingChoices[0];
        if (fallbackChoice) {
          this.selectDayExplorationChallenge(fallbackChoice);
        } else {
          this.closeDayChallengeSelectionPanel();
        }
      }
      if (this.daySpotMiniGameOpen) return { ok: false, reason: 'already_open' };
      const spot = this.explorationSpots.find((s) => s.actionType === 'cave_explore');
      if (!spot) return { ok: false, reason: 'no_cave_spot' };
      this.openDayExplorationMiniGame(spot);
      return { ok: true, spotId: spot.id };
    };
    (window as any).__debug_open_forest_hunt = () => {
      if (this.dayChallengeSelectionOpen) {
        const fallbackChoice = this.dayChallengePendingChoices.find((choice) => choice.actionType === 'hunt')
          || this.dayChallengePendingChoices[0];
        if (fallbackChoice) {
          this.selectDayExplorationChallenge(fallbackChoice);
        } else {
          this.closeDayChallengeSelectionPanel();
        }
      }
      if (this.daySpotMiniGameOpen) return { ok: false, reason: 'already_open' };
      const spot = this.explorationSpots.find((s) => s.actionType === 'hunt');
      if (!spot) return { ok: false, reason: 'no_forest_spot' };
      this.openDayExplorationMiniGame(spot);
      return { ok: true, spotId: spot.id };
    };
    (window as any).__debug_open_city_scavenge = () => {
      if (this.dayChallengeSelectionOpen) {
        const fallbackChoice = this.dayChallengePendingChoices.find((choice) => choice.actionType === 'scavenge')
          || this.dayChallengePendingChoices[0];
        if (fallbackChoice) {
          this.selectDayExplorationChallenge(fallbackChoice);
        } else {
          this.closeDayChallengeSelectionPanel();
        }
      }
      if (this.daySpotMiniGameOpen) return { ok: false, reason: 'already_open' };
      const spot = this.explorationSpots.find((s) => s.actionType === 'scavenge');
      if (!spot) return { ok: false, reason: 'no_city_spot' };
      this.openDayExplorationMiniGame(spot);
      return { ok: true, spotId: spot.id };
    };
    (window as any).__debug_select_day_challenge = (
      branch: DayChallengeBranch = 'stable',
      actionType?: ExplorationActionType
    ) => {
      if (!this.dayChallengeSelectionOpen) {
        return { ok: false, reason: 'selection_not_open' };
      }
      const picked = this.dayChallengePendingChoices.find((choice) => (
        choice.branch === branch && (!actionType || choice.actionType === actionType)
      )) || this.dayChallengePendingChoices[0];
      if (!picked) {
        this.closeDayChallengeSelectionPanel();
        return { ok: false, reason: 'no_choice' };
      }
      this.selectDayExplorationChallenge(picked);
      return {
        ok: true,
        branch: picked.branch,
        actionType: picked.actionType,
        targetQuality: picked.targetQuality,
      };
    };
    (window as any).render_game_to_text = () => {
      const p = this.player;
      const resources = gameState.data.resources;
      const wallChildren = (this.walls?.getChildren?.() ?? []) as Phaser.Physics.Arcade.Sprite[];
      const turretChildren = (this.turrets?.getChildren?.() ?? []) as Phaser.Physics.Arcade.Sprite[];
      const activeWalls = wallChildren.filter(w => w.active);
      const activeTurrets = turretChildren.filter(t => t.active);
      const minWallHealth = activeWalls.reduce((min, wall) => {
        const wd = wall as any;
        return Math.min(min, wd.health ?? 9999);
      }, 9999);
      const minTurretHealth = activeTurrets.reduce((min, turret) => {
        const td = turret as any;
        return Math.min(min, td.health ?? 9999);
      }, 9999);
      const bossCount = (this.enemies?.getChildren?.() ?? []).filter((enemy) => {
        const ed = enemy as any;
        return !!ed?.active && !!ed?.isBoss;
      }).length;
      const exploration = this.explorationSpots.map((spot) => ({
        id: spot.id,
        action: spot.actionType,
        active: this.getExplorationSpotResidentCount(spot.id),
        used: this.getActivityUsage(spot.actionType),
        limit: this.getActivityUsageLimit(spot.actionType),
      }));
      const nightDefenders = Array.from(this.baseResidents.values()).filter((container) => {
        if (!container.active) return false;
        const mode = (container.getData('residentMode') || 'idle') as ResidentMode;
        const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
        return mode === 'idle' && behavior === 'guard';
      }).length;
      const payload = {
        scene: 'game',
        day: gameState.data.currentDay,
        week: gameState.data.currentWeek,
        isNight: gameState.data.isNight,
        wave: gameState.data.currentWave,
        hp: this.playerSystem?.getHealth?.() ?? null,
        player: p ? {
          x: Math.round(p.x),
          y: Math.round(p.y),
          zone: this.getWorldZoneAt(p.x, p.y),
          texture: p.texture?.key || null,
          customFacingDir: (p.getData('customFacingDir') as string | undefined) || null,
        } : null,
        enemies: this.enemies?.countActive?.(true) ?? 0,
        bosses: bossCount,
        bullets: (this.bullets?.countActive?.(true) ?? 0) + (this.vsBullets?.countActive?.(true) ?? 0),
        resources: {
          wood: resources.wood,
          metal: resources.metal,
          scrap: resources.scrap,
          food: resources.food,
          bitcoin: Number(resources.bitcoin.toFixed(2)),
        },
        build: {
          isBuildMode: this.isBuildMode,
          panelOpen: this.isCraftingPanelOpen,
          selectedBuildingId: this.selectedBuildingId,
          selectedCategory: this.isBuildMode ? 'building' : null,
        },
        dayChallenge: this.dayExplorationChallenge
          ? {
            branch: this.dayExplorationChallenge.branch,
            branchNameCN: this.dayExplorationChallenge.branchNameCN,
            progress: this.dayExplorationChallenge.progress,
            required: this.dayExplorationChallenge.required,
            completed: this.dayExplorationChallenge.completed,
          }
          : null,
        dayChallengeSelectionOpen: this.dayChallengeSelectionOpen,
        dayChallengeBranchSelected: this.dayChallengeBranchSelected,
        dayChallengeChoices: this.dayChallengePendingChoices.map((choice) => ({
          branch: choice.branch,
          title: choice.title,
          actionType: choice.actionType,
          targetQuality: choice.targetQuality,
        })),
        dayMiniGame: {
          open: this.daySpotMiniGameOpen,
          mode: this.daySpotMiniGameMode,
          caveActive: this.caveRaidMiniGameActive,
          caveHp: Math.max(0, Math.round(this.caveRaidPlayerHp)),
          caveStage: this.caveRaidStage,
          caveStageProgress: this.caveRaidStageProgress,
          caveStageObjective: this.caveRaidStageObjective,
          caveKills: this.caveRaidKills,
          caveTrapHits: this.daySpotMiniGameTrapHits,
          caveBossSpawned: this.caveRaidBossSpawned,
          caveBossKilled: this.caveRaidBossKilled,
          forestActive: this.forestHuntMiniGameActive,
          forestPhase: this.forestHuntPhase,
          forestAlert: Math.round(this.forestHuntAlertMeter),
          forestDetections: this.forestHuntDetections,
          cityActive: this.cityScavengeMiniGameActive,
          cityRoute: this.cityScavengeRoute,
          cityRouteSelected: this.cityScavengeRouteSelected,
          cityCarry: this.cityScavengeCarryWeight,
          cityCarryCap: this.cityScavengeCarryCap,
          cityScore: this.cityScavengeLootScore,
          cityScoreTarget: this.cityScavengeScoreTarget,
          cityTimer: Math.max(0, Math.ceil((this.cityScavengeTimeLimitMs - this.cityScavengeElapsedMs) / 1000)),
          cityAlarms: this.daySpotMiniGameTrapHits,
          cityExtracted: this.cityScavengeExtracted,
        },
        population: {
          used: BaseSystem.getPopulationUsage(),
          cap: BaseSystem.getPopulationCapacity(),
        },
        baseDiagnostics: {
          upkeepNodes: gameState.data.base.diagnosticUpkeepNodes || 0,
          inputNodes: gameState.data.base.diagnosticInputNodes || 0,
          powerNodes: gameState.data.base.diagnosticPowerNodes || 0,
          total: (gameState.data.base.nodeDiagnostics || []).length,
        },
        companions: {
          party: gameState.data.companions.filter((c) => c.status === 'party').length,
          base: gameState.data.companions.filter((c) => c.status === 'base').length,
          nightDefenders,
        },
        mutators: this.activeRunMutators.map((m) => ({ id: m.id, nameCN: m.nameCN })),
        mutatorEffects: {
          enemyToughnessMul: Number(this.runMutatorEffects.enemyToughnessMul.toFixed(3)),
          dayActivityGainMul: Number(this.runMutatorEffects.dayActivityGainMul.toFixed(3)),
          lootGainMul: Number(this.runMutatorEffects.lootGainMul.toFixed(3)),
          dayFoodConsumptionMul: Number(this.runMutatorEffects.dayFoodConsumptionMul.toFixed(3)),
          incomingDamageMul: Number(this.runMutatorEffects.incomingDamageMul.toFixed(3)),
        },
        dayOps: {
          prepStacks: this.dayOpsNightPrepStacks,
          prepCap: this.getDayOpsPrepStackCap(),
          renown: gameState.getDayOpsRenown(),
          contracts: this.dayOpsContracts.map((contract) => ({
            title: contract.title,
            actionType: contract.actionType,
            stage: contract.stage,
            progress: contract.progress,
            target: contract.target,
            completed: contract.completed,
          })),
        },
        nightDirective: {
          open: this.nightDirectiveSelectionOpen,
          id: this.nightDirectiveId,
          effects: this.nightDirectiveEffects,
        },
        battleMomentum: {
          gauge: Math.round(this.battleMomentum),
          active: this.isBattleMomentumActive(),
          remainMs: Math.max(0, Math.round(this.battleMomentumBoostUntil - this.time.now)),
        },
        permanentTalents: {
          levels: gameState.meta.permanentTalents,
          bonuses: this.permanentTalentBonuses,
        },
        arsenal: {
          stashCount: gameState.data.gearStash.length,
          equipped: gameState.data.equippedGearSlots,
          perks: gameState.data.bitcoinPerks,
        },
        runEvent: {
          open: this.runEventOpen,
          chapter: this.runEventCurrentChapter,
          chapterLabel: RUN_EVENT_CHAPTER_LABELS[this.runEventCurrentChapter] || '',
          factionStanding: { ...this.runEventFactionStanding },
          pendingNightWaveStart: this.pendingNightWaveStartAfterEvent,
        },
        exploration,
        structures: {
          walls: activeWalls.length,
          turrets: activeTurrets.length,
          minWallHealth: Number.isFinite(minWallHealth) ? Math.max(0, Math.round(minWallHealth)) : null,
          minTurretHealth: Number.isFinite(minTurretHealth) ? Math.max(0, Math.round(minTurretHealth)) : null,
        },
      };
      return JSON.stringify(payload);
    };
  }

  private rollRunMutators(): void {
    const pool = [...RUN_MUTATOR_DEFS];
    Phaser.Utils.Array.Shuffle(pool);
    this.activeRunMutators = pool.slice(0, 2);
    this.runMutatorEffects = { ...DEFAULT_RUN_MUTATOR_EFFECTS };
    this.activeRunMutators.forEach((mutator) => {
      const fx = mutator.effects;
      if (fx.playerDamageMul) this.runMutatorEffects.playerDamageMul *= fx.playerDamageMul;
      if (fx.incomingDamageMul) this.runMutatorEffects.incomingDamageMul *= fx.incomingDamageMul;
      if (fx.enemyToughnessMul) this.runMutatorEffects.enemyToughnessMul *= fx.enemyToughnessMul;
      if (fx.companionDamageMul) this.runMutatorEffects.companionDamageMul *= fx.companionDamageMul;
      if (fx.turretDamageMul) this.runMutatorEffects.turretDamageMul *= fx.turretDamageMul;
      if (fx.nightResidentDamageMul) this.runMutatorEffects.nightResidentDamageMul *= fx.nightResidentDamageMul;
      if (fx.lootGainMul) this.runMutatorEffects.lootGainMul *= fx.lootGainMul;
      if (fx.dayActivityGainMul) this.runMutatorEffects.dayActivityGainMul *= fx.dayActivityGainMul;
      if (fx.dayFoodConsumptionMul) this.runMutatorEffects.dayFoodConsumptionMul *= fx.dayFoodConsumptionMul;
      if (fx.xpMul) this.runMutatorEffects.xpMul *= fx.xpMul;
    });
    this.runMutatorEffects.companionDamageMul *= this.permanentTalentBonuses.companionDamageMul;
    this.runMutatorEffects.turretDamageMul *= this.permanentTalentBonuses.turretDamageMul;
    this.runMutatorEffects.lootGainMul *= this.permanentTalentBonuses.economyLootMul;
    this.runMutatorEffects.dayActivityGainMul *= this.permanentTalentBonuses.companionDayGainMul * this.permanentTalentBonuses.economyDayGainMul;
    this.runMutatorEffects.dayFoodConsumptionMul *= this.permanentTalentBonuses.economyFoodUseMul;
    this.dayChallengeMasteryBonuses = gameState.getDayChallengeMasteryBonuses();
    this.runMutatorEffects.playerDamageMul *= this.dayChallengeMasteryBonuses.extremeDamageMul;

    gameState.data.baseStats.xpMultiplier = Number(
      (gameState.data.baseStats.xpMultiplier * this.runMutatorEffects.xpMul).toFixed(3)
    );
  }

  private showRunMutatorBriefing(): void {
    if (this.activeRunMutators.length <= 0) return;
    const w = this.cameras.main.width;
    const title = this.activeRunMutators.map((m) => `【${m.nameCN}】`).join(' ');
    const desc = this.activeRunMutators.map((m) => m.descCN).join('  |  ');
    this.time.delayedCall(1100, () => {
      this.showFloatingText(w / 2, 58, `本局词缀 ${title}`, '#fbbf24', true);
      this.showFloatingText(w / 2, 84, desc, '#93c5fd', true);
    });
  }

  private getRunLootGainMultiplier(): number {
    const perkMul = gameState.getBitcoinPerkBonuses().lootGainMul || 1;
    const nightMul = gameState.data.isNight ? this.nightDirectiveEffects.lootMul : 1;
    return Phaser.Math.Clamp(this.runMutatorEffects.lootGainMul * perkMul * nightMul * this.gearResonanceLootMul, 0.45, 3.4);
  }

  private getRunDayActivityGainMultiplier(): number {
    const pacing = this.getRunPacingProfile();
    return Phaser.Math.Clamp(
      this.runMutatorEffects.dayActivityGainMul
      * this.dayChallengeDayRewardMul
      * pacing.dayRewardMul
      * this.dayOpsRenownBonuses.dayRewardMul,
      0.55,
      3.4
    );
  }

  private getDayChallengeDangerMultiplier(): number {
    return Phaser.Math.Clamp(this.dayChallengeDayDangerMul, 0.72, 1.8);
  }

  private getDayChallengeXpMultiplier(): number {
    return Phaser.Math.Clamp(this.dayChallengeDayXpMul, 0.8, 2.2);
  }

  private getRunFoodConsumptionMultiplier(): number {
    return Phaser.Math.Clamp(this.runMutatorEffects.dayFoodConsumptionMul, 0.6, 2.4);
  }

  private getRunEventRewardMultiplier(period: RunEventPeriod): number {
    const base = period === 'day'
      ? this.getRunDayActivityGainMultiplier()
      : this.getRunLootGainMultiplier();
    return Phaser.Math.Clamp(base, 0.6, 2.6);
  }

  private getRunEventRiskMultiplier(period: RunEventPeriod): number {
    const danger = this.runMutatorEffects.enemyToughnessMul * this.runMutatorEffects.incomingDamageMul;
    const phase = period === 'night' ? 1.12 : 1;
    return Phaser.Math.Clamp(danger * phase, 0.75, 2.8);
  }

  private getRunEventMeta(eventId: string): { chapter: 1 | 2 | 3 | 4; factions: RunEventFaction[] } {
    return RUN_EVENT_META_BY_ID[eventId] || { chapter: 1, factions: [] };
  }

  private getRunEventStoryChapter(): 1 | 2 | 3 | 4 {
    const day = Math.max(1, gameState.data.currentDay || 1);
    const unlockedPieces = this.getUnlockedRunEventLorePieceCount();
    const chapterByDay = day >= 10 ? 4 : day >= 7 ? 3 : day >= 4 ? 2 : 1;
    const chapterByLore = unlockedPieces >= 22 ? 4 : unlockedPieces >= 12 ? 3 : unlockedPieces >= 5 ? 2 : 1;
    const chapter = Math.max(chapterByDay, chapterByLore);
    return Phaser.Math.Clamp(chapter, 1, 4) as 1 | 2 | 3 | 4;
  }

  private getRunEventFactionDelta(choiceId: string): Partial<Record<RunEventFaction, number>> {
    return RUN_EVENT_CHOICE_FACTION_DELTA[choiceId] || {};
  }

  private applyRunEventFactionStanding(choiceId: string): string[] {
    const changes = this.getRunEventFactionDelta(choiceId);
    const notices: string[] = [];
    (Object.keys(changes) as RunEventFaction[]).forEach((faction) => {
      const delta = changes[faction];
      if (!delta) return;
      const next = Phaser.Math.Clamp((this.runEventFactionStanding[faction] || 0) + delta, -8, 8);
      this.runEventFactionStanding[faction] = next;
      const label = RUN_EVENT_FACTION_LABELS[faction] || faction;
      notices.push(`${label}${delta > 0 ? '+' : ''}${delta}`);
    });
    return notices;
  }

  private getRunEventFactionSummary(eventDef: RunEventDef): string {
    const factions = this.getRunEventMeta(eventDef.id).factions;
    if (factions.length <= 0) return '派系：未判定';
    const parts = factions.map((faction) => {
      const standing = this.runEventFactionStanding[faction] || 0;
      const sign = standing > 0 ? '+' : '';
      return `${RUN_EVENT_FACTION_LABELS[faction]} ${sign}${standing}`;
    });
    return `派系倾向：${parts.join('  ·  ')}`;
  }

  private getFactionHostility(faction: RunEventFaction): number {
    return Math.max(0, -(this.runEventFactionStanding[faction] || 0));
  }

  public getNightEnemyFactionWeights(): Record<string, number> {
    const allySurvivor = Math.max(0, this.runEventFactionStanding.survivorUnion || 0);
    const allyTrade = Math.max(0, this.runEventFactionStanding.tradeRing || 0);
    const hostileTrade = this.getFactionHostility('tradeRing');
    const hostileAI = this.getFactionHostility('citadelAI');
    const hostileLab = this.getFactionHostility('labRemnant');
    const hostileMutant = this.getFactionHostility('mutantSwarm');
    const pressureSuppression = Math.max(0.75, 1 - allySurvivor * 0.03);

    const applySuppression = (value: number): number => Phaser.Math.Clamp(value * pressureSuppression, 0.18, 2.8);
    return {
      controlled: Phaser.Math.Clamp(1 + allySurvivor * 0.06 - (hostileMutant + hostileAI) * 0.03, 0.35, 1.9),
      runner: applySuppression(1 + hostileMutant * 0.09 + hostileTrade * 0.02),
      heavy: applySuppression(1 + hostileMutant * 0.05 + hostileAI * 0.08 + hostileLab * 0.03),
      ranged: applySuppression(1 + hostileAI * 0.12 + hostileTrade * 0.04 - allyTrade * 0.02),
      exploder: applySuppression(1 + hostileMutant * 0.11 + hostileLab * 0.05),
      healer: applySuppression(1 + hostileLab * 0.11 + hostileAI * 0.04),
      stealth: applySuppression(1 + hostileTrade * 0.1 + hostileLab * 0.06 + hostileAI * 0.03),
      elite: applySuppression(1 + (hostileAI + hostileMutant + hostileLab + hostileTrade) * 0.035),
    };
  }

  public getMerchantFactionQuoteProfile(): { rateMul: number; glassesMul: number; summaryCN: string } {
    const trade = this.runEventFactionStanding.tradeRing || 0;
    const survivor = this.runEventFactionStanding.survivorUnion || 0;
    const aiHostility = this.getFactionHostility('citadelAI');
    const mutantHostility = this.getFactionHostility('mutantSwarm');
    const labHostility = this.getFactionHostility('labRemnant');
    const hostilePressure = (aiHostility + mutantHostility + labHostility) / 12;
    const rateMul = Phaser.Math.Clamp(1 + trade * 0.055 + survivor * 0.02 - hostilePressure * 0.08, 0.65, 1.45);
    const glassesMul = Phaser.Math.Clamp(1 - trade * 0.035 - survivor * 0.012 + hostilePressure * 0.14, 0.72, 1.35);
    const summaryCN = `派系议价: 商环${trade >= 0 ? '+' : ''}${trade} · 同盟${survivor >= 0 ? '+' : ''}${survivor} · 压力${hostilePressure.toFixed(2)}`;
    return {
      rateMul: Number(rateMul.toFixed(3)),
      glassesMul: Number(glassesMul.toFixed(3)),
      summaryCN,
    };
  }

  private getRunEventChapterProgressRatio(chapter: 1 | 2 | 3 | 4): number {
    const lore = this.getUnlockedRunEventLorePieceCount();
    const day = Math.max(1, gameState.data.currentDay || 1);
    const loreThresholds = [0, 5, 12, 22, this.getRunEventLorePieceTotalCount()];
    const dayThresholds = [1, 4, 7, 10, 14];
    const idx = Math.max(1, Math.min(4, chapter));
    const loreStart = loreThresholds[idx - 1];
    const loreEnd = loreThresholds[Math.min(4, idx)];
    const dayStart = dayThresholds[idx - 1];
    const dayEnd = dayThresholds[Math.min(4, idx)];
    const loreRatio = loreEnd > loreStart ? (lore - loreStart) / (loreEnd - loreStart) : 1;
    const dayRatio = dayEnd > dayStart ? (day - dayStart) / (dayEnd - dayStart) : 1;
    return Phaser.Math.Clamp(Math.max(loreRatio, dayRatio), 0, 1);
  }

  public getRunEventHudProgressSnapshot(): {
    chapter: 1 | 2 | 3 | 4;
    chapterLabel: string;
    chapterProgress: number;
    chainRatio: number;
    stageId: RunEventChainStageId;
    stageLabel: string;
    stageDesc: string;
    stageProgress: number;
    stageTarget: number;
  } {
    const chapter = this.getRunEventStoryChapter();
    const stageStates = RUN_EVENT_CHAIN_STAGES.map((stage) => {
      const done = stage.flags.reduce((sum, flag) => sum + (this.hasRunEventStoryFlag(flag) ? 1 : 0), 0);
      return {
        ...stage,
        progress: Math.min(stage.target, done),
      };
    });
    let stageIndex = stageStates.findIndex((stage) => stage.progress < stage.target);
    if (stageIndex < 0) stageIndex = stageStates.length - 1;
    const active = stageStates[Math.max(0, stageIndex)];
    const totalProgress = stageStates.reduce((sum, stage) => sum + stage.progress, 0);
    const totalTarget = stageStates.reduce((sum, stage) => sum + stage.target, 0);
    return {
      chapter,
      chapterLabel: RUN_EVENT_CHAPTER_LABELS[chapter] || `章节${chapter}`,
      chapterProgress: this.getRunEventChapterProgressRatio(chapter),
      chainRatio: totalTarget > 0 ? Phaser.Math.Clamp(totalProgress / totalTarget, 0, 1) : 0,
      stageId: active.id,
      stageLabel: active.labelCN,
      stageDesc: active.descCN,
      stageProgress: active.progress,
      stageTarget: active.target,
    };
  }

  public getLootCodexSnapshot(): {
    unlocked: number;
    total: number;
    entries: Array<{
      id: string;
      nameCN: string;
      iconKey: string;
      accentColor: number;
      accentText: string;
      usageCN: string;
      sourceCN: string;
      loreCN: string;
      discovered: boolean;
      collected: number;
    }>;
  } {
    const entries = LOOT_CODEX_ENTRIES.map((entry) => {
      const collected = Math.max(0, Math.floor(this.lootCodexCollected[entry.id] || 0));
      const discovered = collected > 0 || !!gameState.data.storyFlags[this.getLootLegendSeenFlagKey(entry.id)];
      return {
        ...entry,
        discovered,
        collected,
      };
    });
    const unlocked = entries.reduce((sum, entry) => sum + (entry.discovered ? 1 : 0), 0);
    return {
      unlocked,
      total: entries.length,
      entries,
    };
  }

  public focusCameraOnWorldPoint(x: number, y: number, holdMs: number = 900): void {
    const cam = this.cameras.main;
    const targetX = Phaser.Math.Clamp(x, cam.width * 0.5, 2000 - cam.width * 0.5);
    const targetY = Phaser.Math.Clamp(y, cam.height * 0.5, 1500 - cam.height * 0.5);
    cam.stopFollow();
    cam.pan(targetX, targetY, 320, 'Sine.easeOut', true);
    const ping = this.add.circle(x, y, 12, 0x22d3ee, 0.16).setDepth(180);
    this.tweens.add({
      targets: ping,
      scale: 2.4,
      alpha: 0,
      duration: 620,
      onComplete: () => ping.destroy(),
    });
    this.time.delayedCall(Math.max(320, holdMs), () => {
      if (!this.player?.active) return;
      cam.startFollow(this.player, true, 0.18, 0.18);
    });
  }

  private getRunEventStoryFlagKey(flag: string): string {
    return `run_event_flag_${flag}`;
  }

  private hasRunEventStoryFlag(flag: string): boolean {
    return !!gameState.data.storyFlags[this.getRunEventStoryFlagKey(flag)];
  }

  private unlockRunEventStoryFlags(flags?: string[]): void {
    if (!flags || flags.length <= 0) return;
    flags.forEach((flag) => {
      if (!flag) return;
      gameState.data.storyFlags[this.getRunEventStoryFlagKey(flag)] = true;
    });
  }

  private getRunEventSeenFlagKey(eventId: string): string {
    return `run_event_seen_${eventId}`;
  }

  private hasSeenRunEvent(eventId: string): boolean {
    return !!gameState.data.storyFlags[this.getRunEventSeenFlagKey(eventId)];
  }

  private markRunEventSeen(eventId: string): boolean {
    const key = this.getRunEventSeenFlagKey(eventId);
    if (gameState.data.storyFlags[key]) return false;
    gameState.data.storyFlags[key] = true;
    return true;
  }

  private getRunEventLoreFlagKey(loreKey: string): string {
    return `run_event_lore_${loreKey}`;
  }

  private hasUnlockedRunEventLore(loreKey: string): boolean {
    return !!gameState.data.storyFlags[this.getRunEventLoreFlagKey(loreKey)];
  }

  private unlockRunEventLore(eventDef: RunEventDef): boolean {
    const key = this.getRunEventLoreFlagKey(eventDef.loreKey || eventDef.id);
    if (gameState.data.storyFlags[key]) return false;
    gameState.data.storyFlags[key] = true;
    this.unlockRunEventStoryFlags([`arc_${eventDef.arc}`]);
    return true;
  }

  private getRunEventLorePieceFlagKey(arc: RunEventArc, pieceId: string): string {
    return `run_event_lore_piece_${arc}_${pieceId}`;
  }

  private hasUnlockedRunEventLorePiece(arc: RunEventArc, pieceId: string): boolean {
    return !!gameState.data.storyFlags[this.getRunEventLorePieceFlagKey(arc, pieceId)];
  }

  private unlockRunEventLorePiece(eventDef: RunEventDef, piece: RunEventLoreSnippet): boolean {
    if (!piece?.id) return false;
    const key = this.getRunEventLorePieceFlagKey(eventDef.arc, piece.id);
    if (gameState.data.storyFlags[key]) return false;
    gameState.data.storyFlags[key] = true;
    const rememberKey = `${eventDef.arc}:${piece.id}`;
    this.runEventRecentLorePieces.push(rememberKey);
    if (this.runEventRecentLorePieces.length > 24) {
      this.runEventRecentLorePieces.splice(0, this.runEventRecentLorePieces.length - 24);
    }
    return true;
  }

  private getUnlockedRunEventLorePieceCount(): number {
    let count = 0;
    (Object.keys(RUN_EVENT_LORE_SNIPPETS) as RunEventArc[]).forEach((arc) => {
      RUN_EVENT_LORE_SNIPPETS[arc].forEach((piece) => {
        if (this.hasUnlockedRunEventLorePiece(arc, piece.id)) count += 1;
      });
    });
    return count;
  }

  private getRunEventLorePieceTotalCount(): number {
    return (Object.keys(RUN_EVENT_LORE_SNIPPETS) as RunEventArc[])
      .reduce((sum, arc) => sum + RUN_EVENT_LORE_SNIPPETS[arc].length, 0);
  }

  private pickRunEventLoreSnippet(eventDef: RunEventDef): RunEventLoreSnippet | null {
    const pieces = RUN_EVENT_LORE_SNIPPETS[eventDef.arc] || [];
    if (pieces.length <= 0) return null;
    const recentSet = new Set(this.runEventRecentLorePieces.slice(-6));
    const unseen = pieces.filter((piece) => !this.hasUnlockedRunEventLorePiece(eventDef.arc, piece.id));
    let pool = unseen.length > 0 ? unseen : pieces;
    if (pool.length > 1) {
      const filtered = pool.filter((piece) => !recentSet.has(`${eventDef.arc}:${piece.id}`));
      if (filtered.length > 0) pool = filtered;
    }
    return Phaser.Utils.Array.GetRandom(pool);
  }

  private getUnlockedRunEventLoreCount(): number {
    return RUN_EVENT_DEFS.reduce((count, def) => (
      this.hasUnlockedRunEventLore(def.loreKey || def.id) ? count + 1 : count
    ), 0);
  }

  private getLatestRunEventDay(eventId: string): number {
    for (let i = this.runEventRecentHistory.length - 1; i >= 0; i -= 1) {
      const record = this.runEventRecentHistory[i];
      if (record.id === eventId) return record.day;
    }
    return -999;
  }

  private pickRunEventDef(period: RunEventPeriod): RunEventDef | null {
    const day = Math.max(1, gameState.data.currentDay || 1);
    const chapter = this.getRunEventStoryChapter();
    const recentIds = new Set(this.runEventRecentHistory.slice(-6).map((record) => record.id));
    const recentArcs = new Set(this.runEventRecentHistory.slice(-5).map((record) => record.arc));
    const recentFactions = new Set(
      this.runEventRecentHistory
        .slice(-4)
        .flatMap((record) => this.getRunEventMeta(record.id).factions)
    );
    const candidates: Array<{ def: RunEventDef; weight: number }> = [];

    for (const def of RUN_EVENT_DEFS) {
      if (def.period !== period) continue;
      if (def.minDay && day < def.minDay) continue;
      if (def.maxDay && day > def.maxDay) continue;
      const meta = this.getRunEventMeta(def.id);
      if (meta.chapter > chapter) continue;
      if (def.requiresFlags?.some((flag) => !this.hasRunEventStoryFlag(flag))) continue;

      const seen = this.hasSeenRunEvent(def.id);
      if (def.unique && seen) continue;

      const cooldown = Math.max(1, def.cooldownDays || 2);
      const latest = this.getLatestRunEventDay(def.id);
      if (day - latest < cooldown) continue;

      let weight = Math.max(0.05, def.weight || 1);
      if (seen) weight *= 0.28;
      if (recentIds.has(def.id)) weight *= 0.2;
      if (recentArcs.has(def.arc)) weight *= 0.58;
      if (meta.factions.length > 0) {
        const recentFactionOverlap = meta.factions.filter((faction) => recentFactions.has(faction)).length;
        if (recentFactionOverlap >= meta.factions.length) {
          weight *= 0.72;
        } else if (recentFactionOverlap === 0) {
          weight *= 1.18;
        }
        meta.factions.forEach((faction) => {
          const standing = this.runEventFactionStanding[faction] || 0;
          if (period === 'day') {
            // Day events倾向于给关系修复/经营回合。
            weight *= standing < -3 ? 1.22 : standing > 3 ? 0.88 : 1;
          } else {
            // Night events在敌对关系高时更容易触发冲突事件。
            weight *= standing < -2 ? 1.16 : standing > 4 ? 0.9 : 1;
          }
        });
      }
      if (!this.hasRunEventStoryFlag(`arc_${def.arc}`)) weight *= 1.28;
      if (!this.hasUnlockedRunEventLore(def.loreKey || def.id)) weight *= 1.18;
      candidates.push({ def, weight });
    }

    const pool = candidates.length > 0
      ? candidates
      : RUN_EVENT_DEFS
        .filter((def) => {
          if (def.period !== period) return false;
          if (def.minDay && day < def.minDay) return false;
          if (def.maxDay && day > def.maxDay) return false;
          const meta = this.getRunEventMeta(def.id);
          return meta.chapter <= Math.min(4, chapter + 1);
        })
        .map((def) => ({ def, weight: Math.max(0.1, def.weight || 1) }));

    if (pool.length <= 0) return null;
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.def;
    }
    return pool[pool.length - 1].def;
  }

  private maybeTriggerRunEvent(period: RunEventPeriod): boolean {
    if (this.isGameOver || this.runEventOpen || this.dayChallengeSelectionOpen) return false;
    const day = Math.max(1, gameState.data.currentDay || 1);
    this.runEventCurrentChapter = this.getRunEventStoryChapter();
    if (day === this.runEventLastAnyTriggerDay) return false;
    if (day < this.runEventGlobalCooldownUntilDay) return false;
    const daysSinceAnyTrigger = day - this.runEventLastAnyTriggerDay;
    const baseChance = period === 'night' ? 0.21 : 0.16;
    const chapterFactor = Math.min(0.08, (this.runEventCurrentChapter - 1) * 0.025);
    const mutatorFactor = Math.min(0.14, this.activeRunMutators.length * 0.03);
    const streakBonus = Math.min(0.24, this.runEventMissStreak[period] * 0.065);
    const dayGrowth = Math.min(0.12, Math.max(0, day - 4) * 0.012);
    const immediateRepeatPenalty = day - this.runEventLastTriggerDay[period] <= 1 ? 0.18 : 0;
    const globalRecentPenalty = daysSinceAnyTrigger <= 1 ? 0.24 : daysSinceAnyTrigger <= 2 ? 0.12 : 0;
    const samePeriodPenalty = this.runEventLastAnyTriggerPeriod === period && daysSinceAnyTrigger <= 3 ? 0.12 : 0;
    const dryDayBonus = daysSinceAnyTrigger >= 3 ? Math.min(0.16, (daysSinceAnyTrigger - 2) * 0.04) : 0;
    const jitter = Phaser.Math.FloatBetween(-0.08, 0.08);
    const triggerChance = Phaser.Math.Clamp(
      baseChance
      + chapterFactor
      + mutatorFactor
      + streakBonus
      + dayGrowth
      + dryDayBonus
      - immediateRepeatPenalty
      - globalRecentPenalty
      - samePeriodPenalty
      + jitter,
      0.05,
      0.72
    );

    if (Math.random() > triggerChance) {
      this.runEventMissStreak[period] = Math.min(8, this.runEventMissStreak[period] + 1);
      return false;
    }

    const picked = this.pickRunEventDef(period);
    if (!picked) {
      this.runEventMissStreak[period] = Math.min(8, this.runEventMissStreak[period] + 1);
      return false;
    }

    this.runEventMissStreak[period] = 0;
    this.runEventLastTriggerDay[period] = day;
    this.runEventLastAnyTriggerDay = day;
    this.runEventLastAnyTriggerPeriod = period;
    const cooldownDays = day <= 3
      ? Phaser.Math.Between(2, 3)
      : day <= 8
        ? Phaser.Math.Between(1, 3)
        : Phaser.Math.Between(1, 2);
    this.runEventGlobalCooldownUntilDay = day + cooldownDays;
    this.runEventRecentHistory.push({ id: picked.id, period, arc: picked.arc, day });
    if (this.runEventRecentHistory.length > 28) {
      this.runEventRecentHistory.splice(0, this.runEventRecentHistory.length - 28);
    }
    this.showRunEventPanel(picked);
    return true;
  }

  private showRunEventPanel(eventDef: RunEventDef): void {
    if (this.runEventOpen || !eventDef) return;
    this.runEventOpen = true;
    this.setUISceneInputEnabled(false);
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const container = this.add.container(0, 0).setDepth(3400).setScrollFactor(0);
    this.runEventContainer = container;

    const rewardMul = this.getRunEventRewardMultiplier(eventDef.period);
    const riskMul = this.getRunEventRiskMultiplier(eventDef.period);
    const loreSnippet = this.pickRunEventLoreSnippet(eventDef);
    this.runEventActiveLoreSnippet = loreSnippet;
    const loreTitle = loreSnippet?.titleCN || '线索摘要';
    const loreText = loreSnippet?.textCN || eventDef.loreTextCN;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
      .setScrollFactor(0);
    container.add(overlay);

    const compactLayout = (this.mobileViewport && h > w * 0.95) || w <= 620;
    const panelW = compactLayout ? Math.min(760, w - 24) : Math.min(980, w - 60);
    const panelH = compactLayout ? Math.min(760, h - 28) : Math.min(590, h - 44);
    const tinyCompactLayout = compactLayout && panelH < 690;
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, eventDef.period === 'night' ? 0xf97316 : 0x0ea5e9, 0.85);
    container.add(panel);

    this.runEventCurrentChapter = this.getRunEventStoryChapter();
    const chapterLabel = RUN_EVENT_CHAPTER_LABELS[this.runEventCurrentChapter] || `章节${this.runEventCurrentChapter}`;
    const factionSummary = this.getRunEventFactionSummary(eventDef);
    const titleFont = compactLayout ? (tinyCompactLayout ? '32px' : '36px') : '44px';
    const descFont = compactLayout ? (tinyCompactLayout ? '17px' : '19px') : '22px';
    const metaFont = compactLayout ? (tinyCompactLayout ? '15px' : '17px') : '20px';
    const storyFont = compactLayout ? (tinyCompactLayout ? '16px' : '18px') : '21px';
    const knownLore = this.getUnlockedRunEventLoreCount();
    const unlockedPieces = this.getUnlockedRunEventLorePieceCount();
    const totalPieces = this.getRunEventLorePieceTotalCount();
    const arcName = RUN_EVENT_ARC_LABELS[eventDef.arc] || '未知线';
    const topY = h / 2 - panelH / 2 + (compactLayout ? 14 : 20);

    container.add(this.add.text(w / 2, topY, eventDef.titleCN, {
      fontSize: titleFont,
      color: eventDef.period === 'night' ? '#fdba74' : '#7dd3fc',
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 42 : 52), eventDef.descCN, {
      fontSize: descFont,
      color: '#cbd5e1',
      fontFamily: this.getUIFontFamily(),
      align: 'center',
      lineSpacing: compactLayout ? 4 : 6,
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 84 : 108), `章节 ${this.runEventCurrentChapter}·${chapterLabel}  |  故事线 ${arcName}  |  线索 ${knownLore}/${RUN_EVENT_DEFS.length}  |  碎片 ${unlockedPieces}/${totalPieces}`, {
      fontSize: metaFont,
      color: '#67e8f9',
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 110 : 136), `线索[${loreTitle}]：${loreText}`, {
      fontSize: storyFont,
      color: '#c4b5fd',
      fontFamily: this.getUIFontFamily(),
      align: 'center',
      lineSpacing: compactLayout ? 2 : 4,
      wordWrap: { width: panelW - 56 },
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 142 : 176), factionSummary, {
      fontSize: compactLayout ? (tinyCompactLayout ? '14px' : '15px') : '17px',
      color: '#86efac',
      fontFamily: this.getUIFontFamily(),
      align: 'center',
      wordWrap: { width: panelW - 52 },
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 168 : 202), `词缀联动：奖励 x${rewardMul.toFixed(2)} · 风险 x${riskMul.toFixed(2)}`, {
      fontSize: metaFont,
      color: '#fbbf24',
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, topY + (compactLayout ? 194 : 230), '12秒无操作将自动随机决策', {
      fontSize: compactLayout ? '14px' : '16px',
      color: '#94a3b8',
      fontFamily: this.getUIFontFamily(),
    }).setOrigin(0.5, 0));

    const buttonW = compactLayout ? panelW - 34 : Math.max(340, panelW * 0.42);
    const cardGap = compactLayout ? 16 : 22;
    const buttonH = compactLayout
      ? Math.round(Phaser.Math.Clamp((panelH - 278 - cardGap) / 2, 106, 194))
      : 244;
    const cardStartY = topY + (compactLayout ? 208 : 238);
    const compactTinyCard = compactLayout && buttonH <= 120;
    const choiceTitleFont = compactLayout ? (buttonH <= 120 ? '20px' : '31px') : '33px';
    const choiceBodyFont = compactLayout ? (buttonH <= 120 ? '13px' : '17px') : '18px';
    const choicePreviewFont = compactLayout ? (buttonH <= 120 ? '12px' : '15px') : '16px';
    const choiceHintFont = compactLayout ? (buttonH <= 120 ? '12px' : '16px') : '16px';
    const buttonPositions = compactLayout
      ? [
        { x: w / 2, y: cardStartY + buttonH / 2 },
        { x: w / 2, y: cardStartY + buttonH / 2 + buttonH + cardGap },
      ]
      : [
        { x: w / 2 - panelW * 0.25, y: cardStartY + buttonH / 2 },
        { x: w / 2 + panelW * 0.25, y: cardStartY + buttonH / 2 },
      ];

    eventDef.choices.forEach((choice, index) => {
      const cx = buttonPositions[index].x;
      const cy = buttonPositions[index].y;
      const accent = index === 0 ? 0x22c55e : 0xf97316;
      const card = this.add.rectangle(cx, cy, buttonW, buttonH, 0x111827, 0.92)
        .setScrollFactor(0)
        .setStrokeStyle(2, accent, 0.9);
      container.add(card);

      const previewLimit = compactTinyCard ? 1 : compactLayout ? 3 : 4;
      const preview = this.describeRunEventChoice(choice, eventDef.period, previewLimit);
      container.add(this.add.text(cx, cy - buttonH / 2 + (compactTinyCard ? 8 : 18), choice.titleCN, {
        fontSize: choiceTitleFont,
        color: '#e2e8f0',
        fontFamily: this.getUIFontFamily(),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0));
      container.add(this.add.text(cx, cy - buttonH / 2 + (compactTinyCard ? 28 : 62), choice.detailCN, {
        fontSize: choiceBodyFont,
        color: '#94a3b8',
        fontFamily: this.getUIFontFamily(),
        align: 'center',
        wordWrap: { width: buttonW - 28 },
      }).setOrigin(0.5, 0));
      container.add(this.add.text(cx, cy - buttonH / 2 + (compactTinyCard ? 44 : 100), preview, {
        fontSize: choicePreviewFont,
        color: '#cbd5e1',
        fontFamily: this.getUIFontFamily(),
        align: 'center',
        wordWrap: { width: buttonW - 32 },
        lineSpacing: compactLayout ? 3 : 4,
      }).setOrigin(0.5, 0));
      if (!compactLayout) {
        container.add(this.add.text(cx, cy + buttonH / 2 - 24, '点击选择', {
          fontSize: choiceHintFont,
          color: '#64748b',
          fontFamily: this.getUIFontFamily(),
        }).setOrigin(0.5, 0.5));
      }

      const clickZone = this.add.zone(
        cx,
        cy,
        buttonW + (this.mobileViewport ? 14 : 0),
        buttonH + (this.mobileViewport ? 10 : 0)
      )
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      container.add(clickZone);

      clickZone.on('pointerover', () => {
        if (!this.runEventOpen) return;
        card.setStrokeStyle(2, accent, 1);
      });
      clickZone.on('pointerout', () => {
        if (!this.runEventOpen) return;
        card.setStrokeStyle(2, accent, 0.9);
      });
      clickZone.on('pointerdown', () => {
        if (!this.runEventOpen) return;
        this.resolveRunEventChoice(eventDef, choice);
      });
    });

    // Keep runs moving in unattended/automation sessions.
    this.runEventAutoPickTimer = this.time.delayedCall(12000, () => {
      if (!this.runEventOpen) return;
      const autoChoice = Phaser.Utils.Array.GetRandom(eventDef.choices);
      this.resolveRunEventChoice(eventDef, autoChoice);
    });
  }

  private describeRunEventChoice(choice: RunEventChoiceDef, period: RunEventPeriod, maxEntries: number = 4): string {
    const rewardMul = this.getRunEventRewardMultiplier(period);
    const riskMul = this.getRunEventRiskMultiplier(period);
    const previewParts: string[] = [];
    const labels: Record<keyof Resources, string> = {
      wood: '木材',
      metal: '金属',
      food: '食物',
      water: '净水',
      scrap: '零件',
      medical: '医疗',
      ammo: '弹药',
      energyCore: '能量核',
      bitcoin: '比特币',
    };
    if (choice.resources) {
      (Object.keys(choice.resources) as Array<keyof Resources>).forEach((key) => {
        const range = choice.resources?.[key];
        if (!range) return;
        const avg = (range[0] + range[1]) / 2;
        const projected = Math.max(0, Math.round(avg * rewardMul));
        if (projected > 0) previewParts.push(`+${labels[key]}${projected}`);
      });
    }
    if (choice.xp) {
      const avgXp = (choice.xp[0] + choice.xp[1]) / 2;
      previewParts.push(`+XP${Math.max(1, Math.round(avgXp * rewardMul))}`);
    }
    if (choice.heal) {
      const avgHeal = (choice.heal[0] + choice.heal[1]) / 2;
      previewParts.push(`恢复${Math.max(1, Math.round(avgHeal * rewardMul))}`);
    }
    if (choice.selfDamage) {
      const avgDmg = (choice.selfDamage[0] + choice.selfDamage[1]) / 2;
      previewParts.push(`承伤${Math.max(1, Math.round(avgDmg * riskMul))}`);
    }
    if (choice.spawnEnemies) {
      const avgEnemy = (choice.spawnEnemies[0] + choice.spawnEnemies[1]) / 2;
      previewParts.push(`敌袭+${Math.max(1, Math.round(avgEnemy * riskMul))}`);
    }
    if (choice.bitcoin) {
      const avgBtc = (choice.bitcoin[0] + choice.bitcoin[1]) / 2;
      previewParts.push(`+₿${(avgBtc * rewardMul).toFixed(2)}`);
    }
    if (previewParts.length > maxEntries) {
      const hidden = previewParts.length - maxEntries;
      const compact = previewParts.slice(0, maxEntries);
      compact.push(`其余${hidden}项变化`);
      return compact.map((line) => `• ${line}`).join('\n');
    }
    return previewParts.map((line) => `• ${line}`).join('\n');
  }

  private resolveRunEventChoice(eventDef: RunEventDef, choice: RunEventChoiceDef): void {
    const rewardMul = this.getRunEventRewardMultiplier(eventDef.period);
    const riskMul = this.getRunEventRiskMultiplier(eventDef.period);
    const rewardParts: string[] = [];
    const loreSnippet = this.runEventActiveLoreSnippet;
    this.markRunEventSeen(eventDef.id);
    this.unlockRunEventStoryFlags(eventDef.setFlags);
    this.unlockRunEventStoryFlags(choice.setFlags);
    const newlyUnlockedLore = this.unlockRunEventLore(eventDef);
    const newlyUnlockedLorePiece = loreSnippet ? this.unlockRunEventLorePiece(eventDef, loreSnippet) : false;
    const arcName = RUN_EVENT_ARC_LABELS[eventDef.arc] || '未知线';
    const labels: Record<keyof Resources, string> = {
      wood: '木',
      metal: '金',
      food: '食',
      water: '水',
      scrap: '件',
      medical: '医',
      ammo: '弹',
      energyCore: '核',
      bitcoin: '₿',
    };

    if (choice.resources) {
      (Object.keys(choice.resources) as Array<keyof Resources>).forEach((key) => {
        const range = choice.resources?.[key];
        if (!range) return;
        const low = Math.min(range[0], range[1]);
        const high = Math.max(range[0], range[1]);
        const base = Phaser.Math.Between(Math.floor(low), Math.floor(high));
        const amount = Math.round(base * rewardMul);
        if (amount === 0) return;
        gameState.addResource(key, amount);
        if (amount > 0) QuestSystem.updateProgress('collect', key, amount);
        rewardParts.push(`${amount >= 0 ? '+' : ''}${labels[key]}${amount}`);
      });
    }

    if (choice.bitcoin) {
      const minBtc = Math.min(choice.bitcoin[0], choice.bitcoin[1]);
      const maxBtc = Math.max(choice.bitcoin[0], choice.bitcoin[1]);
      const base = Phaser.Math.FloatBetween(minBtc, maxBtc);
      const amount = Number((base * rewardMul).toFixed(3));
      if (amount !== 0) {
        gameState.addResource('bitcoin', amount);
        rewardParts.push(`+₿${amount.toFixed(3)}`);
      }
    }

    if (choice.xp) {
      const xpBase = Phaser.Math.Between(choice.xp[0], choice.xp[1]);
      const xp = Math.max(1, Math.round(xpBase * rewardMul));
      this.grantExperience(xp);
      rewardParts.push(`+XP${xp}`);
    }

    if (choice.heal) {
      const healBase = Phaser.Math.Between(choice.heal[0], choice.heal[1]);
      const heal = Math.max(1, Math.round(healBase * rewardMul));
      events.emit(GameEvents.PLAYER_HEAL_REQUEST, { amount: heal, source: '事件收益' });
      rewardParts.push(`+恢复${heal}`);
    }

    if (choice.selfDamage) {
      const damageBase = Phaser.Math.Between(choice.selfDamage[0], choice.selfDamage[1]);
      const damage = Math.max(1, Math.round(damageBase * riskMul));
      events.emit(GameEvents.PLAYER_HIT, { damage });
      rewardParts.push(`-生命${damage}`);
    }

    if (choice.spawnEnemies) {
      const countBase = Phaser.Math.Between(choice.spawnEnemies[0], choice.spawnEnemies[1]);
      const count = Math.max(1, Math.round(countBase * riskMul));
      const wave = Math.max(1, gameState.data.currentWave || 1);
      const day = Math.max(1, gameState.data.currentDay || 1);
      for (let i = 0; i < count; i += 1) {
        this.enemySystem.spawnEnemy(wave, day);
      }
      rewardParts.push(`敌袭+${count}`);
    }

    const factionNotices = this.applyRunEventFactionStanding(choice.id);

    events.emit('update-resources', gameState.data.resources);
    const summary = rewardParts.length > 0 ? rewardParts.join(' ') : '无变化';
    this.showFloatingText(this.cameras.main.width / 2, 126, `${choice.titleCN}: ${summary}`, '#fbbf24', true);
    this.showFloatingText(
      this.cameras.main.width / 2,
      150,
      `事件完成 · ${eventDef.period === 'night' ? '夜间' : '白天'}决策已生效`,
      '#93c5fd',
      true
    );
    if (factionNotices.length > 0) {
      this.showFloatingText(
        this.cameras.main.width / 2,
        172,
        `派系关系变动：${factionNotices.join(' · ')}`,
        '#86efac',
        true
      );
    }
    if (newlyUnlockedLore || newlyUnlockedLorePiece) {
      this.showFloatingText(
        this.cameras.main.width / 2,
        factionNotices.length > 0 ? 196 : 174,
        `线索解锁[${arcName}]：${loreSnippet?.textCN || eventDef.loreTextCN}`,
        '#a78bfa',
        true
      );
    }
    this.runEventCurrentChapter = this.getRunEventStoryChapter();

    this.runEventOpen = false;
    this.setUISceneInputEnabled(true);
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;
    this.runEventActiveLoreSnippet = null;

    if (this.pendingNightWaveStartAfterEvent) {
      this.pendingNightWaveStartAfterEvent = false;
      this.openNightDirectiveSelectionPanel();
    }
  }

  private closeNightDirectiveSelectionPanel(): void {
    if (!this.nightDirectiveSelectionOpen && !this.nightDirectiveSelectionContainer) return;
    this.nightDirectiveSelectionOpen = false;
    this.nightDirectiveAutoPickTimer?.remove(false);
    this.nightDirectiveAutoPickTimer = null;
    this.nightDirectiveSelectionContainer?.destroy();
    this.nightDirectiveSelectionContainer = null;
    this.setUISceneInputEnabled(true);
    if (!this.currentFacility && !this.daySpotMiniGameOpen && !this.dayChallengeSelectionOpen && !this.runEventOpen) {
      this.playerSystem?.setMovementEnabled(true);
    }
  }

  private buildNightDirectiveIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    id: NightDirectiveId,
    color: number
  ): void {
    const halo = this.add.circle(x, y, 21, color, 0.18).setStrokeStyle(1, color, 0.95);
    const ring = this.add.circle(x, y, 14, 0x0b1220, 0.92).setStrokeStyle(1, 0xe2e8f0, 0.55);
    parent.add([halo, ring]);

    const iconNodes: Phaser.GameObjects.Shape[] = [];
    if (id === 'fortify') {
      const shield = this.add.polygon(x, y + 1, [0, -9, 8, -2, 5, 8, 0, 12, -5, 8, -8, -2], color, 0.9)
        .setStrokeStyle(1, 0xe2e8f0, 0.8);
      const strip = this.add.rectangle(x, y, 4, 12, 0xe2e8f0, 0.8);
      iconNodes.push(shield, strip);
    } else if (id === 'assault') {
      const bladeA = this.add.rectangle(x - 1, y - 1, 4, 18, color, 0.95).setAngle(35);
      const bladeB = this.add.rectangle(x + 1, y + 1, 4, 18, 0xf8fafc, 0.88).setAngle(-35);
      const spark = this.add.star(x, y - 8, 4, 1.2, 3.8, 0xfacc15, 0.9);
      iconNodes.push(bladeA, bladeB, spark);
    } else {
      const crate = this.add.rectangle(x, y + 2, 15, 10, color, 0.9).setStrokeStyle(1, 0xe2e8f0, 0.7);
      const handle = this.add.rectangle(x, y - 5, 8, 3, 0xe2e8f0, 0.75);
      const chip = this.add.rectangle(x + 2, y + 2, 3, 3, 0x67e8f9, 0.9);
      iconNodes.push(crate, handle, chip);
    }
    parent.add(iconNodes);

    this.tweens.add({
      targets: halo,
      alpha: { from: 0.18, to: 0.42 },
      scale: { from: 1, to: 1.2 },
      duration: id === 'assault' ? 620 : 840,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: iconNodes,
      scaleX: { from: 1, to: id === 'assault' ? 1.12 : 1.06 },
      scaleY: { from: 1, to: id === 'assault' ? 1.12 : 1.06 },
      angle: id === 'assault' ? { from: -2, to: 2 } : 0,
      duration: id === 'assault' ? 280 : 620,
      yoyo: true,
      repeat: -1,
    });
  }

  private openNightDirectiveSelectionPanel(): void {
    if (this.isGameOver) return;
    if (!gameState.data.isNight) return;
    this.closeNightDirectiveSelectionPanel();
    this.nightDirectiveSelectionOpen = true;
    this.setUISceneInputEnabled(false);
    this.playerSystem?.setMovementEnabled(false);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const mobilePortrait = this.isMobilePortraitViewport();
    const compactLayout = mobilePortrait || w <= 900;
    const container = this.add.container(0, 0).setDepth(3390).setScrollFactor(0);
    this.nightDirectiveSelectionContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.76).setScrollFactor(0);
    container.add(overlay);
    const panelW = compactLayout ? Math.min(460, w - 22) : Math.min(830, w - 48);
    const panelH = compactLayout ? Math.min(h - 26, 700) : Math.min(390, h - 80);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.97)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xf59e0b, 0.85);
    container.add(panel);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 16, '夜间战术线 · 指令选择', {
      fontSize: this.worldFs(compactLayout ? 28 : 30, compactLayout ? 24 : 25),
      color: '#f8fafc',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    if (this.mobileViewport) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 42, '手机端：直接点击下方大按钮执行指令', {
        fontSize: this.worldFs(14, 12),
        color: '#93c5fd',
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }
    const prepCap = this.getDayOpsPrepStackCap();
    const prepBonus = this.dayOpsNightPrepStacks > 0
      ? `白天筹备层数 ${this.dayOpsNightPrepStacks}/${prepCap}（夜战加成 x${(1 + Math.min(0.24, this.dayOpsNightPrepStacks * 0.04)).toFixed(2)}）`
      : '白天筹备层数 0（先完成白天委托可强化夜战）';
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + (this.mobileViewport ? 60 : 52), prepBonus, {
      fontSize: this.worldFs(16, 13),
      color: '#fbbf24',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));

    const ids: NightDirectiveId[] = ['fortify', 'assault', 'salvage'];
    const cardGap = compactLayout ? 10 : 12;
    const cardW = compactLayout ? panelW - 34 : Math.floor((panelW - 64) / 3);
    const cardH = compactLayout
      ? Math.floor((panelH - (this.mobileViewport ? 158 : 138) - cardGap * 2) / 3)
      : panelH - 110;
    const startX = compactLayout ? w / 2 : w / 2 - cardW - 12;
    const centerY = compactLayout ? (h / 2 - panelH / 2 + 116 + cardH / 2) : (h / 2 + 14);
    ids.forEach((id, index) => {
      const def = NIGHT_DIRECTIVE_DEFS[id];
      const x = compactLayout ? startX : startX + index * (cardW + cardGap);
      const y = compactLayout ? centerY + index * (cardH + cardGap) : centerY;
      const card = this.add.rectangle(x, centerY, cardW, cardH, 0x0b1220, 0.96)
        .setPosition(x, y)
        .setScrollFactor(0)
        .setStrokeStyle(2, def.color, 0.92)
        .setInteractive({ useHandCursor: true });
      const texts = [
        this.add.text(x, y - cardH / 2 + 14, def.nameCN, {
          fontSize: this.worldFs(compactLayout ? 24 : 26, compactLayout ? 19 : 20),
          color: '#e2e8f0',
          fontFamily: uiFont,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0),
        this.add.text(x, y - cardH / 2 + 40, def.summaryCN, {
          fontSize: this.worldFs(16, 13),
          color: '#94a3b8',
          fontFamily: uiFont,
          align: 'center',
          wordWrap: { width: cardW - 64, useAdvancedWrap: true },
        }).setOrigin(0.5, 0),
        this.add.text(x + (compactLayout ? 6 : 0), y + 4, `伤害x${def.effects.playerDamageMul.toFixed(2)} · 掉落x${def.effects.lootMul.toFixed(2)}\n压力x${def.effects.enemyPressureMul.toFixed(2)} · 经验x${def.effects.xpMul.toFixed(2)}`, {
          fontSize: this.worldFs(14, 12),
          color: '#93c5fd',
          fontFamily: uiFont,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: cardW - 52, useAdvancedWrap: true },
        }).setOrigin(0.5, 0.5),
      ];
      const actionBtn = this.add.rectangle(
        x,
        y + cardH / 2 - 20,
        compactLayout ? cardW - 20 : 108,
        compactLayout ? 30 : 26,
        def.color,
        0.2
      ).setScrollFactor(0).setStrokeStyle(1, def.color, 0.95).setInteractive({ useHandCursor: true });
      const actionText = this.add.text(x, y + cardH / 2 - 20, compactLayout ? '触控执行指令' : '点击执行', {
          fontSize: this.worldFs(compactLayout ? 15 : 14, compactLayout ? 12 : 11),
          color: '#64748b',
          fontFamily: uiFont,
        }).setOrigin(0.5);
      const pick = () => this.applyNightDirective(id);
      card.on('pointerdown', pick);
      actionBtn.on('pointerdown', pick);
      actionText.setInteractive({ useHandCursor: true }).on('pointerdown', pick);
      card.on('pointerover', () => card.setStrokeStyle(2, def.color, 1));
      card.on('pointerout', () => card.setStrokeStyle(2, def.color, 0.92));
      actionBtn.on('pointerover', () => actionBtn.setFillStyle(def.color, 0.34));
      actionBtn.on('pointerout', () => actionBtn.setFillStyle(def.color, 0.2));
      this.tweens.add({
        targets: actionBtn,
        alpha: { from: 0.62, to: 1 },
        duration: 740 + index * 80,
        yoyo: true,
        repeat: -1,
      });
      container.add([card, ...texts, actionBtn, actionText]);
      this.buildNightDirectiveIcon(container, x - cardW / 2 + 30, y - cardH / 2 + 28, id, def.color);
    });

    this.nightDirectiveAutoPickTimer = this.time.delayedCall(12000, () => {
      if (!this.nightDirectiveSelectionOpen) return;
      const fallback = ids[Math.floor(Math.random() * ids.length)];
      this.applyNightDirective(fallback);
    });
  }

  private applyNightDirective(id: NightDirectiveId): void {
    const def = NIGHT_DIRECTIVE_DEFS[id];
    if (!def) return;
    const pacing = this.getRunPacingProfile();
    const prepMul = 1 + Math.min(0.24, this.dayOpsNightPrepStacks * 0.04);
    const renownMul = this.dayOpsRenownBonuses.nightDirectiveDamageMul || 1;
    this.nightDirectiveId = id;
    this.nightDirectiveEffects = {
      playerDamageMul: Number((def.effects.playerDamageMul * prepMul * renownMul * pacing.combatMul).toFixed(3)),
      companionDamageMul: Number((def.effects.companionDamageMul * prepMul * renownMul * pacing.combatMul).toFixed(3)),
      turretDamageMul: Number((def.effects.turretDamageMul * prepMul * renownMul * pacing.combatMul).toFixed(3)),
      residentDamageMul: Number((def.effects.residentDamageMul * prepMul).toFixed(3)),
      lootMul: Number(def.effects.lootMul.toFixed(3)),
      xpMul: Number(def.effects.xpMul.toFixed(3)),
      enemyPressureMul: Number((def.effects.enemyPressureMul * pacing.nightPressureMul).toFixed(3)),
    };
    const baseDelay = id === 'assault' ? 9500 : id === 'salvage' ? 12200 : 14200;
    this.nightDirectivePressureNextAt = this.time.now + Math.max(5500, Math.round(baseDelay / Math.max(0.65, this.nightDirectiveEffects.enemyPressureMul)));
    this.closeNightDirectiveSelectionPanel();
    this.showFloatingText(this.cameras.main.width / 2, 198, `夜间指令已执行：${def.nameCN}`, '#fbbf24', true);
    this.showFloatingText(
      this.cameras.main.width / 2,
      224,
      `伤害x${this.nightDirectiveEffects.playerDamageMul.toFixed(2)} · 掉落x${this.nightDirectiveEffects.lootMul.toFixed(2)} · 压力x${this.nightDirectiveEffects.enemyPressureMul.toFixed(2)}`,
      '#93c5fd',
      true
    );
    this.waveSystem.startNightWaves();
  }

  private updateNightDirectivePressure(): void {
    if (!gameState.data.isNight) return;
    if (!this.nightDirectiveId) return;
    if (this.time.now < this.nightDirectivePressureNextAt) return;
    if (this.runEventOpen || this.dayChallengeSelectionOpen || this.daySpotMiniGameOpen || this.nightDirectiveSelectionOpen) return;
    const pressureMul = this.nightDirectiveEffects.enemyPressureMul;
    const day = Math.max(1, gameState.data.currentDay || 1);
    const wave = Math.max(1, gameState.data.currentWave || 1);
    const baseCount = this.nightDirectiveId === 'assault' ? 2 : 1;
    const extra = pressureMul > 1 ? Phaser.Math.Between(0, Math.max(1, Math.floor((pressureMul - 1) * 4))) : 0;
    const spawnCount = Math.max(0, baseCount + extra + (day >= 6 ? 1 : 0));
    for (let i = 0; i < spawnCount; i += 1) {
      this.enemySystem.spawnEnemy(wave, day);
    }
    if (spawnCount > 0) {
      const msg = this.nightDirectiveId === 'fortify'
        ? `守线压力波 +${spawnCount}`
        : this.nightDirectiveId === 'assault'
          ? `猎杀反扑 +${spawnCount}`
          : `回收惊动 +${spawnCount}`;
      this.showFloatingText(this.cameras.main.width / 2, 244, msg, '#f97316', true);
    }
    if (this.nightDirectiveId === 'salvage' && Math.random() < 0.55) {
      const scrap = Phaser.Math.Between(2, 4);
      const metal = Phaser.Math.Between(1, 3);
      gameState.addResource('scrap', scrap);
      gameState.addResource('metal', metal);
      if (Math.random() < 0.3) {
        const btc = Number((0.02 + Math.random() * 0.06).toFixed(3));
        gameState.addResource('bitcoin', btc);
      }
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(this.cameras.main.width / 2, 268, `夜间回收 +件${scrap} +金${metal}`, '#67e8f9', true);
    }
    const baseDelay = this.nightDirectiveId === 'assault' ? 9000 : this.nightDirectiveId === 'salvage' ? 11800 : 13800;
    this.nightDirectivePressureNextAt = this.time.now + Math.max(5200, Math.round(baseDelay / Math.max(0.65, pressureMul)));
  }

  private setUISceneInputEnabled(enabled: boolean): void {
    const uiScene = this.scene.get('UIScene') as Phaser.Scene | null;
    if (!uiScene || !uiScene.input) return;
    uiScene.input.enabled = enabled;
  }

  private createLighting(): void {
    if (!this.textures.exists('light_gradient')) {
      const size = 300;
      const canvas = this.textures.createCanvas('light_gradient', size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    this.lightingLayer = this.add.renderTexture(0, 0, 2000, 1500);
    this.lightingLayer.setOrigin(0, 0);
    this.lightingLayer.setScrollFactor(1);
    this.lightingLayer.setDepth(900);
    this.lightingLayer.setAlpha(1);
    this.lightBrush = this.make.image({ key: 'light_gradient', add: false });
    this.lightBrush.setOrigin(0.5);
  }

  private createBackground(): void {
    const worldW = 2000;
    const worldH = 1500;
    this.add.image(worldW / 2, worldH / 2, 'world_base_map').setDepth(-30);
    this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x030712, 0.05).setDepth(-29);

    const baseRing = this.add.ellipse(1000, 750, 540, 430, 0x2a2119, 0.08);
    baseRing.setStrokeStyle(2, 0xb08968, 0.24);
    baseRing.setDepth(-9);
    const baseCore = this.add.ellipse(1000, 750, 468, 356, 0x312417, 0.07);
    baseCore.setStrokeStyle(1, 0xfbbf24, 0.2);
    baseCore.setDepth(-9);
    this.add.rectangle(1000, 750, 388, 2, 0xb08968, 0.16).setDepth(-9);
    this.add.rectangle(1000, 750, 2, 288, 0xb08968, 0.16).setDepth(-9);
    this.add.text(1000, 536, '基地中枢', {
      fontSize: this.worldFs(14, 13),
      color: '#fef3c7',
      fontFamily: this.getUIFontFamily(),
      stroke: '#0b1220',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.3).setDepth(-8);
  }

  private createExplorationWorld(): void {
    this.worldFeatureLayer = this.add.container(0, 0).setDepth(-18);

    const addShadowedStructure = (key: string, x: number, y: number, scale: number, tint?: number) => {
      if (!this.textures.exists(key)) return;
      const shadow = this.add.ellipse(x, y + 12, 52 * scale, 13 * scale, 0x000000, 0.22);
      const sprite = this.add.image(x, y, key).setScale(scale);
      if (tint) sprite.setTint(tint);
      this.worldFeatureLayer.add([shadow, sprite]);
    };

    // River color overlays removed to keep the background clean with custom images.
    addShadowedStructure('deco_river_pier', 428, 468, 1.0, 0xb08968);
    addShadowedStructure('deco_river_pier', 504, 898, 1.04, 0xa67c52);
    addShadowedStructure('deco_bridge_broken', 448, 286, 0.82, 0x9a7c5a);
    addShadowedStructure('deco_river_boat', 390, 710, 0.86, 0x8fa9c8);
    addShadowedStructure('forest_cabin', 350, 1116, 0.74, 0xcbd5e1);
    addShadowedStructure('deco_boulder', 616, 656, 0.84, 0x94a3b8);
    addShadowedStructure('deco_barricade', 576, 1010, 0.7, 0x8f6a48);

    // Forest biome (top-right).
    const forestArea = this.add.ellipse(1605, 410, 640, 660, 0x14532d, 0.1);
    forestArea.setStrokeStyle(1, 0x22c55e, 0.14);
    this.worldFeatureLayer.add(forestArea);
    addShadowedStructure('forest_cabin', 1486, 286, 0.86, 0xd1d5db);
    addShadowedStructure('forest_cabin', 1762, 442, 0.78, 0xbdd7c2);
    addShadowedStructure('deco_billboard', 1638, 214, 0.58, 0xa3e635);
    addShadowedStructure('deco_forest_shrine', 1548, 562, 0.76, 0x95cf9c);
    addShadowedStructure('deco_radio_tower', 1860, 232, 0.58, 0x94a3b8);
    addShadowedStructure('deco_boulder', 1818, 688, 0.92, 0x7f8ea3);

    // City biome (top-left) with stricter boundary so it doesn't invade base visuals.
    const cityArea = this.add.ellipse(322, 396, 544, 584, 0x334155, 0.1);
    cityArea.setStrokeStyle(1, 0x94a3b8, 0.16);
    this.worldFeatureLayer.add(cityArea);
    const cityBlocks = [
      { key: 'house_tower_ruin', x: 160, y: 172, s: 0.56, tint: 0x95a2b5 },
      { key: 'house_apartment', x: 236, y: 210, s: 0.62, tint: 0x9aa6b8 },
      { key: 'house_shop_ruin', x: 356, y: 246, s: 0.74, tint: 0xa5afbf },
      { key: 'house_duplex_ruin', x: 262, y: 296, s: 0.66, tint: 0x9eaab9 },
      { key: 'house_block_ruin', x: 472, y: 194, s: 0.7, tint: 0x98a4b5 },
      { key: 'shop_kiosk_ruin', x: 520, y: 292, s: 0.7, tint: 0xa5afbf },
      { key: 'house_factory_ruin', x: 150, y: 402, s: 0.6, tint: 0x97a3b4 },
      { key: 'house_shop_ruin', x: 286, y: 432, s: 0.7, tint: 0xb0bac8 },
      { key: 'house_block_ruin', x: 414, y: 462, s: 0.78, tint: 0x9ca3af },
      { key: 'house_clinic_ruin', x: 522, y: 402, s: 0.64, tint: 0xaeb6c4 },
      { key: 'deco_ruin', x: 486, y: 506, s: 0.8, tint: 0x9ca3af },
      { key: 'house_tower_ruin', x: 570, y: 480, s: 0.5, tint: 0x95a2b5 },
    ];
    cityBlocks.forEach((block) => addShadowedStructure(block.key, block.x, block.y, block.s, block.tint));
    for (let i = 0; i < 10; i += 1) {
      const machine = this.add.image(
        Phaser.Math.Between(150, 610),
        Phaser.Math.Between(156, 666),
        'deco_machine'
      ).setScale(Phaser.Math.FloatBetween(0.52, 0.82));
      machine.setTint(0x6b7280);
      this.worldFeatureLayer.add(machine);
    }
    addShadowedStructure('deco_billboard', 262, 320, 0.58, 0x94a3b8);
    addShadowedStructure('deco_billboard', 520, 360, 0.5, 0x94a3b8);
    for (let i = 0; i < 11; i += 1) {
      this.worldFeatureLayer.add(this.add.rectangle(
        Phaser.Math.Between(140, 620),
        Phaser.Math.Between(164, 688),
        Phaser.Math.Between(12, 24),
        Phaser.Math.Between(4, 8),
        0x475569,
        0.55
      ).setRotation(Phaser.Math.FloatBetween(-0.4, 0.4)));
    }
    for (let i = 0; i < 4; i += 1) {
      if (!this.textures.exists('deco_wreck_car')) break;
      const car = this.add.image(
        Phaser.Math.Between(160, 600),
        Phaser.Math.Between(208, 652),
        'deco_wreck_car'
      ).setScale(Phaser.Math.FloatBetween(0.45, 0.64)).setRotation(Phaser.Math.FloatBetween(-0.18, 0.18));
      car.setTint(0x8f9bae);
      this.worldFeatureLayer.add(car);
    }
    for (let i = 0; i < 4; i += 1) {
      if (!this.textures.exists('deco_barricade')) break;
      const barricade = this.add.image(
        Phaser.Math.Between(170, 610),
        Phaser.Math.Between(188, 676),
        'deco_barricade'
      ).setScale(Phaser.Math.FloatBetween(0.52, 0.74));
      barricade.setTint(0x9b7f5b);
      this.worldFeatureLayer.add(barricade);
    }

    // Cave biome (bottom-right).
    const caveArea = this.add.ellipse(1670, 1160, 390, 336, 0x1f2937, 0.16);
    caveArea.setStrokeStyle(1, 0x64748b, 0.24);
    this.worldFeatureLayer.add(caveArea);
    this.worldFeatureLayer.add(this.add.ellipse(1650, 1168, 170, 98, 0x020617, 0.88));
    this.worldFeatureLayer.add(this.add.ellipse(1654, 1172, 104, 54, 0x000000, 0.78));
    this.worldFeatureLayer.add(this.add.ellipse(1654, 1144, 126, 44, 0x334155, 0.22));
    addShadowedStructure('deco_cave_gate', 1650, 1168, 0.78, 0x8d99ad);
    addShadowedStructure('cave_watch_post', 1764, 1088, 0.72, 0x8b95a9);
    addShadowedStructure('deco_radio_tower', 1818, 1230, 0.54, 0x8b95a9);
    for (let i = 0; i < 9; i += 1) {
      if (!this.textures.exists('deco_cave_stalagmite')) break;
      const stalagmite = this.add.image(
        Phaser.Math.Between(1520, 1820),
        Phaser.Math.Between(1030, 1350),
        'deco_cave_stalagmite'
      ).setScale(Phaser.Math.FloatBetween(0.56, 0.9)).setTint(0x73819a);
      this.worldFeatureLayer.add(stalagmite);
    }
    for (let i = 0; i < 8; i += 1) {
      this.worldFeatureLayer.add(this.add.image(
        Phaser.Math.Between(1510, 1830),
        Phaser.Math.Between(1010, 1370),
        'deco_crater'
      ).setScale(Phaser.Math.FloatBetween(0.65, 1.0)));
    }

    // Zone labels.
    this.spawnWorldZoneLabel({ x: 398, y: 246, text: '河流区', color: '#22d3ee' });
    this.spawnWorldZoneLabel({ x: 278, y: 246, text: '城区', color: '#f8fafc' });
    this.spawnWorldZoneLabel({ x: 1590, y: 250, text: '森林区', color: '#86efac' });
    this.spawnWorldZoneLabel({ x: 1650, y: 974, text: '山洞区', color: '#c4b5fd' });

    // Exploration points for day-life gameplay.
    this.spawnExplorationSpot({
      id: 'river_fishing_1',
      zone: 'river',
      actionType: 'fish',
      name: '河岸钓点',
      hint: '河流钓鱼',
      x: 430,
      y: 520,
      radius: 90,
      cooldown: 12000,
      iconKey: 'loot_food',
      color: 0x22d3ee,
    });
    this.spawnExplorationSpot({
      id: 'river_swim_1',
      zone: 'river',
      actionType: 'swim',
      name: '浅滩水域',
      hint: '河流游泳',
      x: 462,
      y: 900,
      radius: 86,
      cooldown: 10000,
      iconKey: 'loot_water',
      color: 0x60a5fa,
    });
    this.spawnExplorationSpot({
      id: 'river_fishing_2',
      zone: 'river',
      actionType: 'fish',
      name: '旧桥渔点',
      hint: '河流钓鱼',
      x: 388,
      y: 720,
      radius: 88,
      cooldown: 12000,
      iconKey: 'deco_river_boat',
      color: 0x22d3ee,
    });
    this.spawnExplorationSpot({
      id: 'forest_hunt_1',
      zone: 'forest',
      actionType: 'hunt',
      name: '密林猎场',
      hint: '森林打猎',
      x: 1520,
      y: 360,
      radius: 92,
      cooldown: 14000,
      iconKey: 'deco_pine',
      color: 0x22c55e,
    });
    this.spawnExplorationSpot({
      id: 'forest_hunt_2',
      zone: 'forest',
      actionType: 'hunt',
      name: '林缘伏击点',
      hint: '森林打猎',
      x: 1760,
      y: 590,
      radius: 92,
      cooldown: 14000,
      iconKey: 'forest_cabin',
      color: 0x4ade80,
    });
    this.spawnExplorationSpot({
      id: 'city_scavenge_1',
      zone: 'city',
      actionType: 'scavenge',
      name: '破败小店',
      hint: '城区搜刮',
      x: 258,
      y: 320,
      radius: 88,
      cooldown: 13000,
      iconKey: 'shop_kiosk_ruin',
      color: 0xf59e0b,
    });
    this.spawnExplorationSpot({
      id: 'city_scavenge_2',
      zone: 'city',
      actionType: 'scavenge',
      name: '废墟民宅',
      hint: '城区搜刮',
      x: 470,
      y: 526,
      radius: 88,
      cooldown: 13000,
      iconKey: 'house_block_ruin',
      color: 0xf97316,
    });
    this.spawnExplorationSpot({
      id: 'city_scavenge_3',
      zone: 'city',
      actionType: 'scavenge',
      name: '坍塌诊所',
      hint: '城区搜刮',
      x: 522,
      y: 404,
      radius: 86,
      cooldown: 13500,
      iconKey: 'house_clinic_ruin',
      color: 0xfb7185,
    });
    this.spawnExplorationSpot({
      id: 'cave_explore_1',
      zone: 'cave',
      actionType: 'cave_explore',
      name: '山洞入口',
      hint: '山洞探险',
      x: 1650,
      y: 1170,
      radius: 104,
      cooldown: 22000,
      iconKey: 'cave_watch_post',
      color: 0xa78bfa,
    });
    this.spawnExplorationSpot({
      id: 'cave_explore_2',
      zone: 'cave',
      actionType: 'cave_explore',
      name: '深层裂隙',
      hint: '山洞探险',
      x: 1734,
      y: 1260,
      radius: 96,
      cooldown: 22000,
      iconKey: 'deco_cave_gate',
      color: 0xc4b5fd,
    });
    this.updateExplorationSpotStatus(true);
  }

  private spawnWorldZoneLabel(def: { x: number; y: number; text: string; color: string }): void {
    this.add.text(def.x, def.y, def.text, {
      fontSize: this.worldFs(14, 13),
      color: def.color,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 4,
      backgroundColor: '#071227c8',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(-5);
  }

  private getZoneAccentColor(zone: WorldZoneId): number {
    if (zone === 'river') return 0x22d3ee;
    if (zone === 'forest') return 0x4ade80;
    if (zone === 'city') return 0xf8fafc;
    if (zone === 'cave') return 0xc4b5fd;
    return 0x94a3b8;
  }

  private getCompactSpotLabel(name: string): string {
    const trimmed = (name || '').trim();
    if (trimmed.length <= 4) return trimmed || '点位';
    return `${trimmed.slice(0, 4)}…`;
  }

  private clearExplorationEdgeIndicators(): void {
    this.explorationEdgeIndicators.forEach((indicator) => indicator.destroy());
    this.explorationEdgeIndicators.clear();
  }

  private ensureExplorationEdgeIndicator(spot: ExplorationSpot): Phaser.GameObjects.Container {
    const existing = this.explorationEdgeIndicators.get(spot.id);
    if (existing?.active) return existing;

    const uiFont = this.getUIFontFamily();
    const label = this.getCompactSpotLabel(spot.name);
    const container = this.add.container(0, 0).setDepth(1230).setScrollFactor(0).setVisible(false);
    const labelText = this.add.text(0, 0, label, {
      fontSize: this.worldFs(10, 9),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0, 0.5);

    const panelW = Phaser.Math.Clamp(labelText.width + 36, 72, 128);
    const panel = this.add.rectangle(0, 0, panelW, 24, 0x020617, 0.86)
      .setStrokeStyle(1, this.getZoneAccentColor(spot.zone), 0.95)
      .setOrigin(0.5);
    const arrow = this.add.text(-panelW / 2 + 12, 0, '▲', {
      fontSize: this.worldFs(15, 13),
      color: '#38bdf8',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0.5);
    labelText.setPosition(-panelW / 2 + 24, 0);

    container.add([panel, arrow, labelText]);
    container.setData('arrow', arrow);
    container.setData('label', labelText);
    container.setData('panel', panel);
    this.explorationEdgeIndicators.set(spot.id, container);
    return container;
  }

  private updateExplorationEdgeIndicators(): void {
    const cam = this.cameras.main;
    const w = cam.width;
    const h = cam.height;
    const safeLeft = 12;
    const safeRight = 12;
    const safeTop = 84;
    const safeBottom = this.mobileViewport && h > w ? 90 : 72;
    const centerX = w * 0.5;
    const centerY = h * 0.5;
    const leftBound = safeLeft;
    const rightBound = w - safeRight;
    const topBound = safeTop;
    const bottomBound = h - safeBottom;
    const zoom = cam.zoom || 1;
    const worldCenterX = cam.midPoint.x;
    const worldCenterY = cam.midPoint.y;

    this.explorationSpots.forEach((spot) => {
      const indicator = this.ensureExplorationEdgeIndicator(spot);
      if (!indicator.active || !spot.marker.active || !spot.marker.visible) {
        indicator.setVisible(false);
        return;
      }

      const playerDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y);
      if (playerDistance < spot.radius + 24) {
        indicator.setVisible(false);
        return;
      }

      const dxScreen = (spot.x - worldCenterX) * zoom;
      const dyScreen = (spot.y - worldCenterY) * zoom;
      const sx = centerX + dxScreen;
      const sy = centerY + dyScreen;
      const inSafeView = sx >= leftBound + 20 && sx <= rightBound - 20 && sy >= topBound + 20 && sy <= bottomBound - 20;
      if (inSafeView) {
        indicator.setVisible(false);
        return;
      }

      if (Math.abs(dxScreen) < 0.001 && Math.abs(dyScreen) < 0.001) {
        indicator.setVisible(false);
        return;
      }

      const tx = Math.abs(dxScreen) > 0.001
        ? ((dxScreen > 0 ? rightBound - centerX : leftBound - centerX) / dxScreen)
        : Number.POSITIVE_INFINITY;
      const ty = Math.abs(dyScreen) > 0.001
        ? ((dyScreen > 0 ? bottomBound - centerY : topBound - centerY) / dyScreen)
        : Number.POSITIVE_INFINITY;
      const t = Math.max(0, Math.min(Math.abs(tx), Math.abs(ty)));
      const edgeX = centerX + dxScreen * t;
      const edgeY = centerY + dyScreen * t;

      const arrow = indicator.getData('arrow') as Phaser.GameObjects.Text | undefined;
      const label = indicator.getData('label') as Phaser.GameObjects.Text | undefined;
      const panel = indicator.getData('panel') as Phaser.GameObjects.Rectangle | undefined;
      const halfPanelW = panel?.displayWidth ? panel.displayWidth * 0.5 : 36;
      const safeX = Phaser.Math.Clamp(edgeX, leftBound + halfPanelW + 2, rightBound - halfPanelW - 2);
      const safeY = Phaser.Math.Clamp(edgeY, topBound + 12, bottomBound - 12);
      if (arrow?.active) {
        arrow.setRotation(Math.atan2(dyScreen, dxScreen) + Math.PI * 0.5);
        arrow.setColor(gameState.data.isNight ? '#64748b' : '#38bdf8');
      }
      if (label?.active) {
        label.setText(gameState.data.isNight ? `${this.getCompactSpotLabel(spot.name)}·封` : this.getCompactSpotLabel(spot.name));
        label.setColor(gameState.data.isNight ? '#94a3b8' : '#e2e8f0');
      }
      if (panel?.active) {
        panel.setStrokeStyle(1, gameState.data.isNight ? 0x334155 : this.getZoneAccentColor(spot.zone), 0.95);
      }

      indicator.setPosition(safeX, safeY);
      indicator.setVisible(true);
      indicator.setAlpha(gameState.data.isNight ? 0.78 : 0.94);
    });
  }

  private spawnExplorationSpot(def: {
    id: string;
    zone: WorldZoneId;
    actionType: ExplorationActionType;
    name: string;
    hint: string;
    x: number;
    y: number;
    radius: number;
    cooldown: number;
    iconKey: string;
    color: number;
  }): void {
    const fontBoost = this.getWorldMarkerFontBoost();
    const iconMul = Phaser.Math.Clamp(0.95 + fontBoost * 0.25, 1, 1.46);
    const zoneName = this.getWorldZoneNameCN(def.zone);
    const uiFont = this.getUIFontFamily();
    const marker = this.add.container(def.x, def.y).setDepth(6);
    const halo = this.add.circle(0, 0, 15, 0x0b1220, 0.82).setStrokeStyle(2, def.color, 0.95);
    marker.add(halo);

    if (this.textures.exists(def.iconKey)) {
      const smallWorldIcons = new Set([
        'deco_tree',
        'deco_pine',
        'deco_ruin',
        'deco_boulder',
        'deco_barricade',
        'loot_core',
        'loot_food',
        'loot_water',
      ]);
      const mediumWorldIcons = new Set([
        'deco_river_pier',
        'deco_river_boat',
        'forest_cabin',
        'deco_forest_shrine',
        'shop_kiosk_ruin',
        'house_block_ruin',
        'house_clinic_ruin',
        'deco_cave_gate',
        'cave_watch_post',
      ]);
      const iconBase = smallWorldIcons.has(def.iconKey)
        ? 0.42
        : mediumWorldIcons.has(def.iconKey)
          ? 0.32
          : 0.8;
      const icon = this.add.image(0, 0, def.iconKey).setScale(iconBase * iconMul);
      marker.add(icon);
    } else {
      marker.add(this.add.text(0, -1, '●', {
        fontSize: this.worldFs(14, 12),
        color: '#e2e8f0',
        fontFamily: uiFont,
        stroke: '#020617',
        strokeThickness: 3,
      }).setOrigin(0.5));
    }

    const label = this.add.text(0, -13, `${zoneName}·${def.name}`, {
      fontSize: this.worldFs(12, 11),
      color: '#cbd5e1',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: '#0b1220',
      padding: { left: 6, right: 6, top: 2, bottom: 2 },
    }).setOrigin(0.5, 1);
    marker.add(label);

    const statusText = this.add.text(0, 16, '0/0', {
      fontSize: this.worldFs(11, 10),
      color: '#64748b',
      fontFamily: uiFont,
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: '#0b1220',
      padding: { left: 5, right: 5, top: 1, bottom: 1 },
    }).setOrigin(0.5, 0);
    marker.add(statusText);

    this.tweens.add({
      targets: halo,
      scale: { from: 1, to: 1.14 },
      alpha: { from: 0.72, to: 0.42 },
      duration: 720,
      yoyo: true,
      repeat: -1,
    });

    this.explorationSpots.push({
      id: def.id,
      zone: def.zone,
      actionType: def.actionType,
      name: def.name,
      hint: def.hint,
      marker,
      statusText,
      color: def.color,
      x: def.x,
      y: def.y,
      radius: def.radius,
      cooldown: def.cooldown,
      lastInteract: -999999,
    });
  }

  private isInsideBaseArea(x: number, y: number): boolean {
    return x > 780 && x < 1220 && y > 530 && y < 970;
  }

  private isInsideRiver(x: number, y: number): boolean {
    const main = x >= 300 && x <= 480 && y >= 100 && y <= 1410;
    const branch = x >= 380 && x <= 720 && y >= 1020 && y <= 1190;
    const upper = x >= 350 && x <= 590 && y >= 180 && y <= 470;
    return main || branch || upper;
  }

  private getWorldZoneAt(x: number, y: number): WorldZoneId {
    if (this.isInsideBaseArea(x, y)) return 'base';
    if (this.isInsideRiver(x, y)) return 'river';
    if (x >= 1470 && x <= 1860 && y >= 980 && y <= 1400) return 'cave';
    if (x >= 1260 && x <= 1910 && y >= 100 && y <= 760) return 'forest';
    if (x >= 80 && x <= 620 && y >= 100 && y <= 730) return 'city';
    return 'wasteland';
  }

  private getWorldZoneNameCN(zone: WorldZoneId): string {
    if (zone === 'base') return '基地';
    if (zone === 'river') return '河流';
    if (zone === 'forest') return '森林';
    if (zone === 'city') return '城区';
    if (zone === 'cave') return '山洞';
    return '荒野';
  }

  private getActivityDailyLimit(actionType: ExplorationActionType): number {
    if (actionType === 'fish') return 3;
    if (actionType === 'swim') return 2;
    if (actionType === 'hunt') return 3;
    if (actionType === 'scavenge') return 3;
    return 1;
  }

  private getActivityUsage(actionType: ExplorationActionType): number {
    return this.dayActivityUsage.get(actionType) || 0;
  }

  private getActivityUsageLimit(actionType: ExplorationActionType): number {
    const baseLimit = this.getActivityDailyLimit(actionType);
    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    return baseLimit + Math.max(0, Math.floor(stationed / 2));
  }

  private getRunPacingProfile(dayOverride?: number): {
    xpMul: number;
    dayRewardMul: number;
    dayTargetMul: number;
    dayDangerMul: number;
    nightPressureMul: number;
    combatMul: number;
  } {
    const day = Math.max(1, dayOverride || gameState.data.currentDay || 1);
    if (day <= 1) {
      return { xpMul: 1.38, dayRewardMul: 1.32, dayTargetMul: 0.82, dayDangerMul: 0.82, nightPressureMul: 0.84, combatMul: 1.08 };
    }
    if (day <= 2) {
      return { xpMul: 1.26, dayRewardMul: 1.2, dayTargetMul: 0.88, dayDangerMul: 0.88, nightPressureMul: 0.9, combatMul: 1.06 };
    }
    if (day <= 3) {
      return { xpMul: 1.14, dayRewardMul: 1.1, dayTargetMul: 0.94, dayDangerMul: 0.94, nightPressureMul: 0.95, combatMul: 1.04 };
    }
    if (day <= 7) {
      return { xpMul: 1, dayRewardMul: 1, dayTargetMul: 1, dayDangerMul: 1, nightPressureMul: 1, combatMul: 1 };
    }
    if (day <= 12) {
      return { xpMul: 0.93, dayRewardMul: 0.96, dayTargetMul: 1.08, dayDangerMul: 1.08, nightPressureMul: 1.08, combatMul: 0.98 };
    }
    return { xpMul: 0.86, dayRewardMul: 0.92, dayTargetMul: 1.16, dayDangerMul: 1.18, nightPressureMul: 1.16, combatMul: 0.96 };
  }

  private getOpsResourceShortName(key: keyof Resources): string {
    const shortName: Record<keyof Resources, string> = {
      wood: '木',
      metal: '金',
      food: '食',
      water: '水',
      scrap: '件',
      medical: '医',
      ammo: '弹',
      energyCore: '核',
      bitcoin: '₿',
    };
    return shortName[key];
  }

  private formatResourcePack(resources: Partial<Record<keyof Resources, number>>, prefix: string = '+'): string {
    const parts: string[] = [];
    (Object.keys(resources) as Array<keyof Resources>).forEach((key) => {
      const amount = Math.max(0, Math.round(resources[key] || 0));
      if (amount <= 0) return;
      parts.push(`${prefix}${this.getOpsResourceShortName(key)}${amount}`);
    });
    return parts.join(' ');
  }

  private getDayOpsQualityRank(requirement: DayOpsQualityRequirement): number {
    if (requirement === 'perfect') return 2;
    if (requirement === 'good') return 1;
    return 0;
  }

  private getDayOpsContractsByStage(
    stage: DayOpsStage,
    actionType?: ExplorationActionType
  ): DayOpsContract[] {
    const day = Math.max(1, gameState.data.currentDay || 1);
    return this.dayOpsContracts.filter((contract) => (
      contract.day === day
      && contract.stage === stage
      && (!actionType || contract.actionType === actionType)
    ));
  }

  private getPendingDayOpsContracts(actionType: ExplorationActionType): DayOpsContract[] {
    return this.getDayOpsContractsByStage('execute', actionType);
  }

  private getDayOpsContractsForAction(actionType: ExplorationActionType): DayOpsContract[] {
    const day = Math.max(1, gameState.data.currentDay || 1);
    return this.dayOpsContracts.filter((contract) => (
      contract.day === day
      && contract.actionType === actionType
      && contract.stage !== 'done'
    ));
  }

  private getDayOpsPrepStackCap(): number {
    return 8 + Math.max(0, this.dayOpsRenownBonuses.prepCapBonus || 0);
  }

  private buildDayOpsContracts(day: number): DayOpsContract[] {
    const templatePool: Array<{
      actionType: ExplorationActionType;
      title: string;
      desc: string;
      prepDesc: string;
      requiredQuality: DayOpsQualityRequirement;
      riskyOnly: boolean;
      baseTarget: number;
      prepGain: number;
      basePrepCost: Partial<Record<keyof Resources, number>>;
      renownGain: number;
      reward: {
        resources: Partial<Record<keyof Resources, number>>;
        xp: number;
        bitcoin?: number;
      };
    }> = [
      {
        actionType: 'fish',
        title: '河道补给线',
        desc: '维持渔点供给，保障饮食与净水',
        prepDesc: '先在任务官处领取渔具与净水箱',
        requiredQuality: 'good',
        riskyOnly: false,
        baseTarget: 2,
        prepGain: 1,
        basePrepCost: { wood: 1, scrap: 1 },
        renownGain: 1,
        reward: { resources: { food: 5, water: 4 }, xp: 16, bitcoin: 0.02 },
      },
      {
        actionType: 'swim',
        title: '水域机动训练',
        desc: '提升行动效率并测试应急恢复',
        prepDesc: '先领取训练包与应急补给',
        requiredQuality: 'good',
        riskyOnly: false,
        baseTarget: 2,
        prepGain: 1,
        basePrepCost: { water: 1, medical: 1 },
        renownGain: 1,
        reward: { resources: { water: 3, medical: 2 }, xp: 14, bitcoin: 0.02 },
      },
      {
        actionType: 'hunt',
        title: '林区狩猎任务',
        desc: '补充食物与弹药，准备夜战物资',
        prepDesc: '先补充弹药并布置诱饵线',
        requiredQuality: 'good',
        riskyOnly: true,
        baseTarget: 2,
        prepGain: 2,
        basePrepCost: { ammo: 1, food: 1 },
        renownGain: 2,
        reward: { resources: { food: 6, ammo: 4, metal: 2 }, xp: 22, bitcoin: 0.04 },
      },
      {
        actionType: 'scavenge',
        title: '城区回收行动',
        desc: '限时回收可用零件与医疗',
        prepDesc: '先准备负重包并登记搜刮路线',
        requiredQuality: 'good',
        riskyOnly: false,
        baseTarget: 2,
        prepGain: 2,
        basePrepCost: { water: 1, scrap: 1, medical: 1 },
        renownGain: 2,
        reward: { resources: { scrap: 6, metal: 4, medical: 2 }, xp: 20, bitcoin: 0.05 },
      },
      {
        actionType: 'cave_explore',
        title: '洞穴深潜突袭',
        desc: '攻坚洞穴线路，争夺能量资源',
        prepDesc: '先完成突袭装填与侦察校准',
        requiredQuality: 'perfect',
        riskyOnly: true,
        baseTarget: 1,
        prepGain: 3,
        basePrepCost: { ammo: 2, medical: 1, metal: 1 },
        renownGain: 3,
        reward: { resources: { scrap: 6, metal: 5, energyCore: 1 }, xp: 30, bitcoin: 0.08 },
      },
    ];
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const pacing = this.getRunPacingProfile(day);
    const dayBoost = day >= 4 ? 1 : 0;
    const picks = Phaser.Utils.Array.Shuffle([...templatePool]).slice(0, 2);
    return picks.map((tpl, idx) => {
      const target = Phaser.Math.Clamp(
        Math.round((tpl.baseTarget + (tpl.requiredQuality === 'perfect' ? 0 : dayBoost) + (week >= 3 ? 1 : 0)) * pacing.dayTargetMul),
        1,
        tpl.requiredQuality === 'perfect' ? 4 : 6
      );
      const scale = (1 + day * 0.03 + week * 0.06) * pacing.dayRewardMul * this.dayOpsRenownBonuses.dayRewardMul;
      const rewardResources: Partial<Record<keyof Resources, number>> = {};
      (Object.keys(tpl.reward.resources) as Array<keyof Resources>).forEach((key) => {
        const base = tpl.reward.resources[key] || 0;
        rewardResources[key] = Math.max(1, Math.round(base * scale));
      });
      const prepCost: Partial<Record<keyof Resources, number>> = {};
      (Object.keys(tpl.basePrepCost) as Array<keyof Resources>).forEach((key) => {
        const base = tpl.basePrepCost[key] || 0;
        const scaled = Math.max(1, Math.round(base * (0.92 + week * 0.06) * pacing.dayTargetMul));
        prepCost[key] = scaled;
      });
      return {
        id: `day_ops_${day}_${idx}_${tpl.actionType}`,
        actionType: tpl.actionType,
        title: tpl.title,
        desc: tpl.desc,
        prepDesc: tpl.prepDesc,
        requiredQuality: tpl.requiredQuality,
        riskyOnly: tpl.riskyOnly,
        target,
        progress: 0,
        prepGain: tpl.prepGain,
        stage: 'prep',
        prepCost,
        handoffNpc: 'commander',
        renownGain: tpl.renownGain,
        reward: {
          resources: rewardResources,
          xp: Math.max(8, Math.round(tpl.reward.xp * (1 + day * 0.02) * pacing.xpMul * this.dayOpsRenownBonuses.dayXpMul)),
          bitcoin: Number(((tpl.reward.bitcoin || 0) * (1 + day * 0.03)).toFixed(3)),
        },
        completed: false,
        day,
      } as DayOpsContract;
    });
  }

  private createOrRefreshDayOpsContracts(showAnnouncement: boolean): void {
    const day = Math.max(1, gameState.data.currentDay || 1);
    this.dayOpsContracts = this.buildDayOpsContracts(day);
    this.dayOpsNightPrepStacks = 0;
    if (!showAnnouncement || this.dayOpsContracts.length <= 0) return;
    const brief = this.dayOpsContracts.map((contract, idx) => {
      const quality = contract.requiredQuality === 'perfect' ? '完美' : contract.requiredQuality === 'good' ? '良好' : '任意';
      const risk = contract.riskyOnly ? '冒险限定' : '稳妥/冒险均可';
      const prep = this.formatResourcePack(contract.prepCost, '');
      const stageText = idx === 0 ? '前置' : '执行';
      return `${stageText} ${contract.title} · ${quality} ${contract.target}次 · ${risk} · 备资 ${prep || '无'}`;
    });
    this.showFloatingText(this.cameras.main.width / 2, 286, `白天委托: ${brief[0]}`, '#fbbf24', true);
    if (brief[1]) {
      this.showFloatingText(this.cameras.main.width / 2, 312, `白天委托: ${brief[1]}`, '#f59e0b', true);
    }
  }

  private tryPrepareDayOpsContract(
    contract: DayOpsContract,
    sourceLabel: string,
    silent: boolean = false
  ): boolean {
    if (contract.stage !== 'prep') return false;
    const canPrep = gameState.canAfford(contract.prepCost);
    if (!canPrep) {
      if (!silent) {
        const need = this.formatResourcePack(contract.prepCost, '');
        this.showFloatingText(
          this.player.x,
          this.player.y - 32,
          `${contract.title} 前置不足：${need}`,
          '#ef4444',
          false
        );
      }
      return false;
    }
    gameState.spendResources(contract.prepCost);
    contract.stage = 'execute';
    events.emit('update-resources', gameState.data.resources);
    if (!silent) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 28,
        `${sourceLabel}完成前置：${contract.title}（开始执行）`,
        '#22d3ee',
        false
      );
    }
    this.updateExplorationSpotStatus(true);
    return true;
  }

  private prepareDayOpsFromCommander(): { prepared: number; blocked: number } {
    const prepContracts = this.getDayOpsContractsByStage('prep');
    if (prepContracts.length <= 0) return { prepared: 0, blocked: 0 };
    let prepared = 0;
    let blocked = 0;
    prepContracts.forEach((contract) => {
      if (this.tryPrepareDayOpsContract(contract, '任务官', true)) prepared += 1;
      else blocked += 1;
    });
    if (prepared > 0) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 54,
        `任务官已下发 ${prepared} 项执行委托`,
        '#38bdf8',
        false
      );
    }
    if (blocked > 0) {
      const sample = prepContracts.find((contract) => contract.stage === 'prep');
      const need = sample ? this.formatResourcePack(sample.prepCost, '') : '';
      this.showFloatingText(
        this.player.x,
        this.player.y - 32,
        `前置物资不足 ${blocked} 项${need ? ` · 例: ${need}` : ''}`,
        '#f97316',
        false
      );
    }
    this.updateExplorationSpotStatus(true);
    return { prepared, blocked };
  }

  private tryAutoPrepareDayOpsForSpot(spot: ExplorationSpot): void {
    const prepContracts = this.getDayOpsContractsByStage('prep', spot.actionType);
    if (prepContracts.length <= 0) return;
    const contract = prepContracts[0];
    this.tryPrepareDayOpsContract(contract, spot.name);
  }

  private applyDayOpsContractProgress(
    spot: ExplorationSpot,
    quality: 'poor' | 'good' | 'perfect',
    risky: boolean
  ): void {
    const contracts = this.getPendingDayOpsContracts(spot.actionType);
    if (contracts.length <= 0) return;
    const qRank = this.getDayChallengeQualityRank(quality);
    contracts.forEach((contract) => {
      const reqRank = this.getDayOpsQualityRank(contract.requiredQuality);
      if (qRank < reqRank) return;
      if (contract.riskyOnly && !risky) return;
      contract.progress = Math.min(contract.target, contract.progress + 1);
      if (contract.progress >= contract.target && contract.stage === 'execute') {
        contract.stage = 'handoff';
        const qualityCN = contract.requiredQuality === 'perfect' ? '完美' : contract.requiredQuality === 'good' ? '良好' : '任意';
        this.showFloatingText(
          this.cameras.main.width / 2,
          338,
          `委托执行完成：${contract.title}（${qualityCN}） · 去任务官交付`,
          '#22d3ee',
          true
        );
      }
    });
    this.updateExplorationSpotStatus(true);
  }

  private handoffDayOpsContract(contract: DayOpsContract): void {
    if (contract.stage !== 'handoff' || contract.completed) return;
    const rewardTexts: string[] = [];
    (Object.keys(contract.reward.resources) as Array<keyof Resources>).forEach((key) => {
      const amount = Math.max(0, Math.round(contract.reward.resources[key] || 0));
      if (amount <= 0) return;
      gameState.addResource(key, amount);
      QuestSystem.updateProgress('collect', key, amount);
      rewardTexts.push(`+${this.getOpsResourceShortName(key)}${amount}`);
    });
    if ((contract.reward.bitcoin || 0) > 0) {
      const btc = Number((contract.reward.bitcoin || 0).toFixed(3));
      gameState.addResource('bitcoin', btc);
      rewardTexts.push(`+₿${btc.toFixed(3)}`);
    }
    const xp = Math.max(6, Math.round(contract.reward.xp || 0));
    this.grantExperience(xp);
    rewardTexts.push(`+XP${xp}`);
    const prepCap = this.getDayOpsPrepStackCap();
    this.dayOpsNightPrepStacks = Math.min(prepCap, this.dayOpsNightPrepStacks + Math.max(1, contract.prepGain || 1));
    rewardTexts.push(`夜战筹备+${Math.max(1, contract.prepGain || 1)}/${prepCap}`);
    const renown = gameState.addDayOpsRenown(Math.max(1, contract.renownGain || 1));
    this.dayOpsRenownBonuses = gameState.getDayOpsRenownBonuses();
    rewardTexts.push(`永久声望+${Math.max(1, contract.renownGain || 1)}(Lv.${renown})`);
    contract.stage = 'done';
    contract.completed = true;
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(
      this.cameras.main.width / 2,
      338,
      `委托交付：${contract.title} · ${rewardTexts.join(' ')}`,
      '#22d3ee',
      true
    );
    this.updateExplorationSpotStatus(true);
  }

  private handoffReadyDayOpsContracts(): number {
    const ready = this.getDayOpsContractsByStage('handoff');
    if (ready.length <= 0) return 0;
    ready.forEach((contract) => this.handoffDayOpsContract(contract));
    return ready.length;
  }

  private getActiveDaySpotBonus(spotId: string): DayLifeSpotBonus | null {
    const bonus = this.daySpotBonuses.get(spotId);
    if (!bonus) return null;
    if (bonus.expiresAt <= this.time.now) {
      this.daySpotBonuses.delete(spotId);
      return null;
    }
    return bonus;
  }

  private consumeDaySpotBonus(spotId: string): DayLifeSpotBonus | null {
    const bonus = this.getActiveDaySpotBonus(spotId);
    if (!bonus) return null;
    this.daySpotBonuses.delete(spotId);
    return bonus;
  }

  private getExplorationSpotResidentCount(spotId: string): number {
    let count = 0;
    for (const [, container] of this.baseResidents.entries()) {
      if (!container.active) continue;
      if ((container.getData('residentExplorationSpotId') as string | undefined) !== spotId) continue;
      const mode = (container.getData('residentMode') || 'idle') as ResidentMode;
      if (mode === 'moving' || mode === 'inside') count += 1;
    }
    return count;
  }

  private pickExplorationSpotForBehavior(behavior: ResidentBehavior): ExplorationSpot | null {
    const spots = this.getExplorationSpotsForBehavior(behavior).filter((spot) => {
      const usageLimit = this.getActivityUsageLimit(spot.actionType);
      const used = this.getActivityUsage(spot.actionType);
      return used < usageLimit;
    });
    if (spots.length <= 0) return null;

    let minResident = Number.MAX_SAFE_INTEGER;
    spots.forEach((spot) => {
      minResident = Math.min(minResident, this.getExplorationSpotResidentCount(spot.id));
    });
    const candidates = spots.filter((spot) => this.getExplorationSpotResidentCount(spot.id) === minResident);
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  private updateExplorationSpotStatus(force: boolean = false): void {
    if (!force && this.time.now < this.explorationStatusNextAt) return;
    this.explorationStatusNextAt = this.time.now + 420;
    this.explorationSpots.forEach((spot) => {
      if (!spot.statusText?.active) return;
      const used = this.getActivityUsage(spot.actionType);
      const usageLimit = this.getActivityUsageLimit(spot.actionType);
      const active = this.getExplorationSpotResidentCount(spot.id);
      const bonus = this.getActiveDaySpotBonus(spot.id);
      const challenge = this.dayExplorationChallenge;
      const challengeOnSpot = !!challenge
        && !challenge.completed
        && challenge.day === Math.max(1, gameState.data.currentDay || 1)
        && challenge.actionType === spot.actionType;
      const contractsOnSpot = this.getDayOpsContractsForAction(spot.actionType);
      const prepContracts = contractsOnSpot.filter((contract) => contract.stage === 'prep');
      const executeContracts = contractsOnSpot.filter((contract) => contract.stage === 'execute');
      const handoffContracts = contractsOnSpot.filter((contract) => contract.stage === 'handoff');
      const contractProgress = executeContracts.reduce((sum, contract) => sum + contract.progress, 0);
      const contractTarget = executeContracts.reduce((sum, contract) => sum + contract.target, 0);
      if (gameState.data.isNight) {
        const directiveText = this.nightDirectiveId
          ? `夜间${NIGHT_DIRECTIVE_DEFS[this.nightDirectiveId].nameCN}`
          : '夜间封锁';
        spot.statusText.setText(directiveText);
        spot.statusText.setColor(this.nightDirectiveId ? '#fbbf24' : '#64748b');
      } else if (active > 0) {
        const tag = challengeOnSpot
          ? '挑战'
          : handoffContracts.length > 0
            ? '交付'
            : executeContracts.length > 0
              ? '委托'
              : prepContracts.length > 0
                ? '前置'
                : bonus
                  ? '热点'
                  : '执行';
        spot.statusText.setText(`${tag}中${active} · ${used}/${usageLimit}`);
        spot.statusText.setColor(challengeOnSpot ? '#22d3ee' : (bonus?.color || '#38bdf8'));
      } else if (handoffContracts.length > 0) {
        spot.statusText.setText(`待交付${handoffContracts.length} · ${used}/${usageLimit}`);
        spot.statusText.setColor('#22d3ee');
      } else if (executeContracts.length > 0) {
        spot.statusText.setText(`执行:${contractProgress}/${contractTarget} · ${used}/${usageLimit}`);
        spot.statusText.setColor('#fbbf24');
      } else if (prepContracts.length > 0) {
        spot.statusText.setText(`前置:${prepContracts.length}项 · ${used}/${usageLimit}`);
        spot.statusText.setColor('#f59e0b');
      } else if (challengeOnSpot) {
        spot.statusText.setText(`${challenge?.branchNameCN || '挑战'}:${challenge?.progress || 0}/${challenge?.required || 0} · ${used}/${usageLimit}`);
        spot.statusText.setColor('#22d3ee');
      } else if (bonus) {
        spot.statusText.setText(`热点:${bonus.label} · ${used}/${usageLimit}`);
        spot.statusText.setColor(bonus.color);
      } else {
        spot.statusText.setText(`${used}/${usageLimit}`);
        spot.statusText.setColor('#64748b');
      }
    });
  }

  private refreshExplorationMarkerVisibility(): void {
    const zone = this.getWorldZoneAt(this.player.x, this.player.y);
    const hideFarMarkersInBase = zone === 'base';
    this.explorationSpots.forEach((spot) => {
      if (!spot.marker?.active) return;
      if (!hideFarMarkersInBase) {
        spot.marker.setVisible(true);
        spot.marker.setAlpha(1);
        return;
      }
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y);
      const keepVisible = distance <= Math.max(88, spot.radius * 0.75);
      spot.marker.setVisible(keepVisible);
      spot.marker.setAlpha(keepVisible ? 1 : 0);
    });
  }

  private getExplorationHintText(spot: ExplorationSpot): string {
    if (gameState.data.isNight) {
      const directiveText = this.nightDirectiveId ? ` · 夜策:${NIGHT_DIRECTIVE_DEFS[this.nightDirectiveId].nameCN}` : '';
      return `[E] ${spot.name} · 夜间封锁${directiveText}`;
    }
    const bonus = this.getActiveDaySpotBonus(spot.id);
    const bonusText = bonus ? ` · 热点:${bonus.label}` : '';
    const challenge = this.dayExplorationChallenge;
    const challengeText = challenge && !challenge.completed && challenge.day === Math.max(1, gameState.data.currentDay || 1) && challenge.actionType === spot.actionType
      ? ` · ${challenge.branchNameCN}挑战${challenge.progress}/${challenge.required}`
      : '';
    const contracts = this.getDayOpsContractsForAction(spot.actionType);
    const prepContracts = contracts.filter((c) => c.stage === 'prep');
    const executeContracts = contracts.filter((c) => c.stage === 'execute');
    const handoffContracts = contracts.filter((c) => c.stage === 'handoff');
    const stageTexts: string[] = [];
    if (prepContracts.length > 0) {
      const samplePrep = this.formatResourcePack(prepContracts[0].prepCost, '');
      stageTexts.push(`前置${prepContracts.length}项${samplePrep ? `(${samplePrep})` : ''}`);
    }
    if (executeContracts.length > 0) {
      stageTexts.push(`执行${executeContracts.map((c) => `${c.progress}/${c.target}`).join('|')}`);
    }
    if (handoffContracts.length > 0) {
      stageTexts.push(`交付${handoffContracts.length}项(任务官)`);
    }
    const contractText = stageTexts.length > 0 ? ` · 委托${stageTexts.join(' · ')}` : '';
    const zoneName = this.getWorldZoneNameCN(spot.zone);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const cdLeft = Math.max(0, Math.ceil((spot.cooldown - (this.time.now - spot.lastInteract)) / 1000));
    if (cdLeft > 0) {
      return `[E] ${spot.name}(${zoneName}) · 冷却${cdLeft}s · 今日${used}/${usageLimit}${bonusText}${challengeText}${contractText}`;
    }
    const chainText = this.dayAdventureChain > 1 ? `连携x${this.dayAdventureChain}` : '可触发连携';
    const extraText = bonus ? ` · ${bonus.summary}` : '';
    if (stationed <= 0) {
      return `[E] ${spot.name}(${zoneName}) · 手动探索(${chainText})${extraText} · 驻守0人 · 今日${used}/${usageLimit}${bonusText}${challengeText}${contractText}`;
    }
    return `[E] ${spot.name}(${zoneName}) · 手动探索(${chainText})${extraText} + 自动执行${active}人 · 今日${used}/${usageLimit}${bonusText}${challengeText}${contractText}`;
  }

  private handleExplorationSpotInteraction(spot: ExplorationSpot): void {
    if (gameState.data.isNight) {
      this.showFloatingText(this.player.x, this.player.y - 24, `${spot.name} 夜间封锁`, '#ef4444', false);
      return;
    }
    this.tryAutoPrepareDayOpsForSpot(spot);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    const cdLeftMs = spot.cooldown - (this.time.now - spot.lastInteract);
    if (cdLeftMs > 0) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 24,
        `${spot.name} 冷却中 ${Math.ceil(cdLeftMs / 1000)}s`,
        '#94a3b8',
        false
      );
      return;
    }
    if (used >= usageLimit) {
      this.showFloatingText(this.player.x, this.player.y - 24, `${spot.name} 今日次数已满 ${used}/${usageLimit}`, '#f59e0b', false);
      return;
    }
    this.openDayExplorationMiniGame(spot);
  }

  private grantExperience(amount: number): void {
    const pacing = this.getRunPacingProfile();
    let xpMul = gameState.data.isNight ? this.nightDirectiveEffects.xpMul : 1;
    xpMul *= pacing.xpMul;
    if (!gameState.data.isNight) {
      xpMul *= this.dayOpsRenownBonuses.dayXpMul;
    }
    const safeAmount = Math.max(0, Math.floor(amount * xpMul));
    if (safeAmount <= 0) return;
    const oldLevel = gameState.data.playerLevel || 1;
    const leveledUp = gameState.addExperience(safeAmount);
    events.emit(GameEvents.PLAYER_EXP_CHANGE, {
      current: gameState.data.playerExp,
      max: gameState.data.expToNextLevel,
    });
    if (leveledUp || (gameState.data.playerLevel || 1) > oldLevel) {
      events.emit(GameEvents.PLAYER_LEVEL_UP, { level: gameState.data.playerLevel });
    }
  }

  private executeActiveExploration(
    spot: ExplorationSpot,
    stationed: number,
    active: number,
    used: number,
    usageLimit: number,
    options?: {
      quality?: 'poor' | 'good' | 'perfect';
      risky?: boolean;
      trapHit?: boolean;
    }
  ): void {
    this.dayActivityUsage.set(spot.actionType, used + 1);
    spot.lastInteract = this.time.now;
    const spotBonus = this.consumeDaySpotBonus(spot.id);

    const chainGap = this.time.now - this.dayAdventureLastAt;
    this.dayAdventureChain = chainGap <= 18000 ? Math.min(8, this.dayAdventureChain + 1) : 1;
    this.dayAdventureLastAt = this.time.now;

    const day = Math.max(1, gameState.data.currentDay || 1);
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const quality = options?.quality || 'good';
    const risky = !!options?.risky;
    const trapHit = !!options?.trapHit;
    const failed = quality === 'poor';
    const qualityMul = quality === 'perfect' ? 1.35 : quality === 'poor' ? 0.76 : 1;
    const chainMul = 1 + Math.min(0.45, Math.max(0, this.dayAdventureChain - 1) * 0.08);
    const supportMul = 1 + Math.min(0.35, stationed * 0.03 + active * 0.05);
    const levelMul = 1 + Math.min(0.55, (level - 1) * 0.02);
    const runMul = this.getRunDayActivityGainMultiplier();
    const pacing = this.getRunPacingProfile(day);
    const riskRewardMul = risky ? 1.28 : 1;
    const riskDangerMul = risky ? 1.36 : 1;
    let rewardMul = Phaser.Math.Clamp(chainMul * supportMul * levelMul * runMul * qualityMul * riskRewardMul, 0.62, 3.9);
    let dangerMul = Phaser.Math.Clamp(
      (1 + day * 0.025 + Math.max(0, this.dayAdventureChain - 1) * 0.06) * riskDangerMul * this.getDayChallengeDangerMultiplier() * pacing.dayDangerMul,
      0.82,
      2.8
    );
    if (spotBonus) {
      rewardMul = Phaser.Math.Clamp(rewardMul * spotBonus.rewardMul, 0.62, 4.5);
      dangerMul = Phaser.Math.Clamp(dangerMul * spotBonus.dangerMul, 1, 3.2);
    }
    const outcomeRoll = Math.random() + (this.dayAdventureChain - 1) * 0.03 + Math.min(0.12, stationed * 0.01) + (quality === 'perfect' ? 0.08 : 0) + (risky ? 0.06 : 0);

    const addResource = (key: keyof Resources, base: number): number => {
      const amount = Math.max(1, Math.round(base * rewardMul));
      gameState.addResource(key, amount);
      QuestSystem.updateProgress('collect', key, amount);
      return amount;
    };
    const setDayBuff = (kind: 'trade' | 'morale' | 'training') => {
      gameState.data.storyFlags[`day_buff_${kind}_${day}`] = true;
    };
    const spawnThreat = (min: number, max: number, label: string): number => {
      const amount = Phaser.Math.Between(min, max);
      for (let i = 0; i < amount; i += 1) {
        this.enemySystem.spawnEnemy(Math.max(1, gameState.data.currentWave || 1), day);
      }
      this.showFloatingText(this.player.x, this.player.y - 84, `${label} +${amount}敌`, '#ef4444', false);
      return amount;
    };

    let summary = '';
    let detail = '';
    let color = '#93c5fd';
    let xp = 0;
    const penaltyNotes: string[] = [];
    let penaltyThreatCount = 0;
    let penaltyDamageTaken = 0;

    if (spot.actionType === 'fish') {
      if (failed) {
        rewardMul *= 0.66;
        dangerMul *= 0.72;
      }
      const fishFoodBase = quality === 'perfect' ? 7 : quality === 'good' ? 4 : 2;
      const fishWaterBase = quality === 'perfect' ? 4 : quality === 'good' ? 2 : 1;
      const food = addResource('food', fishFoodBase);
      const water = addResource('water', fishWaterBase);
      xp = quality === 'perfect' ? 20 : quality === 'good' ? 11 : 6;
      color = '#38bdf8';
      summary = failed
        ? `河流失手 +食物${food} +净水${water}`
        : `河流渔获 +食物${food} +净水${water}`;
      if (failed) {
        penaltyNotes.push('河流失手：仅获得低收益');
      }
      if (!failed && outcomeRoll > 1.08) {
        const btc = Number((0.03 + Math.random() * 0.12).toFixed(3));
        gameState.addResource('bitcoin', btc);
        setDayBuff('trade');
        detail = `捞到黑市箱 · +₿${btc.toFixed(3)} · 今日交易加成`;
      } else if (!failed && Math.random() < 0.16 * dangerMul) {
        spawnThreat(1, Math.max(2, Math.round(2 * dangerMul)), '惊动河岸异群');
      }
    } else if (spot.actionType === 'swim') {
      if (failed) {
        rewardMul *= 0.72;
        dangerMul *= 0.75;
      }
      const water = addResource('water', quality === 'perfect' ? 3 : quality === 'good' ? 2 : 1);
      const healBase = quality === 'perfect' ? 18 : quality === 'good' ? 12 : 5;
      const heal = Math.max(3, Math.round(healBase * rewardMul * 0.72));
      events.emit(GameEvents.PLAYER_HEAL_REQUEST, { amount: heal, source: '河流机动训练' });
      xp = quality === 'perfect' ? 16 : quality === 'good' ? 10 : 6;
      color = '#60a5fa';
      summary = failed
        ? `河道失衡 +净水${water} · 恢复${heal}`
        : `河道机动 +净水${water} · 恢复${heal}`;
      if (failed) {
        penaltyNotes.push('河道失衡：仅获得低收益');
      }
      if (!failed && outcomeRoll > 1.06) {
        this.levelSurgeUntil = Math.max(this.levelSurgeUntil, this.time.now + 10000);
        this.levelSurgePulseAt = this.time.now;
        detail = '触发急速状态：10秒火力提速';
      }
    } else if (spot.actionType === 'hunt') {
      const food = addResource('food', quality === 'perfect' ? 6 : quality === 'good' ? 4 : 2);
      const ammo = addResource('ammo', quality === 'perfect' ? 4 : quality === 'good' ? 3 : 1);
      xp = quality === 'perfect' ? 22 : quality === 'good' ? 14 : 8;
      color = '#22c55e';
      summary = failed
        ? `森林受挫 +食物${food} +弹药${ammo}`
        : `森林猎取 +食物${food} +弹药${ammo}`;
      if (failed) {
        const hurt = Phaser.Math.Between(6, 12) + (risky ? 2 : 0);
        events.emit(GameEvents.PLAYER_HIT, { damage: hurt });
        penaltyDamageTaken = hurt;
        penaltyNotes.push(`森林反噬 受伤-${hurt}`);
      } else if (outcomeRoll > 1.07) {
        const metal = addResource('metal', 2);
        setDayBuff('training');
        detail = `猎获军资 +金属${metal} · 今晚训练加成`;
      } else if (Math.random() < 0.33 * dangerMul) {
        spawnThreat(2, Math.max(4, Math.round(4 * dangerMul)), '枪声引来围猎者');
      }
    } else if (spot.actionType === 'scavenge') {
      const medical = addResource('medical', quality === 'perfect' ? 3 : quality === 'good' ? 2 : 1);
      const scrap = addResource('scrap', quality === 'perfect' ? 6 : quality === 'good' ? 4 : 2);
      const metal = addResource('metal', quality === 'perfect' ? 4 : quality === 'good' ? 3 : 1);
      xp = quality === 'perfect' ? 20 : quality === 'good' ? 13 : 7;
      color = '#f59e0b';
      summary = failed
        ? `城区惊险撤离 +医疗${medical} +零件${scrap} +金属${metal}`
        : `城区搜刮 +医疗${medical} +零件${scrap} +金属${metal}`;
      if (failed) {
        this.applyScavengeDurabilityPenalty(trapHit ? 2 : (risky ? 2 : 1), trapHit);
        const reductionPercent = Math.round((1 - this.getScavengeDurabilityDamageMultiplier()) * 100);
        penaltyNotes.push(`装备耐久下降 · 当前伤害-${reductionPercent}%`);
      } else if (outcomeRoll > 1.08) {
        const btc = Number((0.04 + Math.random() * 0.1).toFixed(3));
        gameState.addResource('bitcoin', btc);
        setDayBuff('trade');
        detail = `回收高价芯片 · +₿${btc.toFixed(3)} · 今日交易加成`;
      } else if (Math.random() < 0.3 * dangerMul) {
        spawnThreat(1, Math.max(3, Math.round(3 * dangerMul)), '城区噪音触发追击');
      }
    } else {
      const scrap = addResource('scrap', quality === 'perfect' ? 7 : quality === 'good' ? 5 : 2);
      const metal = addResource('metal', quality === 'perfect' ? 5 : quality === 'good' ? 4 : 2);
      const coreChance = quality === 'perfect' ? 0.4 : quality === 'good' ? 0.22 : 0.05;
      const core = Math.random() < Phaser.Math.Clamp(coreChance * rewardMul, 0.03, 0.72) ? addResource('energyCore', 1) : 0;
      xp = quality === 'perfect' ? 26 : quality === 'good' ? 16 : 8;
      color = '#a78bfa';
      summary = failed
        ? `洞穴撤退 +零件${scrap} +金属${metal}${core > 0 ? ` +能量核${core}` : ''}`
        : `山洞探险 +零件${scrap} +金属${metal}${core > 0 ? ` +能量核${core}` : ''}`;
      if (failed) {
        const dangerCount = spawnThreat(2, Math.max(6, Math.round(6 * dangerMul)), '洞穴失手引发围攻');
        penaltyThreatCount = dangerCount;
        penaltyNotes.push(`山洞惊动异群 +${dangerCount}敌`);
      } else if (outcomeRoll > 1.1) {
        setDayBuff('training');
        setDayBuff('morale');
        detail = '发现战术档案 · 今晚训练+士气双加成';
      } else if (Math.random() < 0.38 * dangerMul) {
        spawnThreat(2, Math.max(5, Math.round(5 * dangerMul)), '洞穴异动引发敌潮');
      }
    }

    const safeXp = Math.max(
      4,
      Math.round(xp * rewardMul * 0.75 * this.getDayChallengeXpMultiplier()) + (spotBonus?.bonusXp || 0)
    );
    this.grantExperience(safeXp);
    this.applyDayExplorationChallengeProgress(spot, quality, risky);
    this.applyDayOpsContractProgress(spot, quality, risky);
    events.emit('update-resources', gameState.data.resources);

    const chainText = this.dayAdventureChain > 1 ? ` · 连携x${this.dayAdventureChain}` : '';
    const qualityText = quality === 'perfect' ? '完美' : quality === 'poor' ? '失手' : '稳健';
    const riskText = risky ? '冒险' : '稳妥';
    this.showFloatingText(
      this.player.x,
      this.player.y - 24,
      `${spot.name} 主动探索(${riskText}/${qualityText})${chainText}`,
      '#fbbf24',
      false
    );
    this.showFloatingText(this.player.x, this.player.y - 48, `${summary} · +XP${safeXp}`, color, false);
    if (spotBonus) {
      const bonusText = `生活热点: ${spotBonus.label} · ${spotBonus.summary}`;
      detail = detail ? `${detail} · ${bonusText}` : bonusText;
    }
    if (penaltyNotes.length > 0) {
      const penaltyText = penaltyNotes.join(' · ');
      detail = detail ? `${detail} · ${penaltyText}` : penaltyText;
      this.playExplorationFailureFeedback(spot.actionType, {
        trapHit,
        threatCount: penaltyThreatCount,
        damageTaken: penaltyDamageTaken,
      });
    }
    if (detail) {
      this.showFloatingText(this.player.x, this.player.y - 72, detail, '#93c5fd', false);
    } else {
      this.showFloatingText(this.player.x, this.player.y - 72, `驻守支援 ${active}/${Math.max(1, stationed)} · 今日${used + 1}/${usageLimit}`, '#93c5fd', false);
    }
    this.updateExplorationSpotStatus(true);
  }

  private getDayChallengeQualityRank(quality: 'poor' | 'good' | 'perfect'): number {
    if (quality === 'perfect') return 2;
    if (quality === 'good') return 1;
    return 0;
  }

  private getDayChallengeBranchNameCN(branch: DayChallengeBranch): string {
    if (branch === 'stable') return '稳妥';
    if (branch === 'adventure') return '冒险';
    return '极限';
  }

  private getDayChallengeBranchDailyModifiers(branch: DayChallengeBranch): {
    rewardMul: number;
    dangerMul: number;
    xpMul: number;
    summary: string;
  } {
    if (branch === 'stable') {
      return {
        rewardMul: Number((1.03 * this.dayChallengeMasteryBonuses.stableRewardMul).toFixed(3)),
        dangerMul: this.dayChallengeMasteryBonuses.stableDangerMitigationMul,
        xpMul: 1,
        summary: `白天探索更稳 · 风险x${this.dayChallengeMasteryBonuses.stableDangerMitigationMul.toFixed(2)}`,
      };
    }
    if (branch === 'adventure') {
      return {
        rewardMul: Number((1.12 * this.dayChallengeMasteryBonuses.adventureRewardMul).toFixed(3)),
        dangerMul: 1.14,
        xpMul: 1.05,
        summary: '白天收益上升 · 风险小幅提高',
      };
    }
    return {
      rewardMul: 1.28,
      dangerMul: 1.34,
      xpMul: Number((1.1 * this.dayChallengeMasteryBonuses.extremeXpMul).toFixed(3)),
      summary: `高压推进 · 经验x${(1.1 * this.dayChallengeMasteryBonuses.extremeXpMul).toFixed(2)}`,
    };
  }

  private getDayChallengeSpotName(actionType: ExplorationActionType): string {
    if (actionType === 'fish') return '河流钓点';
    if (actionType === 'swim') return '浅滩水域';
    if (actionType === 'hunt') return '森林猎场';
    if (actionType === 'scavenge') return '城区废墟';
    return '山洞区域';
  }

  private buildDayChallengeForBranch(
    day: number,
    branch: DayChallengeBranch,
    blockedActions?: Set<ExplorationActionType>
  ): DayExplorationChallenge {
    const pacing = this.getRunPacingProfile(day);
    const actionPool: ExplorationActionType[] = branch === 'stable'
      ? ['fish', 'swim', 'scavenge']
      : branch === 'adventure'
        ? ['hunt', 'scavenge', 'fish', 'swim']
        : ['cave_explore', 'hunt', 'scavenge'];
    const branchHistory = this.dayChallengeBranchRecentActions[branch] || [];
    const recentActionSet = new Set(branchHistory.slice(-2));
    let actionCandidates = actionPool.filter((actionType) => (
      !recentActionSet.has(actionType)
      && !(blockedActions?.has(actionType))
    ));
    if (actionCandidates.length <= 0 && blockedActions && blockedActions.size > 0) {
      actionCandidates = actionPool.filter((actionType) => !blockedActions.has(actionType));
    }
    if (actionCandidates.length <= 0) actionCandidates = [...actionPool];
    const actionType = Phaser.Utils.Array.GetRandom(actionCandidates);
    branchHistory.push(actionType);
    if (branchHistory.length > 8) branchHistory.splice(0, branchHistory.length - 8);
    this.dayChallengeBranchRecentActions[branch] = branchHistory;
    const targetQuality: 'good' | 'perfect' = branch === 'stable'
      ? 'good'
      : branch === 'adventure'
        ? (Math.random() < 0.62 ? 'good' : 'perfect')
        : (Math.random() < 0.18 ? 'good' : 'perfect');
    const requiredBase = actionType === 'cave_explore' ? 1 : actionType === 'swim' ? 2 : 3;
    const branchAdd = branch === 'stable' ? 0 : branch === 'adventure' ? 1 : 2;
    const dayAdd = day >= 4 ? 1 : 0;
    const perfectAdd = targetQuality === 'perfect' ? 1 : 0;
    const required = Phaser.Math.Clamp(
      Math.round((requiredBase + branchAdd + dayAdd + perfectAdd) * pacing.dayTargetMul),
      actionType === 'cave_explore' ? 1 : 2,
      branch === 'extreme' ? 8 : 7
    );

    const rewardByType: Record<ExplorationActionType, DayExplorationChallenge['reward']> = {
      fish: { resources: { food: 6, water: 5 }, xp: 20, bitcoin: 0.04 },
      swim: { resources: { water: 4, medical: 2 }, xp: 18, bitcoin: 0.03 },
      hunt: { resources: { food: 8, ammo: 5, metal: 2 }, xp: 24, bitcoin: 0.05 },
      scavenge: { resources: { scrap: 8, metal: 5, medical: 3 }, xp: 24, bitcoin: 0.06 },
      cave_explore: { resources: { scrap: 7, metal: 6, energyCore: 1 }, xp: 30, bitcoin: 0.08 },
    };
    const descByType: Record<ExplorationActionType, string> = {
      fish: '在河流点位完成指定质量探索，补给渔获队',
      swim: '在河道点位完成节奏锁定，提升队伍机动',
      hunt: '在森林点位完成高质量狩猎，筹备夜战物资',
      scavenge: '在城区点位完成安全搜刮，回收关键零件',
      cave_explore: '在洞穴点位完成精准勘探，夺取核心资源',
    };

    const branchNameCN = this.getDayChallengeBranchNameCN(branch);
    const branchRewardMul = branch === 'stable'
      ? 0.92 * this.dayChallengeMasteryBonuses.stableRewardMul
      : branch === 'adventure'
        ? 1.22 * this.dayChallengeMasteryBonuses.adventureRewardMul
        : 1.58;
    const branchBitcoinMul = branch === 'adventure'
      ? this.dayChallengeMasteryBonuses.adventureBitcoinMul
      : branch === 'extreme'
        ? 1.15
        : 1;
    const branchXpMul = branch === 'extreme'
      ? 1.34 * this.dayChallengeMasteryBonuses.extremeXpMul
      : branch === 'adventure'
        ? 1.16
        : 1;
    const rewardBase = rewardByType[actionType];
    const scaledResources: Partial<Record<keyof Resources, number>> = {};
    (Object.keys(rewardBase.resources) as Array<keyof Resources>).forEach((key) => {
      const amount = rewardBase.resources[key] || 0;
      scaledResources[key] = Math.max(1, Math.round(
        amount
        * branchRewardMul
        * pacing.dayRewardMul
        * this.dayOpsRenownBonuses.dayRewardMul
      ));
    });
    const dailyEffect = this.getDayChallengeBranchDailyModifiers(branch).summary;

    return {
      id: `day_challenge_${day}_${branch}_${actionType}_${targetQuality}`,
      branch,
      branchNameCN,
      actionType,
      targetQuality,
      required,
      progress: 0,
      reward: {
        resources: scaledResources,
        xp: Math.max(12, Math.round(rewardBase.xp * branchXpMul * pacing.xpMul)),
        bitcoin: Number(((rewardBase.bitcoin || 0) * branchRewardMul * branchBitcoinMul * pacing.dayRewardMul).toFixed(3)),
      },
      title: `${branchNameCN}挑战：${actionType === 'fish'
        ? '河流补给线'
        : actionType === 'swim'
          ? '河道机动训练'
          : actionType === 'hunt'
            ? '林区猎获任务'
            : actionType === 'scavenge'
              ? '城区回收行动'
              : '洞穴深潜行动'}`,
      desc: descByType[actionType],
      dailyEffect,
      masteryGain: branch === 'stable' ? 1 : branch === 'adventure' ? 2 : 3,
      completed: false,
      day,
    };
  }

  private selectDayExplorationChallenge(challenge: DayExplorationChallenge): void {
    this.dayExplorationChallenge = {
      ...challenge,
      progress: 0,
      completed: false,
      day: Math.max(1, gameState.data.currentDay || 1),
    };
    this.dayChallengeBranchSelected = challenge.branch;
    const dayMods = this.getDayChallengeBranchDailyModifiers(challenge.branch);
    this.dayChallengeDayRewardMul = dayMods.rewardMul;
    this.dayChallengeDayDangerMul = dayMods.dangerMul;
    this.dayChallengeDayXpMul = dayMods.xpMul;
    this.closeDayChallengeSelectionPanel();

    const qualityText = challenge.targetQuality === 'perfect' ? '完美' : '良好及以上';
    const spotName = this.getDayChallengeSpotName(challenge.actionType);
    this.showFloatingText(this.cameras.main.width / 2, 208, `${challenge.title}`, '#22d3ee', true);
    this.showFloatingText(
      this.cameras.main.width / 2,
      234,
      `${spotName} · 目标${qualityText} ${challenge.required}次`,
      '#93c5fd',
      true
    );
    this.showFloatingText(
      this.cameras.main.width / 2,
      260,
      `今日分支: ${challenge.branchNameCN} · ${challenge.dailyEffect}`,
      '#fbbf24',
      true
    );
    this.updateExplorationSpotStatus(true);
    if (this.pendingDayRunEventAfterChallenge) {
      this.pendingDayRunEventAfterChallenge = false;
      this.maybeTriggerRunEvent('day');
    }
  }

  private closeDayChallengeSelectionPanel(): void {
    if (!this.dayChallengeSelectionOpen) return;
    this.dayChallengeSelectionOpen = false;
    this.dayChallengeSelectionContainer?.destroy();
    this.dayChallengeSelectionContainer = null;
    this.dayChallengePendingChoices = [];
    this.setUISceneInputEnabled(true);
    if (!this.currentFacility && !this.daySpotMiniGameOpen) {
      this.playerSystem?.setMovementEnabled(true);
    }
  }

  private openDayChallengeSelectionPanel(choices: DayExplorationChallenge[]): void {
    this.closeDayChallengeSelectionPanel();
    if (!choices || choices.length <= 0) return;
    this.dayChallengeSelectionOpen = true;
    this.dayChallengePendingChoices = choices;
    this.setUISceneInputEnabled(false);
    this.playerSystem?.setMovementEnabled(false);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const container = this.add.container(0, 0).setDepth(3380).setScrollFactor(0);
    this.dayChallengeSelectionContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x020617, 0.78).setScrollFactor(0);
    container.add(overlay);
    const panelW = Math.min(860, w - 34);
    const panelH = Math.min(500, h - 46);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x38bdf8, 0.85);
    container.add(panel);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 18, '每日挑战 · 三路分支', {
      fontSize: this.worldFs(32, 26),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 54, '选择今日白天策略：稳妥 / 冒险 / 极限（将影响今日收益风险，并累积永久精通）', {
      fontSize: this.worldFs(18, 15),
      color: '#94a3b8',
      fontFamily: uiFont,
      align: 'center',
    }).setOrigin(0.5, 0));

    const cardW = Math.floor((panelW - 74) / 3);
    const cardH = panelH - 128;
    const startX = w / 2 - cardW - 12;
    const startY = h / 2 + 10;
    const masteryLevels = gameState.getDayChallengeMasteryLevels();
    choices.forEach((choice, index) => {
      const x = startX + index * (cardW + 12);
      const branchColor = choice.branch === 'stable' ? 0x22c55e : choice.branch === 'adventure' ? 0xf59e0b : 0xef4444;
      const card = this.add.rectangle(x, startY, cardW, cardH, 0x0b1220, 0.96)
        .setScrollFactor(0)
        .setStrokeStyle(2, branchColor, 0.92)
        .setInteractive({ useHandCursor: true });
      const qualityText = choice.targetQuality === 'perfect' ? '完美' : '良好';
      const spotName = this.getDayChallengeSpotName(choice.actionType);
      const rewardPreview: string[] = [];
      (Object.entries(choice.reward.resources).slice(0, 3) as Array<[keyof Resources, number]>).forEach(([res, amount]) => {
        const resName: Record<keyof Resources, string> = {
          wood: '木',
          metal: '金',
          food: '食',
          water: '水',
          scrap: '件',
          medical: '医',
          ammo: '弹',
          energyCore: '核',
          bitcoin: '₿',
        };
        rewardPreview.push(`${resName[res]}+${Math.floor(amount || 0)}`);
      });
      if ((choice.reward.bitcoin || 0) > 0) {
        rewardPreview.push(`₿+${(choice.reward.bitcoin || 0).toFixed(2)}`);
      }
      const compactRewardText = (parts: string[], limit: number): string => {
        if (parts.length <= limit) return parts.join(' · ');
        return `${parts.slice(0, limit).join(' · ')} · 其余${parts.length - limit}项`;
      };
      const masteryLv = masteryLevels[choice.branch] || 0;
      const rewardPreviewLabel = `完成奖励 ${compactRewardText(rewardPreview, 3)}`;
      const footerTop = startY + cardH / 2 - 110;
      const footerHeight = 84;
      const footerBg = this.add.rectangle(x, footerTop + footerHeight / 2, cardW - 28, footerHeight, 0x0d1727, 0.5)
        .setScrollFactor(0)
        .setStrokeStyle(1, branchColor, 0.28);

      const texts = [
        this.add.text(x, startY - cardH / 2 + 16, choice.branchNameCN, {
          fontSize: this.worldFs(26, 21),
          color: '#f8fafc',
          fontFamily: uiFont,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0),
        this.add.text(x, startY - cardH / 2 + 48, `精通 Lv.${masteryLv}`, {
          fontSize: this.worldFs(15, 13),
          color: '#67e8f9',
          fontFamily: uiFont,
        }).setOrigin(0.5, 0),
        this.add.text(x, startY - cardH / 2 + 74, choice.title, {
          fontSize: this.worldFs(18, 15),
          color: '#cbd5e1',
          fontFamily: uiFont,
          align: 'center',
          wordWrap: { width: cardW - 20, useAdvancedWrap: true },
        }).setOrigin(0.5, 0),
        this.add.text(x, startY - cardH / 2 + 128, `${spotName} · ${qualityText} ${choice.required}次`, {
          fontSize: this.worldFs(16, 14),
          color: '#fbbf24',
          fontFamily: uiFont,
          align: 'center',
        }).setOrigin(0.5, 0),
        this.add.text(x, startY - cardH / 2 + 154, choice.dailyEffect, {
          fontSize: this.worldFs(15, 12),
          color: '#93c5fd',
          fontFamily: uiFont,
          align: 'center',
          wordWrap: { width: cardW - 24, useAdvancedWrap: true },
        }).setOrigin(0.5, 0),
        this.add.text(x, footerTop + 8, rewardPreviewLabel, {
          fontSize: this.worldFs(15, 12),
          color: '#86efac',
          fontFamily: uiFont,
          align: 'center',
          wordWrap: { width: cardW - 38, useAdvancedWrap: true },
        }).setOrigin(0.5, 0),
        this.add.text(x, footerTop + 34, `+XP${choice.reward.xp} · 永久精通+${choice.masteryGain}`, {
          fontSize: this.worldFs(15, 12),
          color: '#fda4af',
          fontFamily: uiFont,
          align: 'center',
          wordWrap: { width: cardW - 38, useAdvancedWrap: true },
        }).setOrigin(0.5, 0),
      ];
      const pickBtn = this.add.rectangle(x, startY + cardH / 2 - 22, cardW - 30, 40, 0x13233a, 0.98)
        .setStrokeStyle(1, branchColor, 0.95)
        .setInteractive({ useHandCursor: true });
      const pickText = this.add.text(x, startY + cardH / 2 - 22, `选择${choice.branchNameCN}`, {
        fontSize: this.worldFs(17, 14),
        color: '#e2e8f0',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const pick = () => this.selectDayExplorationChallenge(choice);
      card.on('pointerdown', pick);
      pickBtn.on('pointerdown', pick);
      container.add([card, footerBg, ...texts, pickBtn, pickText]);
    });
  }

  private createOrRefreshDayExplorationChallenge(showAnnouncement: boolean): void {
    const day = Math.max(1, gameState.data.currentDay || 1);
    this.dayExplorationChallenge = null;
    this.dayChallengeBranchSelected = null;
    this.dayChallengeDayRewardMul = 1;
    this.dayChallengeDayDangerMul = 1;
    this.dayChallengeDayXpMul = 1;
    const pickedActions = new Set<ExplorationActionType>();
    const stable = this.buildDayChallengeForBranch(day, 'stable', pickedActions);
    pickedActions.add(stable.actionType);
    const adventure = this.buildDayChallengeForBranch(day, 'adventure', pickedActions);
    pickedActions.add(adventure.actionType);
    const extreme = this.buildDayChallengeForBranch(day, 'extreme', pickedActions);
    const choices: DayExplorationChallenge[] = [stable, adventure, extreme];
    if (!showAnnouncement) {
      this.selectDayExplorationChallenge(choices[0]);
      return;
    }
    this.openDayChallengeSelectionPanel(choices);
  }

  private applyDayExplorationChallengeProgress(
    spot: ExplorationSpot,
    quality: 'poor' | 'good' | 'perfect',
    risky: boolean
  ): void {
    const challenge = this.dayExplorationChallenge;
    if (!challenge || challenge.completed) return;
    if (challenge.day !== Math.max(1, gameState.data.currentDay || 1)) return;
    if (challenge.actionType !== spot.actionType) return;

    const currentRank = this.getDayChallengeQualityRank(quality);
    const neededRank = this.getDayChallengeQualityRank(challenge.targetQuality);
    if (currentRank < neededRank) return;

    const gain = quality === 'perfect' && challenge.targetQuality === 'good' ? 2 : 1;
    challenge.progress = Math.min(challenge.required, challenge.progress + gain);
    if (this.time.now >= this.dayChallengeHintCooldownUntil) {
      this.dayChallengeHintCooldownUntil = this.time.now + 1200;
      this.showFloatingText(
        this.player.x,
        this.player.y - 118,
        `${challenge.title} ${challenge.progress}/${challenge.required}`,
        '#22d3ee',
        false
      );
    }
    if (challenge.progress < challenge.required) return;

    challenge.completed = true;
    const reward = challenge.reward;
    const rewardParts: string[] = [];
    (Object.keys(reward.resources) as Array<keyof Resources>).forEach((key) => {
      const amount = Math.max(0, Math.floor(reward.resources[key] || 0));
      if (amount <= 0) return;
      gameState.addResource(key, amount);
      QuestSystem.updateProgress('collect', key, amount);
      const nameMap: Record<keyof Resources, string> = {
        wood: '木材',
        metal: '金属',
        food: '食物',
        water: '净水',
        scrap: '零件',
        medical: '医疗',
        ammo: '弹药',
        bitcoin: '比特币',
        energyCore: '能量核',
      };
      rewardParts.push(`${nameMap[key]}+${amount}`);
    });
    if (reward.bitcoin && reward.bitcoin > 0) {
      const btc = Number((reward.bitcoin * (risky ? 1.15 : 1)).toFixed(3));
      gameState.addResource('bitcoin', btc);
      rewardParts.push(`₿+${btc.toFixed(3)}`);
    }
    const xpBonusMul = challenge.branch === 'extreme' ? this.dayChallengeMasteryBonuses.extremeXpMul : 1;
    this.grantExperience(Math.max(8, Math.round((reward.xp + (quality === 'perfect' ? 6 : 0)) * xpBonusMul)));
    const nextMasteryLevel = gameState.addDayChallengeMastery(challenge.branch, challenge.masteryGain);
    this.dayChallengeMasteryBonuses = gameState.getDayChallengeMasteryBonuses();
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(
      this.cameras.main.width / 2,
      186,
      `挑战完成：${challenge.title}`,
      '#4ade80',
      true
    );
    if (rewardParts.length > 0) {
      this.showFloatingText(this.cameras.main.width / 2, 214, `奖励 ${rewardParts.join(' · ')}`, '#fbbf24', true);
    }
    this.showFloatingText(
      this.cameras.main.width / 2,
      242,
      `永久成长：${challenge.branchNameCN}分支精通 +${challenge.masteryGain} (Lv.${nextMasteryLevel})`,
      '#67e8f9',
      true
    );
  }

  private getDayMiniGameProfile(actionType: ExplorationActionType): DayMiniGameProfile {
    if (actionType === 'fish') {
      return {
        title: '浮漂追踪',
        hint: '让光标贴合浮漂蓝区，越准渔获越高',
        targetColor: 0x0ea5e9,
        perfectColor: 0x22d3ee,
        trapColor: 0x7f1d1d,
        baseWidth: 0.24,
        baseTargetSpeed: 0.00034,
        perfectRatio: 0.4,
        riskyTargetWidthMul: 0.84,
        riskyTargetSpeedMul: 1.18,
        hasTrap: false,
        trapWidth: 0,
      };
    }
    if (actionType === 'swim') {
      return {
        title: '呼吸节奏',
        hint: '观察水流节奏，在稳定窗口锁定动作',
        targetColor: 0x2563eb,
        perfectColor: 0x60a5fa,
        trapColor: 0x7f1d1d,
        baseWidth: 0.27,
        baseTargetSpeed: 0.00024,
        perfectRatio: 0.36,
        riskyTargetWidthMul: 0.8,
        riskyTargetSpeedMul: 1.1,
        hasTrap: false,
        trapWidth: 0,
      };
    }
    if (actionType === 'hunt') {
      return {
        title: '狩猎预判',
        hint: '猎物窗口移动很快，抓住短暂时机',
        targetColor: 0x15803d,
        perfectColor: 0x22c55e,
        trapColor: 0x7f1d1d,
        baseWidth: 0.19,
        baseTargetSpeed: 0.00058,
        perfectRatio: 0.34,
        riskyTargetWidthMul: 0.78,
        riskyTargetSpeedMul: 1.26,
        hasTrap: false,
        trapWidth: 0,
      };
    }
    if (actionType === 'scavenge') {
      return {
        title: '开锁避陷',
        hint: '贴住蓝区并避开红色陷阱，失败会触发警报',
        targetColor: 0xd97706,
        perfectColor: 0xf59e0b,
        trapColor: 0xdc2626,
        baseWidth: 0.2,
        baseTargetSpeed: 0.00028,
        perfectRatio: 0.33,
        riskyTargetWidthMul: 0.76,
        riskyTargetSpeedMul: 1.22,
        hasTrap: true,
        trapWidth: 0.16,
      };
    }
    return {
      title: '回声判位',
      hint: '山洞回声会跳点，锁定时机可获高价值掉落',
      targetColor: 0x7c3aed,
      perfectColor: 0xa78bfa,
      trapColor: 0xdc2626,
      baseWidth: 0.18,
      baseTargetSpeed: 0.00036,
      perfectRatio: 0.31,
      riskyTargetWidthMul: 0.72,
      riskyTargetSpeedMul: 1.24,
      hasTrap: true,
      trapWidth: 0.12,
    };
  }

  private getProtocolMiniGameStyle(): {
    id: LevelUpProtocolId;
    level: number;
    totalLevel: number;
    color: number;
    label: string;
    glyph: string;
  } | null {
    const levels = EvolutionSystem.getProtocolLevels();
    let dominant: LevelUpProtocolId = 'barrage_matrix';
    let hasDominant = false;
    let dominantLevel = 0;
    let total = 0;
    for (const id of Object.keys(levels) as LevelUpProtocolId[]) {
      const level = Math.max(0, levels[id] || 0);
      total += level;
      if (level > dominantLevel) {
        dominant = id;
        hasDominant = true;
        dominantLevel = level;
      }
    }
    if (!hasDominant || dominantLevel <= 0 || total <= 0) return null;
    const glyphMap: Record<LevelUpProtocolId, string> = {
      barrage_matrix: '✶',
      phase_lance: '⟐',
      overclock_link: '⚡',
      echo_reactor: '◎',
      hunter_instinct: '➹',
      companion_sync: '◍',
    };
    const shortNameMap: Record<LevelUpProtocolId, string> = {
      barrage_matrix: '弹幕矩阵',
      phase_lance: '相位穿矛',
      overclock_link: '过载链路',
      echo_reactor: '回声反应堆',
      hunter_instinct: '猎手本能',
      companion_sync: '伙伴协同',
    };
    return {
      id: dominant,
      level: dominantLevel,
      totalLevel: total,
      color: PROTOCOL_VISUAL_PROFILE[dominant].color,
      label: `${shortNameMap[dominant]} Lv.${dominantLevel}`,
      glyph: glyphMap[dominant],
    };
  }

  private blendColor(base: number, tint: number, ratio: number): number {
    const t = Phaser.Math.Clamp(ratio, 0, 1);
    const from = Phaser.Display.Color.IntegerToColor(base);
    const to = Phaser.Display.Color.IntegerToColor(tint);
    return Phaser.Display.Color.GetColor(
      Math.round(from.red + (to.red - from.red) * t),
      Math.round(from.green + (to.green - from.green) * t),
      Math.round(from.blue + (to.blue - from.blue) * t)
    );
  }

  private getMiniGameSkinKey(
    theme: DayMiniGameTheme,
    part: 'tile' | 'panel' | 'safe' | 'risky' | 'button' | 'bar' | 'icon'
  ): string {
    return `mg_${part}_${theme.variant}`;
  }

  private getMiniGameButtonSkinKey(theme: DayMiniGameTheme, state: 'normal' | 'hover' | 'pressed'): string {
    if (state === 'hover') return `mg_button_hover_${theme.variant}`;
    if (state === 'pressed') return `mg_button_pressed_${theme.variant}`;
    return this.getMiniGameSkinKey(theme, 'button');
  }

  private getMiniGameObjectAtlasKey(theme: DayMiniGameTheme): string {
    return `mg_obj_${theme.variant}`;
  }

  private addMiniGameObjectIcon(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    theme: DayMiniGameTheme,
    frame: 'player' | 'loot' | 'trap' | 'enemy' | 'hint' | 'medical' | 'tech' | 'stash',
    size = 18,
    alpha = 1
  ): Phaser.GameObjects.Image | null {
    const key = this.getMiniGameObjectAtlasKey(theme);
    if (!this.textures.exists(key)) return null;
    const texture = this.textures.get(key);
    let useFrame: string = frame;
    if (!texture.has(useFrame)) {
      if (texture.has('hint')) {
        useFrame = 'hint';
      } else {
        const fallbackFrames = texture.getFrameNames();
        if (!fallbackFrames || fallbackFrames.length <= 0) return null;
        useFrame = fallbackFrames[0];
      }
    }
    const icon = this.add.image(x, y, key, useFrame)
      .setDisplaySize(size, size)
      .setAlpha(alpha)
      .setScrollFactor(0);
    container.add(icon);
    return icon;
  }

  private addMiniGameRectSkin(
    container: Phaser.GameObjects.Container,
    rect: Phaser.GameObjects.Rectangle,
    theme: DayMiniGameTheme,
    part: 'tile' | 'safe' | 'risky' | 'button' | 'bar',
    alpha = 0.92
  ): Phaser.GameObjects.Image | null {
    const key = this.getMiniGameSkinKey(theme, part);
    if (!this.textures.exists(key)) return null;
    const skin = this.add.image(rect.x, rect.y, key)
      .setDisplaySize(rect.width, rect.height)
      .setAlpha(alpha)
      .setScrollFactor(0);
    const index = container.getIndex(rect);
    if (index >= 0) container.addAt(skin, index);
    else container.add(skin);
    return skin;
  }

  private bindMiniGameButtonInteraction(
    rect: Phaser.GameObjects.Rectangle,
    skin: Phaser.GameObjects.Image | null,
    theme: DayMiniGameTheme,
    label?: Phaser.GameObjects.Text | null
  ): void {
    const normalKey = this.getMiniGameButtonSkinKey(theme, 'normal');
    const hoverKey = this.getMiniGameButtonSkinKey(theme, 'hover');
    const pressedKey = this.getMiniGameButtonSkinKey(theme, 'pressed');
    const hasNormal = this.textures.exists(normalKey);
    const hasHover = this.textures.exists(hoverKey);
    const hasPressed = this.textures.exists(pressedKey);
    const targets: Phaser.GameObjects.GameObject[] = [rect];
    if (skin) targets.push(skin);
    if (label) targets.push(label);
    const applyVisual = (state: 'normal' | 'hover' | 'pressed') => {
      if (skin && hasNormal) {
        if (state === 'pressed' && hasPressed) skin.setTexture(pressedKey);
        else if (state === 'hover' && hasHover) skin.setTexture(hoverKey);
        else skin.setTexture(normalKey);
      } else {
        rect.setAlpha(state === 'pressed' ? 0.84 : state === 'hover' ? 0.97 : 1);
      }
    };
    const tweenScale = (scale: number, duration: number) => {
      this.tweens.add({
        targets,
        scaleX: scale,
        scaleY: scale,
        duration,
        ease: 'Quad.Out',
      });
    };
    rect.on('pointerover', () => {
      applyVisual('hover');
      tweenScale(1.025, 80);
    });
    rect.on('pointerout', () => {
      applyVisual('normal');
      tweenScale(1, 110);
    });
    rect.on('pointerdown', () => {
      applyVisual('pressed');
      tweenScale(0.97, 60);
    });
    rect.on('pointerup', () => {
      applyVisual('hover');
      tweenScale(1.02, 80);
    });
    rect.on('pointerupoutside', () => {
      applyVisual('normal');
      tweenScale(1, 100);
    });
  }

  private addMiniGameThemeIcon(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    theme: DayMiniGameTheme,
    fallbackFontSize = 22
  ): void {
    const iconKey = this.getMiniGameSkinKey(theme, 'icon');
    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(x, y, iconKey).setDisplaySize(24, 24).setScrollFactor(0);
      container.add(icon);
      return;
    }
    const icon = this.add.text(x, y, theme.icon, {
      fontSize: this.worldFs(fallbackFontSize, 18),
      color: theme.accentText,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);
    container.add(icon);
  }

  private createMiniGamePanelDecor(
    container: Phaser.GameObjects.Container,
    centerX: number,
    centerY: number,
    panelW: number,
    panelH: number,
    theme: DayMiniGameTheme
  ): void {
    const left = Math.floor(centerX - panelW * 0.5 + 6);
    const top = Math.floor(centerY - panelH * 0.5 + 28);
    const width = Math.max(40, Math.floor(panelW - 12));
    const height = Math.max(40, Math.floor(panelH - 38));
    const tileKey = this.getMiniGameSkinKey(theme, 'tile');
    const panelKey = this.getMiniGameSkinKey(theme, 'panel');
    if (this.textures.exists(tileKey)) {
      const tileLayer = this.add.tileSprite(centerX, centerY + 8, width, height, tileKey)
        .setAlpha(0.34)
        .setScrollFactor(0);
      container.add(tileLayer);
    } else {
      const tile = theme.variant === 'city' ? 16 : theme.variant === 'cave' ? 18 : 20;
      const gfx = this.add.graphics().setScrollFactor(0);
      for (let y = 0; y < height; y += tile) {
        for (let x = 0; x < width; x += tile) {
          const even = ((x / tile) + (y / tile)) % 2 === 0;
          const color = even ? theme.tileA : theme.tileB;
          gfx.fillStyle(color, even ? 0.16 : 0.1);
          gfx.fillRect(left + x, top + y, tile - 1, tile - 1);
        }
      }
      gfx.lineStyle(1, theme.accent, 0.3);
      gfx.strokeRect(left + 2, top + 2, width - 4, height - 4);
      container.add(gfx);
    }
    if (this.textures.exists(panelKey)) {
      const panelLayer = this.add.image(centerX, centerY, panelKey)
        .setDisplaySize(panelW, panelH)
        .setAlpha(0.72)
        .setScrollFactor(0);
      container.add(panelLayer);
    }

    const markCount = this.lowPerfMode ? 2 : 3;
    for (let i = 0; i < markCount; i += 1) {
      const wm = this.add.text(
        centerX - panelW * 0.5 + 54 + i * 82,
        centerY + panelH * 0.5 - 36,
        theme.icon,
        {
          fontSize: this.worldFs(14, 12),
          color: this.toHexColor(theme.accent),
          fontFamily: this.getUIFontFamily(),
        }
      ).setAlpha(0.22).setScrollFactor(0).setOrigin(0.5);
      container.add(wm);
    }

    if (theme.protocolLevel > 0) {
      const protocolFrame = this.add.rectangle(centerX, centerY, panelW + 8, panelH + 8, theme.protocolColor, 0)
        .setStrokeStyle(2, theme.protocolColor, 0.68)
        .setScrollFactor(0);
      container.add(protocolFrame);
      this.tweens.add({
        targets: protocolFrame,
        alpha: { from: 0.45, to: 0.9 },
        scaleX: { from: 1, to: 1.01 },
        scaleY: { from: 1, to: 1.01 },
        duration: 780,
        yoyo: true,
        repeat: -1,
      });
      const protocolChip = this.add.text(centerX + panelW * 0.5 - 18, centerY - panelH * 0.5 + 10, `协议共鸣 ${theme.protocolLabel}`, {
        fontSize: this.worldFs(11, 10),
        color: this.toHexColor(theme.protocolColor),
        fontFamily: this.getUIFontFamily(),
        fontStyle: 'bold',
      }).setOrigin(1, 0).setScrollFactor(0);
      container.add(protocolChip);
    }
  }

  private getDayMiniGameTheme(actionType: ExplorationActionType): DayMiniGameTheme {
    const buildTheme = (
      variant: DayMiniGameTheme['variant'],
      accent: number,
      accentText: string,
      icon: string,
      subtitle: string,
      panelColor: number,
      overlayColor: number,
      overlayAlpha: number,
      arenaColor: number,
      tileA: number,
      tileB: number,
      safeCardColor: number,
      riskyCardColor: number,
      buttonColor: number,
      buttonTextColor: string
    ): DayMiniGameTheme => ({
      variant,
      accent,
      accentText,
      icon,
      subtitle,
      panelColor,
      overlayColor,
      overlayAlpha,
      arenaColor,
      tileA,
      tileB,
      safeCardColor,
      riskyCardColor,
      buttonColor,
      buttonTextColor,
      protocolLevel: 0,
      protocolLabel: '',
      protocolColor: accent,
    });

    let baseTheme: DayMiniGameTheme;
    if (actionType === 'fish' || actionType === 'swim') {
      baseTheme = buildTheme(
        'river',
        actionType === 'swim' ? 0x2563eb : 0x0ea5e9,
        actionType === 'swim' ? '#60a5fa' : '#38bdf8',
        actionType === 'swim' ? '◌' : '≋',
        actionType === 'swim' ? '河流训练' : '河流钓猎',
        0x0a1a2f,
        0x020812,
        0.72,
        0x0b1a2d,
        0x0c223c,
        0x112b47,
        0x10304b,
        0x2a1620,
        0x11304d,
        '#dbeafe'
      );
    } else if (actionType === 'hunt') {
      baseTheme = buildTheme(
        'forest',
        0x16a34a,
        '#4ade80',
        '△',
        '森林狩猎',
        0x0d2019,
        0x020b06,
        0.76,
        0x0f2018,
        0x183723,
        0x112f1d,
        0x1f3c2e,
        0x2a1620,
        0x163826,
        '#dcfce7'
      );
    } else if (actionType === 'scavenge') {
      baseTheme = buildTheme(
        'city',
        0xd97706,
        '#f59e0b',
        '▣',
        '城区搜刮',
        0x23180d,
        0x090705,
        0.78,
        0x1a1a1f,
        0x2b2419,
        0x1f1a12,
        0x293442,
        0x2a1620,
        0x2b2413,
        '#fef3c7'
      );
    } else {
      baseTheme = buildTheme(
        'cave',
        0x7c3aed,
        '#a78bfa',
        '◈',
        '洞穴突袭',
        0x1a1230,
        0x05030d,
        0.78,
        0x121026,
        0x261a3b,
        0x1c1530,
        0x26314a,
        0x2a1620,
        0x221a38,
        '#ede9fe'
      );
    }

    const protocolStyle = this.getProtocolMiniGameStyle();
    if (!protocolStyle) return baseTheme;

    const blend = Phaser.Math.Clamp(0.14 + protocolStyle.totalLevel * 0.028, 0.16, 0.46);
    const accent = this.blendColor(baseTheme.accent, protocolStyle.color, blend);
    return {
      ...baseTheme,
      accent,
      accentText: this.toHexColor(accent),
      panelColor: this.blendColor(baseTheme.panelColor, protocolStyle.color, blend * 0.52),
      arenaColor: this.blendColor(baseTheme.arenaColor, protocolStyle.color, blend * 0.38),
      tileA: this.blendColor(baseTheme.tileA, protocolStyle.color, blend * 0.32),
      tileB: this.blendColor(baseTheme.tileB, protocolStyle.color, blend * 0.26),
      safeCardColor: this.blendColor(baseTheme.safeCardColor, protocolStyle.color, blend * 0.36),
      buttonColor: this.blendColor(baseTheme.buttonColor, protocolStyle.color, blend * 0.44),
      protocolColor: protocolStyle.color,
      protocolLevel: protocolStyle.level,
      protocolLabel: `${protocolStyle.glyph} ${protocolStyle.label}`,
    };
  }

  private getDayMiniGameRounds(actionType: ExplorationActionType): number {
    if (actionType === 'fish' || actionType === 'swim') return 2;
    if (actionType === 'hunt' || actionType === 'scavenge') return 3;
    return 4;
  }

  private refreshDayMiniGameRoundDisplay(): void {
    if (this.daySpotMiniGameRoundText) {
      this.daySpotMiniGameRoundText.setText(
        `回合 ${this.daySpotMiniGameRound}/${this.daySpotMiniGameRoundsTotal} · 积分 ${this.daySpotMiniGameScore}/${this.daySpotMiniGameRoundsTotal * 2}`
      );
    }
    if (this.daySpotMiniGameActionLabel) {
      this.daySpotMiniGameActionLabel.setText(`锁定 [E] · ${this.daySpotMiniGameRound}/${this.daySpotMiniGameRoundsTotal}`);
    }
  }

  private getScavengeDurabilityDamageMultiplier(): number {
    if (this.scavengeDurabilityStacks <= 0) return 1;
    if (this.time.now >= this.scavengeDurabilityPenaltyUntil) return 1;
    return Math.max(0.68, 1 - this.scavengeDurabilityStacks * 0.08);
  }

  private applyScavengeDurabilityPenalty(stacks: number, fromTrap: boolean): void {
    const safeStacks = Phaser.Math.Clamp(Math.floor(stacks), 1, 3);
    this.scavengeDurabilityStacks = Phaser.Math.Clamp(this.scavengeDurabilityStacks + safeStacks, 0, 4);
    const extraMs = fromTrap ? 34000 : 26000;
    const nextUntil = this.time.now + extraMs + safeStacks * 2800;
    this.scavengeDurabilityPenaltyUntil = Math.max(this.scavengeDurabilityPenaltyUntil, nextUntil);
    this.scavengeDurabilityPenaltyStartAt = this.time.now;
    this.scavengeDurabilityPenaltyDurationMs = Math.max(1000, this.scavengeDurabilityPenaltyUntil - this.time.now);
    const reductionPercent = Math.round((1 - this.getScavengeDurabilityDamageMultiplier()) * 100);
    const remainSec = Math.max(1, Math.ceil((this.scavengeDurabilityPenaltyUntil - this.time.now) / 1000));
    this.showFloatingText(
      this.player.x,
      this.player.y - 108,
      `装备耐久受损 Lv.${this.scavengeDurabilityStacks} · 伤害-${reductionPercent}%(${remainSec}s)`,
      '#fb923c',
      false
    );
  }

  private updateScavengeDurabilityState(): void {
    if (this.scavengeDurabilityStacks <= 0) return;
    if (this.time.now < this.scavengeDurabilityPenaltyUntil) return;
    this.scavengeDurabilityStacks = 0;
    this.scavengeDurabilityPenaltyUntil = 0;
    this.scavengeDurabilityPenaltyStartAt = 0;
    this.scavengeDurabilityPenaltyDurationMs = 0;
    this.showFloatingText(this.player.x, this.player.y - 92, '装备耐久已恢复', '#22c55e', false);
  }

  private initializeDayMiniGameState(spot: ExplorationSpot): void {
    this.daySpotMiniGameMode = spot.actionType;
    this.daySpotMiniGameProfile = this.getDayMiniGameProfile(spot.actionType);
    this.daySpotMiniGameTargetCenter = Phaser.Math.FloatBetween(0.35, 0.65);
    this.daySpotMiniGameTargetDir = Math.random() < 0.5 ? -1 : 1;
    this.daySpotMiniGamePerfectRatio = this.daySpotMiniGameProfile.perfectRatio;
    this.daySpotMiniGameTrapCenter = this.daySpotMiniGameProfile.hasTrap
      ? Phaser.Math.FloatBetween(0.2, 0.8)
      : -1;
    this.daySpotMiniGameTrapWidth = this.daySpotMiniGameProfile.trapWidth;
    this.applyDayMiniGameRiskModifiers();
  }

  private applyDayMiniGameRiskModifiers(): void {
    const profile = this.daySpotMiniGameProfile;
    if (!profile) return;
    const risky = this.daySpotMiniGameRisk === 'risky';
    const widthMul = risky ? profile.riskyTargetWidthMul : 1;
    this.daySpotMiniGameTargetWidth = Phaser.Math.Clamp(profile.baseWidth * widthMul, 0.1, 0.42);
    this.daySpotMiniGameTrapWidth = profile.hasTrap
      ? Phaser.Math.Clamp(profile.trapWidth * (risky ? 1.2 : 1), 0.08, 0.28)
      : 0;
    this.refreshDayMiniGameZoneVisuals();
  }

  private refreshDayMiniGameZoneVisuals(): void {
    const cursor = this.daySpotMiniGameCursorVisual;
    if (!cursor) return;
    const minX = Number(cursor.getData('barMinX') || 0);
    const maxX = Number(cursor.getData('barMaxX') || 0);
    const barW = Math.max(1, maxX - minX);
    const barH = Number(cursor.getData('barH') || 26);
    const centerX = minX + barW * this.daySpotMiniGameTargetCenter;
    const targetW = Math.max(10, barW * this.daySpotMiniGameTargetWidth);
    const perfectW = Math.max(8, targetW * this.daySpotMiniGamePerfectRatio);

    if (this.daySpotMiniGameTargetVisual) {
      this.daySpotMiniGameTargetVisual.setSize(targetW, barH - 6);
      this.daySpotMiniGameTargetVisual.x = centerX;
    }
    if (this.daySpotMiniGamePerfectVisual) {
      this.daySpotMiniGamePerfectVisual.setSize(perfectW, barH - 6);
      this.daySpotMiniGamePerfectVisual.x = centerX;
    }
    if (this.daySpotMiniGameTrapVisual) {
      const hasTrap = this.daySpotMiniGameTrapCenter >= 0 && this.daySpotMiniGameTrapWidth > 0;
      this.daySpotMiniGameTrapVisual.setVisible(hasTrap);
      if (hasTrap) {
        this.daySpotMiniGameTrapVisual.setSize(Math.max(8, barW * this.daySpotMiniGameTrapWidth), barH - 8);
        this.daySpotMiniGameTrapVisual.x = minX + barW * this.daySpotMiniGameTrapCenter;
      }
      if (this.daySpotMiniGameTrapIcon) {
        this.daySpotMiniGameTrapIcon.setVisible(hasTrap);
        if (hasTrap) {
          this.daySpotMiniGameTrapIcon.x = this.daySpotMiniGameTrapVisual.x;
          this.daySpotMiniGameTrapIcon.y = this.daySpotMiniGameTrapVisual.y;
        }
      }
    }
  }

  private playMiniGameOutcomeTone(
    actionType: ExplorationActionType,
    quality: 'poor' | 'good' | 'perfect',
    inTrap: boolean
  ): void {
    try {
      const manager: any = this.sound;
      const ctx = manager?.context as AudioContext | undefined;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const t0 = ctx.currentTime + 0.005;
      const master = ctx.createGain();
      master.gain.value = this.mobileViewport ? 0.03 : 0.045;
      master.connect(ctx.destination);
      const variant = actionType === 'fish' || actionType === 'swim'
        ? 'river'
        : actionType === 'hunt'
          ? 'forest'
          : actionType === 'scavenge'
            ? 'city'
            : 'cave';
      const base = variant === 'river' ? 200 : variant === 'forest' ? 172 : variant === 'city' ? 210 : 156;
      const pulse = (semitone: number, start: number, duration: number, type: OscillatorType) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(base * Math.pow(2, semitone / 12), t0 + start);
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(master.gain.value, t0 + start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0 + start);
        osc.stop(t0 + start + duration);
      };
      if (inTrap || quality === 'poor') {
        pulse(-2, 0, 0.11, 'sawtooth');
        pulse(-7, 0.07, 0.14, 'square');
      } else if (quality === 'perfect') {
        pulse(0, 0, 0.1, 'triangle');
        pulse(4, 0.07, 0.12, 'sine');
        pulse(9, 0.14, 0.14, 'triangle');
      } else {
        pulse(0, 0, 0.1, 'triangle');
        pulse(3, 0.08, 0.11, 'sine');
      }
      this.time.delayedCall(440, () => master.disconnect());
    } catch {
      // Ignore audio failures (autoplay policy / unsupported context)
    }
  }

  private playMiniGameOutcomeVfx(
    actionType: ExplorationActionType,
    quality: 'poor' | 'good' | 'perfect',
    inTrap: boolean,
    x?: number,
    y?: number,
    subtle = false
  ): void {
    const variant = actionType === 'fish' || actionType === 'swim'
      ? 'river'
      : actionType === 'hunt'
        ? 'forest'
        : actionType === 'scavenge'
          ? 'city'
          : 'cave';
    const cx = x ?? this.player.x;
    const cy = y ?? (this.player.y - 8);
    const poor = inTrap || quality === 'poor';
    const multiplier = subtle ? 0.7 : 1;
    const count = Math.max(
      2,
      Math.round((this.ultraLowPerfMode ? 3 : this.lowPerfMode ? 6 : 10) * multiplier)
    );

    if (variant === 'river') {
      const color = poor ? 0x60a5fa : quality === 'perfect' ? 0x67e8f9 : 0x38bdf8;
      for (let i = 0; i < count; i += 1) {
        const ripple = this.add.circle(cx, cy, 8 + i * 1.4, color, poor ? 0.2 : 0.26).setDepth(1084);
        this.tweens.add({
          targets: ripple,
          scale: poor ? 1.34 : 1.7,
          alpha: 0,
          duration: 260 + i * 24,
          onComplete: () => ripple.destroy(),
        });
      }
    } else if (variant === 'forest') {
      const color = poor ? 0xef4444 : quality === 'perfect' ? 0x4ade80 : 0x22c55e;
      for (let i = 0; i < count; i += 1) {
        const leaf = this.add.rectangle(cx, cy, Phaser.Math.Between(3, 6), Phaser.Math.Between(8, 14), color, 0.88).setDepth(1084);
        leaf.angle = Phaser.Math.Between(-70, 70);
        this.tweens.add({
          targets: leaf,
          x: cx + Phaser.Math.Between(-48, 48),
          y: cy + Phaser.Math.Between(-56, 16),
          alpha: 0,
          duration: Phaser.Math.Between(220, 420),
          onComplete: () => leaf.destroy(),
        });
      }
    } else if (variant === 'city') {
      const color = poor ? 0xfb7185 : quality === 'perfect' ? 0xfbbf24 : 0xf59e0b;
      for (let i = 0; i < count; i += 1) {
        const shard = this.add.rectangle(cx, cy, Phaser.Math.Between(4, 9), Phaser.Math.Between(2, 4), color, 0.9).setDepth(1084);
        shard.angle = Phaser.Math.Between(-20, 20);
        this.tweens.add({
          targets: shard,
          x: cx + Phaser.Math.Between(-56, 56),
          y: cy + Phaser.Math.Between(-42, 34),
          alpha: 0,
          duration: Phaser.Math.Between(200, 360),
          onComplete: () => shard.destroy(),
        });
      }
    } else {
      const color = poor ? 0xf43f5e : quality === 'perfect' ? 0xc4b5fd : 0xa78bfa;
      const ring = this.add.circle(cx, cy, poor ? 14 : 18, color, 0).setDepth(1084).setStrokeStyle(2, color, 0.82);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ring,
        scale: poor ? 1.2 : 1.6,
        alpha: 0,
        duration: poor ? 200 : 320,
        onComplete: () => ring.destroy(),
      });
      for (let i = 0; i < Math.max(2, Math.floor(count * 0.7)); i += 1) {
        const shard = this.add.rectangle(cx, cy, 3, Phaser.Math.Between(8, 14), color, 0.88).setDepth(1085);
        shard.angle = Phaser.Math.Between(0, 360);
        this.tweens.add({
          targets: shard,
          x: cx + Phaser.Math.Between(-64, 64),
          y: cy + Phaser.Math.Between(-42, 42),
          alpha: 0,
          duration: Phaser.Math.Between(220, 460),
          onComplete: () => shard.destroy(),
        });
      }
    }

    if (!subtle && quality === 'perfect' && !poor) {
      this.cameras.main.flash(this.lowPerfMode ? 80 : 120, 76, 214, 198);
    } else if (!subtle && poor) {
      this.cameras.main.shake(this.lowPerfMode ? 80 : 120, this.lowPerfMode ? 0.0038 : 0.006);
    }
    this.playMiniGameOutcomeTone(actionType, quality, inTrap);
  }

  private playDayMiniGameResultFeedback(
    spot: ExplorationSpot,
    quality: 'poor' | 'good' | 'perfect',
    risky: boolean,
    inTrap: boolean
  ): void {
    const theme = this.getDayMiniGameTheme(spot.actionType);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const container = this.add.container(w * 0.5, h * 0.24).setDepth(3560).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, 360, 74, theme.panelColor, 0.92).setStrokeStyle(2, theme.accent, 0.95);
    const chip = this.add.rectangle(-140, 0, 58, 38, theme.accent, 0.28).setStrokeStyle(1, theme.accent, 1);
    const icon = this.add.text(-140, 0, theme.icon, {
      fontSize: '22px',
      color: theme.accentText,
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const qualityText = inTrap
      ? '陷阱触发'
      : quality === 'perfect' ? '完美锁定' : quality === 'good' ? '稳定锁定' : '锁定失误';
    const riskText = risky ? '冒险' : '稳妥';
    const title = this.add.text(-98, -11, `${spot.name} · ${qualityText}`, {
      fontSize: '19px',
      color: inTrap ? '#f87171' : quality === 'perfect' ? '#22c55e' : quality === 'good' ? '#38bdf8' : '#f59e0b',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const subtitle = this.add.text(-98, 14, `${theme.subtitle} · ${riskText}路线`, {
      fontSize: '13px',
      color: '#94a3b8',
      fontFamily: uiFont,
    }).setOrigin(0, 0.5);
    container.add([bg, chip, icon, title, subtitle]);
    container.setScale(0.86).setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      y: container.y - 8,
      duration: 220,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 34,
      delay: 820,
      duration: 280,
      onComplete: () => container.destroy(),
    });
    this.playMiniGameOutcomeVfx(spot.actionType, quality, inTrap, this.player.x, this.player.y - 6, false);
  }

  private playExplorationPenaltyTone(actionType: ExplorationActionType): void {
    try {
      const manager: any = this.sound;
      const ctx = manager?.context as AudioContext | undefined;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const t0 = ctx.currentTime + 0.005;
      const master = ctx.createGain();
      master.gain.value = this.mobileViewport ? 0.032 : 0.05;
      master.connect(ctx.destination);

      const pulse = (freq: number, start: number, duration: number, type: OscillatorType = 'square') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0 + start);
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(master.gain.value, t0 + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0 + start);
        osc.stop(t0 + start + duration);
      };

      if (actionType === 'fish' || actionType === 'swim') {
        pulse(320, 0, 0.12, 'sine');
        pulse(260, 0.08, 0.12, 'triangle');
      } else if (actionType === 'hunt') {
        pulse(190, 0, 0.1, 'sawtooth');
        pulse(145, 0.09, 0.12, 'square');
      } else if (actionType === 'scavenge') {
        pulse(420, 0, 0.06, 'square');
        pulse(240, 0.07, 0.11, 'triangle');
      } else {
        pulse(130, 0, 0.12, 'sawtooth');
        pulse(98, 0.08, 0.16, 'triangle');
      }

      this.time.delayedCall(460, () => master.disconnect());
    } catch {
      // Ignore audio failures (autoplay policy / unsupported context)
    }
  }

  private playExplorationFailureFeedback(
    actionType: ExplorationActionType,
    options?: { trapHit?: boolean; threatCount?: number; damageTaken?: number }
  ): void {
    const cx = this.player.x;
    const cy = this.player.y - 6;
    const maxParticles = this.ultraLowPerfMode ? 5 : this.lowPerfMode ? 8 : 12;
    if (actionType === 'fish' || actionType === 'swim') {
      for (let i = 0; i < maxParticles; i += 1) {
        const ripple = this.add.circle(cx, cy, 8 + i * 1.1, 0x38bdf8, 0.26).setDepth(1082);
        this.tweens.add({
          targets: ripple,
          scale: 1.8 + i * 0.05,
          alpha: 0,
          duration: 340 + i * 18,
          onComplete: () => ripple.destroy(),
        });
      }
      this.showFloatingText(cx, cy - 42, '河流失手：仅低收益', '#60a5fa', false);
    } else if (actionType === 'hunt') {
      const dmg = Math.max(0, Math.floor(options?.damageTaken || 0));
      const slashCount = Math.max(3, maxParticles - 2);
      for (let i = 0; i < slashCount; i += 1) {
        const slash = this.add.rectangle(
          cx + Phaser.Math.Between(-16, 16),
          cy + Phaser.Math.Between(-10, 10),
          Phaser.Math.Between(3, 6),
          Phaser.Math.Between(14, 24),
          0xef4444,
          0.88
        ).setDepth(1083);
        slash.angle = Phaser.Math.Between(-40, 40);
        this.tweens.add({
          targets: slash,
          y: slash.y - Phaser.Math.Between(10, 24),
          alpha: 0,
          duration: Phaser.Math.Between(220, 420),
          onComplete: () => slash.destroy(),
        });
      }
      this.showFloatingText(cx, cy - 48, `森林反噬：受伤-${dmg}`, '#ef4444', false);
      this.cameras.main.shake(this.lowPerfMode ? 90 : 140, this.lowPerfMode ? 0.0042 : 0.0068);
    } else if (actionType === 'scavenge') {
      const trapHit = !!options?.trapHit;
      const sparkColor = trapHit ? 0xef4444 : 0xf59e0b;
      for (let i = 0; i < maxParticles; i += 1) {
        const spark = this.add.rectangle(
          cx + Phaser.Math.Between(-14, 14),
          cy + Phaser.Math.Between(-14, 8),
          Phaser.Math.Between(3, 6),
          Phaser.Math.Between(3, 8),
          sparkColor,
          0.95
        ).setDepth(1083);
        this.tweens.add({
          targets: spark,
          x: spark.x + Phaser.Math.Between(-48, 48),
          y: spark.y - Phaser.Math.Between(16, 54),
          alpha: 0,
          angle: Phaser.Math.Between(-140, 140),
          duration: Phaser.Math.Between(220, 460),
          onComplete: () => spark.destroy(),
        });
      }
      this.cameras.main.flash(this.lowPerfMode ? 80 : 120, 245, 158, 11);
      this.showFloatingText(cx, cy - 48, trapHit ? '城区陷阱：重度耐久磨损' : '城区事故：耐久磨损', '#f59e0b', false);
    } else {
      const threatCount = Math.max(1, Math.floor(options?.threatCount || 1));
      const wave = this.add.circle(cx, cy, 22, 0xa78bfa, 0.24).setDepth(1082);
      this.tweens.add({
        targets: wave,
        scale: 2.3,
        alpha: 0,
        duration: 420,
        onComplete: () => wave.destroy(),
      });
      for (let i = 0; i < maxParticles; i += 1) {
        const shard = this.add.rectangle(
          cx + Phaser.Math.Between(-18, 18),
          cy + Phaser.Math.Between(-12, 12),
          Phaser.Math.Between(3, 5),
          Phaser.Math.Between(6, 12),
          0x8b5cf6,
          0.88
        ).setDepth(1083);
        shard.angle = Phaser.Math.Between(0, 360);
        this.tweens.add({
          targets: shard,
          x: shard.x + Phaser.Math.Between(-64, 64),
          y: shard.y + Phaser.Math.Between(-36, 32),
          alpha: 0,
          duration: Phaser.Math.Between(260, 520),
          onComplete: () => shard.destroy(),
        });
      }
      this.showFloatingText(cx, cy - 50, `洞穴警报：围攻 +${threatCount}敌`, '#a78bfa', false);
      this.cameras.main.shake(this.lowPerfMode ? 110 : 160, this.lowPerfMode ? 0.0045 : 0.007);
    }
    this.playExplorationPenaltyTone(actionType);
  }

  private openDayExplorationMiniGame(spot: ExplorationSpot): void {
    if (this.daySpotMiniGameOpen || this.runEventOpen || this.dayChallengeSelectionOpen || this.isGameOver) return;
    this.daySpotMiniGameOpen = true;
    this.daySpotMiniGameSpot = spot;
    this.daySpotMiniGameRisk = 'safe';
    this.daySpotMiniGameCursor = 0.5;
    this.daySpotMiniGameCursorDir = Math.random() < 0.5 ? -1 : 1;
    if (spot.actionType === 'hunt') {
      this.daySpotMiniGameRound = 1;
      this.daySpotMiniGameRoundsTotal = this.getDayMiniGameRounds(spot.actionType);
      this.daySpotMiniGameScore = 0;
      this.daySpotMiniGameTrapHits = 0;
      this.daySpotMiniGameMode = 'hunt';
      this.daySpotMiniGameProfile = this.getDayMiniGameProfile(spot.actionType);
      this.daySpotMiniGameContainer?.destroy();
      this.daySpotMiniGameContainer = null;
      this.setUISceneInputEnabled(false);
      this.playerSystem?.setMovementEnabled(false);
      this.openForestHuntMiniGame(spot);
      return;
    }
    if (spot.actionType === 'scavenge') {
      this.daySpotMiniGameRound = 1;
      this.daySpotMiniGameRoundsTotal = 1;
      this.daySpotMiniGameScore = 0;
      this.daySpotMiniGameTrapHits = 0;
      this.daySpotMiniGameMode = 'scavenge';
      this.daySpotMiniGameProfile = this.getDayMiniGameProfile(spot.actionType);
      this.daySpotMiniGameContainer?.destroy();
      this.daySpotMiniGameContainer = null;
      this.setUISceneInputEnabled(false);
      this.playerSystem?.setMovementEnabled(false);
      this.openCityScavengeMiniGame(spot);
      return;
    }
    if (spot.actionType === 'cave_explore') {
      this.daySpotMiniGameRound = 1;
      this.daySpotMiniGameRoundsTotal = 1;
      this.daySpotMiniGameScore = 0;
      this.daySpotMiniGameTrapHits = 0;
      this.daySpotMiniGameMode = 'cave_explore';
      this.daySpotMiniGameProfile = this.getDayMiniGameProfile(spot.actionType);
      this.daySpotMiniGameContainer?.destroy();
      this.daySpotMiniGameContainer = null;
      this.setUISceneInputEnabled(false);
      this.playerSystem?.setMovementEnabled(false);
      this.openCaveRaidMiniGame(spot);
      return;
    }
    this.daySpotMiniGameRound = 1;
    this.daySpotMiniGameRoundsTotal = this.getDayMiniGameRounds(spot.actionType);
    this.daySpotMiniGameScore = 0;
    this.daySpotMiniGameTrapHits = 0;
    this.daySpotMiniGameRoundText = null;
    this.daySpotMiniGameStageText = null;
    this.daySpotMiniGameActionLabel = null;
    this.initializeDayMiniGameState(spot);
    this.setUISceneInputEnabled(false);
    this.playerSystem?.setMovementEnabled(false);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const theme = this.getDayMiniGameTheme(spot.actionType);
    const container = this.add.container(0, 0).setDepth(3450).setScrollFactor(0);
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, theme.overlayColor, theme.overlayAlpha).setScrollFactor(0);
    container.add(overlay);
    const panelW = Math.min(700, w - 64);
    const panelH = Math.min(370, h - 96);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, theme.panelColor, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, theme.accent, 0.9);
    container.add(panel);
    this.createMiniGamePanelDecor(container, w / 2, h / 2, panelW, panelH, theme);
    this.addMiniGameThemeIcon(container, w / 2 - panelW / 2 + 28, h / 2 - panelH / 2 + 26, theme, 20);
    const topBand = this.add.rectangle(w / 2, h / 2 - panelH / 2 + 12, panelW - 12, 16, theme.accent, 0.15).setScrollFactor(0);
    const topBandEdge = this.add.rectangle(w / 2, h / 2 - panelH / 2 + 21, panelW - 20, 1, theme.accent, 0.5).setScrollFactor(0);
    container.add([topBand, topBandEdge]);

    const usage = this.getActivityUsage(spot.actionType);
    const limit = this.getActivityUsageLimit(spot.actionType);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 20, `${theme.icon} 白天探索小游戏 · ${spot.name}`, {
      fontSize: this.worldFs(23, 20),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 54, `按 [E] 或点“锁定”完成本回合 · 今日 ${usage}/${limit}`, {
      fontSize: this.worldFs(14, 13),
      color: '#94a3b8',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));
    if (theme.protocolLevel > 0) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 70, `协议联动：${theme.protocolLabel}`, {
        fontSize: this.worldFs(12, 11),
        color: this.toHexColor(theme.protocolColor),
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }
    const profile = this.daySpotMiniGameProfile || this.getDayMiniGameProfile(spot.actionType);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + (theme.protocolLevel > 0 ? 92 : 78), `${profile.title}：${profile.hint}`, {
      fontSize: this.worldFs(14, 13),
      color: theme.accentText,
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));
    const bonus = this.getActiveDaySpotBonus(spot.id);
    if (bonus) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 102, `生活热点：${bonus.label} · ${bonus.summary}`, {
        fontSize: this.worldFs(14, 13),
        color: bonus.color,
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }
    this.daySpotMiniGameRoundText = this.add.text(w / 2, h / 2 - panelH / 2 + 124, '', {
      fontSize: this.worldFs(13, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.daySpotMiniGameStageText = this.add.text(w / 2, h / 2 + 88, '', {
      fontSize: this.worldFs(13, 12),
      color: '#93c5fd',
      fontFamily: uiFont,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add([this.daySpotMiniGameRoundText, this.daySpotMiniGameStageText]);

    const safeCard = this.add.rectangle(w / 2 - 128, h / 2 - 24, 220, 84, theme.safeCardColor, 0.92)
      .setStrokeStyle(2, 0x38bdf8, 0.95)
      .setInteractive({ useHandCursor: true });
    const riskyCard = this.add.rectangle(w / 2 + 128, h / 2 - 24, 220, 84, theme.riskyCardColor, 0.88)
      .setStrokeStyle(2, 0xfb7185, 0.7)
      .setInteractive({ useHandCursor: true });
    const safeText = this.add.text(w / 2 - 128, h / 2 - 24, '稳妥模式\n收益中等 · 风险低', {
      fontSize: this.worldFs(14, 12),
      color: '#bae6fd',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);
    const riskyText = this.add.text(w / 2 + 128, h / 2 - 24, '冒险模式\n收益更高 · 风险更高', {
      fontSize: this.worldFs(14, 12),
      color: '#fecdd3',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);
    container.add([safeCard, riskyCard, safeText, riskyText]);
    this.addMiniGameRectSkin(container, safeCard, theme, 'safe', 0.9);
    this.addMiniGameRectSkin(container, riskyCard, theme, 'risky', 0.9);

    const refreshRiskVisual = () => {
      const safeSelected = this.daySpotMiniGameRisk === 'safe';
      safeCard.setStrokeStyle(2, theme.accent, safeSelected ? 1 : 0.6);
      riskyCard.setStrokeStyle(2, 0xfb7185, safeSelected ? 0.7 : 1);
      safeCard.setFillStyle(theme.safeCardColor, safeSelected ? 0.96 : 0.84);
      riskyCard.setFillStyle(theme.riskyCardColor, safeSelected ? 0.82 : 0.96);
    };
    safeCard.on('pointerdown', () => {
      if (!this.daySpotMiniGameOpen) return;
      this.daySpotMiniGameRisk = 'safe';
      refreshRiskVisual();
      this.applyDayMiniGameRiskModifiers();
    });
    riskyCard.on('pointerdown', () => {
      if (!this.daySpotMiniGameOpen) return;
      this.daySpotMiniGameRisk = 'risky';
      refreshRiskVisual();
      this.applyDayMiniGameRiskModifiers();
    });
    refreshRiskVisual();

    const barW = Math.min(520, panelW - 80);
    const barH = 26;
    const barX = w / 2 - barW / 2;
    const barY = h / 2 + 54;
    const barBg = this.add.rectangle(w / 2, barY, barW, barH, theme.arenaColor, 0.92).setStrokeStyle(2, theme.accent, 0.44);
    const targetZone = this.add.rectangle(w / 2, barY, barW * this.daySpotMiniGameTargetWidth, barH - 6, profile.targetColor, 0.72);
    const perfectZone = this.add.rectangle(w / 2, barY, barW * this.daySpotMiniGameTargetWidth * this.daySpotMiniGamePerfectRatio, barH - 6, profile.perfectColor, 0.95);
    const trapZone = this.add.rectangle(w / 2, barY, barW * this.daySpotMiniGameTrapWidth, barH - 8, profile.trapColor, 0.74);
    trapZone.setVisible(!!profile.hasTrap);
    const cursor = this.add.rectangle(barX + barW * this.daySpotMiniGameCursor, barY, 8, barH + 8, 0xf8fafc, 1);
    cursor.setStrokeStyle(1, theme.accent, 0.95);
    cursor.setData('barMinX', barX);
    cursor.setData('barMaxX', barX + barW);
    cursor.setData('barH', barH);
    this.daySpotMiniGameCursorVisual = cursor;
    this.daySpotMiniGameTargetVisual = targetZone;
    this.daySpotMiniGamePerfectVisual = perfectZone;
    this.daySpotMiniGameTrapVisual = trapZone;
    container.add([barBg, targetZone, perfectZone, trapZone, cursor]);
    this.addMiniGameRectSkin(container, barBg, theme, 'bar', 0.86);
    this.daySpotMiniGameTrapIcon = this.addMiniGameObjectIcon(container, trapZone.x, trapZone.y, theme, 'trap', 15, 0.9);
    this.refreshDayMiniGameZoneVisuals();

    const actionBtn = this.add.rectangle(w / 2, h / 2 + 122, 220, 52, theme.buttonColor, 0.95)
      .setStrokeStyle(2, theme.accent, 0.92)
      .setInteractive({ useHandCursor: true });
    const actionLabel = this.add.text(w / 2, h / 2 + 122, '锁定 [E]', {
      fontSize: this.worldFs(18, 16),
      color: theme.buttonTextColor,
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.daySpotMiniGameActionLabel = actionLabel;
    actionBtn.on('pointerdown', () => this.resolveDayExplorationMiniGame());
    container.add([actionBtn, actionLabel]);
    const actionBtnSkin = this.addMiniGameRectSkin(container, actionBtn, theme, 'button', 0.92);
    this.bindMiniGameButtonInteraction(actionBtn, actionBtnSkin, theme, actionLabel);

    const closeBtn = this.add.text(w / 2 + panelW / 2 - 20, h / 2 - panelH / 2 + 14, '✕', {
      fontSize: this.worldFs(20, 18),
      color: '#f87171',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeDayExplorationMiniGame());
    container.add(closeBtn);
    this.refreshDayMiniGameRoundDisplay();
  }

  private openForestHuntMiniGame(spot: ExplorationSpot): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const theme = this.getDayMiniGameTheme('hunt');
    const container = this.add.container(0, 0).setDepth(3450).setScrollFactor(0);
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, theme.overlayColor, theme.overlayAlpha).setScrollFactor(0);
    container.add(overlay);
    const panelW = Math.min(760, w - 50);
    const panelH = Math.min(452, h - 56);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, theme.panelColor, 0.97)
      .setScrollFactor(0)
      .setStrokeStyle(2, theme.accent, 0.92);
    container.add(panel);
    this.createMiniGamePanelDecor(container, w / 2, h / 2, panelW, panelH, theme);
    this.addMiniGameThemeIcon(container, w / 2 - panelW / 2 + 28, h / 2 - panelH / 2 + 28, theme, 20);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 16, `${theme.icon} 森林追踪狩猎 · ${spot.name}`, {
      fontSize: this.worldFs(24, 20),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 48, '潜行追踪猎迹，抓住爆发窗口完成致命一击', {
      fontSize: this.worldFs(14, 13),
      color: '#94a3b8',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));
    if (theme.protocolLevel > 0) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 66, `协议联动：${theme.protocolLabel}`, {
        fontSize: this.worldFs(12, 11),
        color: this.toHexColor(theme.protocolColor),
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }

    this.daySpotMiniGameRoundText = this.add.text(w / 2, h / 2 - panelH / 2 + (theme.protocolLevel > 0 ? 88 : 72), '', {
      fontSize: this.worldFs(13, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    container.add(this.daySpotMiniGameRoundText);

    const safeCard = this.add.rectangle(w / 2 - 142, h / 2 - panelH / 2 + 116, 230, 64, theme.safeCardColor, 0.94)
      .setStrokeStyle(2, 0x4ade80, 0.92)
      .setInteractive({ useHandCursor: true });
    const riskyCard = this.add.rectangle(w / 2 + 142, h / 2 - panelH / 2 + 116, 230, 64, theme.riskyCardColor, 0.9)
      .setStrokeStyle(2, 0xfb7185, 0.76)
      .setInteractive({ useHandCursor: true });
    const safeText = this.add.text(w / 2 - 142, h / 2 - panelH / 2 + 116, '稳妥潜行\n视野更松 · 爆发窗口更长', {
      fontSize: this.worldFs(13, 12),
      color: '#bbf7d0',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    const riskyText = this.add.text(w / 2 + 142, h / 2 - panelH / 2 + 116, '冒险猎杀\n视野更严 · 收益更高', {
      fontSize: this.worldFs(13, 12),
      color: '#fecdd3',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    container.add([safeCard, riskyCard, safeText, riskyText]);
    this.addMiniGameRectSkin(container, safeCard, theme, 'safe', 0.9);
    this.addMiniGameRectSkin(container, riskyCard, theme, 'risky', 0.9);

    const arenaW = Math.min(panelW - 60, 700);
    const arenaH = Math.min(198, panelH - 220);
    const arenaX = w / 2 - arenaW / 2;
    const arenaY = h / 2 - 24;
    const arenaBg = this.add.rectangle(w / 2, arenaY + arenaH / 2, arenaW, arenaH, theme.arenaColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.42);
    const groundY = arenaY + arenaH - 14;
    const ground = this.add.rectangle(w / 2, groundY, arenaW - 12, 6, 0x475569, 1);
    const bushL = this.add.rectangle(arenaX + 70, groundY - 10, 32, 12, 0x14532d, 0.8).setStrokeStyle(1, 0x22c55e, 0.6);
    const bushR = this.add.rectangle(arenaX + arenaW - 76, groundY - 10, 38, 12, 0x14532d, 0.8).setStrokeStyle(1, 0x22c55e, 0.6);
    container.add([arenaBg, ground, bushL, bushR]);
    this.addMiniGameRectSkin(container, arenaBg, theme, 'tile', 0.26);

    this.forestHuntArena = new Phaser.Geom.Rectangle(arenaX + 8, arenaY + 10, arenaW - 16, arenaH - 20);
    this.forestHuntGroundY = groundY;
    this.forestHuntPlayerSprite = this.add.rectangle(
      this.forestHuntArena.x + 24,
      this.forestHuntGroundY - 13,
      16,
      26,
      0x93c5fd,
      0.04
    ).setStrokeStyle(1, 0xe2e8f0, 0.95);
    this.forestHuntPreySprite = this.add.rectangle(
      this.forestHuntArena.right - 36,
      this.forestHuntGroundY - 12,
      18,
      24,
      0x7f1d1d,
      0.04
    ).setStrokeStyle(1, 0xfca5a5, 0.9);
    this.forestHuntSightVisual = this.add.rectangle(
      this.forestHuntPreySprite.x - 42,
      this.forestHuntGroundY - 17,
      148,
      46,
      0xf97316,
      0.08
    ).setStrokeStyle(1, 0xfb7185, 0.65);
    container.add([this.forestHuntSightVisual, this.forestHuntPreySprite, this.forestHuntPlayerSprite]);
    this.forestHuntPlayerIcon = this.addMiniGameObjectIcon(
      container,
      this.forestHuntPlayerSprite.x,
      this.forestHuntPlayerSprite.y,
      theme,
      'player',
      22,
      0.95
    );
    this.forestHuntPreyIcon = this.addMiniGameObjectIcon(
      container,
      this.forestHuntPreySprite.x,
      this.forestHuntPreySprite.y,
      theme,
      'enemy',
      23,
      0.95
    );
    this.forestHuntHintIcon = this.addMiniGameObjectIcon(
      container,
      this.forestHuntSightVisual.x,
      this.forestHuntSightVisual.y - 18,
      theme,
      'hint',
      18,
      0.85
    );

    const barW = Math.min(arenaW - 44, 560);
    const barH = 20;
    const barX = w / 2 - barW / 2;
    const barY = arenaY + arenaH + 12;
    const barBg = this.add.rectangle(w / 2, barY, barW, barH, theme.arenaColor, 0.92).setStrokeStyle(2, theme.accent, 0.45);
    const targetZone = this.add.rectangle(w / 2, barY, barW * 0.22, barH - 4, 0x16a34a, 0.72);
    const perfectZone = this.add.rectangle(w / 2, barY, barW * 0.22 * 0.42, barH - 4, 0x22c55e, 0.95);
    const cursor = this.add.rectangle(barX + barW * 0.5, barY, 8, barH + 6, 0xf8fafc, 1);
    cursor.setStrokeStyle(1, 0x4ade80, 0.95);
    cursor.setData('barMinX', barX);
    cursor.setData('barMaxX', barX + barW);
    cursor.setData('barH', barH);
    this.daySpotMiniGameCursorVisual = cursor;
    this.daySpotMiniGameTargetVisual = targetZone;
    this.daySpotMiniGamePerfectVisual = perfectZone;
    this.daySpotMiniGameTrapVisual = null;
    container.add([barBg, targetZone, perfectZone, cursor]);
    this.addMiniGameRectSkin(container, barBg, theme, 'bar', 0.86);

    this.forestHuntStatusText = this.add.text(arenaX + 8, barY + 18, '', {
      fontSize: this.worldFs(13, 12),
      color: '#cbd5e1',
      fontFamily: uiFont,
    });
    this.forestHuntPhaseText = this.add.text(arenaX + 8, arenaY - 18, '', {
      fontSize: this.worldFs(14, 12),
      color: '#bbf7d0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    });
    this.forestHuntAlertText = this.add.text(arenaX + arenaW - 8, arenaY - 18, '', {
      fontSize: this.worldFs(14, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.forestHuntActionHintText = this.add.text(w / 2, barY + 62, '', {
      fontSize: this.worldFs(12, 11),
      color: '#67e8f9',
      fontFamily: uiFont,
      align: 'center',
    }).setOrigin(0.5);
    this.daySpotMiniGameStageText = this.add.text(w / 2, barY + 42, '', {
      fontSize: this.worldFs(13, 12),
      color: '#93c5fd',
      fontFamily: uiFont,
      align: 'center',
    }).setOrigin(0.5);
    container.add([
      this.forestHuntStatusText,
      this.forestHuntPhaseText,
      this.forestHuntAlertText,
      this.daySpotMiniGameStageText,
      this.forestHuntActionHintText,
    ]);

    const actionBtn = this.add.rectangle(w / 2, h / 2 + panelH / 2 - 30, 278, 44, theme.buttonColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    this.daySpotMiniGameActionLabel = this.add.text(w / 2, h / 2 + panelH / 2 - 30, '屏息 [E]', {
      fontSize: this.worldFs(17, 15),
      color: theme.buttonTextColor,
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    actionBtn.on('pointerdown', () => this.triggerForestHuntAction());
    container.add([actionBtn, this.daySpotMiniGameActionLabel]);
    const actionBtnSkin = this.addMiniGameRectSkin(container, actionBtn, theme, 'button', 0.92);
    this.bindMiniGameButtonInteraction(actionBtn, actionBtnSkin, theme, this.daySpotMiniGameActionLabel);

    const closeBtn = this.add.text(w / 2 + panelW / 2 - 18, h / 2 - panelH / 2 + 12, '✕', {
      fontSize: this.worldFs(20, 18),
      color: '#f87171',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.resolveForestHuntMiniGame('poor', true));
    container.add(closeBtn);

    const refreshRiskVisual = () => {
      const safeSelected = this.daySpotMiniGameRisk === 'safe';
      safeCard.setStrokeStyle(2, 0x4ade80, safeSelected ? 1 : 0.62);
      riskyCard.setStrokeStyle(2, 0xfb7185, safeSelected ? 0.68 : 1);
      safeCard.setFillStyle(theme.safeCardColor, safeSelected ? 0.97 : 0.84);
      riskyCard.setFillStyle(theme.riskyCardColor, safeSelected ? 0.82 : 0.96);
    };
    safeCard.on('pointerdown', () => {
      if (!this.forestHuntMiniGameActive) return;
      this.daySpotMiniGameRisk = 'safe';
      this.applyForestHuntRiskPreset();
      refreshRiskVisual();
    });
    riskyCard.on('pointerdown', () => {
      if (!this.forestHuntMiniGameActive) return;
      this.daySpotMiniGameRisk = 'risky';
      this.applyForestHuntRiskPreset();
      refreshRiskVisual();
    });

    this.forestHuntMiniGameActive = true;
    this.forestHuntResultResolved = false;
    this.forestHuntPhase = 'stealth';
    this.forestHuntPhaseElapsedMs = 0;
    this.forestHuntRoundStealthSuccess = false;
    this.forestHuntAlertMeter = 0;
    this.forestHuntDetections = 0;
    this.forestHuntBreathCooldownUntil = 0;
    this.forestHuntMobileMoveX = 0;
    this.forestHuntBurstCursor = 0.5;
    this.forestHuntBurstCursorDir = Math.random() < 0.5 ? -1 : 1;
    this.forestHuntBurstTargetCenter = 0.5;
    this.forestHuntBurstTargetDir = Math.random() < 0.5 ? -1 : 1;
    this.applyForestHuntRiskPreset();
    refreshRiskVisual();
    this.startForestHuntRound();
  }

  private applyForestHuntRiskPreset(): void {
    const risky = this.daySpotMiniGameRisk === 'risky';
    if (risky) {
      this.forestHuntStealthDurationMs = 4300;
      this.forestHuntBurstDurationMs = 1900;
      this.forestHuntPlayerSpeed = 0.286;
      this.forestHuntPreyVx = 0.094;
      this.forestHuntBurstCursorSpeed = 0.00128;
      this.forestHuntBurstTargetSpeed = 0.00066;
      this.forestHuntBurstTargetWidth = 0.18;
      this.forestHuntBurstPerfectRatio = 0.34;
    } else {
      this.forestHuntStealthDurationMs = 5200;
      this.forestHuntBurstDurationMs = 2400;
      this.forestHuntPlayerSpeed = 0.25;
      this.forestHuntPreyVx = 0.082;
      this.forestHuntBurstCursorSpeed = 0.00106;
      this.forestHuntBurstTargetSpeed = 0.00052;
      this.forestHuntBurstTargetWidth = 0.22;
      this.forestHuntBurstPerfectRatio = 0.42;
    }
    this.refreshForestHuntBurstVisuals();
  }

  private refreshForestHuntBurstVisuals(): void {
    const cursor = this.daySpotMiniGameCursorVisual;
    const target = this.daySpotMiniGameTargetVisual;
    const perfect = this.daySpotMiniGamePerfectVisual;
    if (!cursor || !target || !perfect) return;
    const barMinX = Number(cursor.getData('barMinX') || 0);
    const barMaxX = Number(cursor.getData('barMaxX') || 0);
    const barW = Math.max(1, barMaxX - barMinX);
    const burstMode = this.forestHuntPhase === 'burst';

    target.width = barW * this.forestHuntBurstTargetWidth;
    target.x = barMinX + barW * this.forestHuntBurstTargetCenter;
    perfect.width = target.width * this.forestHuntBurstPerfectRatio;
    perfect.x = target.x;
    cursor.x = barMinX + barW * this.forestHuntBurstCursor;

    cursor.setVisible(burstMode);
    target.setVisible(burstMode);
    perfect.setVisible(burstMode);
  }

  private startForestHuntRound(): void {
    if (!this.forestHuntMiniGameActive || !this.forestHuntArena) return;
    this.forestHuntPhase = 'stealth';
    this.forestHuntPhaseElapsedMs = 0;
    this.forestHuntRoundStealthSuccess = false;
    this.forestHuntAlertMeter = Math.max(0, this.forestHuntAlertMeter - 28);
    this.forestHuntBurstCursor = Phaser.Math.FloatBetween(0.08, 0.92);
    this.forestHuntBurstCursorDir = Math.random() < 0.5 ? -1 : 1;
    this.forestHuntBurstTargetCenter = Phaser.Math.FloatBetween(0.3, 0.7);
    this.forestHuntBurstTargetDir = Math.random() < 0.5 ? -1 : 1;
    this.spawnForestHuntClue();
    this.refreshDayMiniGameRoundDisplay();
    if (this.daySpotMiniGameStageText) {
      this.daySpotMiniGameStageText.setText('潜行阶段：靠近猎迹，避免在视野锥内移动').setColor('#86efac');
    }
    if (this.forestHuntActionHintText) {
      this.forestHuntActionHintText.setText('左右移动追踪 · [E] 屏息可压低警觉').setColor('#67e8f9');
    }
    if (this.forestHuntStatusText) {
      this.forestHuntStatusText.setText('追踪猎迹中…').setColor('#cbd5e1');
    }
    this.refreshForestHuntBurstVisuals();
  }

  private spawnForestHuntClue(): void {
    if (!this.daySpotMiniGameContainer || !this.forestHuntArena) return;
    if (this.forestHuntClue) {
      this.forestHuntClue.sprite.destroy();
      this.forestHuntClue.pulse.destroy();
      this.forestHuntClue = null;
    }
    const x = Phaser.Math.Between(
      Math.floor(this.forestHuntArena.x + 24),
      Math.floor(this.forestHuntArena.right - 24)
    );
    const y = this.forestHuntGroundY - Phaser.Math.Between(18, 44);
    const theme = this.getDayMiniGameTheme('hunt');
    const sprite = this.add.image(x, y, this.getMiniGameObjectAtlasKey(theme), 'loot').setDisplaySize(16, 16).setAlpha(0.95);
    const pulse = this.add.ellipse(x, y, 24, 16, 0x22c55e, 0.22).setStrokeStyle(1, 0x4ade80, 0.5);
    this.daySpotMiniGameContainer.add([pulse, sprite]);
    this.forestHuntClue = { sprite, pulse };
  }

  private enterForestHuntBurst(stealthSuccess: boolean, reason: string): void {
    if (!this.forestHuntMiniGameActive) return;
    this.forestHuntPhase = 'burst';
    this.forestHuntPhaseElapsedMs = 0;
    this.forestHuntRoundStealthSuccess = stealthSuccess;
    if (this.forestHuntClue) {
      this.forestHuntClue.sprite.destroy();
      this.forestHuntClue.pulse.destroy();
      this.forestHuntClue = null;
    }
    if (this.forestHuntStatusText) {
      this.forestHuntStatusText.setText(reason).setColor(stealthSuccess ? '#4ade80' : '#f59e0b');
    }
    if (this.daySpotMiniGameStageText) {
      this.daySpotMiniGameStageText.setText('爆发阶段：在绿色窗口按 [E/Space] 开火').setColor('#a7f3d0');
    }
    if (this.forestHuntActionHintText) {
      this.forestHuntActionHintText.setText('锁定目标后立刻开火，拖延会自动失手').setColor('#fbbf24');
    }
    this.refreshForestHuntBurstVisuals();
  }

  private triggerForestHuntAction(): void {
    if (!this.forestHuntMiniGameActive) return;
    if (this.forestHuntPhase === 'burst') {
      this.resolveForestHuntBurstShot(false);
      return;
    }
    const now = this.time.now;
    if (now < this.forestHuntBreathCooldownUntil) return;
    this.forestHuntBreathCooldownUntil = now + 900;
    this.forestHuntAlertMeter = Math.max(0, this.forestHuntAlertMeter - 20);
    if (this.daySpotMiniGameStageText) {
      this.daySpotMiniGameStageText.setText('屏息成功：警觉下降').setColor('#67e8f9');
    }
  }

  private resolveForestHuntBurstShot(autoMiss: boolean): void {
    if (!this.forestHuntMiniGameActive || this.forestHuntPhase !== 'burst') return;
    const targetDist = Math.abs(this.forestHuntBurstCursor - this.forestHuntBurstTargetCenter);
    const targetHalf = this.forestHuntBurstTargetWidth * 0.5;
    const perfectHalf = targetHalf * this.forestHuntBurstPerfectRatio;
    let shotQuality: 'poor' | 'good' | 'perfect' = autoMiss
      ? 'poor'
      : targetDist <= perfectHalf
        ? 'perfect'
        : targetDist <= targetHalf
          ? 'good'
          : 'poor';
    if (!this.forestHuntRoundStealthSuccess) {
      shotQuality = shotQuality === 'perfect' ? 'good' : 'poor';
    }
    const roundPoints = shotQuality === 'perfect' ? 2 : shotQuality === 'good' ? 1 : 0;
    this.daySpotMiniGameScore += roundPoints;
    if (shotQuality === 'poor' || !this.forestHuntRoundStealthSuccess) {
      this.daySpotMiniGameTrapHits += 1;
    }
    if (this.daySpotMiniGameStageText) {
      const shotText = shotQuality === 'perfect' ? '爆发命中：完美 +2' : shotQuality === 'good' ? '爆发命中：良好 +1' : '爆发失手 +0';
      this.daySpotMiniGameStageText.setText(shotText).setColor(
        shotQuality === 'perfect' ? '#4ade80' : shotQuality === 'good' ? '#38bdf8' : '#f87171'
      );
    }
    this.playMiniGameOutcomeVfx(
      'hunt',
      shotQuality,
      shotQuality === 'poor',
      this.forestHuntPreySprite?.x ?? this.player.x,
      this.forestHuntPreySprite?.y ?? (this.player.y - 16),
      true
    );
    const flashColor = shotQuality === 'perfect' ? 0x67e8f9 : shotQuality === 'good' ? 0x93c5fd : 0xf87171;
    const flashAlpha = shotQuality === 'poor' ? 0.3 : 0.45;
    const flashRadius = shotQuality === 'perfect' ? 34 : shotQuality === 'good' ? 26 : 20;
    if (this.forestHuntPreySprite) {
      const flash = this.add.circle(this.forestHuntPreySprite.x, this.forestHuntPreySprite.y, flashRadius, flashColor, flashAlpha).setDepth(3475);
      this.daySpotMiniGameContainer?.add(flash);
      this.tweens.add({
        targets: flash,
        scale: 1.6,
        alpha: 0,
        duration: shotQuality === 'perfect' ? 260 : 180,
        onComplete: () => flash.destroy(),
      });
    }
    if (this.daySpotMiniGameRound < this.daySpotMiniGameRoundsTotal) {
      this.daySpotMiniGameRound += 1;
      this.startForestHuntRound();
      return;
    }

    const maxPoints = Math.max(1, this.daySpotMiniGameRoundsTotal * 2);
    const netScore = this.daySpotMiniGameScore - this.forestHuntDetections * 0.9 - this.daySpotMiniGameTrapHits * 0.45;
    const scoreRatio = Phaser.Math.Clamp(netScore / maxPoints, 0, 1);
    let finalQuality: 'poor' | 'good' | 'perfect' = scoreRatio >= 0.78
      ? 'perfect'
      : scoreRatio >= 0.46
        ? 'good'
        : 'poor';
    if (this.forestHuntDetections >= 2 || this.daySpotMiniGameTrapHits >= Math.ceil(this.daySpotMiniGameRoundsTotal * 0.7)) {
      finalQuality = 'poor';
    }
    this.resolveForestHuntMiniGame(finalQuality, false);
  }

  private playForestHuntDetectionFeedback(): void {
    const prey = this.forestHuntPreySprite;
    if (!prey || !this.daySpotMiniGameContainer) return;
    const pulse = this.add.circle(prey.x, prey.y, 30, 0xef4444, 0.34).setDepth(3475);
    this.daySpotMiniGameContainer.add(pulse);
    this.tweens.add({
      targets: pulse,
      scale: 1.9,
      alpha: 0,
      duration: 240,
      onComplete: () => pulse.destroy(),
    });
    this.playMiniGameOutcomeVfx('hunt', 'poor', true, prey.x, prey.y - 6, true);
    this.cameras.main.shake(this.lowPerfMode ? 70 : 110, this.lowPerfMode ? 0.0028 : 0.0048);
    this.showFloatingText(prey.x, prey.y - 26, '暴露! 猎物警觉', '#f87171', true);
  }

  private updateForestHuntMiniGame(delta: number): void {
    if (!this.forestHuntMiniGameActive || !this.forestHuntArena || !this.forestHuntPlayerSprite || !this.forestHuntPreySprite || !this.forestHuntSightVisual) return;
    this.forestHuntPhaseElapsedMs += delta;
    let moveX = 0;
    if (this.cursors?.left?.isDown || this.moveLeftKey?.isDown) moveX -= 1;
    if (this.cursors?.right?.isDown || this.moveRightKey?.isDown) moveX += 1;
    if (Math.abs(moveX) < 0.01 && Math.abs(this.forestHuntMobileMoveX) > 0.12) {
      moveX = Phaser.Math.Clamp(this.forestHuntMobileMoveX, -1, 1);
    }
    this.forestHuntPlayerSprite.x = Phaser.Math.Clamp(
      this.forestHuntPlayerSprite.x + moveX * this.forestHuntPlayerSpeed * delta,
      this.forestHuntArena.x + 10,
      this.forestHuntArena.right - 10
    );

    this.forestHuntPreySprite.x += this.forestHuntPreyVx * delta;
    if (this.forestHuntPreySprite.x <= this.forestHuntArena.x + 24) {
      this.forestHuntPreySprite.x = this.forestHuntArena.x + 24;
      this.forestHuntPreyVx = Math.abs(this.forestHuntPreyVx);
    } else if (this.forestHuntPreySprite.x >= this.forestHuntArena.right - 24) {
      this.forestHuntPreySprite.x = this.forestHuntArena.right - 24;
      this.forestHuntPreyVx = -Math.abs(this.forestHuntPreyVx);
    }
    this.forestHuntPreyFacing = this.forestHuntPreyVx >= 0 ? 1 : -1;
    this.forestHuntPreySprite.y = this.forestHuntGroundY - 12 + Math.sin(this.time.now * 0.006) * 3;
    if (this.forestHuntPlayerIcon?.active) {
      this.forestHuntPlayerIcon.setPosition(this.forestHuntPlayerSprite.x, this.forestHuntPlayerSprite.y);
    }
    if (this.forestHuntPreyIcon?.active) {
      this.forestHuntPreyIcon.setPosition(this.forestHuntPreySprite.x, this.forestHuntPreySprite.y);
      this.forestHuntPreyIcon.setFlipX(this.forestHuntPreyFacing < 0);
    }
    const coneW = this.daySpotMiniGameRisk === 'risky' ? 164 : 146;
    const coneH = this.daySpotMiniGameRisk === 'risky' ? 48 : 52;
    this.forestHuntSightVisual.width = coneW;
    this.forestHuntSightVisual.height = coneH;
    this.forestHuntSightVisual.x = this.forestHuntPreySprite.x + this.forestHuntPreyFacing * (coneW * 0.46);
    this.forestHuntSightVisual.y = this.forestHuntGroundY - 17;
    if (this.forestHuntHintIcon?.active) {
      this.forestHuntHintIcon.setPosition(this.forestHuntSightVisual.x, this.forestHuntSightVisual.y - coneH * 0.45);
    }

    if (this.forestHuntClue) {
      this.forestHuntClue.pulse.setAlpha(0.18 + 0.12 * Math.abs(Math.sin(this.time.now * 0.01)));
      this.forestHuntClue.pulse.setScale(1 + 0.12 * Math.abs(Math.sin(this.time.now * 0.012)));
    }

    if (this.forestHuntPhase === 'stealth') {
      const remainMs = Math.max(0, this.forestHuntStealthDurationMs - this.forestHuntPhaseElapsedMs);
      if (this.forestHuntPhaseText) {
        this.forestHuntPhaseText.setText(`潜行追踪 · ${Math.ceil(remainMs / 1000)}s`).setColor('#4ade80');
      }
      if (this.daySpotMiniGameActionLabel) {
        if (this.time.now < this.forestHuntBreathCooldownUntil) {
          const cd = Math.max(0, (this.forestHuntBreathCooldownUntil - this.time.now) / 1000);
          this.daySpotMiniGameActionLabel.setText(`屏息冷却 ${cd.toFixed(1)}s`);
        } else {
          this.daySpotMiniGameActionLabel.setText('屏息 [E] · 潜行阶段');
        }
      }
      const inSight = Math.abs(this.forestHuntPlayerSprite.x - this.forestHuntSightVisual.x) <= this.forestHuntSightVisual.width * 0.5
        && Math.abs(this.forestHuntPlayerSprite.y - this.forestHuntSightVisual.y) <= this.forestHuntSightVisual.height * 0.5;
      if (inSight && Math.abs(moveX) > 0.2) {
        this.forestHuntAlertMeter = Math.min(100, this.forestHuntAlertMeter + (this.daySpotMiniGameRisk === 'risky' ? 0.076 : 0.058) * delta);
      } else {
        this.forestHuntAlertMeter = Math.max(0, this.forestHuntAlertMeter - 0.032 * delta);
      }
      if (this.forestHuntAlertText) {
        this.forestHuntAlertText.setText(`警觉 ${Math.round(this.forestHuntAlertMeter)} · 暴露${this.forestHuntDetections}`);
      }

      if (this.forestHuntClue) {
        const dx = this.forestHuntPlayerSprite.x - this.forestHuntClue.sprite.x;
        const dy = this.forestHuntPlayerSprite.y - this.forestHuntClue.sprite.y;
        if (dx * dx + dy * dy <= 20 * 20) {
          this.enterForestHuntBurst(true, '追踪成功：爆发窗口开启');
          return;
        }
      }
      if (this.forestHuntAlertMeter >= 100) {
        this.forestHuntDetections += 1;
        this.daySpotMiniGameTrapHits += 1;
        this.forestHuntAlertMeter = 52;
        this.playForestHuntDetectionFeedback();
        this.enterForestHuntBurst(false, '被猎物察觉：仓促爆发');
        return;
      }
      if (this.forestHuntPhaseElapsedMs >= this.forestHuntStealthDurationMs) {
        this.daySpotMiniGameTrapHits += 1;
        this.enterForestHuntBurst(false, '追踪超时：爆发质量下降');
        return;
      }
      this.refreshForestHuntBurstVisuals();
      return;
    }

    const remainBurstMs = Math.max(0, this.forestHuntBurstDurationMs - this.forestHuntPhaseElapsedMs);
    if (this.forestHuntPhaseText) {
      this.forestHuntPhaseText.setText(`爆发射击 · ${Math.ceil(remainBurstMs / 1000)}s`).setColor('#fbbf24');
    }
    if (this.daySpotMiniGameActionLabel) {
      this.daySpotMiniGameActionLabel.setText('开火 [E / Space] · 爆发阶段');
    }
    if (this.forestHuntAlertText) {
      this.forestHuntAlertText.setText(`警觉 ${Math.round(this.forestHuntAlertMeter)} · 暴露${this.forestHuntDetections}`);
    }
    this.forestHuntBurstCursor += this.forestHuntBurstCursorDir * this.forestHuntBurstCursorSpeed * delta;
    if (this.forestHuntBurstCursor <= 0) {
      this.forestHuntBurstCursor = 0;
      this.forestHuntBurstCursorDir = 1;
    } else if (this.forestHuntBurstCursor >= 1) {
      this.forestHuntBurstCursor = 1;
      this.forestHuntBurstCursorDir = -1;
    }
    this.forestHuntBurstTargetCenter += this.forestHuntBurstTargetDir * this.forestHuntBurstTargetSpeed * delta;
    if (this.forestHuntBurstTargetCenter <= 0.18) {
      this.forestHuntBurstTargetCenter = 0.18;
      this.forestHuntBurstTargetDir = 1;
    } else if (this.forestHuntBurstTargetCenter >= 0.82) {
      this.forestHuntBurstTargetCenter = 0.82;
      this.forestHuntBurstTargetDir = -1;
    }
    this.refreshForestHuntBurstVisuals();
    if (this.forestHuntPhaseElapsedMs >= this.forestHuntBurstDurationMs) {
      this.resolveForestHuntBurstShot(true);
    }
  }

  private resolveForestHuntMiniGame(
    finalQuality: 'poor' | 'good' | 'perfect',
    forcedRetreat: boolean
  ): void {
    if (!this.forestHuntMiniGameActive || this.forestHuntResultResolved || !this.daySpotMiniGameSpot) return;
    this.forestHuntResultResolved = true;
    const spot = this.daySpotMiniGameSpot;
    const risky = this.daySpotMiniGameRisk === 'risky';
    const trapHit = this.daySpotMiniGameTrapHits > 0 || this.forestHuntDetections > 0 || forcedRetreat;
    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    this.closeDayExplorationMiniGame();
    if (used >= usageLimit || gameState.data.isNight) return;
    this.playDayMiniGameResultFeedback(spot, forcedRetreat ? 'poor' : finalQuality, risky, trapHit);
    this.executeActiveExploration(spot, stationed, active, used, usageLimit, {
      quality: forcedRetreat ? 'poor' : finalQuality,
      risky,
      trapHit,
    });
  }

  private openCityScavengeMiniGame(spot: ExplorationSpot): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const theme = this.getDayMiniGameTheme('scavenge');
    const container = this.add.container(0, 0).setDepth(3450).setScrollFactor(0);
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, theme.overlayColor, theme.overlayAlpha).setScrollFactor(0);
    container.add(overlay);
    const panelW = Math.min(820, w - 40);
    const panelH = Math.min(500, h - 40);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, theme.panelColor, 0.97)
      .setScrollFactor(0)
      .setStrokeStyle(2, theme.accent, 0.92);
    container.add(panel);
    this.createMiniGamePanelDecor(container, w / 2, h / 2, panelW, panelH, theme);
    this.addMiniGameThemeIcon(container, w / 2 - panelW / 2 + 28, h / 2 - panelH / 2 + 26, theme, 20);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 14, `${theme.icon} 限时搜刮战 · ${spot.name}`, {
      fontSize: this.worldFs(24, 20),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 46, '选择路线，潜入搜刮后带着负重撤离到左侧撤离点', {
      fontSize: this.worldFs(14, 13),
      color: '#94a3b8',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));
    if (theme.protocolLevel > 0) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 64, `协议联动：${theme.protocolLabel}`, {
        fontSize: this.worldFs(12, 11),
        color: this.toHexColor(theme.protocolColor),
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }

    const safeCard = this.add.rectangle(w / 2 - 144, h / 2 - panelH / 2 + 94, 232, 58, theme.safeCardColor, 0.94)
      .setStrokeStyle(2, 0x4ade80, 0.9)
      .setInteractive({ useHandCursor: true });
    const riskyCard = this.add.rectangle(w / 2 + 144, h / 2 - panelH / 2 + 94, 232, 58, theme.riskyCardColor, 0.92)
      .setStrokeStyle(2, 0xfb7185, 0.72)
      .setInteractive({ useHandCursor: true });
    const safeText = this.add.text(w / 2 - 144, h / 2 - panelH / 2 + 94, '稳妥搜刮\n时间更长 · 风险更低', {
      fontSize: this.worldFs(13, 12),
      color: '#bbf7d0',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    const riskyText = this.add.text(w / 2 + 144, h / 2 - panelH / 2 + 94, '冒险搜刮\n收益更高 · 负重惩罚更重', {
      fontSize: this.worldFs(13, 12),
      color: '#fecdd3',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    container.add([safeCard, riskyCard, safeText, riskyText]);
    this.addMiniGameRectSkin(container, safeCard, theme, 'safe', 0.9);
    this.addMiniGameRectSkin(container, riskyCard, theme, 'risky', 0.9);

    const routeY = h / 2 - panelH / 2 + 144;
    const routeCards = [
      {
        key: 'alley' as const,
        title: '背街小巷',
        desc: '短线低警报 · 基础收益',
        x: w / 2 - 220,
        color: 0x38bdf8,
      },
      {
        key: 'market' as const,
        title: '废墟商街',
        desc: '中线均衡 · 节奏稳定',
        x: w / 2,
        color: 0xfbbf24,
      },
      {
        key: 'rooftop' as const,
        title: '高架屋顶',
        desc: '高压高回报 · 警报频繁',
        x: w / 2 + 220,
        color: 0xfb7185,
      },
    ];
    const routeVisuals = routeCards.map((route) => {
      const rect = this.add.rectangle(route.x, routeY, 198, 54, 0x0f172a, 0.94)
        .setStrokeStyle(2, route.color, 0.62)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(route.x, routeY, `${route.title}\n${route.desc}`, {
        fontSize: this.worldFs(12, 11),
        color: '#cbd5e1',
        fontFamily: uiFont,
        align: 'center',
        lineSpacing: 2,
      }).setOrigin(0.5);
      container.add([rect, text]);
      const skin = this.addMiniGameRectSkin(container, rect, theme, 'button', 0.7);
      this.bindMiniGameButtonInteraction(rect, skin, theme, text);
      return { route: route.key, rect, text, skin };
    });

    const arenaW = Math.min(panelW - 52, 760);
    const arenaH = Math.min(214, panelH - 264);
    const arenaX = w / 2 - arenaW / 2;
    const arenaY = h / 2 - 8;
    const arena = this.add.rectangle(w / 2, arenaY + arenaH / 2, arenaW, arenaH, theme.arenaColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.42);
    container.add(arena);
    this.addMiniGameRectSkin(container, arena, theme, 'tile', 0.28);
    this.cityScavengeArena = new Phaser.Geom.Rectangle(arenaX + 8, arenaY + 8, arenaW - 16, arenaH - 16);
    this.cityScavengeLanes = [
      arenaY + 48,
      arenaY + 98,
      arenaY + 148,
      arenaY + 188,
    ];

    this.cityScavengeExtractZone = this.add.rectangle(arenaX + 30, arenaY + arenaH / 2, 44, arenaH - 18, 0x22c55e, 0.16)
      .setStrokeStyle(1, 0x4ade80, 0.65);
    this.cityScavengePlayerSprite = this.add.rectangle(
      arenaX + 28,
      this.cityScavengeLanes[1] || (arenaY + 90),
      14,
      20,
      0x93c5fd,
      1
    ).setStrokeStyle(1, 0xe2e8f0, 0.95);
    container.add([this.cityScavengeExtractZone, this.cityScavengePlayerSprite]);

    this.cityScavengeStatusText = this.add.text(arenaX + 8, arenaY + arenaH + 12, '', {
      fontSize: this.worldFs(13, 12),
      color: '#cbd5e1',
      fontFamily: uiFont,
    });
    this.cityScavengeTimerText = this.add.text(arenaX + arenaW - 8, arenaY + arenaH + 12, '', {
      fontSize: this.worldFs(13, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.cityScavengeCarryText = this.add.text(arenaX + 8, arenaY + arenaH + 34, '', {
      fontSize: this.worldFs(13, 12),
      color: '#67e8f9',
      fontFamily: uiFont,
    });
    this.cityScavengeActionHintText = this.add.text(arenaX + arenaW - 8, arenaY + arenaH + 34, '', {
      fontSize: this.worldFs(13, 12),
      color: '#93c5fd',
      fontFamily: uiFont,
    }).setOrigin(1, 0);
    this.cityScavengeRouteText = this.add.text(w / 2, routeY + 38, '', {
      fontSize: this.worldFs(12, 11),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add([
      this.cityScavengeStatusText,
      this.cityScavengeTimerText,
      this.cityScavengeCarryText,
      this.cityScavengeActionHintText,
      this.cityScavengeRouteText,
    ]);

    const actionBtn = this.add.rectangle(w / 2, h / 2 + panelH / 2 - 28, 300, 46, theme.buttonColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    this.daySpotMiniGameActionLabel = this.add.text(w / 2, h / 2 + panelH / 2 - 28, '搜刮/撤离 [E]', {
      fontSize: this.worldFs(17, 15),
      color: theme.buttonTextColor,
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    actionBtn.on('pointerdown', () => this.triggerCityScavengeAction());
    container.add([actionBtn, this.daySpotMiniGameActionLabel]);
    const actionBtnSkin = this.addMiniGameRectSkin(container, actionBtn, theme, 'button', 0.92);
    this.bindMiniGameButtonInteraction(actionBtn, actionBtnSkin, theme, this.daySpotMiniGameActionLabel);

    const closeBtn = this.add.text(w / 2 + panelW / 2 - 18, h / 2 - panelH / 2 + 12, '✕', {
      fontSize: this.worldFs(20, 18),
      color: '#f87171',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.resolveCityScavengeMiniGame(false, 'retreat'));
    container.add(closeBtn);

    const refreshRiskVisual = () => {
      const safeSelected = this.daySpotMiniGameRisk === 'safe';
      safeCard.setStrokeStyle(2, 0x4ade80, safeSelected ? 1 : 0.62);
      riskyCard.setStrokeStyle(2, 0xfb7185, safeSelected ? 0.68 : 1);
      safeCard.setFillStyle(theme.safeCardColor, safeSelected ? 0.97 : 0.84);
      riskyCard.setFillStyle(theme.riskyCardColor, safeSelected ? 0.82 : 0.96);
    };
    safeCard.on('pointerdown', () => {
      if (!this.cityScavengeMiniGameActive) return;
      this.daySpotMiniGameRisk = 'safe';
      this.applyCityScavengeRiskPreset();
      this.selectCityScavengeRoute(this.cityScavengeRoute, false);
      refreshRiskVisual();
    });
    riskyCard.on('pointerdown', () => {
      if (!this.cityScavengeMiniGameActive) return;
      this.daySpotMiniGameRisk = 'risky';
      this.applyCityScavengeRiskPreset();
      this.selectCityScavengeRoute(this.cityScavengeRoute, false);
      refreshRiskVisual();
    });

    const refreshRouteVisual = () => {
      routeVisuals.forEach((visual) => {
        const picked = visual.route === this.cityScavengeRoute;
        visual.rect.setStrokeStyle(2, picked ? 0xfbbf24 : 0x475569, picked ? 1 : 0.56);
        visual.rect.setFillStyle(0x0f172a, picked ? 0.99 : 0.88);
        visual.skin?.setAlpha(picked ? 0.9 : 0.7);
        visual.text.setColor(picked ? '#fef08a' : '#cbd5e1');
      });
    };
    routeVisuals.forEach((visual) => {
      visual.rect.on('pointerdown', () => {
        if (!this.cityScavengeMiniGameActive) return;
        this.selectCityScavengeRoute(visual.route, false);
        refreshRouteVisual();
      });
    });

    this.cityScavengeMiniGameActive = true;
    this.cityScavengeResultResolved = false;
    this.cityScavengeRoute = 'alley';
    this.cityScavengeRouteSelected = false;
    this.cityScavengeElapsedMs = 0;
    this.cityScavengeCarryWeight = 0;
    this.cityScavengeLootScore = 0;
    this.cityScavengeTrapCooldownUntil = 0;
    this.cityScavengeMoveX = 0;
    this.cityScavengeMoveY = 0;
    this.cityScavengeExtracted = false;
    this.applyCityScavengeRiskPreset();
    this.selectCityScavengeRoute('alley', true);
    refreshRiskVisual();
    refreshRouteVisual();
  }

  private applyCityScavengeRiskPreset(): void {
    const risky = this.daySpotMiniGameRisk === 'risky';
    if (risky) {
      this.cityScavengeTimeLimitMs = 11500;
      this.cityScavengeCarryCap = 17;
      this.cityScavengePlayerBaseSpeed = 0.292;
    } else {
      this.cityScavengeTimeLimitMs = 14600;
      this.cityScavengeCarryCap = 20;
      this.cityScavengePlayerBaseSpeed = 0.272;
    }
  }

  private selectCityScavengeRoute(
    route: 'alley' | 'market' | 'rooftop',
    resetPosition: boolean
  ): void {
    this.cityScavengeRoute = route;
    this.cityScavengeRouteSelected = true;
    this.cityScavengeLootNodes.forEach((node) => {
      node.sprite.destroy();
      node.pulse.destroy();
      node.label.destroy();
    });
    this.cityScavengeLootNodes = [];
    this.cityScavengePatrols.forEach((patrol) => patrol.sprite.destroy());
    this.cityScavengePatrols = [];
    this.daySpotMiniGameTrapHits = 0;
    this.cityScavengeCarryWeight = 0;
    this.cityScavengeLootScore = 0;
    this.cityScavengeElapsedMs = 0;
    this.cityScavengeExtracted = false;

    if (!this.daySpotMiniGameContainer || !this.cityScavengeArena || !this.cityScavengePlayerSprite) return;
    const theme = this.getDayMiniGameTheme('scavenge');
    const risky = this.daySpotMiniGameRisk === 'risky';
    const laneTop = this.cityScavengeLanes[0] || this.cityScavengeArena.y + 16;
    const laneMid = this.cityScavengeLanes[1] || (this.cityScavengeArena.y + this.cityScavengeArena.height * 0.5);
    const laneLow = this.cityScavengeLanes[2] || (this.cityScavengeArena.bottom - 24);
    const createNode = (
      x: number,
      y: number,
      weight: number,
      value: number,
      kind: CityScavengeLootNode['kind']
    ) => {
      const color = kind === 'medical' ? 0x22d3ee : kind === 'tech' ? 0xfbbf24 : kind === 'stash' ? 0xfb7185 : 0x94a3b8;
      const frame: 'loot' | 'medical' | 'tech' | 'stash' = kind === 'medical'
        ? 'medical'
        : kind === 'tech'
          ? 'tech'
          : kind === 'stash'
            ? 'stash'
            : 'loot';
      const pulse = this.add.rectangle(x, y, 24, 24, color, 0.16).setStrokeStyle(1, color, 0.42);
      const sprite = this.add.image(x, y, this.getMiniGameObjectAtlasKey(theme), frame).setDisplaySize(16, 16).setAlpha(0.95);
      const label = this.add.text(x, y - 14, `+${value}`, {
        fontSize: this.worldFs(10, 9),
        color: '#e2e8f0',
        fontFamily: this.getUIFontFamily(),
      }).setOrigin(0.5);
      this.daySpotMiniGameContainer?.add([pulse, sprite, label]);
      this.cityScavengeLootNodes.push({ sprite, pulse, label, x, y, weight, value, kind, collected: false });
    };
    const createPatrol = (y: number, speed: number, width: number) => {
      const sprite = this.add.image(
        this.cityScavengeArena!.x + Phaser.Math.Between(120, Math.max(130, this.cityScavengeArena!.width - 40)),
        y,
        this.getMiniGameObjectAtlasKey(theme),
        'enemy'
      ).setDisplaySize(width, 16).setAlpha(0.85);
      sprite.setTint(0xf87171);
      this.daySpotMiniGameContainer?.add(sprite);
      this.cityScavengePatrols.push({ sprite, laneY: y, vx: speed, width, height: 10 });
    };

    if (route === 'alley') {
      this.cityScavengeRouteRewardMul = risky ? 1.02 : 0.96;
      this.cityScavengeRouteDangerMul = risky ? 1.08 : 0.84;
      this.cityScavengeScoreTarget = risky ? 23 : 20;
      createNode(this.cityScavengeArena.x + 178, laneMid, 3, 5, 'supply');
      createNode(this.cityScavengeArena.x + 296, laneLow, 4, 6, 'medical');
      createNode(this.cityScavengeArena.x + 420, laneMid, 4, 6, 'supply');
      createNode(this.cityScavengeArena.x + 530, laneTop, 5, 8, 'tech');
      createPatrol(laneMid, (risky ? 0.16 : 0.13) * (Math.random() < 0.5 ? -1 : 1), 58);
      createPatrol(laneLow, (risky ? 0.14 : 0.11) * (Math.random() < 0.5 ? -1 : 1), 54);
    } else if (route === 'market') {
      this.cityScavengeRouteRewardMul = risky ? 1.18 : 1.08;
      this.cityScavengeRouteDangerMul = risky ? 1.22 : 1.02;
      this.cityScavengeScoreTarget = risky ? 29 : 26;
      createNode(this.cityScavengeArena.x + 160, laneTop, 3, 5, 'medical');
      createNode(this.cityScavengeArena.x + 250, laneMid, 5, 7, 'supply');
      createNode(this.cityScavengeArena.x + 338, laneLow, 6, 8, 'tech');
      createNode(this.cityScavengeArena.x + 444, laneTop, 5, 8, 'supply');
      createNode(this.cityScavengeArena.x + 548, laneMid, 7, 10, 'stash');
      createPatrol(laneTop, (risky ? 0.2 : 0.16) * (Math.random() < 0.5 ? -1 : 1), 62);
      createPatrol(laneMid, (risky ? 0.21 : 0.17) * (Math.random() < 0.5 ? -1 : 1), 64);
      createPatrol(laneLow, (risky ? 0.19 : 0.15) * (Math.random() < 0.5 ? -1 : 1), 56);
    } else {
      this.cityScavengeRouteRewardMul = risky ? 1.42 : 1.26;
      this.cityScavengeRouteDangerMul = risky ? 1.46 : 1.24;
      this.cityScavengeScoreTarget = risky ? 34 : 30;
      createNode(this.cityScavengeArena.x + 216, laneTop, 5, 7, 'tech');
      createNode(this.cityScavengeArena.x + 332, laneMid, 7, 10, 'stash');
      createNode(this.cityScavengeArena.x + 440, laneTop, 8, 11, 'stash');
      createNode(this.cityScavengeArena.x + 566, laneLow, 9, 13, 'tech');
      createPatrol(laneTop, (risky ? 0.24 : 0.2) * (Math.random() < 0.5 ? -1 : 1), 68);
      createPatrol(laneMid, (risky ? 0.24 : 0.2) * (Math.random() < 0.5 ? -1 : 1), 64);
      createPatrol(laneLow, (risky ? 0.22 : 0.18) * (Math.random() < 0.5 ? -1 : 1), 62);
      createPatrol((laneTop + laneMid) * 0.5, (risky ? 0.2 : 0.16) * (Math.random() < 0.5 ? -1 : 1), 56);
    }

    const startY = route === 'rooftop' ? laneTop : route === 'market' ? laneMid : laneLow;
    if (resetPosition) {
      this.cityScavengePlayerSprite.x = this.cityScavengeArena.x + 20;
      this.cityScavengePlayerSprite.y = startY;
    }
    const routeName = route === 'alley' ? '背街小巷' : route === 'market' ? '废墟商街' : '高架屋顶';
    if (this.cityScavengeRouteText) {
      this.cityScavengeRouteText.setText(`路线：${routeName} · 目标分 ${this.cityScavengeScoreTarget} · 风险x${this.cityScavengeRouteDangerMul.toFixed(2)}`);
    }
    if (this.cityScavengeStatusText) {
      this.cityScavengeStatusText.setText('已进入城区，先搜刮，再返回撤离区').setColor('#cbd5e1');
    }
  }

  private triggerCityScavengeAction(): void {
    if (!this.cityScavengeMiniGameActive || !this.cityScavengeRouteSelected || !this.cityScavengePlayerSprite || !this.cityScavengeArena) return;
    const player = this.cityScavengePlayerSprite;
    const nearestNode = this.cityScavengeLootNodes.find((node) => {
      if (node.collected || !node.sprite.active) return false;
      const dx = player.x - node.x;
      const dy = player.y - node.y;
      return dx * dx + dy * dy <= 24 * 24;
    });
    if (nearestNode) {
      nearestNode.collected = true;
      this.cityScavengeCarryWeight += nearestNode.weight;
      this.cityScavengeLootScore += Math.round(nearestNode.value * this.cityScavengeRouteRewardMul);
      nearestNode.sprite.destroy();
      nearestNode.pulse.destroy();
      nearestNode.label.destroy();
      this.showFloatingText(player.x, player.y - 18, `+${nearestNode.value}分 / +${nearestNode.weight}kg`, '#67e8f9', true);
      if (this.cityScavengeStatusText) {
        this.cityScavengeStatusText.setText(`拾取成功：${nearestNode.kind === 'medical' ? '医疗箱' : nearestNode.kind === 'stash' ? '黑箱' : '补给'}入包`).setColor('#67e8f9');
      }
      if (this.cityScavengeCarryWeight > this.cityScavengeCarryCap && this.cityScavengeStatusText) {
        this.cityScavengeStatusText.setText('负重过高：移动显著减速，警报风险上升').setColor('#f59e0b');
      }
      this.playMiniGameOutcomeVfx('scavenge', 'good', false, player.x, player.y - 8, true);
      return;
    }
    const zone = this.cityScavengeExtractZone;
    if (zone && Math.abs(player.x - zone.x) <= zone.width * 0.5 && Math.abs(player.y - zone.y) <= zone.height * 0.5) {
      this.resolveCityScavengeMiniGame(true, 'manual');
      return;
    }
    if (this.cityScavengeStatusText) {
      this.cityScavengeStatusText.setText('附近无可搜刮目标，继续推进或回撤').setColor('#94a3b8');
    }
  }

  private resolveCityScavengeMiniGame(extracted: boolean, reason: 'manual' | 'timeout' | 'retreat'): void {
    if (!this.cityScavengeMiniGameActive || this.cityScavengeResultResolved || !this.daySpotMiniGameSpot) return;
    this.cityScavengeResultResolved = true;
    this.cityScavengeExtracted = extracted;
    const spot = this.daySpotMiniGameSpot;
    const carriedRatio = this.cityScavengeLootScore / Math.max(1, this.cityScavengeScoreTarget);
    const overWeightRatio = Math.max(0, this.cityScavengeCarryWeight - this.cityScavengeCarryCap) / Math.max(1, this.cityScavengeCarryCap);
    const penalty = this.daySpotMiniGameTrapHits * 0.16 + overWeightRatio * 0.4;
    const effectiveScore = extracted
      ? Phaser.Math.Clamp(carriedRatio - penalty, 0, 1.4)
      : Phaser.Math.Clamp(carriedRatio * 0.44 - 0.22, 0, 1);
    let finalQuality: 'poor' | 'good' | 'perfect' = effectiveScore >= 0.94 && this.daySpotMiniGameTrapHits <= 0
      ? 'perfect'
      : effectiveScore >= 0.5
        ? 'good'
        : 'poor';
    const forcedTrap = !extracted || reason === 'timeout' || this.daySpotMiniGameTrapHits > 0;
    if (reason === 'timeout') finalQuality = 'poor';
    const riskyBase = this.daySpotMiniGameRisk === 'risky';
    const routeRisky = this.cityScavengeRouteDangerMul > 1.18;
    const risky = riskyBase || routeRisky;

    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);

    this.closeDayExplorationMiniGame();
    if (used >= usageLimit || gameState.data.isNight) return;
    this.playDayMiniGameResultFeedback(spot, finalQuality, risky, forcedTrap);
    this.executeActiveExploration(spot, stationed, active, used, usageLimit, {
      quality: finalQuality,
      risky,
      trapHit: forcedTrap,
    });
  }

  private updateCityScavengeMiniGame(delta: number): void {
    if (!this.cityScavengeMiniGameActive || !this.cityScavengeRouteSelected || !this.cityScavengeArena || !this.cityScavengePlayerSprite) return;
    this.cityScavengeElapsedMs += delta;
    const now = this.time.now;

    let moveX = 0;
    let moveY = 0;
    if (this.cursors?.left?.isDown || this.moveLeftKey?.isDown) moveX -= 1;
    if (this.cursors?.right?.isDown || this.moveRightKey?.isDown) moveX += 1;
    if (this.cursors?.up?.isDown || this.jumpKey?.isDown) moveY -= 1;
    if (this.cursors?.down?.isDown) moveY += 1;
    if (Math.abs(moveX) < 0.1 && Math.abs(this.cityScavengeMoveX) > 0.1) moveX = Phaser.Math.Clamp(this.cityScavengeMoveX, -1, 1);
    if (Math.abs(moveY) < 0.1 && Math.abs(this.cityScavengeMoveY) > 0.1) moveY = Phaser.Math.Clamp(this.cityScavengeMoveY, -1, 1);

    const carryRatio = this.cityScavengeCarryWeight / Math.max(1, this.cityScavengeCarryCap);
    const overweightPenalty = carryRatio > 1 ? (carryRatio - 1) * 0.56 : 0;
    const speedMul = Phaser.Math.Clamp(1 - Math.min(0.68, carryRatio * 0.48 + overweightPenalty), 0.3, 1);
    const speed = this.cityScavengePlayerBaseSpeed * speedMul;
    this.cityScavengePlayerSprite.x = Phaser.Math.Clamp(
      this.cityScavengePlayerSprite.x + moveX * speed * delta,
      this.cityScavengeArena.x + 10,
      this.cityScavengeArena.right - 10
    );
    this.cityScavengePlayerSprite.y = Phaser.Math.Clamp(
      this.cityScavengePlayerSprite.y + moveY * speed * delta,
      this.cityScavengeArena.y + 10,
      this.cityScavengeArena.bottom - 10
    );

    const patrolSpeedMul = this.daySpotMiniGameRisk === 'risky' ? 1.14 : 1;
    this.cityScavengePatrols.forEach((patrol) => {
      if (!patrol.sprite.active) return;
      patrol.sprite.x += patrol.vx * patrolSpeedMul * this.cityScavengeRouteDangerMul * delta;
      patrol.sprite.setFlipX(patrol.vx < 0);
      const left = this.cityScavengeArena!.x + patrol.width * 0.5;
      const right = this.cityScavengeArena!.right - patrol.width * 0.5;
      if (patrol.sprite.x <= left) {
        patrol.sprite.x = left;
        patrol.vx = Math.abs(patrol.vx);
      } else if (patrol.sprite.x >= right) {
        patrol.sprite.x = right;
        patrol.vx = -Math.abs(patrol.vx);
      }
      const hit = Math.abs(this.cityScavengePlayerSprite!.x - patrol.sprite.x) <= (patrol.width + this.cityScavengePlayerSprite!.width) * 0.5
        && Math.abs(this.cityScavengePlayerSprite!.y - patrol.laneY) <= (patrol.height + this.cityScavengePlayerSprite!.height) * 0.5;
      if (hit && now >= this.cityScavengeTrapCooldownUntil) {
        this.cityScavengeTrapCooldownUntil = now + 780;
        this.daySpotMiniGameTrapHits += 1;
        const lostCarry = Math.min(this.cityScavengeCarryWeight, Phaser.Math.Between(1, this.cityScavengeCarryWeight >= this.cityScavengeCarryCap ? 3 : 2));
        this.cityScavengeCarryWeight = Math.max(0, this.cityScavengeCarryWeight - lostCarry);
        this.cityScavengeLootScore = Math.max(0, this.cityScavengeLootScore - Math.round(lostCarry * 1.25));
        this.cameras.main.shake(this.lowPerfMode ? 80 : 120, this.lowPerfMode ? 0.0036 : 0.0056);
        const pulse = this.add.circle(this.cityScavengePlayerSprite!.x, this.cityScavengePlayerSprite!.y, 20, 0xef4444, 0.28).setDepth(3470);
        this.daySpotMiniGameContainer?.add(pulse);
        this.tweens.add({
          targets: pulse,
          scale: 1.7,
          alpha: 0,
          duration: 260,
          onComplete: () => pulse.destroy(),
        });
        if (this.cityScavengeStatusText) {
          this.cityScavengeStatusText.setText(`触发警报：丢失负重 ${lostCarry}kg`).setColor('#f87171');
        }
        this.playMiniGameOutcomeVfx(
          'scavenge',
          'poor',
          true,
          this.cityScavengePlayerSprite!.x,
          this.cityScavengePlayerSprite!.y - 8,
          true
        );
      }
    });

    this.cityScavengeLootNodes.forEach((node) => {
      if (node.collected || !node.pulse.active) return;
      node.pulse.setAlpha(0.12 + 0.16 * Math.abs(Math.sin((this.time.now + node.x) * 0.01)));
      node.pulse.setScale(1 + 0.1 * Math.abs(Math.sin((this.time.now + node.y) * 0.012)));
    });

    const nearestNode = this.cityScavengeLootNodes.find((node) => {
      if (node.collected || !node.sprite.active) return false;
      const dx = this.cityScavengePlayerSprite!.x - node.x;
      const dy = this.cityScavengePlayerSprite!.y - node.y;
      return dx * dx + dy * dy <= 24 * 24;
    });
    const zone = this.cityScavengeExtractZone;
    const inExtract = !!zone
      && Math.abs(this.cityScavengePlayerSprite.x - zone.x) <= zone.width * 0.5
      && Math.abs(this.cityScavengePlayerSprite.y - zone.y) <= zone.height * 0.5;
    if (this.cityScavengeActionHintText) {
      if (nearestNode) {
        this.cityScavengeActionHintText.setText(`E 搜刮 · ${nearestNode.weight}kg / ${nearestNode.value}分`).setColor('#67e8f9');
      } else if (inExtract) {
        this.cityScavengeActionHintText.setText(this.cityScavengeLootScore > 0 ? 'E 撤离结算' : '先搜刮再撤离').setColor('#fbbf24');
      } else {
        this.cityScavengeActionHintText.setText('沿路线推进，搜刮后返回撤离区').setColor('#94a3b8');
      }
    }

    const remainingMs = Math.max(0, this.cityScavengeTimeLimitMs - this.cityScavengeElapsedMs);
    if (this.cityScavengeTimerText) {
      this.cityScavengeTimerText.setText(`倒计时 ${Math.ceil(remainingMs / 1000)}s · 警报${this.daySpotMiniGameTrapHits}`);
      this.cityScavengeTimerText.setColor(remainingMs <= 3500 ? '#fb7185' : '#fbbf24');
    }
    if (this.cityScavengeCarryText) {
      this.cityScavengeCarryText.setText(`负重 ${this.cityScavengeCarryWeight}/${this.cityScavengeCarryCap}kg · 分值 ${this.cityScavengeLootScore}/${this.cityScavengeScoreTarget}`);
      this.cityScavengeCarryText.setColor(this.cityScavengeCarryWeight > this.cityScavengeCarryCap ? '#fb7185' : '#67e8f9');
    }
    if (this.daySpotMiniGameActionLabel) {
      this.daySpotMiniGameActionLabel.setText(inExtract ? '撤离 [E]' : '搜刮 [E]');
    }
    if (remainingMs <= 0) {
      this.resolveCityScavengeMiniGame(false, 'timeout');
    }
  }

  private openCaveRaidMiniGame(spot: ExplorationSpot): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const uiFont = this.getUIFontFamily();
    const theme = this.getDayMiniGameTheme('cave_explore');
    const container = this.add.container(0, 0).setDepth(3450).setScrollFactor(0);
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = container;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, theme.overlayColor, theme.overlayAlpha).setScrollFactor(0);
    container.add(overlay);
    const panelW = Math.min(780, w - 44);
    const panelH = Math.min(470, h - 50);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, theme.panelColor, 0.97)
      .setScrollFactor(0)
      .setStrokeStyle(2, theme.accent, 0.92);
    container.add(panel);
    this.createMiniGamePanelDecor(container, w / 2, h / 2, panelW, panelH, theme);
    this.addMiniGameThemeIcon(container, w / 2 - panelW / 2 + 28, h / 2 - panelH / 2 + 28, theme, 20);
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 16, `${theme.icon} 洞穴突袭 · ${spot.name}`, {
      fontSize: this.worldFs(24, 20),
      color: '#e2e8f0',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 48, '短横版战斗：躲陷阱、清杂兵、击杀小Boss后撤离', {
      fontSize: this.worldFs(14, 13),
      color: '#94a3b8',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0));
    if (theme.protocolLevel > 0) {
      container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 66, `协议联动：${theme.protocolLabel}`, {
        fontSize: this.worldFs(12, 11),
        color: this.toHexColor(theme.protocolColor),
        fontFamily: uiFont,
      }).setOrigin(0.5, 0));
    }

    const safeCard = this.add.rectangle(w / 2 - 140, h / 2 - panelH / 2 + 96, 230, 68, theme.safeCardColor, 0.94)
      .setStrokeStyle(2, 0x60a5fa, 0.92)
      .setInteractive({ useHandCursor: true });
    const riskyCard = this.add.rectangle(w / 2 + 140, h / 2 - panelH / 2 + 96, 230, 68, theme.riskyCardColor, 0.9)
      .setStrokeStyle(2, 0xfb7185, 0.76)
      .setInteractive({ useHandCursor: true });
    const safeText = this.add.text(w / 2 - 140, h / 2 - panelH / 2 + 96, '稳妥突入\n时间更长 · 敌压较低', {
      fontSize: this.worldFs(13, 12),
      color: '#bfdbfe',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    const riskyText = this.add.text(w / 2 + 140, h / 2 - panelH / 2 + 96, '冒险突入\n敌压更高 · 掉落更猛', {
      fontSize: this.worldFs(13, 12),
      color: '#fecdd3',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    container.add([safeCard, riskyCard, safeText, riskyText]);
    this.addMiniGameRectSkin(container, safeCard, theme, 'safe', 0.9);
    this.addMiniGameRectSkin(container, riskyCard, theme, 'risky', 0.9);

    const arenaW = Math.min(panelW - 60, 720);
    const arenaH = Math.min(228, panelH - 206);
    const arenaX = w / 2 - arenaW / 2;
    const arenaY = h / 2 - 44;
    const arenaBg = this.add.rectangle(w / 2, arenaY + arenaH / 2, arenaW, arenaH, theme.arenaColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.44);
    const groundY = arenaY + arenaH - 16;
    const ground = this.add.rectangle(w / 2, groundY, arenaW - 18, 6, 0x475569, 1);
    const caveFog = this.add.rectangle(w / 2, arenaY + 24, arenaW - 18, 26, 0xa78bfa, 0.08);
    const leftPlatformW = Math.floor(arenaW * 0.28);
    const leftPlatformY = groundY - 52;
    const leftPlatformX = arenaX + 78 + leftPlatformW * 0.5;
    const leftPlatform = this.add.rectangle(leftPlatformX, leftPlatformY, leftPlatformW, 7, 0x64748b, 0.94)
      .setStrokeStyle(1, 0xcbd5e1, 0.75);
    const rightPlatformW = Math.floor(arenaW * 0.24);
    const rightPlatformY = groundY - 76;
    const rightPlatformX = arenaX + arenaW - 86 - rightPlatformW * 0.5;
    const rightPlatform = this.add.rectangle(rightPlatformX, rightPlatformY, rightPlatformW, 7, 0x64748b, 0.94)
      .setStrokeStyle(1, 0xcbd5e1, 0.75);
    const torchL = this.add.circle(arenaX + 28, arenaY + 24, 5, 0xf59e0b, 0.9);
    const torchR = this.add.circle(arenaX + arenaW - 28, arenaY + 24, 5, 0xf59e0b, 0.9);
    container.add([arenaBg, caveFog, ground, leftPlatform, rightPlatform, torchL, torchR]);
    this.addMiniGameRectSkin(container, arenaBg, theme, 'tile', 0.24);

    this.caveRaidArena = new Phaser.Geom.Rectangle(arenaX + 8, arenaY + 10, arenaW - 16, arenaH - 20);
    this.caveRaidGroundY = groundY;
    this.caveRaidSurfaces = [
      { x1: arenaX + 8, x2: arenaX + arenaW - 8, y: groundY },
      { x1: leftPlatformX - leftPlatformW / 2, x2: leftPlatformX + leftPlatformW / 2, y: leftPlatformY },
      { x1: rightPlatformX - rightPlatformW / 2, x2: rightPlatformX + rightPlatformW / 2, y: rightPlatformY },
    ];
    this.caveRaidPlayerSprite = this.add.rectangle(
      this.caveRaidArena.x + 24,
      this.caveRaidGroundY - 13,
      16,
      26,
      0x93c5fd,
      0.05
    ).setStrokeStyle(1, 0xe2e8f0, 0.95);
    container.add(this.caveRaidPlayerSprite);
    this.caveRaidPlayerIcon = this.addMiniGameObjectIcon(
      container,
      this.caveRaidPlayerSprite.x,
      this.caveRaidPlayerSprite.y,
      theme,
      'player',
      22,
      0.95
    );

    this.caveRaidStatusText = this.add.text(arenaX + 8, arenaY + arenaH + 10, '清除杂兵，准备迎战小Boss', {
      fontSize: this.worldFs(13, 12),
      color: '#cbd5e1',
      fontFamily: uiFont,
    });
    this.caveRaidHpText = this.add.text(arenaX + 8, arenaY - 18, '', {
      fontSize: this.worldFs(14, 12),
      color: '#4ade80',
      fontFamily: uiFont,
      fontStyle: 'bold',
    });
    this.caveRaidTimerText = this.add.text(arenaX + arenaW - 8, arenaY - 18, '', {
      fontSize: this.worldFs(14, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    container.add([this.caveRaidStatusText, this.caveRaidHpText, this.caveRaidTimerText]);

    const actionBtn = this.add.rectangle(w / 2, h / 2 + panelH / 2 - 34, 272, 44, theme.buttonColor, 0.98)
      .setStrokeStyle(2, theme.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    const actionLabel = this.add.text(w / 2, h / 2 + panelH / 2 - 34, '攻击 [E / Space] · 跳跃 [W / ↑]', {
      fontSize: this.worldFs(17, 15),
      color: theme.buttonTextColor,
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.daySpotMiniGameActionLabel = actionLabel;
    actionBtn.on('pointerdown', () => this.tryCaveRaidAttack());
    container.add([actionBtn, actionLabel]);
    const actionBtnSkin = this.addMiniGameRectSkin(container, actionBtn, theme, 'button', 0.92);
    this.bindMiniGameButtonInteraction(actionBtn, actionBtnSkin, theme, actionLabel);

    const closeBtn = this.add.text(w / 2 + panelW / 2 - 18, h / 2 - panelH / 2 + 12, '✕', {
      fontSize: this.worldFs(20, 18),
      color: '#f87171',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.resolveCaveRaidMiniGame('retreat'));
    container.add(closeBtn);

    const refreshRiskVisual = () => {
      const safeSelected = this.daySpotMiniGameRisk === 'safe';
      safeCard.setStrokeStyle(2, 0x60a5fa, safeSelected ? 1 : 0.62);
      riskyCard.setStrokeStyle(2, 0xfb7185, safeSelected ? 0.68 : 1);
      safeCard.setFillStyle(theme.safeCardColor, safeSelected ? 0.97 : 0.84);
      riskyCard.setFillStyle(theme.riskyCardColor, safeSelected ? 0.82 : 0.96);
    };
    safeCard.on('pointerdown', () => {
      if (!this.caveRaidMiniGameActive) return;
      this.daySpotMiniGameRisk = 'safe';
      this.applyCaveRaidRiskPreset();
      refreshRiskVisual();
    });
    riskyCard.on('pointerdown', () => {
      if (!this.caveRaidMiniGameActive) return;
      this.daySpotMiniGameRisk = 'risky';
      this.applyCaveRaidRiskPreset();
      refreshRiskVisual();
    });

    const level = Math.max(1, gameState.data.playerLevel || 1);
    this.caveRaidMiniGameActive = true;
    this.caveRaidResultResolved = false;
    this.caveRaidElapsedMs = 0;
    this.caveRaidStage = 1;
    this.caveRaidStageProgress = 0;
    this.caveRaidStageObjective = this.daySpotMiniGameRisk === 'risky' ? 6 : 4;
    this.caveRaidKills = 0;
    this.caveRaidBossSpawned = false;
    this.caveRaidBossKilled = false;
    this.caveRaidBossSprite = null;
    this.caveRaidBossNextSkillAt = 0;
    this.caveRaidNextSpawnAt = this.time.now + 900;
    this.caveRaidNextTrapAt = this.time.now + 1800;
    this.caveRaidEnemies = [];
    this.caveRaidProjectiles = [];
    this.caveRaidTraps = [];
    this.caveRaidMobileMoveX = 0;
    this.caveRaidMobileMoveY = 0;
    this.caveRaidPlayerVy = 0;
    this.caveRaidPlayerGrounded = true;
    this.caveRaidPlayerJumpCooldownUntil = 0;
    this.caveRaidPlayerHpMax = Phaser.Math.Clamp(90 + level * 4, 90, 180);
    this.caveRaidPlayerHp = this.caveRaidPlayerHpMax;
    this.caveRaidPlayerAttackCooldownUntil = 0;
    this.caveRaidPlayerInvulUntil = 0;
    this.applyCaveRaidRiskPreset();
    this.startCaveRaidStage(1);
    refreshRiskVisual();
    this.refreshCaveRaidHud();
  }

  private applyCaveRaidRiskPreset(): void {
    const risky = this.daySpotMiniGameRisk === 'risky';
    if (risky) {
      this.caveRaidEnemyHpMul = 1.22;
      this.caveRaidEnemySpeedMul = 1.18;
      this.caveRaidEnemySpawnIntervalMs = 1500;
      this.caveRaidDurationMs = 30000;
      this.caveRaidPlayerSpeed = 0.292;
      this.caveRaidPlayerJumpForce = 0.48;
    } else {
      this.caveRaidEnemyHpMul = 1;
      this.caveRaidEnemySpeedMul = 1;
      this.caveRaidEnemySpawnIntervalMs = 2050;
      this.caveRaidDurationMs = 36000;
      this.caveRaidPlayerSpeed = 0.255;
      this.caveRaidPlayerJumpForce = 0.46;
    }
    if (this.caveRaidStage === 1) {
      this.caveRaidStageObjective = this.daySpotMiniGameRisk === 'risky' ? 6 : 4;
    }
    this.refreshCaveRaidHud();
  }

  private startCaveRaidStage(stage: 1 | 2 | 3): void {
    if (!this.caveRaidMiniGameActive) return;
    this.caveRaidStage = stage;
    this.caveRaidStageProgress = 0;
    if (stage === 1) {
      this.caveRaidStageObjective = this.daySpotMiniGameRisk === 'risky' ? 6 : 4;
      this.caveRaidNextSpawnAt = this.time.now + 600;
      this.caveRaidNextTrapAt = this.time.now + 1900;
      this.caveRaidBossSpawned = false;
    } else if (stage === 2) {
      this.caveRaidStageObjective = this.daySpotMiniGameRisk === 'risky' ? 9000 : 11000;
      this.caveRaidNextSpawnAt = Number.MAX_SAFE_INTEGER;
      this.caveRaidNextTrapAt = this.time.now + 420;
      this.caveRaidEnemies.forEach((enemy) => {
        enemy.sprite.destroy();
        enemy.visual?.destroy();
      });
      this.caveRaidEnemies = [];
      this.showFloatingText(this.player.x, this.player.y - 96, '陷阱房！存活后进入Boss房', '#fbbf24', false);
    } else {
      this.caveRaidStageObjective = 1;
      this.caveRaidNextSpawnAt = this.time.now + 1200;
      this.caveRaidNextTrapAt = this.time.now + 1700;
      this.caveRaidBossSpawned = true;
      this.spawnCaveRaidEnemy(true);
      this.showFloatingText(this.player.x, this.player.y - 98, '小Boss房已开启', '#fb7185', false);
    }
    this.refreshCaveRaidHud();
  }

  private refreshCaveRaidHud(): void {
    if (!this.caveRaidMiniGameActive) return;
    const hpRatio = this.caveRaidPlayerHpMax > 0 ? this.caveRaidPlayerHp / this.caveRaidPlayerHpMax : 0;
    if (this.caveRaidHpText) {
      this.caveRaidHpText
        .setText(`生命 ${Math.max(0, Math.ceil(this.caveRaidPlayerHp))}/${this.caveRaidPlayerHpMax} · 陷阱命中${this.daySpotMiniGameTrapHits}`)
        .setColor(hpRatio > 0.55 ? '#4ade80' : hpRatio > 0.3 ? '#fbbf24' : '#ef4444');
    }
    if (this.caveRaidTimerText) {
      const remain = Math.max(0, this.caveRaidDurationMs - this.caveRaidElapsedMs);
      this.caveRaidTimerText.setText(`剩余 ${Math.ceil(remain / 1000)}s`);
    }
    if (this.caveRaidStatusText) {
      if (this.caveRaidBossKilled) {
        this.caveRaidStatusText.setText('小Boss已击杀，立即撤离').setColor('#4ade80');
      } else if (this.caveRaidStage === 3) {
        this.caveRaidStatusText.setText(`阶段3/3 · 小Boss战（杂兵击杀${this.caveRaidKills}）`).setColor('#fda4af');
      } else if (this.caveRaidStage === 2) {
        const remainMs = Math.max(0, this.caveRaidStageObjective - this.caveRaidStageProgress);
        this.caveRaidStatusText.setText(`阶段2/3 · 陷阱房生存 ${Math.ceil(remainMs / 1000)}s`).setColor('#fbbf24');
      } else {
        this.caveRaidStatusText.setText(`阶段1/3 · 清理杂兵 ${this.caveRaidKills}/${this.caveRaidStageObjective}`).setColor('#cbd5e1');
      }
    }
    if (this.daySpotMiniGameActionLabel) {
      this.daySpotMiniGameActionLabel.setText(`攻击 [E / Space] · 跳跃 [W / ↑] · ${this.daySpotMiniGameRisk === 'risky' ? '冒险突入' : '稳妥突入'}`);
    }
    if (this.caveRaidBossSprite?.active) {
      const ratio = Math.max(0, (this.caveRaidEnemies.find((enemy) => enemy.isBoss)?.hp || 0) / Math.max(1, this.caveRaidEnemies.find((enemy) => enemy.isBoss)?.maxHp || 1));
      const bossVisual = this.caveRaidEnemies.find((enemy) => enemy.isBoss)?.visual;
      if (bossVisual?.active) {
        bossVisual.setTint(ratio > 0.6 ? 0xf87171 : ratio > 0.3 ? 0xfb923c : 0xfbbf24);
      }
    }
  }

  private spawnCaveRaidEnemy(isBoss: boolean): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidArena || !this.daySpotMiniGameContainer) return;
    const theme = this.getDayMiniGameTheme('cave_explore');
    const day = Math.max(1, gameState.data.currentDay || 1);
    const kind: CaveRaidEnemy['kind'] = isBoss
      ? 'boss'
      : (Math.random() < 0.54 ? 'runner' : (Math.random() < 0.5 ? 'leaper' : 'spitter'));
    const baseHp = kind === 'boss'
      ? 182
      : kind === 'leaper'
        ? 32
        : kind === 'spitter'
          ? 24
          : 26;
    const speedBase = kind === 'boss'
      ? 0.066
      : kind === 'leaper'
        ? 0.092
        : kind === 'spitter'
          ? 0.042
          : 0.102;
    const hp = Math.max(10, Math.round(baseHp * (1 + day * 0.034) * this.caveRaidEnemyHpMul));
    const speed = speedBase * this.caveRaidEnemySpeedMul * (1 + Math.min(0.36, day * 0.011));
    const w = kind === 'boss' ? 34 : kind === 'spitter' ? 18 : 20;
    const h = kind === 'boss' ? 36 : 24;
    const spawnFromRight = kind === 'spitter'
      ? Math.random() < 0.5
      : ((this.caveRaidPlayerSprite?.x ?? this.caveRaidArena.centerX) < this.caveRaidArena.centerX || Math.random() < 0.62);
    const spawnX = spawnFromRight
      ? this.caveRaidArena.right - Phaser.Math.Between(18, 30)
      : this.caveRaidArena.x + Phaser.Math.Between(18, 30);
    const groundY = kind === 'spitter'
      ? (Math.random() < 0.5 ? this.caveRaidGroundY - 52 : this.caveRaidGroundY - 76)
      : this.caveRaidGroundY;
    const fill = kind === 'boss'
      ? 0xdc2626
      : kind === 'leaper'
        ? 0xbe123c
        : kind === 'spitter'
          ? 0x7c3aed
          : 0x7f1d1d;
    const stroke = kind === 'boss'
      ? 0xfca5a5
      : kind === 'spitter'
        ? 0xc4b5fd
        : 0xf87171;
    const sprite = this.add.rectangle(
      spawnX,
      groundY - h / 2,
      w,
      h,
      fill,
      0.06
    ).setStrokeStyle(1, stroke, 0.94);
    this.daySpotMiniGameContainer.add(sprite);
    const visualFrame: 'enemy' | 'hint' = kind === 'spitter' ? 'hint' : 'enemy';
    const visual = this.addMiniGameObjectIcon(
      this.daySpotMiniGameContainer,
      spawnX,
      groundY - h / 2,
      theme,
      visualFrame,
      kind === 'boss' ? 30 : 22,
      kind === 'boss' ? 1 : 0.94
    );
    if (visual) {
      if (kind === 'boss') visual.setTint(0xf87171);
      else if (kind === 'spitter') visual.setTint(0xa78bfa);
      else if (kind === 'leaper') visual.setTint(0xfb7185);
      else visual.setTint(0xef4444);
    }
    const enemy: CaveRaidEnemy = {
      sprite,
      visual,
      hp,
      maxHp: hp,
      speed,
      vx: spawnFromRight ? -speed : speed,
      vy: 0,
      kind,
      touchDamage: kind === 'boss' ? 18 : kind === 'leaper' ? 10 : 8,
      isBoss,
      nextAttackAt: this.time.now + Phaser.Math.Between(420, 760),
      jumpCooldownUntil: this.time.now + Phaser.Math.Between(480, 920),
      groundY,
    };
    this.caveRaidEnemies.push(enemy);
    if (isBoss) {
      this.caveRaidBossSprite = sprite;
      this.caveRaidBossNextSkillAt = this.time.now + 1100;
      this.showFloatingText(this.player.x, this.player.y - 104, '洞穴首领出现！', '#f87171', false);
      this.cameras.main.shake(this.lowPerfMode ? 120 : 180, this.lowPerfMode ? 0.004 : 0.0068);
    }
  }

  private spawnCaveRaidTrap(mode?: CaveRaidTrap['mode']): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidArena || !this.daySpotMiniGameContainer) return;
    const theme = this.getDayMiniGameTheme('cave_explore');
    const trapMode = mode || (Math.random() < (this.caveRaidStage === 2 ? 0.5 : 0.28) ? 'drop' : 'floor');
    const width = trapMode === 'drop'
      ? Phaser.Math.Between(18, 26)
      : Phaser.Math.Between(58, this.daySpotMiniGameRisk === 'risky' ? 104 : 90);
    const centerX = Phaser.Math.Between(
      Math.floor(this.caveRaidArena.x + width * 0.5),
      Math.floor(this.caveRaidArena.right - width * 0.5)
    );
    const zone = this.add.rectangle(centerX, this.caveRaidGroundY - 4, width, 10, 0xef4444, 0.16)
      .setStrokeStyle(1, 0xfda4af, 0.9);
    const pulse = this.add.rectangle(
      centerX,
      trapMode === 'drop' ? this.caveRaidArena.y + 12 : this.caveRaidGroundY - 18,
      trapMode === 'drop' ? width * 0.92 : width * 0.66,
      trapMode === 'drop' ? 14 : 18,
      0xf43f5e,
      0.12
    );
    this.daySpotMiniGameContainer.add([zone, pulse]);
    const icon = this.addMiniGameObjectIcon(
      this.daySpotMiniGameContainer,
      centerX,
      trapMode === 'drop' ? this.caveRaidArena.y + 14 : this.caveRaidGroundY - 18,
      theme,
      'trap',
      trapMode === 'drop' ? 16 : 14,
      0.86
    );
    const now = this.time.now;
    this.caveRaidTraps.push({
      zone,
      pulse,
      icon,
      armedAt: now,
      fireAt: now + Phaser.Math.Between(
        this.daySpotMiniGameRisk === 'risky' ? 560 : 700,
        this.daySpotMiniGameRisk === 'risky' ? 940 : 1180
      ),
      fired: false,
      mode: trapMode,
      travelV: trapMode === 'drop' ? (this.daySpotMiniGameRisk === 'risky' ? 0.46 : 0.38) : 0,
    });
  }

  private requestCaveRaidJump(): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidPlayerSprite) return;
    const now = this.time.now;
    if (now < this.caveRaidPlayerJumpCooldownUntil || !this.caveRaidPlayerGrounded) return;
    this.caveRaidPlayerJumpCooldownUntil = now + 150;
    this.caveRaidPlayerGrounded = false;
    this.caveRaidPlayerVy = -(this.caveRaidPlayerJumpForce * (this.daySpotMiniGameRisk === 'risky' ? 1.03 : 1));
    this.caveRaidPlayerSprite.y -= 1;
    const jumpSpark = this.add.circle(this.caveRaidPlayerSprite.x, this.caveRaidPlayerSprite.y + 13, 4, 0x93c5fd, 0.7);
    this.daySpotMiniGameContainer?.add(jumpSpark);
    this.tweens.add({
      targets: jumpSpark,
      alpha: 0,
      scale: 1.8,
      duration: 170,
      onComplete: () => jumpSpark.destroy(),
    });
  }

  private spawnCaveRaidProjectile(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    fromEnemy: boolean,
    color: number
  ): void {
    if (!this.daySpotMiniGameContainer) return;
    const projectile = this.add.rectangle(x, y, fromEnemy ? 8 : 10, fromEnemy ? 5 : 4, color, 1)
      .setStrokeStyle(1, fromEnemy ? 0xfca5a5 : 0xffffff, 0.9);
    this.daySpotMiniGameContainer.add(projectile);
    this.caveRaidProjectiles.push({
      sprite: projectile,
      vx,
      vy,
      lifeMs: fromEnemy ? 1700 : 920,
      damage,
      fromEnemy,
    });
  }

  private tryCaveRaidAttack(): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidPlayerSprite || !this.daySpotMiniGameContainer) return;
    const now = this.time.now;
    if (now < this.caveRaidPlayerAttackCooldownUntil) return;
    this.caveRaidPlayerAttackCooldownUntil = now + (this.daySpotMiniGameRisk === 'risky' ? 260 : 340);

    const nearestEnemy = this.caveRaidEnemies.reduce<CaveRaidEnemy | null>((best, enemy) => {
      if (!enemy.sprite.active) return best;
      if (!best) return enemy;
      const bestDist = Math.abs(best.sprite.x - this.caveRaidPlayerSprite!.x);
      const currentDist = Math.abs(enemy.sprite.x - this.caveRaidPlayerSprite!.x);
      return currentDist < bestDist ? enemy : best;
    }, null);
    let facing = 1;
    if (this.cursors?.left?.isDown || this.moveLeftKey?.isDown || this.caveRaidMobileMoveX < -0.25) {
      facing = -1;
    } else if (this.cursors?.right?.isDown || this.moveRightKey?.isDown || this.caveRaidMobileMoveX > 0.25) {
      facing = 1;
    } else if (nearestEnemy) {
      facing = nearestEnemy.sprite.x >= this.caveRaidPlayerSprite.x ? 1 : -1;
    }

    const meleeRange = this.daySpotMiniGameRisk === 'risky' ? 44 : 36;
    const meleeDamage = this.daySpotMiniGameRisk === 'risky' ? 36 : 29;
    let hitCount = 0;
    for (let i = this.caveRaidEnemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.caveRaidEnemies[i];
      if (!enemy || !enemy.sprite.active) continue;
      const dx = enemy.sprite.x - this.caveRaidPlayerSprite.x;
      const dy = Math.abs(enemy.sprite.y - this.caveRaidPlayerSprite.y);
      if ((dx * facing) >= 0 && Math.abs(dx) <= meleeRange && dy <= 24) {
        enemy.hp -= meleeDamage;
        hitCount += 1;
      }
    }

    const baseSpeed = this.daySpotMiniGameRisk === 'risky' ? 0.86 : 0.74;
    this.spawnCaveRaidProjectile(
      this.caveRaidPlayerSprite.x + facing * 13,
      this.caveRaidPlayerSprite.y - 4,
      baseSpeed * facing,
      0,
      this.daySpotMiniGameRisk === 'risky' ? 34 : 27,
      false,
      0x67e8f9
    );
    const flash = this.add.circle(this.caveRaidPlayerSprite.x + facing * 12, this.caveRaidPlayerSprite.y - 4, 5, 0x67e8f9, 0.7);
    this.daySpotMiniGameContainer.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 140,
      onComplete: () => flash.destroy(),
    });
    this.playMiniGameOutcomeVfx(
      'cave_explore',
      hitCount > 0 ? (hitCount >= 2 ? 'perfect' : 'good') : 'poor',
      hitCount <= 0,
      this.caveRaidPlayerSprite.x + facing * 12,
      this.caveRaidPlayerSprite.y - 8,
      true
    );
  }

  private damageCaveRaidPlayer(amount: number, reason: string): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidPlayerSprite) return;
    const now = this.time.now;
    if (now < this.caveRaidPlayerInvulUntil) return;
    this.caveRaidPlayerInvulUntil = now + 460;
    this.caveRaidPlayerHp = Math.max(0, this.caveRaidPlayerHp - Math.max(1, Math.floor(amount)));
    this.caveRaidPlayerIcon?.setTint(0xf87171);
    this.time.delayedCall(120, () => {
      if (!this.caveRaidMiniGameActive || !this.caveRaidPlayerSprite) return;
      this.caveRaidPlayerIcon?.clearTint();
    });
    if (this.caveRaidStatusText) {
      this.caveRaidStatusText.setText(`受击 -${Math.floor(amount)} (${reason})`).setColor('#fca5a5');
    }
    this.playMiniGameOutcomeVfx('cave_explore', 'poor', true, this.caveRaidPlayerSprite.x, this.caveRaidPlayerSprite.y - 8, true);
    this.refreshCaveRaidHud();
    if (this.caveRaidPlayerHp <= 0) {
      this.resolveCaveRaidMiniGame('down');
    }
  }

  private updateCaveRaidPlayerPhysics(delta: number): void {
    if (!this.caveRaidArena || !this.caveRaidPlayerSprite) return;
    let moveX = 0;
    if (this.cursors?.left?.isDown || this.moveLeftKey?.isDown) moveX -= 1;
    if (this.cursors?.right?.isDown || this.moveRightKey?.isDown) moveX += 1;
    if (Math.abs(moveX) < 0.01 && Math.abs(this.caveRaidMobileMoveX) > 0.15) {
      moveX = Phaser.Math.Clamp(this.caveRaidMobileMoveX, -1, 1);
    }
    this.caveRaidPlayerSprite.x = Phaser.Math.Clamp(
      this.caveRaidPlayerSprite.x + moveX * this.caveRaidPlayerSpeed * delta,
      this.caveRaidArena.x + 10,
      this.caveRaidArena.right - 10
    );

    const halfH = this.caveRaidPlayerSprite.height * 0.5;
    const prevBottom = this.caveRaidPlayerSprite.y + halfH;
    this.caveRaidPlayerVy += 0.00142 * delta;
    this.caveRaidPlayerSprite.y += this.caveRaidPlayerVy * delta;
    const nextBottom = this.caveRaidPlayerSprite.y + halfH;

    let landingSurfaceY: number | null = null;
    for (let i = 0; i < this.caveRaidSurfaces.length; i += 1) {
      const surface = this.caveRaidSurfaces[i];
      if (this.caveRaidPlayerSprite.x < surface.x1 - 8 || this.caveRaidPlayerSprite.x > surface.x2 + 8) continue;
      if (prevBottom <= surface.y + 2 && nextBottom >= surface.y) {
        if (landingSurfaceY === null || surface.y < landingSurfaceY) {
          landingSurfaceY = surface.y;
        }
      }
    }
    if (landingSurfaceY !== null) {
      this.caveRaidPlayerSprite.y = landingSurfaceY - halfH;
      this.caveRaidPlayerVy = 0;
      this.caveRaidPlayerGrounded = true;
    } else {
      const supportY = this.caveRaidSurfaces.find((surface) =>
        this.caveRaidPlayerSprite!.x >= surface.x1 - 8
        && this.caveRaidPlayerSprite!.x <= surface.x2 + 8
        && Math.abs((this.caveRaidPlayerSprite!.y + halfH) - surface.y) <= 2.5
      )?.y;
      if (supportY === undefined) {
        this.caveRaidPlayerGrounded = false;
      }
      if (this.caveRaidPlayerSprite.y + halfH >= this.caveRaidGroundY) {
        this.caveRaidPlayerSprite.y = this.caveRaidGroundY - halfH;
        this.caveRaidPlayerVy = 0;
        this.caveRaidPlayerGrounded = true;
      }
    }

    const ceilingY = this.caveRaidArena.y + halfH + 2;
    if (this.caveRaidPlayerSprite.y < ceilingY) {
      this.caveRaidPlayerSprite.y = ceilingY;
      if (this.caveRaidPlayerVy < 0) this.caveRaidPlayerVy = 0;
    }
    if (this.caveRaidPlayerIcon?.active) {
      this.caveRaidPlayerIcon.setPosition(this.caveRaidPlayerSprite.x, this.caveRaidPlayerSprite.y);
      this.caveRaidPlayerIcon.setFlipX(moveX < 0);
    }
  }

  private updateCaveRaidMiniGame(delta: number): void {
    if (!this.caveRaidMiniGameActive || !this.caveRaidArena || !this.caveRaidPlayerSprite) return;
    this.caveRaidElapsedMs += delta;
    if (this.caveRaidElapsedMs >= this.caveRaidDurationMs) {
      this.resolveCaveRaidMiniGame('timeout');
      return;
    }
    if (this.caveRaidMobileMoveY <= -0.86) {
      this.requestCaveRaidJump();
    }
    this.updateCaveRaidPlayerPhysics(delta);

    for (let i = this.caveRaidProjectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.caveRaidProjectiles[i];
      if (!projectile.sprite.active) {
        this.caveRaidProjectiles.splice(i, 1);
        continue;
      }
      projectile.sprite.x += projectile.vx * delta;
      projectile.sprite.y += projectile.vy * delta;
      projectile.lifeMs -= delta;
      let removeProjectile = projectile.lifeMs <= 0
        || projectile.sprite.x > this.caveRaidArena.right + 12
        || projectile.sprite.x < this.caveRaidArena.x - 12
        || projectile.sprite.y < this.caveRaidArena.y - 14
        || projectile.sprite.y > this.caveRaidGroundY + 20;
      if (!removeProjectile && projectile.fromEnemy) {
        const hitX = Math.abs(projectile.sprite.x - this.caveRaidPlayerSprite.x) <= (projectile.sprite.width + this.caveRaidPlayerSprite.width) * 0.5;
        const hitY = Math.abs(projectile.sprite.y - this.caveRaidPlayerSprite.y) <= (projectile.sprite.height + this.caveRaidPlayerSprite.height) * 0.5;
        if (hitX && hitY) {
          removeProjectile = true;
          this.damageCaveRaidPlayer(projectile.damage, '远程命中');
        }
      } else if (!removeProjectile) {
        for (let j = this.caveRaidEnemies.length - 1; j >= 0; j -= 1) {
          const enemy = this.caveRaidEnemies[j];
          if (!enemy || !enemy.sprite.active) continue;
          const hitX = Math.abs(projectile.sprite.x - enemy.sprite.x) <= (projectile.sprite.width + enemy.sprite.width) * 0.5;
          const hitY = Math.abs(projectile.sprite.y - enemy.sprite.y) <= (projectile.sprite.height + enemy.sprite.height) * 0.5 + 6;
          if (!hitX || !hitY) continue;
          enemy.hp -= projectile.damage;
          removeProjectile = true;
          if (enemy.hp <= 0) {
            enemy.sprite.destroy();
            enemy.visual?.destroy();
            this.caveRaidEnemies.splice(j, 1);
            if (enemy.isBoss) {
              this.caveRaidBossKilled = true;
              this.caveRaidBossSprite = null;
            } else {
              this.caveRaidKills += 1;
            }
            if (this.caveRaidStage === 1 && this.caveRaidKills >= this.caveRaidStageObjective) {
              this.startCaveRaidStage(2);
            }
          }
          break;
        }
      }
      if (removeProjectile) {
        projectile.sprite.destroy();
        this.caveRaidProjectiles.splice(i, 1);
      }
    }

    for (let i = this.caveRaidEnemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.caveRaidEnemies[i];
      if (!enemy || !enemy.sprite.active) {
        enemy?.visual?.destroy();
        this.caveRaidEnemies.splice(i, 1);
        continue;
      }
      const dxToPlayer = this.caveRaidPlayerSprite.x - enemy.sprite.x;
      const dyToPlayer = this.caveRaidPlayerSprite.y - enemy.sprite.y;
      if (enemy.kind === 'spitter') {
        enemy.vx = 0;
        if (this.time.now >= enemy.nextAttackAt && Math.abs(dxToPlayer) <= 370) {
          enemy.nextAttackAt = this.time.now + Phaser.Math.Between(
            this.daySpotMiniGameRisk === 'risky' ? 760 : 920,
            this.daySpotMiniGameRisk === 'risky' ? 1020 : 1280
          );
          const angle = Math.atan2(dyToPlayer, dxToPlayer);
          const speed = this.daySpotMiniGameRisk === 'risky' ? 0.34 : 0.29;
          this.spawnCaveRaidProjectile(
            enemy.sprite.x,
            enemy.sprite.y - 2,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            this.daySpotMiniGameRisk === 'risky' ? 12 : 9,
            true,
            0xfda4af
          );
        }
      } else {
        const dir = dxToPlayer >= 0 ? 1 : -1;
        enemy.vx = dir * enemy.speed * (enemy.kind === 'boss' ? 1.16 : 1);
        if (enemy.kind === 'leaper' && this.time.now >= enemy.jumpCooldownUntil && Math.abs(dxToPlayer) <= 210) {
          enemy.vy = -0.4;
          enemy.jumpCooldownUntil = this.time.now + Phaser.Math.Between(860, 1280);
        }
        if (enemy.kind === 'boss' && this.time.now >= this.caveRaidBossNextSkillAt) {
          const enraged = enemy.hp / Math.max(1, enemy.maxHp) <= 0.5;
          if (Math.random() < 0.52) {
            const base = enraged ? 0.46 : 0.38;
            [-0.15, 0, 0.15].forEach((offset) => {
              const a = Math.atan2(dyToPlayer, dxToPlayer) + offset;
              this.spawnCaveRaidProjectile(
                enemy.sprite.x,
                enemy.sprite.y - 4,
                Math.cos(a) * base,
                Math.sin(a) * base,
                enraged ? 13 : 10,
                true,
                0xfb7185
              );
            });
          } else {
            this.spawnCaveRaidTrap('floor');
            if (Math.random() < (enraged ? 0.72 : 0.45)) this.spawnCaveRaidTrap('drop');
          }
          this.caveRaidBossNextSkillAt = this.time.now + (enraged ? 1250 : 1820);
        }
      }

      enemy.sprite.x += enemy.vx * delta;
      enemy.vy += 0.0013 * delta;
      enemy.sprite.y += enemy.vy * delta;
      if (enemy.visual?.active) {
        enemy.visual.setPosition(enemy.sprite.x, enemy.sprite.y);
        enemy.visual.setFlipX(enemy.vx < 0);
      }
      const enemyHalfH = enemy.sprite.height * 0.5;
      if (enemy.sprite.y + enemyHalfH >= enemy.groundY) {
        enemy.sprite.y = enemy.groundY - enemyHalfH;
        enemy.vy = 0;
      }

      if (enemy.sprite.x < this.caveRaidArena.x - 20 || enemy.sprite.x > this.caveRaidArena.right + 20) {
        enemy.sprite.destroy();
        enemy.visual?.destroy();
        this.caveRaidEnemies.splice(i, 1);
        if (enemy.isBoss) {
          this.damageCaveRaidPlayer(22, '首领突袭');
        }
        continue;
      }
      const overlapX = Math.abs(enemy.sprite.x - this.caveRaidPlayerSprite.x) <= (enemy.sprite.width + this.caveRaidPlayerSprite.width) * 0.5;
      const overlapY = Math.abs(enemy.sprite.y - this.caveRaidPlayerSprite.y) <= (enemy.sprite.height + this.caveRaidPlayerSprite.height) * 0.45;
      if (overlapX && overlapY && this.time.now >= enemy.nextAttackAt) {
        enemy.nextAttackAt = this.time.now + (enemy.isBoss ? 420 : enemy.kind === 'leaper' ? 620 : 780);
        this.damageCaveRaidPlayer(enemy.touchDamage, enemy.isBoss ? '首领重击' : '近身抓咬');
      }
    }

    if (this.caveRaidStage === 1 && this.time.now >= this.caveRaidNextSpawnAt) {
      this.spawnCaveRaidEnemy(false);
      if (this.daySpotMiniGameRisk === 'risky' && Math.random() < 0.3) {
        this.spawnCaveRaidEnemy(false);
      }
      this.caveRaidNextSpawnAt = this.time.now + Phaser.Math.Between(
        Math.max(900, this.caveRaidEnemySpawnIntervalMs - 320),
        this.caveRaidEnemySpawnIntervalMs + 260
      );
    }
    if (this.caveRaidStage === 2) {
      this.caveRaidStageProgress += delta;
      if (this.caveRaidStageProgress >= this.caveRaidStageObjective) {
        this.startCaveRaidStage(3);
      }
    }
    if (this.caveRaidStage === 3 && !this.caveRaidBossKilled && this.time.now >= this.caveRaidNextSpawnAt) {
      this.spawnCaveRaidEnemy(false);
      if (this.daySpotMiniGameRisk === 'risky' && Math.random() < 0.36) this.spawnCaveRaidEnemy(false);
      this.caveRaidNextSpawnAt = this.time.now + Phaser.Math.Between(
        Math.max(1040, this.caveRaidEnemySpawnIntervalMs - 180),
        this.caveRaidEnemySpawnIntervalMs + 360
      );
    }
    if (!this.caveRaidBossKilled && this.time.now >= this.caveRaidNextTrapAt) {
      if (this.caveRaidStage === 2) {
        this.spawnCaveRaidTrap(Math.random() < 0.5 ? 'drop' : 'floor');
      } else if (this.caveRaidStage === 3) {
        this.spawnCaveRaidTrap(Math.random() < 0.4 ? 'drop' : 'floor');
      } else {
        this.spawnCaveRaidTrap('floor');
      }
      this.caveRaidNextTrapAt = this.time.now + Phaser.Math.Between(
        this.caveRaidStage === 2
          ? (this.daySpotMiniGameRisk === 'risky' ? 700 : 920)
          : (this.daySpotMiniGameRisk === 'risky' ? 1900 : 2500),
        this.caveRaidStage === 2
          ? (this.daySpotMiniGameRisk === 'risky' ? 1200 : 1480)
          : (this.daySpotMiniGameRisk === 'risky' ? 2900 : 3600)
      );
    }

    for (let i = this.caveRaidTraps.length - 1; i >= 0; i -= 1) {
      const trap = this.caveRaidTraps[i];
      if (!trap.zone.active || !trap.pulse.active) {
        trap.icon?.destroy();
        this.caveRaidTraps.splice(i, 1);
        continue;
      }
      if (!trap.fired) {
        const readyMs = Math.max(1, trap.fireAt - trap.armedAt);
        const t = Phaser.Math.Clamp((this.time.now - trap.armedAt) / readyMs, 0, 1);
        trap.zone.setAlpha(0.15 + t * 0.38);
        trap.pulse.setAlpha(0.12 + 0.16 * Math.abs(Math.sin(this.time.now * 0.028)));
        trap.pulse.setScale(1 + t * 0.35, 1 + t * 0.12);
        if (trap.icon?.active) {
          trap.icon.setPosition(trap.pulse.x, trap.pulse.y);
          trap.icon.setAlpha(0.68 + t * 0.22);
        }
        if (this.time.now >= trap.fireAt) {
          trap.fired = true;
          if (trap.mode === 'floor') {
            trap.zone.setFillStyle(0xef4444, 0.92);
            trap.pulse.setFillStyle(0xfca5a5, 0.7);
            trap.icon?.setTint(0xf87171);
            const hitPlayer = this.caveRaidPlayerSprite.x >= trap.zone.getBounds().left
              && this.caveRaidPlayerSprite.x <= trap.zone.getBounds().right
              && this.caveRaidPlayerSprite.y + this.caveRaidPlayerSprite.height * 0.5 >= this.caveRaidGroundY - 8;
            if (hitPlayer) {
              this.daySpotMiniGameTrapHits += 1;
              this.damageCaveRaidPlayer(this.daySpotMiniGameRisk === 'risky' ? 22 : 16, '地雷爆震');
              this.cameras.main.shake(this.lowPerfMode ? 70 : 110, this.lowPerfMode ? 0.003 : 0.005);
            }
          } else {
            trap.zone.setFillStyle(0xfda4af, 0.28).setAlpha(0.36);
            trap.pulse.setFillStyle(0xf43f5e, 0.84).setAlpha(0.95);
            trap.pulse.y = this.caveRaidArena.y + 10;
            trap.icon?.setTint(0xfb7185);
          }
        }
      } else if (trap.mode === 'floor') {
        if (this.time.now - trap.fireAt > 260) {
          trap.zone.destroy();
          trap.pulse.destroy();
          trap.icon?.destroy();
          this.caveRaidTraps.splice(i, 1);
        }
      } else {
        trap.pulse.y += trap.travelV * delta;
        trap.icon?.setPosition(trap.pulse.x, trap.pulse.y);
        const hitX = Math.abs(trap.pulse.x - this.caveRaidPlayerSprite.x) <= (trap.pulse.width + this.caveRaidPlayerSprite.width) * 0.45;
        const hitY = Math.abs(trap.pulse.y - this.caveRaidPlayerSprite.y) <= (trap.pulse.height + this.caveRaidPlayerSprite.height) * 0.45;
        if (hitX && hitY) {
          this.daySpotMiniGameTrapHits += 1;
          this.damageCaveRaidPlayer(this.daySpotMiniGameRisk === 'risky' ? 18 : 14, '落石砸击');
          trap.zone.destroy();
          trap.pulse.destroy();
          trap.icon?.destroy();
          this.caveRaidTraps.splice(i, 1);
        } else if (trap.pulse.y > this.caveRaidGroundY + 20) {
          trap.zone.destroy();
          trap.pulse.destroy();
          trap.icon?.destroy();
          this.caveRaidTraps.splice(i, 1);
        }
      }
    }

    if (this.caveRaidBossKilled) {
      this.resolveCaveRaidMiniGame('victory');
      return;
    }
    this.refreshCaveRaidHud();
  }

  private resolveCaveRaidMiniGame(result: 'victory' | 'timeout' | 'down' | 'retreat'): void {
    if (!this.caveRaidMiniGameActive || this.caveRaidResultResolved || !this.daySpotMiniGameSpot) return;
    this.caveRaidResultResolved = true;
    const spot = this.daySpotMiniGameSpot;
    const risky = this.daySpotMiniGameRisk === 'risky';
    const trapHit = this.daySpotMiniGameTrapHits > 0;

    let quality: 'poor' | 'good' | 'perfect' = 'poor';
    if (result === 'victory') {
      const hpRatio = this.caveRaidPlayerHpMax > 0 ? this.caveRaidPlayerHp / this.caveRaidPlayerHpMax : 0;
      if (hpRatio >= 0.74 && !trapHit && this.caveRaidElapsedMs <= this.caveRaidDurationMs * 0.78) {
        quality = 'perfect';
      } else if (hpRatio >= 0.35 && this.daySpotMiniGameTrapHits <= 3) {
        quality = 'good';
      }
    }

    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    this.closeDayExplorationMiniGame();
    if (used >= usageLimit || gameState.data.isNight) return;
    this.playDayMiniGameResultFeedback(spot, quality, risky, trapHit || result !== 'victory');
    this.executeActiveExploration(spot, stationed, active, used, usageLimit, {
      quality,
      risky,
      trapHit: trapHit || result !== 'victory',
    });
  }

  private updateDayExplorationMiniGame(delta: number): void {
    if (this.caveRaidMiniGameActive) {
      this.updateCaveRaidMiniGame(delta);
      return;
    }
    if (this.cityScavengeMiniGameActive) {
      this.updateCityScavengeMiniGame(delta);
      return;
    }
    if (this.forestHuntMiniGameActive) {
      this.updateForestHuntMiniGame(delta);
      return;
    }
    const profile = this.daySpotMiniGameProfile;
    if (!this.daySpotMiniGameOpen || !this.daySpotMiniGameCursorVisual || !profile) return;
    const risky = this.daySpotMiniGameRisk === 'risky';
    const riskSpeedMul = risky ? profile.riskyTargetSpeedMul : 1;
    const cursorSpeed = (risky ? 0.00095 : 0.00072) * (this.daySpotMiniGameMode === 'hunt' ? 1.16 : 1);
    this.daySpotMiniGameCursor += this.daySpotMiniGameCursorDir * cursorSpeed * delta;
    if (this.daySpotMiniGameCursor <= 0) {
      this.daySpotMiniGameCursor = 0;
      this.daySpotMiniGameCursorDir = 1;
    } else if (this.daySpotMiniGameCursor >= 1) {
      this.daySpotMiniGameCursor = 1;
      this.daySpotMiniGameCursorDir = -1;
    }

    const targetSpeed = profile.baseTargetSpeed * riskSpeedMul;
    if (this.daySpotMiniGameMode === 'swim') {
      const oscillation = 0.74 + 0.3 * Math.abs(Math.sin(this.time.now * 0.0042));
      this.daySpotMiniGameTargetWidth = Phaser.Math.Clamp(profile.baseWidth * oscillation * (risky ? profile.riskyTargetWidthMul : 1), 0.1, 0.44);
      this.daySpotMiniGameTargetCenter = 0.5 + Math.sin(this.time.now * 0.0018) * 0.08;
    } else if (this.daySpotMiniGameMode === 'hunt') {
      this.daySpotMiniGameTargetCenter += this.daySpotMiniGameTargetDir * targetSpeed * delta;
      this.daySpotMiniGameTargetCenter += Math.sin(this.time.now * 0.011) * 0.0007 * delta;
      if (this.daySpotMiniGameTargetCenter <= 0.16) {
        this.daySpotMiniGameTargetCenter = 0.16;
        this.daySpotMiniGameTargetDir = 1;
      } else if (this.daySpotMiniGameTargetCenter >= 0.84) {
        this.daySpotMiniGameTargetCenter = 0.84;
        this.daySpotMiniGameTargetDir = -1;
      }
    } else if (this.daySpotMiniGameMode === 'cave_explore') {
      const pulse = Math.sin(this.time.now * 0.0038);
      const anchor = pulse > 0 ? 0.68 : 0.32;
      this.daySpotMiniGameTargetCenter += (anchor - this.daySpotMiniGameTargetCenter) * 0.12;
      this.daySpotMiniGameTargetCenter = Phaser.Math.Clamp(this.daySpotMiniGameTargetCenter, 0.12, 0.88);
      this.daySpotMiniGameTrapCenter = 0.5 + Math.sin(this.time.now * 0.0022) * 0.16;
    } else if (this.daySpotMiniGameMode === 'scavenge') {
      this.daySpotMiniGameTargetCenter += this.daySpotMiniGameTargetDir * targetSpeed * 0.66 * delta;
      if (this.daySpotMiniGameTargetCenter <= 0.2) {
        this.daySpotMiniGameTargetCenter = 0.2;
        this.daySpotMiniGameTargetDir = 1;
      } else if (this.daySpotMiniGameTargetCenter >= 0.8) {
        this.daySpotMiniGameTargetCenter = 0.8;
        this.daySpotMiniGameTargetDir = -1;
      }
      this.daySpotMiniGameTrapCenter += -this.daySpotMiniGameTargetDir * targetSpeed * 0.5 * delta;
      if (this.daySpotMiniGameTrapCenter <= 0.16) {
        this.daySpotMiniGameTrapCenter = 0.16;
      } else if (this.daySpotMiniGameTrapCenter >= 0.84) {
        this.daySpotMiniGameTrapCenter = 0.84;
      }
    } else {
      this.daySpotMiniGameTargetCenter += this.daySpotMiniGameTargetDir * targetSpeed * delta;
      if (this.daySpotMiniGameTargetCenter <= 0.2) {
        this.daySpotMiniGameTargetCenter = 0.2;
        this.daySpotMiniGameTargetDir = 1;
      } else if (this.daySpotMiniGameTargetCenter >= 0.8) {
        this.daySpotMiniGameTargetCenter = 0.8;
        this.daySpotMiniGameTargetDir = -1;
      }
    }

    const minX = Number(this.daySpotMiniGameCursorVisual.getData('barMinX') || 0);
    const maxX = Number(this.daySpotMiniGameCursorVisual.getData('barMaxX') || 0);
    this.daySpotMiniGameCursorVisual.x = minX + (maxX - minX) * this.daySpotMiniGameCursor;
    this.refreshDayMiniGameZoneVisuals();
  }

  private resolveDayExplorationMiniGame(): void {
    if (this.caveRaidMiniGameActive) {
      this.tryCaveRaidAttack();
      return;
    }
    if (this.cityScavengeMiniGameActive) {
      this.triggerCityScavengeAction();
      return;
    }
    if (this.forestHuntMiniGameActive) {
      this.triggerForestHuntAction();
      return;
    }
    if (!this.daySpotMiniGameOpen || !this.daySpotMiniGameSpot || !this.daySpotMiniGameProfile) return;
    const spot = this.daySpotMiniGameSpot;
    const targetDist = Math.abs(this.daySpotMiniGameCursor - this.daySpotMiniGameTargetCenter);
    const targetHalf = this.daySpotMiniGameTargetWidth * 0.5;
    const perfectHalf = targetHalf * this.daySpotMiniGamePerfectRatio;
    const hasTrap = this.daySpotMiniGameProfile.hasTrap && this.daySpotMiniGameTrapCenter >= 0 && this.daySpotMiniGameTrapWidth > 0;
    const inTrap = hasTrap && Math.abs(this.daySpotMiniGameCursor - this.daySpotMiniGameTrapCenter) <= this.daySpotMiniGameTrapWidth * 0.5;
    const quality: 'poor' | 'good' | 'perfect' =
      inTrap ? 'poor' : targetDist <= perfectHalf ? 'perfect' : targetDist <= targetHalf ? 'good' : 'poor';
    const risky = this.daySpotMiniGameRisk === 'risky';
    const roundPoints = inTrap ? 0 : quality === 'perfect' ? 2 : quality === 'good' ? 1 : 0;
    this.daySpotMiniGameScore += roundPoints;
    if (inTrap) this.daySpotMiniGameTrapHits += 1;

    if (this.daySpotMiniGameStageText) {
      const text = inTrap
        ? `第${this.daySpotMiniGameRound}回合：踩中陷阱`
        : `第${this.daySpotMiniGameRound}回合：${quality === 'perfect' ? '完美 +2' : quality === 'good' ? '稳健 +1' : '失误 +0'}`;
      this.daySpotMiniGameStageText
        .setText(text)
        .setColor(inTrap ? '#f87171' : quality === 'perfect' ? '#4ade80' : quality === 'good' ? '#38bdf8' : '#f59e0b');
    }
    this.playMiniGameOutcomeVfx(
      spot.actionType,
      quality,
      inTrap,
      this.daySpotMiniGameCursorVisual?.x ?? this.player.x,
      (this.daySpotMiniGameCursorVisual?.y ?? this.player.y) - 6,
      true
    );
    if (this.daySpotMiniGameRound < this.daySpotMiniGameRoundsTotal) {
      this.daySpotMiniGameRound += 1;
      this.daySpotMiniGameCursor = Phaser.Math.FloatBetween(0.08, 0.92);
      this.daySpotMiniGameCursorDir = Math.random() < 0.5 ? -1 : 1;
      this.initializeDayMiniGameState(spot);
      this.refreshDayMiniGameRoundDisplay();
      return;
    }

    const maxPoints = Math.max(1, this.daySpotMiniGameRoundsTotal * 2);
    const netScore = this.daySpotMiniGameScore - this.daySpotMiniGameTrapHits * 0.8;
    const scoreRatio = Phaser.Math.Clamp(netScore / maxPoints, 0, 1);
    let finalQuality: 'poor' | 'good' | 'perfect' = scoreRatio >= 0.76
      ? 'perfect'
      : scoreRatio >= 0.42
        ? 'good'
        : 'poor';
    if (this.daySpotMiniGameTrapHits >= Math.ceil(this.daySpotMiniGameRoundsTotal * 0.6)) {
      finalQuality = 'poor';
    }
    const finalTrap = this.daySpotMiniGameTrapHits > 0;

    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);

    this.closeDayExplorationMiniGame();
    if (used >= usageLimit || gameState.data.isNight) return;

    this.playDayMiniGameResultFeedback(spot, finalQuality, risky, finalTrap);
    this.executeActiveExploration(spot, stationed, active, used, usageLimit, {
      quality: finalQuality,
      risky,
      trapHit: finalTrap,
    });
  }

  private closeDayExplorationMiniGame(): void {
    if (!this.daySpotMiniGameOpen) return;
    this.daySpotMiniGameOpen = false;
    this.daySpotMiniGameContainer?.destroy();
    this.daySpotMiniGameContainer = null;
    this.daySpotMiniGameCursorVisual = null;
    this.daySpotMiniGameTargetVisual = null;
    this.daySpotMiniGamePerfectVisual = null;
    this.daySpotMiniGameTrapVisual = null;
    this.daySpotMiniGameRoundText = null;
    this.daySpotMiniGameStageText = null;
    this.daySpotMiniGameActionLabel = null;
    this.daySpotMiniGameRound = 1;
    this.daySpotMiniGameRoundsTotal = 1;
    this.daySpotMiniGameScore = 0;
    this.daySpotMiniGameTrapHits = 0;
    this.caveRaidMiniGameActive = false;
    this.caveRaidResultResolved = false;
    this.caveRaidArena = null;
    this.caveRaidGroundY = 0;
    this.caveRaidSurfaces = [];
    this.caveRaidPlayerSprite = null;
    this.caveRaidPlayerVy = 0;
    this.caveRaidPlayerGrounded = true;
    this.caveRaidPlayerJumpCooldownUntil = 0;
    this.caveRaidPlayerAttackCooldownUntil = 0;
    this.caveRaidPlayerInvulUntil = 0;
    this.caveRaidElapsedMs = 0;
    this.caveRaidStage = 1;
    this.caveRaidStageProgress = 0;
    this.caveRaidStageObjective = 4;
    this.caveRaidKills = 0;
    this.caveRaidBossSpawned = false;
    this.caveRaidBossKilled = false;
    this.caveRaidBossSprite = null;
    this.caveRaidBossNextSkillAt = 0;
    this.caveRaidNextSpawnAt = 0;
    this.caveRaidNextTrapAt = 0;
    this.caveRaidMobileMoveX = 0;
    this.caveRaidMobileMoveY = 0;
    this.caveRaidStatusText = null;
    this.caveRaidHpText = null;
    this.caveRaidTimerText = null;
    this.caveRaidEnemies = [];
    this.caveRaidProjectiles = [];
    this.caveRaidTraps = [];
    this.forestHuntMiniGameActive = false;
    this.forestHuntResultResolved = false;
    this.forestHuntArena = null;
    this.forestHuntGroundY = 0;
    this.forestHuntPlayerSprite = null;
    this.forestHuntPreySprite = null;
    this.forestHuntPlayerIcon = null;
    this.forestHuntPreyIcon = null;
    this.forestHuntHintIcon = null;
    this.forestHuntSightVisual = null;
    if (this.forestHuntClue) {
      this.forestHuntClue.sprite.destroy();
      this.forestHuntClue.pulse.destroy();
    }
    this.forestHuntClue = null;
    this.forestHuntStatusText = null;
    this.forestHuntPhaseText = null;
    this.forestHuntAlertText = null;
    this.forestHuntPhase = 'stealth';
    this.forestHuntPhaseElapsedMs = 0;
    this.forestHuntStealthDurationMs = 5200;
    this.forestHuntBurstDurationMs = 2400;
    this.forestHuntRoundStealthSuccess = false;
    this.forestHuntAlertMeter = 0;
    this.forestHuntDetections = 0;
    this.forestHuntBreathCooldownUntil = 0;
    this.forestHuntPlayerSpeed = 0.24;
    this.forestHuntPreyVx = 0.082;
    this.forestHuntPreyFacing = 1;
    this.forestHuntMobileMoveX = 0;
    this.forestHuntBurstCursor = 0.5;
    this.forestHuntBurstCursorDir = 1;
    this.forestHuntBurstCursorSpeed = 0.00106;
    this.forestHuntBurstTargetCenter = 0.5;
    this.forestHuntBurstTargetDir = 1;
    this.forestHuntBurstTargetSpeed = 0.00052;
    this.forestHuntBurstTargetWidth = 0.22;
    this.forestHuntBurstPerfectRatio = 0.42;
    this.forestHuntActionHintText = null;
    this.cityScavengeMiniGameActive = false;
    this.cityScavengeResultResolved = false;
    this.cityScavengeArena = null;
    this.cityScavengePlayerSprite = null;
    this.cityScavengeExtractZone = null;
    this.cityScavengeStatusText = null;
    this.cityScavengeTimerText = null;
    this.cityScavengeCarryText = null;
    this.cityScavengeActionHintText = null;
    this.cityScavengeRouteText = null;
    this.cityScavengeRoute = 'alley';
    this.cityScavengeRouteSelected = false;
    this.cityScavengeElapsedMs = 0;
    this.cityScavengeTimeLimitMs = 15000;
    this.cityScavengeCarryWeight = 0;
    this.cityScavengeCarryCap = 20;
    this.cityScavengeLootScore = 0;
    this.cityScavengeScoreTarget = 24;
    this.cityScavengePlayerBaseSpeed = 0.27;
    this.cityScavengeMoveX = 0;
    this.cityScavengeMoveY = 0;
    this.cityScavengeTrapCooldownUntil = 0;
    this.cityScavengeLanes = [];
    this.cityScavengeLootNodes = [];
    this.cityScavengePatrols = [];
    this.cityScavengeRouteRewardMul = 1;
    this.cityScavengeRouteDangerMul = 1;
    this.cityScavengeExtracted = false;
    this.daySpotMiniGameSpot = null;
    this.daySpotMiniGameRisk = 'safe';
    this.daySpotMiniGameMode = 'fish';
    this.daySpotMiniGameCursor = 0.5;
    this.daySpotMiniGameCursorDir = 1;
    this.daySpotMiniGameTargetCenter = 0.5;
    this.daySpotMiniGameTargetDir = 1;
    this.daySpotMiniGameTargetWidth = 0.24;
    this.daySpotMiniGamePerfectRatio = 0.4;
    this.daySpotMiniGameTrapCenter = -1;
    this.daySpotMiniGameTrapWidth = 0;
    this.daySpotMiniGameProfile = null;
    this.setUISceneInputEnabled(true);
    if (!this.currentFacility) {
      this.playerSystem?.setMovementEnabled(true);
    }
  }

  private createVillageScenery(): void {
    this.villageLayer = this.add.container(0, 0).setDepth(-3);
    this.villageLights = [];
    const uiFont = this.getUIFontFamily();

    const tileSize = 64;
    const cols = 8;
    const rows = 7;
    const startX = 1000 - (cols * tileSize) / 2;
    const startY = 750 - (rows * tileSize) / 2;
    const centerX = startX + cols * tileSize * 0.5;

    // Ground: fully use user-provided base tile texture.
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = this.add.image(
          startX + col * tileSize + tileSize / 2,
          startY + row * tileSize + tileSize / 2,
          'village_ground'
        ).setDepth(-4);
        this.villageLayer.add(tile);
      }
    }
    const plaza = this.add.rectangle(centerX, startY + tileSize * 3.54, 356, 246, 0x101826, 0.14).setDepth(-5);
    plaza.setStrokeStyle(1, 0x3b82f6, 0.2);
    this.villageLayer.add(plaza);

    const districtPads = [
      { x: centerX, y: startY + tileSize * 0.98, w: 334, h: 96, stroke: 0xfbbf24, tag: '指挥区' },
      { x: centerX - 220, y: startY + tileSize * 3.12, w: 174, h: 188, stroke: 0x86efac, tag: '生活区' },
      { x: centerX + 220, y: startY + tileSize * 3.12, w: 174, h: 188, stroke: 0xf59e0b, tag: '制造区' },
      { x: centerX, y: startY + tileSize * 5.18, w: 304, h: 108, stroke: 0x22d3ee, tag: '后勤区' },
    ];
    districtPads.forEach((pad) => {
      const lane = this.add.rectangle(pad.x, pad.y + pad.h * 0.4, pad.w * 0.62, 1, pad.stroke, 0.28).setDepth(-5);
      this.villageLayer.add(lane);
    });

    const placeStructure = (key: string, x: number, y: number, scale: number, depth = -2) => {
      if (!this.textures.exists(key)) return;
      const shadow = this.add.ellipse(x, y + 14, 74 * scale, 15 * scale, 0x000000, 0.2).setDepth(depth - 1);
      const sprite = this.add.image(x, y, key).setScale(scale).setDepth(depth);
      this.villageLayer.add([shadow, sprite]);
    };

    // Remove old "影目房子" and keep base as functional construction hub.
    const missionCoreShadow = this.add.ellipse(centerX, startY + tileSize * 3.3, 208, 44, 0x000000, 0.24).setDepth(-3);
    const missionCore = this.add.rectangle(centerX, startY + tileSize * 3.16, 196, 84, 0x13263f, 0.72).setDepth(-2);
    missionCore.setStrokeStyle(2, 0x38bdf8, 0.46);
    this.villageLayer.add([missionCoreShadow, missionCore]);
    this.villageLayer.add(this.add.text(centerX, startY + tileSize * 2.68, '基地中枢', {
      fontSize: this.worldFs(16, 15),
      color: '#e2f3ff',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#0b1220',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(-1));

    // Construction facilities from user asset pack.
    placeStructure('room_quarters', centerX - 220, startY + tileSize * 2.92, 1.05);
    placeStructure('workbench', centerX + 220, startY + tileSize * 2.92, 1.05);
    placeStructure('medical_station', centerX, startY + tileSize * 4.96, 1.05);
    placeStructure('bunk_bed', centerX, startY + tileSize * 5.58, 1.05);

    // Keep only essential props.
    this.villageLayer.add(this.add.image(centerX - 86, startY + tileSize * 3.22, 'store_counter').setDepth(-1).setScale(0.9));
    this.villageLayer.add(this.add.image(centerX + 86, startY + tileSize * 3.22, 'store_counter').setDepth(-1).setScale(0.9));
    [
      { x: centerX - 146, y: startY + tileSize * 4.2, s: 0.86 },
      { x: centerX + 146, y: startY + tileSize * 4.2, s: 0.86 },
    ].forEach((p) => {
      const crate = this.add.image(p.x, p.y, 'supply_crate').setDepth(-1).setScale(p.s);
      const shadow = this.add.ellipse(p.x, p.y + 11, 34 * p.s, 10 * p.s, 0x000000, 0.22).setDepth(-2);
      this.villageLayer.add([shadow, crate]);
    });

    placeStructure('camp_garden_box', centerX - 230, startY + tileSize * 5.4, 0.92, -2);
    placeStructure('camp_garden_box', centerX + 230, startY + tileSize * 5.4, 0.92, -2);
    placeStructure('camp_table', centerX, startY + tileSize * 4.34, 0.86, -2);

    // Lamps + fire core.
    [
      { x: startX + tileSize * 0.5, y: startY + tileSize * 0.5 },
      { x: startX + tileSize * (cols - 0.5), y: startY + tileSize * 0.5 },
      { x: startX + tileSize * 0.5, y: startY + tileSize * (rows - 0.5) },
      { x: startX + tileSize * (cols - 0.5), y: startY + tileSize * (rows - 0.5) },
    ].forEach((pos) => {
      this.villageLayer.add(this.add.image(pos.x, pos.y, 'street_lamp').setDepth(-1));
      this.villageLayer.add(this.add.circle(pos.x, pos.y + 16, 24, 0xfff3b0, 0.1).setDepth(-2));
      this.villageLights.push({ x: pos.x, y: pos.y + 10, scale: 0.68 });
    });
    const fire = this.add.sprite(centerX, startY + tileSize * 3.56, 'campfire').setDepth(-1);
    this.villageLayer.add(fire);
    this.villageLayer.add(this.add.circle(fire.x, fire.y, 34, 0xffa94a, 0.16).setDepth(-2));
    this.villageLights.push({ x: fire.x, y: fire.y, scale: 1.04 });

    // Minimal labels.
    const districtStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: this.worldFs(12, 11),
      color: '#fef3c7',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: '#2a2014cc',
      padding: { left: 6, right: 6, top: 2, bottom: 2 },
    };
    districtPads.forEach((pad) => {
      if (pad.tag === '指挥区') return;
      const yOffset = pad.tag === '后勤区' ? -36 : -42;
      const tag = this.add.text(pad.x, pad.y + yOffset, pad.tag, districtStyle).setOrigin(0.5).setDepth(-1);
      this.villageLayer.add(tag);
    });
    const board = this.add.rectangle(centerX, startY + tileSize * 5.74, 172, 34, 0x2b2117, 0.92);
    board.setStrokeStyle(2, 0xfacc15);
    this.villageLayer.add(board);
    this.villageLayer.add(this.add.text(board.x, board.y, '生活营地 · 安全区', {
      fontSize: this.worldFs(14, 13),
      color: '#facc15',
      fontFamily: uiFont,
      align: 'center',
    }).setOrigin(0.5).setDepth(-1));

    // Walls around base
    this.createBaseWalls(startX, startY, tileSize, cols, rows);

    // NPCs
    this.spawnNPC(centerX - 74, startY + tileSize * 1.98, 'merchant', '数据交易员');
    this.spawnNPC(centerX + 74, startY + tileSize * 1.98, 'weaponsmith', '宝岛眼镜店');
    this.spawnNPC(centerX, startY + tileSize * 4.62, 'commander', '任务官');

    // Day-life facilities (enterable)
    this.spawnFacility({
      id: 'kitchen',
      name: '炊事台',
      action: '做饭',
      texture: 'kitchen_station',
      x: centerX - 132,
      y: startY + tileSize * 4.24,
      enterX: centerX - 132,
      enterY: startY + tileSize * 3.9,
      exitX: centerX - 164,
      exitY: startY + tileSize * 4.34,
      radius: 88,
    });
    this.spawnFacility({
      id: 'quarters',
      name: '宿舍房间',
      action: '休息',
      texture: 'room_quarters',
      x: centerX - 40,
      y: startY + tileSize * 5.28,
      enterX: centerX - 40,
      enterY: startY + tileSize * 4.92,
      exitX: centerX - 74,
      exitY: startY + tileSize * 5.36,
      radius: 92,
    });
    this.spawnFacility({
      id: 'guard_post',
      name: '哨岗',
      action: '站岗',
      texture: 'guard_post',
      x: centerX + 42,
      y: startY + tileSize * 5.28,
      enterX: centerX + 42,
      enterY: startY + tileSize * 4.92,
      exitX: centerX + 74,
      exitY: startY + tileSize * 5.36,
      radius: 78,
    });
    this.spawnFacility({
      id: 'workbench',
      name: '工作台',
      action: '加工',
      texture: 'workbench',
      x: centerX + 132,
      y: startY + tileSize * 4.24,
      enterX: centerX + 132,
      enterY: startY + tileSize * 3.9,
      exitX: centerX + 164,
      exitY: startY + tileSize * 4.34,
      radius: 78,
    });
  }

  private spawnFacility(def: {
    id: FacilityInteractable['id'];
    name: string;
    action: string;
    texture: string;
    x: number;
    y: number;
    enterX: number;
    enterY: number;
    exitX: number;
    exitY: number;
    radius: number;
  }): void {
    const sprite = this.add.sprite(def.x, def.y, def.texture).setDepth(-1);
    const baseScale = sprite.width > 72 ? 0.78 : 0.88;
    sprite.setScale(baseScale);
    this.villageLayer.add(sprite);

    const glow = this.add.circle(def.x, def.y + 10, 20, 0x38bdf8, 0.08).setDepth(-2);
    this.villageLayer.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.06, to: 0.14 },
      scale: { from: 0.94, to: 1.14 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });

    this.facilityInteractables.push({
      id: def.id,
      name: def.name,
      action: def.action,
      sprite,
      enterX: def.enterX,
      enterY: def.enterY,
      exitX: def.exitX,
      exitY: def.exitY,
      radius: def.radius,
    });
  }

  private createBaseWalls(startX: number, startY: number, tileSize: number, cols: number, rows: number): void {
    const left = startX - tileSize / 2;
    const right = startX + cols * tileSize - tileSize / 2;
    const top = startY - tileSize / 2;
    const bottom = startY + rows * tileSize - tileSize / 2;

    const placeWall = (x: number, y: number) => {
      const wallTex = this.pickVariantTexture('wall', x, y);
      const wall = this.walls.create(x, y, wallTex) as Phaser.Physics.Arcade.Sprite;
      this.configureStructure(wall);
      const def = BUILDING_DEFS.wall;
      wall.clearTint();
      (wall as any).health = def.health;
      (wall as any).maxHealth = def.health;
      (wall as any).buildingId = def.id;
      (wall as any).buildingDef = def;
      (wall as any).buildingTier = def.tier;
      gameState.data.buildings.push({ id: def.id, type: def.category, x, y, tier: def.tier, health: def.health });
    };

    const gateCol = Math.floor(cols / 2);
    const topTurretY = top - 10;

    for (let col = 0; col < cols; col++) {
      if (col === gateCol) continue;
      placeWall(startX + col * tileSize + tileSize / 2, top);
      placeWall(startX + col * tileSize + tileSize / 2, bottom);
    }
    for (let row = 0; row < rows; row++) {
      placeWall(left, startY + row * tileSize + tileSize / 2);
      placeWall(right, startY + row * tileSize + tileSize / 2);
    }

    // Initial turrets
    [{ x: startX + tileSize * 1.5, y: topTurretY }, { x: startX + tileSize * (cols - 1.5), y: topTurretY }].forEach(pos => {
      const t = this.turrets.create(pos.x, pos.y, this.getBuildingTextureKey('turret', 'turret')) as Phaser.Physics.Arcade.Sprite;
      this.configureStructure(t);
      const def = BUILDING_DEFS.turret;
      t.clearTint();
      (t as any).buildingId = def.id;
      (t as any).buildingDef = def;
      (t as any).buildingTier = def.tier;
      (t as any).health = def.health;
      (t as any).maxHealth = def.health;
      this.initTurretAutoLevelStats(t, 15, 700, 220);
      gameState.data.buildings.push({ id: def.id, type: def.category, x: pos.x, y: pos.y, tier: def.tier, health: def.health });
    });
  }

  private configureStructure(structure: Phaser.Physics.Arcade.Sprite): void {
    structure.setImmovable(true);
    (structure.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    structure.setDepth(3);
    const body = structure.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setSize(56, 56);
      body.setOffset((structure.width - 56) / 2, (structure.height - 56) / 2);
    }
    if (!(structure as any).health) {
      (structure as any).health = 100;
      (structure as any).maxHealth = 100;
    }
  }

  private initTurretAutoLevelStats(
    turret: Phaser.Physics.Arcade.Sprite,
    baseDamage: number,
    baseFireRate: number,
    baseRange: number
  ): void {
    const td = turret as any;
    td.runtimeId = td.runtimeId || `turret_${++this.turretIdSeed}`;
    td.baseDamage = baseDamage;
    td.baseFireRate = baseFireRate;
    td.baseRange = baseRange;
    td.level = Math.max(1, td.level || 1);
    td.killCount = td.killCount || 0;
    td.nextLevelKills = td.nextLevelKills || this.getAutoLevelTarget(td.level);
    td.lastFireTime = td.lastFireTime || 0;
    this.applyTurretLevelStats(turret);
  }

  private getAutoLevelTarget(level: number): number {
    const lv = Math.max(1, level || 1);
    if (lv < TURRET_PROMOTION_LEVEL) {
      return Math.floor(8 + Math.pow(lv, 1.25) * 4.5);
    }
    const postLv = lv - TURRET_PROMOTION_LEVEL + 1;
    return Math.floor(26 + Math.pow(postLv + 4, 1.46) * 9.2);
  }

  private getAutoLevelColor(level: number): number {
    return AUTO_LEVEL_COLOR_CYCLE[(Math.max(1, level) - 1) % AUTO_LEVEL_COLOR_CYCLE.length] ?? 0x22d3ee;
  }

  private applyTurretLevelStats(turret: Phaser.Physics.Arcade.Sprite): void {
    const td = turret as any;
    const lv = Phaser.Math.Clamp(Math.max(1, td.level || 1), 1, TURRET_MAX_LEVEL);
    td.level = lv;
    td.baseHealth = Math.max(1, td.baseHealth || td.maxHealth || td.health || 100);
    const oldMaxHealth = Math.max(1, td.maxHealth || td.baseHealth || 100);
    const oldHealth = Phaser.Math.Clamp(td.health ?? oldMaxHealth, 0, oldMaxHealth);
    const oldHealthRate = Phaser.Math.Clamp(oldHealth / oldMaxHealth, 0, 1);
    const preLevel = Math.max(0, Math.min(lv, TURRET_PROMOTION_LEVEL) - 1);
    const postLevel = Math.max(0, lv - TURRET_PROMOTION_LEVEL);
    let damageMul = Math.pow(1.095, preLevel) * Math.pow(1.118, postLevel);
    let fireRateMul = Math.pow(0.987, preLevel) * Math.pow(0.976, postLevel);
    let rangeMul = Math.pow(1.02, preLevel) * Math.pow(1.03, postLevel);
    let healthMul = Math.pow(1.03, preLevel) * Math.pow(1.065, postLevel);
    let bulletSpeedMul = 1 + Math.min(0.42, preLevel * 0.008 + postLevel * 0.014);

    if (td.advancedClass) {
      const def = TURRET_ADVANCED_CLASSES.find(item => item.nameCN === td.advancedClass);
      if (def) {
        damageMul *= def.damageMul;
        fireRateMul *= def.fireRateMul;
        rangeMul *= def.rangeMul;
        bulletSpeedMul *= def.bulletSpeedMul;
      }
    }

    fireRateMul /= Math.max(0.55, this.permanentTalentBonuses.turretFireRateMul || 1);
    healthMul *= this.permanentTalentBonuses.turretHealthMul || 1;

    td.damage = Math.max(1, Math.round((td.baseDamage || 15) * damageMul));
    td.fireRate = Math.max(110, Math.round((td.baseFireRate || 700) * fireRateMul));
    td.range = Math.min(980, Math.round((td.baseRange || 220) * rangeMul));
    td.maxHealth = Math.max(80, Math.round((td.baseHealth || 100) * healthMul));
    td.health = Math.max(1, Math.round(td.maxHealth * oldHealthRate));
    td.bulletSpeed = Math.round(350 * bulletSpeedMul);

    const classDef = TURRET_ADVANCED_CLASSES.find(item => item.nameCN === td.advancedClass);
    const color = classDef?.tint || this.getAutoLevelColor(lv);
    td.levelColor = color;
    turret.setTint(color);
  }

  private spawnNPC(x: number, y: number, type: CampInteractable['type'], name: string): void {
    const sprite = this.add.sprite(x, y, this.getNpcTextureKey(type));
    const npcScale = this.getNpcVisualScale();
    sprite.setScale(npcScale);
    sprite.setDepth(3);
    const colors: Record<string, number> = { merchant: 0xfbbf24, commander: 0x0ea5e9, weaponsmith: 0xef4444 };
    if (sprite.texture?.key === 'companion') {
      sprite.setTint(colors[type] || 0xffffff);
    }
    this.villageLayer.add(sprite);

    this.tweens.add({
      targets: sprite,
      y: { from: y, to: y - 2 },
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const label = this.add.text(x, y - 40, name, {
      fontSize: this.worldFs(14, 13),
      color: '#fef08a',
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);
    this.villageLayer.add(label);

    this.interactables.push({ sprite, type, name, cooldown: 1000, lastInteract: 0 });
  }

  private getNpcTextureKey(type: CampInteractable['type']): string {
    if (type === 'merchant' && this.textures.exists('npc_merchant')) return 'npc_merchant';
    if (type === 'commander' && this.textures.exists('npc_commander')) return 'npc_commander';
    if (type === 'weaponsmith' && this.textures.exists('npc_weaponsmith')) return 'npc_weaponsmith';
    return 'companion';
  }

  private getCompanionRoleTexture(role?: string, seedKey?: string): string {
    const fallback = this.textures.exists('companion') ? 'companion' : '';
    const candidates: string[] = [];
    if (role === 'tank') {
      if (this.textures.exists('companion_tank')) candidates.push('companion_tank');
      if (this.textures.exists('companion_engineer')) candidates.push('companion_engineer');
    } else if (role === 'sniper') {
      if (this.textures.exists('companion_sniper')) candidates.push('companion_sniper');
      if (this.textures.exists('companion_raider')) candidates.push('companion_raider');
    } else if (role === 'medic') {
      if (this.textures.exists('companion_medic')) candidates.push('companion_medic');
      if (this.textures.exists('companion_support')) candidates.push('companion_support');
    }
    if (candidates.length <= 0) return fallback || 'companion';
    if (!seedKey) return candidates[0];
    const hash = Array.from(seedKey).reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 7);
    return candidates[hash % candidates.length];
  }

  private getCompanionRoleColor(role?: string): number {
    if (role === 'tank') return 0x38bdf8;
    if (role === 'sniper') return 0x22c55e;
    if (role === 'medic') return 0xf472b6;
    return 0x93c5fd;
  }

  private setupCollisions(): void {
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) =>
      this.bulletHitEnemy(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite), undefined, this);
    this.physics.add.overlap(this.vsBullets, this.enemies, (b, e) =>
      this.bulletHitEnemy(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite), undefined, this);

    this.physics.add.overlap(this.companionBullets, this.enemies, (b, e) =>
      this.handleEffectBulletHit(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite), undefined, this);

    this.physics.add.overlap(this.enemies, this.player, this.enemyHitPlayer, undefined, this);

    this.physics.add.collider(this.enemies, this.walls, (e, w) =>
      this.enemyDamageBuilding(e as Phaser.Physics.Arcade.Sprite, w as Phaser.Physics.Arcade.Sprite));

    this.physics.add.collider(this.enemies, this.turrets, (e, t) =>
      this.enemyDamageBuilding(e as Phaser.Physics.Arcade.Sprite, t as Phaser.Physics.Arcade.Sprite));

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.turrets);
    this.physics.add.collider(this.enemies, this.enemies);
    // Companions keep formation via follow logic; disabling structure collision avoids path lock.

    this.physics.add.overlap(this.player, this.survivors, (_p, s) =>
      this.rescueSurvivor(s as Phaser.Physics.Arcade.Sprite), undefined, this);

    this.physics.add.overlap(this.turretBullets, this.enemies, (b, e) =>
      this.turretBulletHitEnemy(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite), undefined, this);
  }

  private setupInput(): void {
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.moveLeftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.moveRightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.emergencyExitKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard!.on('keydown-B', () => {
      if (this.currentFacility) return;
      this.toggleBuildMode();
    });
    this.input.keyboard!.on('keydown-R', () => {
      if (this.currentFacility) return;
      this.demolishNearbyBuilding();
    });
    this.input.keyboard!.on('keydown-C', () => {
      if (this.currentFacility) return;
      if (this.isBuildMode) this.exitBuildMode();
      this.toggleCrafting();
    });
    this.input.keyboard!.on('keydown-Q', () => {
      if (this.currentFacility) return;
      this.toggleQuests();
    });
    this.input.keyboard!.on('keydown-X', () => {
      if (this.currentFacility) return;
      events.emit('toggle-exchange');
    });
    this.input.keyboard!.on('keydown-G', () => {
      if (this.currentFacility) return;
      events.emit('toggle-collection');
    });
    // J / T / H are handled in UIScene so panel hotkeys remain edge-triggered
    // and do not double-toggle when both scenes are alive.

    // Weapon switching (1-6)
    for (let i = 1; i <= 6; i++) {
      const keyName = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][i - 1];
      this.input.keyboard!.on(`keydown-${keyName}`, () => {
        if (this.isBuildMode) {
          this.selectBuildByIndex(i - 1);
          return;
        }
        if (this.currentFacility) return;
        const weapons = ['pistol', 'shotgun', 'rifle', 'flamethrower', 'laser', 'rocket'] as const;
        this.weaponSystem.switchWeapon(weapons[i - 1]);
        events.emit(GameEvents.WEAPON_CHANGED, { weapon: weapons[i - 1], config: this.weaponSystem.getCurrentWeapon() });
      });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      if (this.runEventOpen) return;
      if (this.isBuildMode && !this.isGameOver) {
        if (this.currentFacility) return;
        if (this.isCraftingPanelOpen) return;
        if (gameObjects && gameObjects.length > 0) return;
        this.placeBuilding(pointer);
      }
    });

    this.input.on('wheel', (_pointer: any, _gameObjects: any, _dx: number, _dy: number) => {
      // P0: disable wheel-switch build flow, keep menu-driven selection.
      if (!this.isBuildMode) return;
    });
  }

  private createHUD(): void {
    const sw = this.cameras.main.width;
    const sh = this.cameras.main.height;

    this.interactionHint = this.add.text(sw / 2, sh - 70, '', {
      fontSize: this.worldFs(20, 18),
      color: '#facc15',
      fontFamily: this.getUIFontFamily(),
      backgroundColor: '#111827cc', padding: { x: 16, y: 8 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1200).setVisible(false);
  }

  private hasPlayerV2Texture(): boolean {
    return this.player?.texture?.key === HERO_V2_TEXTURE_KEY;
  }

  private resolveHeroDirection(vx: number, vy: number, fallback: HeroV2Direction): HeroV2Direction {
    if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return fallback;
    const angleDeg = Phaser.Math.RadToDeg(Math.atan2(vy, vx));
    if (angleDeg >= -22.5 && angleDeg < 22.5) return 'e';
    if (angleDeg >= 22.5 && angleDeg < 67.5) return 'se';
    if (angleDeg >= 67.5 && angleDeg < 112.5) return 's';
    if (angleDeg >= 112.5 && angleDeg < 157.5) return 'sw';
    if (angleDeg >= 157.5 || angleDeg < -157.5) return 'w';
    if (angleDeg >= -157.5 && angleDeg < -112.5) return 'nw';
    if (angleDeg >= -112.5 && angleDeg < -67.5) return 'n';
    return 'ne';
  }

  private resolveEnemyDirection(vx: number, vy: number, fallback: EnemyV2Direction): EnemyV2Direction {
    if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return fallback;
    if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? 'e' : 'w';
    return vy >= 0 ? 's' : 'n';
  }

  private updateV2CharacterAnimations(): void {
    this.updatePlayerV2WalkAnimation();
    this.updateEnemyV2WalkAnimation();
  }

  private updatePlayerV2WalkAnimation(): void {
    if (!this.hasPlayerV2Texture() || !this.player.active) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    this.playerFacingDir = this.resolveHeroDirection(vx, vy, this.playerFacingDir);
    if (Math.hypot(vx, vy) > 8) {
      if (this.time.now >= this.playerActionLockUntil) {
        this.playPlayerAction('walk');
      }
      return;
    }
    if (this.time.now < this.playerActionLockUntil) return;
    this.player.anims.stop();
    this.player.setFrame(getHeroFrameIndex(this.playerFacingDir, 'walk', 0));
  }

  private updateEnemyV2WalkAnimation(): void {
    const now = this.time.now;
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return;
      const ed = enemy as any;
      if (ed.dead || ed.isBoss) return;
      const archetype = (ed.enemyAnimArchetype as EnemyV2Archetype | undefined)
        || mapLegacyEnemyTypeToV2Archetype(String(ed.enemyType || 'zombie'));
      const textureKey = ENEMY_V2_TEXTURE_KEYS[archetype];
      if (enemy.texture?.key !== textureKey) return;

      const body = enemy.body as Phaser.Physics.Arcade.Body | null;
      const vx = body?.velocity.x || 0;
      const vy = body?.velocity.y || 0;
      const prevDir = (enemy.getData('v2FacingDir') as EnemyV2Direction | undefined) || 's';
      const dir = this.resolveEnemyDirection(vx, vy, prevDir);
      enemy.setData('v2FacingDir', dir);

      const actionLock = (enemy.getData('v2ActionLockUntil') as number | undefined) || 0;
      if (now < actionLock) return;

      if (Math.hypot(vx, vy) > 8) {
        this.playEnemyAction(enemy, 'walk');
        return;
      }

      enemy.anims.stop();
      enemy.setFrame(getEnemyFrameIndex(dir, 'walk', 0));
    });
  }

  private playPlayerAction(action: V2Action, force = false, lockMsOverride?: number): number {
    if (!this.hasPlayerV2Texture() || !this.player.active) return 0;
    const def = HERO_V2_ACTIONS[action];
    const key = heroAnimKey(this.playerFacingDir, action);
    if (!this.anims.exists(key)) return 0;
    if (def.repeat === -1) {
      if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) {
        this.player.anims.play(key, true);
      }
      return 0;
    }
    const now = this.time.now;
    if (!force && now < this.playerActionLockUntil) return 0;
    if (!force && this.player.anims.currentAnim?.key === key && this.player.anims.isPlaying) return 0;
    this.player.anims.play(key, true);
    const duration = lockMsOverride ?? getActionDurationMs(def);
    this.playerActionLockUntil = Math.max(this.playerActionLockUntil, now + duration);
    return duration;
  }

  private playEnemyAction(
    enemy: Phaser.Physics.Arcade.Sprite,
    action: V2Action,
    force = false,
    lockMsOverride?: number
  ): number {
    if (!enemy.active) return 0;
    const ed = enemy as any;
    const archetype = (ed.enemyAnimArchetype as EnemyV2Archetype | undefined)
      || mapLegacyEnemyTypeToV2Archetype(String(ed.enemyType || 'zombie'));
    const textureKey = ENEMY_V2_TEXTURE_KEYS[archetype];
    if (enemy.texture?.key !== textureKey) return 0;

    const def = ENEMY_V2_ACTIONS[action];
    const body = enemy.body as Phaser.Physics.Arcade.Body | null;
    const prevDir = (enemy.getData('v2FacingDir') as EnemyV2Direction | undefined) || 's';
    const dir = this.resolveEnemyDirection(body?.velocity.x || 0, body?.velocity.y || 0, prevDir);
    enemy.setData('v2FacingDir', dir);

    const key = enemyAnimKey(archetype, dir, action);
    if (!this.anims.exists(key)) return 0;

    if (def.repeat === -1) {
      if (enemy.anims.currentAnim?.key !== key || !enemy.anims.isPlaying) {
        enemy.anims.play(key, true);
      }
      return 0;
    }

    const now = this.time.now;
    const lockUntil = (enemy.getData('v2ActionLockUntil') as number | undefined) || 0;
    if (!force && now < lockUntil) return 0;
    if (!force && enemy.anims.currentAnim?.key === key && enemy.anims.isPlaying) return 0;
    enemy.anims.play(key, true);
    const duration = lockMsOverride ?? getActionDurationMs(def);
    enemy.setData('v2ActionLockUntil', now + duration);
    return duration;
  }

  private onPlayerHitAnimation(): void {
    if (this.isGameOver) return;
    this.playPlayerAction('hurt', true, 180);
  }

  // ============================================================
  // UPDATE LOOP
  // ============================================================
  update(_time: number, delta: number): void {
    this.frameCounter += 1;
    if ((gameState.data.playerLevel || 1) !== this.lastAppliedUpgradeLevel) {
      this.applyDynamicPlayerUpgradeBonuses(true);
    }
    this.updateScavengeDurabilityState();
    if (this.dayChallengeSelectionOpen || this.nightDirectiveSelectionOpen) {
      this.explorationEdgeIndicators.forEach((indicator) => indicator.setVisible(false));
      return;
    }
    if (this.daySpotMiniGameOpen) {
      if (this.caveRaidMiniGameActive) {
        if ((this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
          || (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey))) {
          this.tryCaveRaidAttack();
        }
        if ((this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up))
          || (this.jumpKey && Phaser.Input.Keyboard.JustDown(this.jumpKey))) {
          this.requestCaveRaidJump();
        }
      } else if (this.forestHuntMiniGameActive) {
        if ((this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
          || (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey))) {
          this.triggerForestHuntAction();
        }
      } else if (this.cityScavengeMiniGameActive) {
        if ((this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
          || (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey))) {
          this.triggerCityScavengeAction();
        }
      } else if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.resolveDayExplorationMiniGame();
      }
      this.updateDayExplorationMiniGame(delta);
      this.explorationEdgeIndicators.forEach((indicator) => indicator.setVisible(false));
      return;
    }
    if (this.isGameOver || this.runEventOpen) {
      this.explorationEdgeIndicators.forEach((indicator) => indicator.setVisible(false));
      return;
    }
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.currentFacility) {
        this.exitFacility();
      } else
      if (this.time.now >= this.interactionDebounceUntil) {
        this.interactionDebounceUntil = this.time.now + 130;
        this.handleInteraction();
      }
    }
    if (this.emergencyExitKey && Phaser.Input.Keyboard.JustDown(this.emergencyExitKey)) {
      if (!this.currentFacility) {
        this.recoverFacilityTransitionState();
        if (this.isBuildMode) this.exitBuildMode();
        if (this.isCraftingPanelOpen) events.emit('toggle-crafting');
      }
    }
    if (this.facilityTransitioning && this.time.now - this.facilityTransitionStartedAt > 1100) {
      this.recoverFacilityTransitionState();
    }
    if (this.levelUpPanelOpen) return; // Pause during level-up
    if (this.currentFacility && !this.facilityTransitioning) {
      this.enforceFacilityLock();
    }

    // Systems
    if (!this.currentFacility) {
      this.playerSystem.update();
    } else {
      this.playerSystem.setMovementEnabled(false);
      this.enforceFacilityLock();
    }
    if (this.currentFacility && !this.facilityTransitioning) {
      this.enforceFacilityLock();
    }
    this.enemySystem.update();
    this.updateScavengerCollectors();
    this.lootSystem.update();
    this.weatherSystem.update();

    // VS-style multi-weapon auto-fire
    if (!this.currentFacility) {
      this.autoFireAllWeapons(delta);
    }

    // Turret AI
    this.updateTurrets();

    // Companion system
    const combatBoost = this.getPlayerCombatBoost();
    const companionGlobalBonus = Math.max(
      0,
      Math.floor(((gameState.data.playerLevel || 1) * 2.6 + Math.max(0, this.comboCount) * 0.2) * combatBoost.companionDamageMul)
    );
    this.companionSystem.update(
      this.enemies,
      this.companionBullets,
      companionGlobalBonus,
      this.permanentTalentBonuses.companionFireRateMul * combatBoost.companionFireRateMul
    );
    if (this.time.now >= this.nextCompanionRosterSyncAt) {
      this.nextCompanionRosterSyncAt = this.time.now + (this.lowPerfMode ? 260 : 120);
      this.syncCompanionRoster();
    }
    this.updateNightBaseDefense();
    this.updateNightDirectivePressure();
    if (this.time.now >= this.nextExplorationUiUpdateAt) {
      this.nextExplorationUiUpdateAt = this.time.now + (this.lowPerfMode ? 280 : 120);
      this.updateExplorationSpotStatus();
      this.refreshExplorationMarkerVisibility();
    }
    if (this.time.now >= this.nextResidentAssistUpdateAt) {
      this.nextResidentAssistUpdateAt = this.time.now + (this.lowPerfMode ? 220 : 120);
      this.updateResidentAssistTask();
    }
    if (this.time.now >= this.nextAutoDutyDispatchSyncAt) {
      this.nextAutoDutyDispatchSyncAt = this.time.now + (this.lowPerfMode ? 2600 : 1400);
      this.maintainAutoDutyDispatch();
    }
    this.updateConstructionAutomation(delta);

    // Homing bullets (every other frame is sufficient)
    if (this.frameCounter % 2 === 0) {
      this.updateHomingBullets();
    }
    if (this.frameCounter % 2 === 0) {
      this.updateBulletMotionPatterns(delta);
    }

    // Bullet cleanup (every 3rd frame)
    if (this.frameCounter % 3 === 0) {
      this.cleanupBullets();
    }
    if (this.frameCounter % 2 === 0) {
      this.updateBulletTrails(delta);
    }

    // Build preview
    if (this.isBuildMode) {
      this.updateBuildPreview();
    }

    // Hunger warning
    const deficit = gameState.data.base.foodDeficit || 0;
    if (deficit > 0) {
      const now = this.time.now;
      if (now - this.lastHungerWarning > 8000) {
        this.lastHungerWarning = now;
        this.showFloatingText(this.cameras.main.width / 2, 200, `⚠ 缺粮 ${deficit}，伤害下降`, '#ef4444', true);
      }
    }

    // Lighting
    if (!this.lowPerfMode || this.time.now >= this.nextLightingUpdateAt) {
      this.nextLightingUpdateAt = this.time.now + (this.ultraLowPerfMode ? 48 : this.lowPerfMode ? 34 : 0);
      this.updateLighting();
    }

    // Animation (every other frame is visually indistinguishable)
    if (this.frameCounter % 2 === 0) {
      this.updateV2CharacterAnimations();
    }
    if (this.player?.active && this.frameCounter % 2 === 0) {
      this.animationSystem.updateSquashAndStretch(this.player);
    }

    // Interaction hints (every 3rd frame)
    if (this.frameCounter % 3 === 0) {
      this.updateInteractionHints();
      this.updateExplorationEdgeIndicators();
    }

    // Combo decay
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) {
      this.comboCount = 0;
      if (this.comboText) this.comboText.setVisible(false);
    }
    if (this.time.now >= this.nextGearResonanceCheckAt) {
      this.nextGearResonanceCheckAt = this.time.now + 2000;
      this.updateGearResonanceState();
    }
    if (this.frameCounter % 3 === 0) {
      this.updateBattleMomentumState();
      this.updateOverdriveState();
      this.updateLevelSurgeState();
      this.updateProtocolAuraState();
      this.updatePowerTierState();
    }
    this.updateComboDisplay();

    // Speed lines when moving fast (throttled to avoid object leak)
    if (!this.lowPerfMode && this.frameCounter % 4 === 0) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (body) {
        const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
        if (speed > 180 && Math.random() < 0.25) {
          const line = this.add.rectangle(
            this.player.x - body.velocity.x * 0.1 + Phaser.Math.Between(-10, 10),
            this.player.y - body.velocity.y * 0.1 + Phaser.Math.Between(-10, 10),
            2, 8, 0x0ea5e9, 0.3
          ).setDepth(3);
          this.tweens.add({ targets: line, alpha: 0, duration: 150, onComplete: () => line.destroy() });
        }
      }
    }

    // Survivor spawn during day (only when population has room)
    if (!gameState.data.isNight && BaseSystem.canRecruitCompanion(1) && Math.random() < 0.001) {
      this.spawnSurvivor();
    }
  }

  // ============================================================
  // COMBAT
  // ============================================================
  private autoFireAllWeapons(_delta: number): void {
    const nearest = this.enemySystem.findNearestEnemy();
    if (!nearest) return;
    const baseMods = EvolutionSystem.getEquippedBrandCombatModifiers();
    const playerCombatBoost = this.getPlayerCombatBoost();
    const brandMods = {
      ...baseMods,
      fireRateMul: (baseMods.fireRateMul || 1) * playerCombatBoost.fireRateMul,
      damageMul: (baseMods.damageMul || 1) * playerCombatBoost.damageMul,
      projectileBonus: Math.max(0, (baseMods.projectileBonus || 0) + playerCombatBoost.projectileBonus),
      speedMul: (baseMods.speedMul || 1) * playerCombatBoost.speedMul,
      spreadMul: (baseMods.spreadMul || 1) * playerCombatBoost.spreadMul,
      pierceBonus: (baseMods.pierceBonus || 0) + playerCombatBoost.pierceBonus,
      patternPower: playerCombatBoost.patternPower,
      signatureRateMul: playerCombatBoost.signatureRateMul,
      extraChainChance: playerCombatBoost.extraChainChance,
      signatureDamageMul: playerCombatBoost.signatureDamageMul,
      signatureSpeedMul: playerCombatBoost.signatureSpeedMul,
      orbitAmpMul: playerCombatBoost.orbitAmpMul,
      companionDamageMul: playerCombatBoost.companionDamageMul,
      companionFireRateMul: playerCombatBoost.companionFireRateMul,
    };

    // Fire primary weapon
    const didFire = this.weaponSystem.fire(this.player.x, this.player.y, nearest.x, nearest.y, brandMods);
    let didAnyShot = didFire;
    if (didFire) {
      this.animationSystem.playRecoil(this.player, 0.12);
      this.createMuzzleFlash(this.player.x + 20, this.player.y);
    }

    // Fire additional VS weapons
    const activeWeapons = EvolutionSystem.getActiveWeapons();
    const now = this.time.now;
    const activeTimerKeys = new Set<string>();
    for (const weapon of activeWeapons) {
      if (!weapon.def) continue;
      const timerKey = weapon.slotKey || weapon.id;
      activeTimerKeys.add(timerKey);
      const adjustedFireRate = Math.max(30, (weapon.def.fireRate || 400) / Math.max(0.4, brandMods.fireRateMul || 1));
      let lastFire = this.weaponTimers.get(timerKey) || 0;
      if (now < lastFire) {
        // Guard against clock rollback after scene transitions/pauses.
        lastFire = now - adjustedFireRate;
        this.weaponTimers.set(timerKey, lastFire);
      }
      if (now - lastFire < adjustedFireRate) continue;

      const baseWeaponId = String(weapon.slotKey || weapon.id).split('#')[0] || weapon.id;
      const firedCount = this.fireVSWeapon(weapon.def, nearest, brandMods, baseWeaponId, weapon.level);
      if (firedCount > 0) {
        didAnyShot = true;
        this.weaponTimers.set(timerKey, now);
      } else {
        // If bullet pool was saturated, retry faster to prevent "one shot then stop".
        this.weaponTimers.set(timerKey, now - adjustedFireRate * 0.85);
      }
    }
    // Clear stale timers for removed/evolved slots.
    Array.from(this.weaponTimers.keys()).forEach(key => {
      if (!activeTimerKeys.has(key)) this.weaponTimers.delete(key);
    });
    if (didAnyShot) {
      this.playPlayerAction('attack', true, 120);
    }
  }

  private getPlayerCombatBoost(): {
    fireRateMul: number;
    damageMul: number;
    projectileBonus: number;
    speedMul: number;
    spreadMul: number;
    pierceBonus: number;
    patternPower: number;
    signatureRateMul: number;
    extraChainChance: number;
    signatureDamageMul: number;
    signatureSpeedMul: number;
    orbitAmpMul: number;
    companionDamageMul: number;
    companionFireRateMul: number;
  } {
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const permanentDamageLv = Math.max(0, gameState.meta?.permanentUpgrades?.damage || 0);
    const permanentMobilityLv = Math.max(0, gameState.meta?.permanentUpgrades?.mobility || 0);
    const killCount = Math.max(0, gameState.data.stats.enemiesKilled || 0);
    const tier = this.getPowerTierProfile(level, week, killCount);
    const comboTier = Math.floor(Math.max(0, this.comboCount) / 25);
    const activeCompanions = gameState.data.companions.filter(c => c.status !== 'base');
    const partyCount = Math.max(0, activeCompanions.length);
    const avgCompanionLevel = activeCompanions.length > 0
      ? activeCompanions.reduce((sum, c) => sum + Math.max(1, c.level || 1), 0) / activeCompanions.length
      : 0;
    const roleVariety = new Set(activeCompanions.map(c => c.role)).size;
    const masteryLevels = Object.values(this.weaponMasteryLevels);
    const masteryAvg = masteryLevels.reduce((sum, lv) => sum + lv, 0) / Math.max(1, masteryLevels.length);
    const masteryPeak = Math.max(...masteryLevels);
    const pacing = this.getRunPacingProfile();
    const runMomentumTier = Math.min(20, Math.floor(killCount / 35));
    const runMomentumMul = runMomentumTier * 0.02;
    const protocolBonuses = EvolutionSystem.getProtocolCombatBonuses();
    const permanentDamageBonus = Math.min(0.72, permanentDamageLv * 0.055);
    const permanentSpeedBonus = Math.min(0.25, permanentMobilityLv * 0.018);
    const weekPressureBonus = Math.min(0.32, Math.max(0, week - 1) * 0.04);
    const partySyncBonus = Math.min(0.18, partyCount * 0.03);
    const masteryBonus = Math.max(0, masteryAvg - 1) * 0.022;
    const projectileBonus =
      (level >= 4 ? 1 : 0) +
      (level >= 9 ? 1 : 0) +
      (level >= 14 ? 1 : 0) +
      (level >= 20 ? 1 : 0) +
      (level >= 24 ? 1 : 0) +
      (masteryPeak >= 5 ? 1 : 0) +
      (masteryPeak >= 9 ? 1 : 0) +
      (runMomentumTier >= 10 ? 1 : 0) +
      protocolBonuses.projectileBonus +
      this.gearResonanceProjectileBonus;
    const pierceBonus =
      (level >= 7 ? 1 : 0) +
      (level >= 13 ? 1 : 0) +
      (level >= 19 ? 1 : 0) +
      (masteryPeak >= 7 ? 1 : 0) +
      protocolBonuses.pierceBonus;
    const companionDamageBonus = Math.min(0.25, avgCompanionLevel * 0.013 + roleVariety * 0.018);
    const fireRateMul = (1 + Math.min(
      1.08,
      (level - 1) * 0.017 +
      0.1 +
      (week - 1) * 0.022 +
      comboTier * 0.014 +
      partySyncBonus * 0.9 +
      masteryBonus * 0.85 +
      runMomentumMul * 0.9
    )) * protocolBonuses.fireRateMul * this.gearResonanceFireRateMul * pacing.combatMul;
    const damageMul = (1 + Math.min(
      1.85,
      (level - 1) * 0.03 +
      0.16 +
      (week - 1) * 0.036 +
      comboTier * 0.044 +
      partySyncBonus * 1.1 +
      masteryBonus * 1.2 +
      companionDamageBonus +
      runMomentumMul * 1.15 +
      weekPressureBonus +
      permanentDamageBonus
    )) * protocolBonuses.damageMul * this.gearResonanceDamageMul * pacing.combatMul;
    const speedMul = (1 + Math.min(0.62, (level - 1) * 0.012 + partySyncBonus * 0.55 + masteryBonus * 0.34 + runMomentumMul * 0.2 + permanentSpeedBonus))
      * protocolBonuses.speedMul;
    const speedMulWithGear = speedMul * this.gearResonanceSpeedMul;
    const spreadMul = Math.max(0.5, 1 - Math.min(0.5, (level - 1) * 0.014 + partySyncBonus * 0.28 + masteryBonus * 0.32 + runMomentumMul * 0.14));
    const patternPower = Math.max(0, protocolBonuses.patternPower + Math.floor(level / 8));
    const signatureRateMul = protocolBonuses.signatureRateMul * (1 + Math.min(0.36, masteryPeak * 0.03 + level * 0.004));
    const extraChainChance = protocolBonuses.extraChainChance + Math.min(0.1, runMomentumTier * 0.004);
    const signatureDamageMul = 1 + Math.min(0.5, patternPower * 0.07 + level * 0.004);
    const signatureSpeedMul = 1 + Math.min(0.44, patternPower * 0.055 + level * 0.003);
    const orbitAmpMul = 1 + Math.min(0.38, patternPower * 0.05);
    const companionDamageMul = protocolBonuses.companionDamageMul
      * (1 + Math.min(0.22, avgCompanionLevel * 0.006 + roleVariety * 0.03));
    const companionFireRateMul = protocolBonuses.companionFireRateMul
      * (1 + Math.min(0.16, avgCompanionLevel * 0.004 + roleVariety * 0.02));
    const levelSpikeTier = Math.floor((level - 1) / 5);
    const levelSpikeFireRateMul = 1 + Math.min(0.34, levelSpikeTier * 0.055);
    const levelSpikeDamageMul = 1 + Math.min(0.52, levelSpikeTier * 0.08);
    const levelSpikeSpeedMul = 1 + Math.min(0.26, levelSpikeTier * 0.038);
    const levelSpikeProjectileBonus = Math.floor((level - 1) / 10);
    const levelSpikePierceBonus = level >= 18 ? 1 : 0;
    const tieredBoost = {
      fireRateMul: fireRateMul * tier.fireRateMul * levelSpikeFireRateMul,
      damageMul: damageMul * tier.damageMul * levelSpikeDamageMul,
      projectileBonus: projectileBonus + tier.projectileBonus + levelSpikeProjectileBonus,
      speedMul: speedMulWithGear * tier.speedMul * levelSpikeSpeedMul,
      spreadMul: spreadMul,
      pierceBonus: pierceBonus + tier.pierceBonus + levelSpikePierceBonus,
      patternPower,
      signatureRateMul,
      extraChainChance,
      signatureDamageMul,
      signatureSpeedMul,
      orbitAmpMul,
      companionDamageMul,
      companionFireRateMul,
    };
    if (this.isBattleMomentumActive()) {
      tieredBoost.fireRateMul *= 1.16;
      tieredBoost.damageMul *= 1.22;
      tieredBoost.projectileBonus += 1;
      tieredBoost.speedMul *= 1.08;
      tieredBoost.signatureRateMul *= 1.06;
      tieredBoost.extraChainChance = Math.min(0.72, tieredBoost.extraChainChance + 0.05);
    }
    if (this.time.now < this.levelSurgeUntil) {
      return {
        fireRateMul: tieredBoost.fireRateMul * 1.24,
        damageMul: tieredBoost.damageMul * 1.28,
        projectileBonus: tieredBoost.projectileBonus + 1,
        speedMul: tieredBoost.speedMul * 1.16,
        spreadMul: Math.max(0.45, tieredBoost.spreadMul * 0.8),
        pierceBonus: tieredBoost.pierceBonus + 1,
        patternPower: tieredBoost.patternPower + 1,
        signatureRateMul: tieredBoost.signatureRateMul * 1.1,
        extraChainChance: Math.min(0.62, tieredBoost.extraChainChance + 0.06),
        signatureDamageMul: tieredBoost.signatureDamageMul * 1.08,
        signatureSpeedMul: tieredBoost.signatureSpeedMul * 1.08,
        orbitAmpMul: tieredBoost.orbitAmpMul * 1.06,
        companionDamageMul: tieredBoost.companionDamageMul * 1.08,
        companionFireRateMul: tieredBoost.companionFireRateMul * 1.06,
      };
    }
    if (this.isOverdriveActive()) {
      return {
        fireRateMul: tieredBoost.fireRateMul * 1.32,
        damageMul: tieredBoost.damageMul * 1.5,
        projectileBonus: tieredBoost.projectileBonus + 1,
        speedMul: tieredBoost.speedMul * 1.22,
        spreadMul: Math.max(0.45, tieredBoost.spreadMul * 0.78),
        pierceBonus: tieredBoost.pierceBonus + 1,
        patternPower: tieredBoost.patternPower + 1,
        signatureRateMul: tieredBoost.signatureRateMul * 1.14,
        extraChainChance: Math.min(0.68, tieredBoost.extraChainChance + 0.08),
        signatureDamageMul: tieredBoost.signatureDamageMul * 1.14,
        signatureSpeedMul: tieredBoost.signatureSpeedMul * 1.12,
        orbitAmpMul: tieredBoost.orbitAmpMul * 1.08,
        companionDamageMul: tieredBoost.companionDamageMul * 1.12,
        companionFireRateMul: tieredBoost.companionFireRateMul * 1.09,
      };
    }
    return tieredBoost;
  }

  private fireVSWeapon(
    weaponDef: any,
    target: Phaser.Physics.Arcade.Sprite,
    brandMods?: ReturnType<typeof EvolutionSystem.getEquippedBrandCombatModifiers> & {
      patternPower?: number;
      signatureRateMul?: number;
      extraChainChance?: number;
      signatureDamageMul?: number;
      signatureSpeedMul?: number;
      orbitAmpMul?: number;
    },
    weaponId?: string,
    weaponLevel?: number
  ): number {
    if (!weaponDef) return 0;
    const mods: ReturnType<typeof EvolutionSystem.getEquippedBrandCombatModifiers> & {
      patternPower?: number;
      signatureRateMul?: number;
      extraChainChance?: number;
      signatureDamageMul?: number;
      signatureSpeedMul?: number;
      orbitAmpMul?: number;
    } = {
      ...EvolutionSystem.getEquippedBrandCombatModifiers(),
      ...(brandMods || {}),
    };
    const glassesSpecials = EvolutionSystem.getGlassesSpecials();
    const enableGlobalHoming = glassesSpecials.has('emergence_resonance') || glassesSpecials.has('gemini_assist');
    const milestoneStage = getWeaponMilestoneBonuses(weaponId || String(weaponDef.id || ''), Math.max(1, weaponLevel || 1)).count;
    const milestoneIntensity = 1 + milestoneStage * 0.34;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    const projectileCount = Math.max(1, (weaponDef.projectileCount || 1) + (mods.projectileBonus || 0));
    const spreadDeg = (weaponDef.spread || 0) * (mods.spreadMul || 1);
    const speed = Math.max(80, (weaponDef.speed || 400) * (mods.speedMul || 1));
    const patternPower = Math.max(0, Math.floor(mods.patternPower || 0));
    const signatureRateMul = Math.max(0.55, mods.signatureRateMul || 1);
    const signatureDamageMul = Math.max(0.7, mods.signatureDamageMul || 1);
    const signatureSpeedMul = Math.max(0.7, mods.signatureSpeedMul || 1);
    const orbitAmpMul = Math.max(0.75, mods.orbitAmpMul || 1);
    const extraChainChance = Phaser.Math.Clamp(mods.extraChainChance || 0, 0, 0.65);
    const finalSpecial = weaponDef.special || mods.forceSpecial;
    const damage = (weaponDef.damage || 10) * (mods.damageMul || 1);
    let created = 0;
    const patternKey = String(weaponDef.id || weaponDef.nameCN || weaponDef.name || 'vs');
    const shotIndex = (this.vsWeaponPatternCounter.get(patternKey) || 0) + 1;
    this.vsWeaponPatternCounter.set(patternKey, shotIndex);
    const patternIntensity = 1 + patternPower * 0.22 + Math.max(0, signatureRateMul - 1) * 0.35 + milestoneStage * 0.16;

    for (let i = 0; i < projectileCount; i++) {
      const spread = spreadDeg * (Math.PI / 180);
      const bulletAngle = angle + (Math.random() - 0.5) * spread;
      const bullet = this.acquireBulletFromGroup(this.vsBullets, this.player.x, this.player.y);
      if (!bullet) continue;
      created += 1;

      bullet.enableBody(true, this.player.x, this.player.y, true, true);
      bullet.setActive(true).setVisible(true);
      const bulletTexture = this.getVSBulletTexture(weaponDef, finalSpecial);
      bullet.setTexture(bulletTexture);
      bullet.setAlpha(1);
      const bulletScale = this.getVSBulletScale(bulletTexture) * (bulletTexture === 'bullet_cannon' ? (1 + milestoneStage * 0.08) : (1 + milestoneStage * 0.14));
      bullet.setScale(bulletScale);
      const baseTint = weaponDef.color || 0x0ea5e9;
      const visualTint = finalSpecial ? baseTint : (mods.tintColor || baseTint);
      bullet.setTint(visualTint);
      bullet.setBlendMode(Phaser.BlendModes.ADD);
      bullet.setDepth(10);

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.reset(this.player.x, this.player.y);
      body.setAllowGravity(false);
      const radius = Math.max(4, Math.min(7, Math.floor(4 * bulletScale)));
      body.setCircle(radius, bullet.width / 2 - radius, bullet.height / 2 - radius);
      body.setCollideWorldBounds(false);
      body.setBounce(0, 0);
      body.setDrag(0, 0);
      const baseVelocityX = Math.cos(bulletAngle) * speed;
      const baseVelocityY = Math.sin(bulletAngle) * speed;
      body.setVelocity(baseVelocityX, baseVelocityY);
      bullet.setRotation(bulletAngle + Math.PI / 2);
      this.createBulletMuzzleVfx(this.player.x, this.player.y, bulletAngle, visualTint, bulletTexture, milestoneIntensity);

      // Store weapon data on bullet
      const anyBullet = bullet as any;
      anyBullet.weaponDamage = damage;
      anyBullet.weaponType = weaponDef.id;
      anyBullet.weaponSpecial = finalSpecial;
      anyBullet.weaponRange = weaponDef.range || 400;
      anyBullet.originX = this.player.x;
      anyBullet.originY = this.player.y;
      anyBullet.isHoming = !!(enableGlobalHoming || mods.homing);
      anyBullet.homingTarget = (enableGlobalHoming || mods.homing) ? target : null;
      anyBullet.brandDamageApplied = true;
      anyBullet.milestoneStage = milestoneStage;
      anyBullet.vfxIntensity = milestoneIntensity;
      anyBullet.visualTrailBias = 1 + milestoneStage * 0.24;
      anyBullet.bulletTextureKey = bulletTexture;
      anyBullet.baseVelocityX = baseVelocityX;
      anyBullet.baseVelocityY = baseVelocityY;
      const swayArchetype = this.resolveBulletVfxArchetype(bulletTexture, finalSpecial);
      const swayAmp =
        swayArchetype === 'pulse' ? 22
          : swayArchetype === 'chain' ? 18
            : swayArchetype === 'flame' ? 14
              : 0;
      anyBullet.swayAmplitude = swayAmp > 0 ? swayAmp + milestoneStage * 4 : 0;
      anyBullet.swayFrequency = swayAmp > 0 ? (swayArchetype === 'flame' ? 0.02 : 0.014) + milestoneStage * 0.001 : 0;
      anyBullet.swayPhase = Math.random() * Math.PI * 2;
      if (finalSpecial === 'pierce') {
        const gearBonuses = gameState.getWeaponGearBonuses(weaponDef.id as any);
        anyBullet.pierceLeft = 1 + (mods.pierceBonus || 0) + Math.max(0, gearBonuses.pierceBonus || 0);
      } else {
        anyBullet.pierceLeft = null;
      }
      if (extraChainChance > 0 && Math.random() < extraChainChance) {
        anyBullet.weaponSpecial = 'chain';
      }

      // Auto-destroy after range
      const lifetime = (weaponDef.range || 400) / speed * 1000;
      anyBullet.spawnTime = this.time.now;
      anyBullet.maxLifetime = lifetime + 200;
      if (anyBullet.vsLifetimeTimer) {
        anyBullet.vsLifetimeTimer.remove();
        anyBullet.vsLifetimeTimer = null;
      }
      if (anyBullet.lifetimeTimer) {
        anyBullet.lifetimeTimer.remove();
        anyBullet.lifetimeTimer = null;
      }
      anyBullet.vsLifetimeTimer = this.time.delayedCall(lifetime, () => {
        anyBullet.vsLifetimeTimer = null;
        if (bullet.active) {
          this.disableBullet(bullet);
        }
      });
    }

    const cadence = (base: number): number => Math.max(1, Math.round(base / (signatureRateMul * patternIntensity)));
    const burstChance = Phaser.Math.Clamp((0.1 + patternPower * 0.045) * (14 / cadence(9)), 0, 0.72);
    if (patternPower > 0 && created > 0 && Math.random() < burstChance) {
      const burstCount = Math.min(14, 4 + patternPower);
      const burstSpread = Math.PI * 2;
      for (let i = 0; i < burstCount; i++) {
        const extra = this.acquireBulletFromGroup(this.vsBullets, this.player.x, this.player.y);
        if (!extra) continue;
        created += 1;
        const angleOffset = -burstSpread / 2 + (burstSpread / burstCount) * i;
        const burstAngle = angle + angleOffset;
        const burstSpeed = speed * (0.88 + patternPower * 0.06) * signatureSpeedMul;
        const burstDamage = damage * (0.54 + patternPower * 0.1) * signatureDamageMul;
        extra.enableBody(true, this.player.x, this.player.y, true, true);
        extra.setActive(true).setVisible(true);
        const burstTexture = this.getVSBulletTexture(weaponDef, finalSpecial === 'burn' ? 'burn' : finalSpecial || 'chain');
        extra.setTexture(burstTexture);
        extra.setScale(this.getVSBulletScale(burstTexture) * (1 + milestoneStage * 0.16));
        extra.setTint(weaponDef.color || 0x0ea5e9);
        extra.setBlendMode(Phaser.BlendModes.ADD);
        const body = extra.body as Phaser.Physics.Arcade.Body;
        body.reset(this.player.x, this.player.y);
        body.setAllowGravity(false);
        const extraScale = this.getVSBulletScale(burstTexture);
        const extraRadius = Math.max(4, Math.min(7, Math.floor(4 * extraScale)));
        body.setCircle(extraRadius, extra.width / 2 - extraRadius, extra.height / 2 - extraRadius);
        body.setCollideWorldBounds(false);
        body.setBounce(0, 0);
        body.setDrag(0, 0);
        body.setVelocity(Math.cos(burstAngle) * burstSpeed, Math.sin(burstAngle) * burstSpeed);
        extra.setRotation(burstAngle + Math.PI / 2);
        const anyExtra = extra as any;
        anyExtra.weaponDamage = burstDamage;
        anyExtra.weaponType = weaponDef.id;
        anyExtra.weaponSpecial = extraChainChance > 0.22 ? 'chain' : finalSpecial;
        anyExtra.weaponRange = Math.max(160, (weaponDef.range || 400) * 0.75);
        anyExtra.originX = this.player.x;
        anyExtra.originY = this.player.y;
        anyExtra.isHoming = false;
        anyExtra.homingTarget = null;
        anyExtra.brandDamageApplied = true;
        anyExtra.milestoneStage = milestoneStage;
        anyExtra.vfxIntensity = milestoneIntensity + 0.18;
        anyExtra.visualTrailBias = 1.08 + milestoneStage * 0.28;
        anyExtra.bulletTextureKey = burstTexture;
        anyExtra.baseVelocityX = Math.cos(burstAngle) * burstSpeed;
        anyExtra.baseVelocityY = Math.sin(burstAngle) * burstSpeed;
        anyExtra.swayAmplitude = (10 + patternPower * 2 + milestoneStage * 3) * orbitAmpMul;
        anyExtra.swayFrequency = 0.012 + patternPower * 0.0008 + milestoneStage * 0.0009;
        anyExtra.swayPhase = (Math.PI * 2 * i) / Math.max(1, burstCount);
        if (anyExtra.weaponSpecial === 'pierce') {
          const gearBonuses = gameState.getWeaponGearBonuses(weaponDef.id as any);
          anyExtra.pierceLeft = 2 + (mods.pierceBonus || 0) + Math.max(0, gearBonuses.pierceBonus || 0);
        } else {
          anyExtra.pierceLeft = null;
        }
        const burstLife = anyExtra.weaponRange / Math.max(120, burstSpeed) * 1000;
        anyExtra.spawnTime = this.time.now;
        anyExtra.maxLifetime = burstLife + 120;
        if (anyExtra.vsLifetimeTimer) anyExtra.vsLifetimeTimer.remove();
        anyExtra.vsLifetimeTimer = this.time.delayedCall(burstLife, () => {
          anyExtra.vsLifetimeTimer = null;
          if (extra.active) this.disableBullet(extra);
        });
      }
    }
    if (patternPower >= 3 && created > 0 && shotIndex % cadence(5) === 0) {
      const novaCount = Math.min(18, 8 + patternPower * 2);
      for (let i = 0; i < novaCount; i++) {
        const nova = this.acquireBulletFromGroup(this.vsBullets, this.player.x, this.player.y);
        if (!nova) continue;
        created += 1;
        const novaAngle = angle + (Math.PI * 2 * i / Math.max(1, novaCount)) + Phaser.Math.FloatBetween(-0.08, 0.08);
        const novaSpecial = finalSpecial === 'burn'
          ? 'burn'
          : finalSpecial === 'pierce'
            ? 'pierce'
            : 'chain';
        const novaTexture = this.getVSBulletTexture(weaponDef, novaSpecial);
        const novaScale = this.getVSBulletScale(novaTexture) * (novaTexture === 'bullet_cannon' ? (1.04 + milestoneStage * 0.08) : (1.08 + milestoneStage * 0.18));
        const novaSpeed = speed * (0.92 + patternPower * 0.045) * signatureSpeedMul;
        const novaDamage = damage * (0.38 + patternPower * 0.07) * signatureDamageMul;
        nova.enableBody(true, this.player.x, this.player.y, true, true);
        nova.setActive(true).setVisible(true);
        nova.setTexture(novaTexture);
        nova.setScale(novaScale);
        nova.setTint(weaponDef.color || 0x0ea5e9);
        nova.setBlendMode(Phaser.BlendModes.ADD);
        const body = nova.body as Phaser.Physics.Arcade.Body;
        body.reset(this.player.x, this.player.y);
        body.setAllowGravity(false);
        const novaRadius = Math.max(4, Math.min(7, Math.floor(4 * novaScale)));
        body.setCircle(novaRadius, nova.width / 2 - novaRadius, nova.height / 2 - novaRadius);
        body.setCollideWorldBounds(false);
        body.setBounce(0, 0);
        body.setDrag(0, 0);
        body.setVelocity(Math.cos(novaAngle) * novaSpeed, Math.sin(novaAngle) * novaSpeed);
        nova.setRotation(novaAngle + Math.PI / 2);
        const anyNova = nova as any;
        anyNova.weaponDamage = novaDamage;
        anyNova.weaponType = weaponDef.id;
        anyNova.weaponSpecial = extraChainChance > 0.18 ? 'chain' : novaSpecial;
        anyNova.weaponRange = Math.max(140, (weaponDef.range || 400) * 0.72);
        anyNova.originX = this.player.x;
        anyNova.originY = this.player.y;
        anyNova.isHoming = false;
        anyNova.homingTarget = null;
        anyNova.brandDamageApplied = true;
        anyNova.milestoneStage = milestoneStage;
        anyNova.vfxIntensity = milestoneIntensity + 0.34;
        anyNova.visualTrailBias = 1.14 + milestoneStage * 0.32;
        anyNova.bulletTextureKey = novaTexture;
        anyNova.baseVelocityX = Math.cos(novaAngle) * novaSpeed;
        anyNova.baseVelocityY = Math.sin(novaAngle) * novaSpeed;
        anyNova.swayAmplitude = (14 + patternPower * 2.4 + milestoneStage * 3.5) * orbitAmpMul;
        anyNova.swayFrequency = 0.014 + patternPower * 0.0009 + milestoneStage * 0.0011;
        anyNova.swayPhase = (Math.PI * 2 * i) / Math.max(1, novaCount);
        if (anyNova.weaponSpecial === 'pierce') {
          const gearBonuses = gameState.getWeaponGearBonuses(weaponDef.id as any);
          anyNova.pierceLeft = 2 + (mods.pierceBonus || 0) + Math.max(0, gearBonuses.pierceBonus || 0);
        } else {
          anyNova.pierceLeft = null;
        }
        const novaLife = anyNova.weaponRange / Math.max(120, novaSpeed) * 1000;
        anyNova.spawnTime = this.time.now;
        anyNova.maxLifetime = novaLife + 120;
        if (anyNova.vsLifetimeTimer) anyNova.vsLifetimeTimer.remove();
        anyNova.vsLifetimeTimer = this.time.delayedCall(novaLife, () => {
          anyNova.vsLifetimeTimer = null;
          if (nova.active) this.disableBullet(nova);
        });
      }
    }
    return created;
  }

  private getVSBulletTexture(weaponDef: any, special: string | undefined): string {
    const id = String(weaponDef?.id || '');
    if (id.includes('orbit')) return 'bullet_orbit';
    if (id.includes('holy') || id.includes('water') || id.includes('sanct')) return 'bullet_holy';
    if (id.includes('boomerang')) return 'bullet_boomerang';
    if (special === 'burn') return 'bullet_flame';
    if (special === 'pierce') return 'bullet_pierce';
    if (special === 'explode') return 'bullet_cannon';
    if (special === 'slow') return 'bullet_frost';
    if (special === 'chain') return 'bullet_chain';
    if (id.includes('scatter') || id.includes('crit_storm') || id.includes('shotgun')) return 'bullet_scatter';
    if (id.includes('pulse') || id.includes('bullet_hell') || id.includes('rifle')) return 'bullet_pulse';
    if (id.includes('flame') || id.includes('flamethrower') || id.includes('inferno')) return 'bullet_flame';
    if (id.includes('frost') || id.includes('absolute_zero')) return 'bullet_frost';
    if (id.includes('chain') || id.includes('storm') || id.includes('thunder')) return 'bullet_chain';
    if (id.includes('cannon') || id.includes('reflection')) return 'bullet_cannon';
    if (id.includes('pierce') || id.includes('annihilation') || id.includes('laser')) return 'bullet_pierce';
    return 'bullet';
  }

  private getVSBulletScale(texture: string): number {
    if (texture === 'bullet_cannon') return 3;
    if (texture === 'bullet_holy') return 2.3;
    if (texture === 'bullet_orbit' || texture === 'bullet_boomerang') return 2.15;
    return 2;
  }

  private resolveBulletVfxArchetype(textureKey: string | undefined, special: string | undefined): BulletVfxArchetype {
    const key = String(textureKey || '').toLowerCase();
    if (key.includes('orbit')) return 'orbit';
    if (key.includes('holy')) return 'holy';
    if (key.includes('boomerang')) return 'boomerang';

    const normalizedSpecial = String(special || '').toLowerCase();
    if (normalizedSpecial === 'burn' || normalizedSpecial === 'burning') return 'flame';
    if (normalizedSpecial === 'explode' || normalizedSpecial === 'explosive') return 'cannon';
    if (normalizedSpecial === 'chain') return 'chain';
    if (normalizedSpecial === 'pierce' || normalizedSpecial === 'piercing') return 'pierce';
    if (normalizedSpecial === 'slow' || normalizedSpecial === 'frozen') return 'frost';

    if (key.includes('scatter')) return 'scatter';
    if (key.includes('pulse')) return 'pulse';
    if (key.includes('flame')) return 'flame';
    if (key.includes('pierce')) return 'pierce';
    if (key.includes('cannon')) return 'cannon';
    if (key.includes('frost')) return 'frost';
    if (key.includes('chain')) return 'chain';
    return 'kinetic';
  }

  private acquireBulletFromGroup(
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite | null {
    let bullet = group.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (bullet) return bullet;

    const recycled = this.recycleOldestActiveBullet(group);
    if (recycled) {
      bullet = group.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
      if (bullet) return bullet;
    }

    // Last resort: force one sweep cleanup and retry once.
    this.cleanupBulletGroup(group);
    return group.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
  }

  private recycleOldestActiveBullet(group: Phaser.Physics.Arcade.Group): Phaser.Physics.Arcade.Sprite | null {
    let oldest: Phaser.Physics.Arcade.Sprite | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;
    group.getChildren().forEach(child => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (!bullet.active) return;
      const t = (bullet as any).spawnTime ?? 0;
      if (t < oldestTime) {
        oldestTime = t;
        oldest = bullet;
      }
    });
    if (oldest) this.disableBullet(oldest);
    return oldest;
  }

  private bulletHitEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active) return;
    const bulletData = bullet as any;
    const mods = EvolutionSystem.getEquippedBrandCombatModifiers();
    const bulletWeaponType = (bulletData.weaponType || this.weaponSystem.getCurrentWeaponType()) as WeaponType;
    const gearBonuses = gameState.getWeaponGearBonuses(bulletWeaponType as any);
    let damage = bulletData.weaponDamage ?? bulletData.damage ?? this.weaponSystem.getCurrentWeapon().damage ?? 10;
    if (!bulletData.brandDamageApplied) {
      damage *= (mods.damageMul || 1);
    }
    const special = bulletData.weaponSpecial ?? bulletData.special ?? mods.forceSpecial;
    damage = this.applyHungerPenalty(damage);

    // Apply special effects
    if (special === 'burn') this.applyBurnEffect(enemy);
    else if (special === 'slow') this.applySlowEffect(enemy);
    else if (special === 'explode') this.createExplosion(enemy.x, enemy.y, 80 * Math.max(0.75, gearBonuses.explosionRadiusMul || 1), damage * 0.5);
    else if (special === 'chain') this.createChainLightning(enemy, 3 + Math.max(0, gearBonuses.chainBonus || 0), damage * 0.6);
    else if (EvolutionSystem.getGlassesSpecials().has('neural_chain')) this.createChainLightning(enemy, 1, damage * 0.45);

    if (special === 'pierce') {
      if (bulletData.pierceLeft == null) bulletData.pierceLeft = 1 + (mods.pierceBonus || 0) + Math.max(0, gearBonuses.pierceBonus || 0);
      bulletData.pierceLeft -= 1;
      if (bulletData.pierceLeft <= 0) this.disableBullet(bullet);
    } else {
      this.disableBullet(bullet);
    }
    this.createBulletImpactVfx(
      enemy.x,
      enemy.y,
      special,
      bullet.tintTopLeft || 0x7dd3fc,
      (bullet as any).bulletTextureKey || bullet.texture?.key,
      bulletData.vfxIntensity || 1
    );

    const source: DamageSource = bulletData.ownerType === 'companion'
      ? { type: 'companion', companionId: bulletData.ownerId || null }
      : bulletData.ownerType === 'turret'
        ? { type: 'turret', turretId: bulletData.ownerId || null }
        : { type: 'player', weaponType: bulletWeaponType };
    this.damageEnemy(enemy, damage, source);
  }

  private cleanupBullets(): void {
    this.cleanupBulletGroup(this.bullets);
    this.cleanupBulletGroup(this.vsBullets);
    this.cleanupBulletGroup(this.companionBullets);
  }

  private updateBulletTrails(delta: number): void {
    const mobile = this.mobileViewport;
    this.bulletTrailTick += delta;
    const interval = this.ultraLowPerfMode ? 52 : this.lowPerfMode ? 38 : (mobile ? 28 : 16);
    if (this.bulletTrailTick < interval) return;
    this.bulletTrailTick = 0;

    const emitTrail = (group: Phaser.Physics.Arcade.Group, baseRate: number): void => {
      let emitted = 0;
      const maxEmit = this.ultraLowPerfMode ? 6 : this.lowPerfMode ? (mobile ? 10 : 16) : (mobile ? 16 : 30);
      group.getChildren().forEach((child) => {
        if (emitted >= maxEmit) return;
        const bullet = child as Phaser.Physics.Arcade.Sprite;
        if (!bullet.active) return;
        const b = bullet as any;
        const textureKey = b.bulletTextureKey || bullet.texture?.key;
        const special = b.weaponSpecial ?? b.special ?? b.bulletEffect?.type;
        const archetype = this.resolveBulletVfxArchetype(textureKey, special);
        const milestoneStage = Math.max(0, Math.floor(b.milestoneStage || 0));
        const vfxIntensity = Math.max(1, b.vfxIntensity || 1);
        const trailBias = Math.max(1, b.visualTrailBias || 1);
        const trailChance = archetype === 'scatter' ? 0.34
          : archetype === 'pulse' ? 0.44
            : archetype === 'flame' ? 0.48
              : archetype === 'holy' ? 0.46
                : archetype === 'orbit' ? 0.42
                  : archetype === 'boomerang' ? 0.38
              : archetype === 'pierce' ? 0.4
                : archetype === 'cannon' ? 0.3
                  : archetype === 'frost' ? 0.36
                    : archetype === 'chain' ? 0.42
                      : 0.32;
        const perfRate = this.ultraLowPerfMode ? 0.62 : this.lowPerfMode ? 0.82 : 1;
        if (Math.random() > baseRate * trailChance * perfRate * Math.min(1.8, trailBias * (0.92 + (vfxIntensity - 1) * 0.6))) return;
        const body = bullet.body as Phaser.Physics.Arcade.Body | null;
        const vx = body?.velocity.x ?? 0;
        const vy = body?.velocity.y ?? 0;
        const speed = Math.max(1, Math.hypot(vx, vy));
        const dir = Math.atan2(vy, vx);
        const tint = (bullet.tintTopLeft && bullet.tintTopLeft !== 0xffffff) ? bullet.tintTopLeft : 0x7dd3fc;
        const length = (archetype === 'pierce' ? 11
          : archetype === 'pulse' ? 9
            : archetype === 'cannon' ? 8
              : archetype === 'boomerang' ? 10
                : archetype === 'holy' ? 7
                  : archetype === 'orbit' ? 7
                    : 6) + milestoneStage * 1.8;
        const width = (archetype === 'cannon' ? 4 : archetype === 'scatter' ? 2 : archetype === 'holy' ? 4 : 3) + Math.min(1.4, milestoneStage * 0.35);
        const alpha = Math.min(0.72, (archetype === 'flame' ? 0.46 : archetype === 'holy' ? 0.44 : archetype === 'chain' ? 0.42 : 0.38) + milestoneStage * 0.05);
        const life = (archetype === 'cannon' ? 170 : archetype === 'frost' ? 150 : archetype === 'boomerang' ? 145 : 130) + milestoneStage * 18;
        const backOffset = Phaser.Math.Clamp(speed * 0.008, 4, 10);
        const tx = bullet.x - Math.cos(dir) * backOffset + Phaser.Math.FloatBetween(-1, 1);
        const ty = bullet.y - Math.sin(dir) * backOffset + Phaser.Math.FloatBetween(-1, 1);

        emitted += 1;
        const trail = this.add.rectangle(tx, ty, length, width, tint, alpha).setDepth(9);
        trail.setBlendMode(Phaser.BlendModes.ADD);
        trail.setRotation(dir + Math.PI / 2);
        this.tweens.add({
          targets: trail,
          alpha: 0,
          scaleX: 0.4,
          scaleY: archetype === 'cannon' ? 1.5 : 1.2,
          duration: life,
          onComplete: () => trail.destroy(),
        });

        if (!this.lowPerfMode && (archetype === 'flame' || archetype === 'cannon' || archetype === 'chain')) {
          const emberColor = archetype === 'chain' ? 0xd8b4fe : archetype === 'flame' ? 0xfb923c : 0xa855f7;
          const ember = this.add.rectangle(tx, ty, 2, 2, emberColor, 0.7).setDepth(10);
          ember.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: ember,
            x: tx - Math.cos(dir) * Phaser.Math.Between(5, 10),
            y: ty - Math.sin(dir) * Phaser.Math.Between(5, 10),
            alpha: 0,
            duration: life + 30,
            onComplete: () => ember.destroy(),
          });
        }
        if (!this.lowPerfMode && archetype === 'pulse') {
          const node = this.add.rectangle(tx, ty, 3, 3, 0x67e8f9, 0.34).setDepth(10);
          node.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: node,
            alpha: 0,
            scaleX: 1.8,
            scaleY: 1.8,
            duration: life + 15,
            onComplete: () => node.destroy(),
          });
        }
        if (!this.lowPerfMode && archetype === 'scatter' && Math.random() < 0.4) {
          const pellet = this.add.rectangle(tx, ty, 2, 2, 0xe2e8f0, 0.54).setDepth(10);
          pellet.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: pellet,
            x: tx + Phaser.Math.Between(-5, 5),
            y: ty + Phaser.Math.Between(-5, 5),
            alpha: 0,
            duration: life - 20,
            onComplete: () => pellet.destroy(),
          });
        }
        if (!this.lowPerfMode && archetype === 'holy') {
          const sigil = this.add.rectangle(tx, ty, 2, 8, 0xfef3c7, 0.72).setDepth(10);
          const sigilCross = this.add.rectangle(tx, ty, 8, 2, 0x93c5fd, 0.48).setDepth(10);
          sigil.setBlendMode(Phaser.BlendModes.ADD);
          sigilCross.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: [sigil, sigilCross],
            alpha: 0,
            scaleX: 1.5,
            scaleY: 0.4,
            duration: life + 20,
            onComplete: () => {
              sigil.destroy();
              sigilCross.destroy();
            },
          });
        }
        if (!this.lowPerfMode && archetype === 'orbit') {
          [-1, 1].forEach((side) => {
            const mote = this.add.circle(
              tx + Math.cos(dir + Math.PI / 2) * side * (4 + milestoneStage),
              ty + Math.sin(dir + Math.PI / 2) * side * (4 + milestoneStage),
              1.5 + milestoneStage * 0.25,
              tint,
              0.32
            ).setDepth(9);
            mote.setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({
              targets: mote,
              alpha: 0,
              scale: 1.9,
              duration: life + 30,
              onComplete: () => mote.destroy(),
            });
          });
        }
        if (!this.lowPerfMode && archetype === 'boomerang') {
          const arc = this.add.arc(tx, ty, 6 + milestoneStage, Phaser.Math.RadToDeg(dir) - 70, Phaser.Math.RadToDeg(dir) + 70, false, 0x6ee7b7, 0.22).setDepth(9);
          arc.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: arc,
            alpha: 0,
            scaleX: 1.45,
            scaleY: 1.45,
            duration: life + 20,
            onComplete: () => arc.destroy(),
          });
        }
        if (!this.lowPerfMode && archetype === 'frost') {
          const shard = this.add.rectangle(tx, ty, 2, 6, 0xe0f2fe, 0.65).setDepth(10);
          shard.setBlendMode(Phaser.BlendModes.ADD);
          shard.setRotation(dir + Math.PI / 4);
          this.tweens.add({
            targets: shard,
            alpha: 0,
            scaleY: 0.2,
            duration: 150,
            onComplete: () => shard.destroy(),
          });
        }
        if (!this.lowPerfMode && milestoneStage >= 2 && Math.random() < 0.45) {
          const offset = Phaser.Math.FloatBetween(5, 11 + milestoneStage * 2);
          const rune = this.add.circle(
            tx + Math.cos(dir + Math.PI / 2) * offset,
            ty + Math.sin(dir + Math.PI / 2) * offset,
            2 + milestoneStage,
            tint,
            0.18 + milestoneStage * 0.04
          ).setDepth(9);
          rune.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: rune,
            alpha: 0,
            scale: 1.6 + milestoneStage * 0.18,
            duration: life + 40,
            onComplete: () => rune.destroy(),
          });
        }
        if (!this.lowPerfMode && milestoneStage >= 3 && Math.random() < 0.28) {
          const cross = this.add.rectangle(tx, ty, length * 0.8, 2, tint, 0.34).setDepth(10);
          cross.setBlendMode(Phaser.BlendModes.ADD);
          cross.setRotation(dir);
          this.tweens.add({
            targets: cross,
            alpha: 0,
            scaleX: 1.8,
            scaleY: 0.4,
            duration: life + 30,
            onComplete: () => cross.destroy(),
          });
        }
      });
    };

    const baseMul = this.ultraLowPerfMode ? 0.7 : this.lowPerfMode ? 0.84 : 1;
    emitTrail(this.bullets, (mobile ? 0.62 : 0.78) * baseMul);
    emitTrail(this.vsBullets, (mobile ? 0.72 : 0.88) * baseMul);
    emitTrail(this.companionBullets, (mobile ? 0.58 : 0.7) * baseMul);
    emitTrail(this.turretBullets, (mobile ? 0.64 : 0.82) * baseMul);
  }

  private updateBulletMotionPatterns(delta: number): void {
    const updateGroup = (group: Phaser.Physics.Arcade.Group): void => {
      group.getChildren().forEach((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite;
        if (!bullet.active) return;
        const b = bullet as any;
        if (b.isHoming) return;
        const swayAmp = b.swayAmplitude ?? 0;
        const swayFrequency = b.swayFrequency ?? 0;
        if (swayAmp <= 0 || swayFrequency <= 0) return;
        const body = bullet.body as Phaser.Physics.Arcade.Body | null;
        if (!body) return;
        const baseVX = b.baseVelocityX ?? body.velocity.x;
        const baseVY = b.baseVelocityY ?? body.velocity.y;
        const baseSpeed = Math.max(1, Math.hypot(baseVX, baseVY));
        b.swayPhase = (b.swayPhase ?? 0) + delta * swayFrequency;
        const nx = baseVX / baseSpeed;
        const ny = baseVY / baseSpeed;
        const px = -ny;
        const py = nx;
        const sway = Math.sin(b.swayPhase) * swayAmp;
        const finalVX = baseVX + px * sway;
        const finalVY = baseVY + py * sway;
        body.setVelocity(finalVX, finalVY);
        bullet.setRotation(Math.atan2(finalVY, finalVX) + Math.PI / 2);
      });
    };

    updateGroup(this.bullets);
    updateGroup(this.vsBullets);
    updateGroup(this.companionBullets);
    updateGroup(this.turretBullets);
  }

  private cleanupBulletGroup(group: Phaser.Physics.Arcade.Group): void {
    const now = this.time.now;
    const bounds = this.physics.world.bounds;
    const margin = 120;
    group.getChildren().forEach(child => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (!bullet.active) return;
      const anyBullet = bullet as any;
      const body = bullet.body as Phaser.Physics.Arcade.Body | null;
      const age = now - (anyBullet.spawnTime || now);
      const maxLifetime = anyBullet.maxLifetime ?? 4000;
      const speed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;

      if (bullet.x < bounds.x - margin || bullet.x > bounds.right + margin ||
          bullet.y < bounds.y - margin || bullet.y > bounds.bottom + margin) {
        this.disableBullet(bullet);
        return;
      }

      if (age > maxLifetime) {
        this.disableBullet(bullet);
        return;
      }

      if (speed < 5 && age > 150) {
        this.disableBullet(bullet);
      }
    });
  }

  private disableBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    const anyBullet = bullet as any;
    if (anyBullet.vsLifetimeTimer) {
      anyBullet.vsLifetimeTimer.remove();
      anyBullet.vsLifetimeTimer = null;
    }
    if (anyBullet.lifetimeTimer) {
      anyBullet.lifetimeTimer.remove();
      anyBullet.lifetimeTimer = null;
    }
    anyBullet.weaponDamage = null;
    anyBullet.weaponSpecial = null;
    anyBullet.damage = null;
    anyBullet.special = null;
    anyBullet.bulletEffect = null;
    anyBullet.pierceLeft = null;
    anyBullet.brandDamageApplied = null;
    anyBullet.isHoming = false;
    anyBullet.homingTarget = null;
    anyBullet.homingStrength = null;
    anyBullet.ownerType = null;
    anyBullet.ownerId = null;
    anyBullet.milestoneStage = null;
    anyBullet.vfxIntensity = null;
    anyBullet.visualTrailBias = null;
    anyBullet.bulletTextureKey = null;
    anyBullet.baseVelocityX = null;
    anyBullet.baseVelocityY = null;
    anyBullet.swayAmplitude = null;
    anyBullet.swayFrequency = null;
    anyBullet.swayPhase = null;
    anyBullet.spawnTime = null;
    anyBullet.maxLifetime = null;
    bullet.setVelocity(0, 0);
    bullet.disableBody(true, true);
  }

  private createBulletImpactVfx(
    x: number,
    y: number,
    special: string | undefined,
    _color: number,
    textureKey?: string,
    intensity: number = 1
  ): void {
    const archetype = this.resolveBulletVfxArchetype(textureKey, special);
    const intensityMul = Phaser.Math.Clamp(intensity, 1, 2.5);
    const ringColor = archetype === 'cannon' ? 0xfb923c
      : archetype === 'chain' ? 0xd8b4fe
        : archetype === 'frost' ? 0x93c5fd
          : archetype === 'holy' ? 0xfef3c7
            : archetype === 'orbit' ? 0xf9a8d4
              : archetype === 'boomerang' ? 0x6ee7b7
          : archetype === 'flame' ? 0xf97316
            : archetype === 'pierce' ? 0x7dd3fc
              : 0x67e8f9;
    const coreSize = (archetype === 'cannon' ? 8 : archetype === 'pierce' ? 6 : archetype === 'holy' ? 7 : 5) * (1 + (intensityMul - 1) * 0.34);
    const baseSparkCount = archetype === 'cannon' ? 8 : archetype === 'scatter' ? 5 : archetype === 'holy' ? 7 : 6;
    const amplifiedSparkCount = Math.round(baseSparkCount * (1 + (intensityMul - 1) * 0.6));
    const sparkCount = this.ultraLowPerfMode ? Math.max(1, Math.floor(amplifiedSparkCount * 0.35))
      : this.lowPerfMode ? Math.max(2, Math.floor(amplifiedSparkCount * 0.55))
        : amplifiedSparkCount;
    const travel = (archetype === 'cannon' ? 28 : archetype === 'pierce' ? 22 : archetype === 'boomerang' ? 24 : 18) * (1 + (intensityMul - 1) * 0.28);
    const duration = (archetype === 'cannon' ? 220 : archetype === 'chain' ? 180 : archetype === 'holy' ? 190 : 150) * (1 + (intensityMul - 1) * 0.18);

    const core = this.add.rectangle(x, y, coreSize, coreSize, ringColor, 0.86).setDepth(110);
    core.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: core,
      alpha: 0,
      scaleX: archetype === 'pierce' ? 2.4 : 2,
      scaleY: archetype === 'pierce' ? 1.2 : 2,
      duration,
      onComplete: () => core.destroy(),
    });
    const halo = this.add.circle(x, y, coreSize + 2, ringColor, 0.24).setDepth(109);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: halo,
      alpha: 0,
      scale: archetype === 'cannon' ? 3.1 : 2.4,
      duration: duration + 40,
      onComplete: () => halo.destroy(),
    });
    if (!this.lowPerfMode && intensityMul >= 1.45) {
      const shock = this.add.circle(x, y, coreSize + 5, ringColor, 0.14).setDepth(108);
      shock.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shock,
        alpha: 0,
        scale: 2.6 + (intensityMul - 1) * 0.6,
        duration: duration + 70,
        onComplete: () => shock.destroy(),
      });
    }

    for (let i = 0; i < sparkCount; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(Math.floor(travel * 0.45), travel);
      const sparkW = archetype === 'pierce' ? 5 : archetype === 'boomerang' ? 4 : 3;
      const sparkH = archetype === 'pierce' ? 2 : archetype === 'holy' ? 4 : 3;
      const spark = this.add.rectangle(x, y, sparkW, sparkH, ringColor, 0.94).setDepth(111);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setRotation(angle + Math.PI / 2);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: duration + Phaser.Math.Between(20, 70),
        onComplete: () => spark.destroy(),
      });
    }

    if (!this.lowPerfMode && archetype === 'chain') {
      for (let i = 0; i < 2; i++) {
        const bolt = this.add.rectangle(x, y, 3, 12, 0xf5d0fe, 0.72).setDepth(112);
        bolt.setBlendMode(Phaser.BlendModes.ADD);
        bolt.setRotation(Phaser.Math.FloatBetween(-0.8, 0.8));
        this.tweens.add({
          targets: bolt,
          alpha: 0,
          scaleY: 0.2,
          duration: 160,
          onComplete: () => bolt.destroy(),
        });
      }
    } else if (!this.lowPerfMode && archetype === 'holy') {
      const rayA = this.add.rectangle(x, y, 3, 20, 0xfef9c3, 0.7).setDepth(112);
      const rayB = this.add.rectangle(x, y, 20, 3, 0x93c5fd, 0.45).setDepth(112);
      rayA.setBlendMode(Phaser.BlendModes.ADD);
      rayB.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: [rayA, rayB],
        alpha: 0,
        scaleX: 1.4,
        scaleY: 0.25,
        duration: 180,
        onComplete: () => {
          rayA.destroy();
          rayB.destroy();
        },
      });
    } else if (!this.lowPerfMode && archetype === 'orbit') {
      const swirl = this.add.arc(x, y, 10, -50, 210, false, 0xf9a8d4, 0.22).setDepth(112);
      swirl.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: swirl,
        alpha: 0,
        scaleX: 1.6,
        scaleY: 1.3,
        angle: 60,
        duration: 170,
        onComplete: () => swirl.destroy(),
      });
    } else if (!this.lowPerfMode && archetype === 'boomerang') {
      const crescent = this.add.arc(x, y, 12, -80, 80, false, 0x6ee7b7, 0.3).setDepth(112);
      crescent.setBlendMode(Phaser.BlendModes.ADD);
      crescent.setRotation(Phaser.Math.FloatBetween(-0.8, 0.8));
      this.tweens.add({
        targets: crescent,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.2,
        duration: 170,
        onComplete: () => crescent.destroy(),
      });
    } else if (!this.lowPerfMode && archetype === 'pulse') {
      const grid = this.add.rectangle(x, y, 16, 16, 0x67e8f9, 0.12).setDepth(112);
      grid.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: grid,
        alpha: 0,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 160,
        onComplete: () => grid.destroy(),
      });
    } else if (!this.lowPerfMode && archetype === 'scatter') {
      for (let i = 0; i < 3; i += 1) {
        const frag = this.add.rectangle(x, y, 2, 2, 0xf8fafc, 0.72).setDepth(112);
        frag.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: frag,
          x: x + Phaser.Math.Between(-12, 12),
          y: y + Phaser.Math.Between(-12, 12),
          alpha: 0,
          duration: 120,
          onComplete: () => frag.destroy(),
        });
      }
    } else if (!this.lowPerfMode && archetype === 'frost') {
      const shard = this.add.rectangle(x, y, 2, 14, 0xe0f2fe, 0.7).setDepth(112);
      shard.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shard,
        alpha: 0,
        angle: 70,
        duration: 180,
        onComplete: () => shard.destroy(),
      });
    }
    if (!this.lowPerfMode && intensityMul >= 1.85) {
      const slashA = this.add.rectangle(x, y, coreSize * 3.2, 2, 0xf8fafc, 0.42).setDepth(113);
      const slashB = this.add.rectangle(x, y, coreSize * 3.2, 2, ringColor, 0.34).setDepth(113);
      slashA.setBlendMode(Phaser.BlendModes.ADD);
      slashB.setBlendMode(Phaser.BlendModes.ADD);
      slashA.setRotation(Phaser.Math.FloatBetween(-0.9, 0.9));
      slashB.setRotation(slashA.rotation + Math.PI / 2);
      [slashA, slashB].forEach((slash) => {
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: 1.7,
          duration: duration + 30,
          onComplete: () => slash.destroy(),
        });
      });
    }
  }

  private createBulletMuzzleVfx(
    x: number,
    y: number,
    angle: number,
    tint: number,
    textureKey?: string,
    intensity: number = 1
  ): void {
    const archetype = this.resolveBulletVfxArchetype(textureKey, undefined);
    const intensityMul = Phaser.Math.Clamp(intensity, 1, 2.5);
    const dist = (archetype === 'cannon' ? 14 : 10) + (intensityMul - 1) * 4;
    const fxX = x + Math.cos(angle) * dist;
    const fxY = y + Math.sin(angle) * dist;
    const coreTint = archetype === 'holy' ? 0xfef3c7
      : archetype === 'orbit' ? 0xf9a8d4
        : archetype === 'boomerang' ? 0x6ee7b7
          : tint;
    const coreW = (archetype === 'pierce' ? 10 : archetype === 'cannon' ? 9 : archetype === 'boomerang' ? 9 : 7) * (1 + (intensityMul - 1) * 0.25);
    const coreH = (archetype === 'pierce' ? 4 : archetype === 'holy' ? 7 : 6) * (1 + (intensityMul - 1) * 0.16);
    const core = this.add.rectangle(fxX, fxY, coreW, coreH, coreTint, 0.78).setDepth(109);
    core.setBlendMode(Phaser.BlendModes.ADD);
    core.setRotation(angle + Math.PI / 2);
    this.tweens.add({
      targets: core,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 1.35,
      duration: (archetype === 'cannon' ? 110 : 80) * (1 + (intensityMul - 1) * 0.12),
      onComplete: () => core.destroy(),
    });
    const rune = this.add.circle(fxX, fxY, archetype === 'cannon' ? 7 : archetype === 'holy' ? 6 : 5, coreTint, 0.26).setDepth(108);
    rune.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: rune,
      alpha: 0,
      scale: archetype === 'cannon' ? 2.2 : 1.8,
      duration: (archetype === 'cannon' ? 130 : 95) * (1 + (intensityMul - 1) * 0.14),
      onComplete: () => rune.destroy(),
    });
    if (!this.lowPerfMode && intensityMul >= 1.4) {
      const echo = this.add.circle(fxX, fxY, (archetype === 'cannon' ? 9 : 6) * intensityMul, coreTint, 0.14).setDepth(107);
      echo.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: echo,
        alpha: 0,
        scale: 1.8,
        duration: 120,
        onComplete: () => echo.destroy(),
      });
    }
    if (!this.lowPerfMode && archetype === 'pulse') {
      const beam = this.add.rectangle(fxX, fxY, 14, 2, 0x67e8f9, 0.28).setDepth(108);
      beam.setBlendMode(Phaser.BlendModes.ADD);
      beam.setRotation(angle);
      this.tweens.add({
        targets: beam,
        alpha: 0,
        scaleX: 1.8,
        duration: 100,
        onComplete: () => beam.destroy(),
      });
    } else if (!this.lowPerfMode && archetype === 'scatter') {
      [-0.26, 0, 0.26].forEach((spread) => {
        const shard = this.add.rectangle(fxX, fxY, 6, 2, 0xe2e8f0, 0.32).setDepth(108);
        shard.setBlendMode(Phaser.BlendModes.ADD);
        shard.setRotation(angle + Math.PI + spread);
        this.tweens.add({
          targets: shard,
          alpha: 0,
          scaleX: 1.4,
          duration: 90,
          onComplete: () => shard.destroy(),
        });
      });
    }

    if (this.ultraLowPerfMode) return;
    const sparkCount = this.lowPerfMode ? 1 : Math.max(2, Math.round((archetype === 'cannon' ? 4 : 2) * (1 + (intensityMul - 1) * 0.55)));
    for (let i = 0; i < sparkCount; i++) {
      const spread = Phaser.Math.FloatBetween(-0.35, 0.35);
      const dir = angle + Math.PI + spread;
      const spark = this.add.rectangle(fxX, fxY, 2, 2, 0xf8fafc, 0.8).setDepth(109);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: fxX + Math.cos(dir) * Phaser.Math.Between(6, 12),
        y: fxY + Math.sin(dir) * Phaser.Math.Between(6, 12),
        alpha: 0,
        duration: 90,
        onComplete: () => spark.destroy(),
      });
    }
    if (!this.lowPerfMode && archetype === 'holy') {
      const halo = this.add.arc(fxX, fxY, 7 + intensityMul, -35, 215, false, 0x93c5fd, 0.18).setDepth(108);
      halo.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: halo,
        alpha: 0,
        scaleX: 1.55,
        scaleY: 1.25,
        duration: 120,
        onComplete: () => halo.destroy(),
      });
    } else if (!this.lowPerfMode && archetype === 'orbit') {
      [-1, 1].forEach((side) => {
        const mote = this.add.circle(
          fxX + Math.cos(angle + Math.PI / 2) * side * 5,
          fxY + Math.sin(angle + Math.PI / 2) * side * 5,
          1.8,
          0xfda4af,
          0.42
        ).setDepth(109);
        mote.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: mote,
          alpha: 0,
          scale: 1.9,
          duration: 100,
          onComplete: () => mote.destroy(),
        });
      });
    } else if (!this.lowPerfMode && archetype === 'boomerang') {
      const slash = this.add.arc(fxX, fxY, 8, -55, 55, false, 0x6ee7b7, 0.24).setDepth(108);
      slash.setBlendMode(Phaser.BlendModes.ADD);
      slash.setRotation(angle);
      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.4,
        scaleY: 1.2,
        duration: 100,
        onComplete: () => slash.destroy(),
      });
    }
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number, source: DamageSource = { type: 'player' }): void {
    const ed = enemy as any;
    if (ed.dead) return;
    const stats = EvolutionSystem.getComputedStats();
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    let sourceMultiplier = 1;
    if (source.type === 'player') {
      sourceMultiplier *= 1 + Math.min(0.75, (level - 1) * 0.025 + (week - 1) * 0.04);
      if (this.comboCount >= 20) {
        sourceMultiplier *= 1 + Math.min(0.22, Math.floor(this.comboCount / 20) * 0.04);
      }
      if (gameState.data.isNight) {
        sourceMultiplier *= this.nightDirectiveEffects.playerDamageMul;
      }
    } else if (source.type === 'companion') {
      const activeCompanions = gameState.data.companions.filter(c => c.status !== 'base');
      const companionLevel = Math.max(
        1,
        source.companionId
          ? (gameState.data.companions.find(c => c.id === source.companionId)?.level || 1)
          : Math.round(
            activeCompanions.length > 0
              ? activeCompanions.reduce((sum, c) => sum + Math.max(1, c.level || 1), 0) / activeCompanions.length
              : 1
          )
      );
      sourceMultiplier *= 1 + Math.min(0.7, (level - 1) * 0.022);
      sourceMultiplier *= 1 + Math.min(1.05, (companionLevel - 1) * 0.038 + Math.max(0, activeCompanions.length - 1) * 0.045);
      if (companionLevel >= 20) {
        sourceMultiplier *= 1.12 + Math.min(0.18, (companionLevel - 20) * 0.01);
      }
      if (gameState.data.isNight) {
        sourceMultiplier *= this.nightDirectiveEffects.companionDamageMul;
      }
    } else if (source.type === 'turret') {
      sourceMultiplier *= 1 + Math.min(0.2, (week - 1) * 0.025);
      if (gameState.data.isNight) {
        sourceMultiplier *= this.nightDirectiveEffects.turretDamageMul;
      }
    }
    if (gameState.data.isNight && this.hasDayBuff('training')) {
      if (source.type === 'player') sourceMultiplier *= 1.16;
      else if (source.type === 'companion') sourceMultiplier *= 1.24;
      else sourceMultiplier *= 1.1;
    }

    let finalDamage = damage * (1 + stats.damage / 100) * sourceMultiplier;
    if (source.type === 'player') {
      finalDamage *= this.runMutatorEffects.playerDamageMul;
      finalDamage *= this.getScavengeDurabilityDamageMultiplier();
    } else if (source.type === 'companion') {
      finalDamage *= this.runMutatorEffects.companionDamageMul;
    } else if (source.type === 'turret') {
      finalDamage *= this.runMutatorEffects.turretDamageMul;
    }
    finalDamage /= Math.max(0.4, this.runMutatorEffects.enemyToughnessMul);

    // Crit
    const isCrit = Math.random() * 100 < stats.critChance;
    if (isCrit) finalDamage *= stats.critDamage / 100;

    if (ed.isBoss) {
      finalDamage *= gameState.getBitcoinPerkBonuses().bossDamageMul || 1;
    }
    if (ed.isBoss) {
      const weekScale = Math.max(1, gameState.data.currentWeek || 1);
      const waveScale = Math.max(1, gameState.data.currentWave || 1);
      const armorMul = Phaser.Math.Clamp(
        ed.bossArmorMul ?? (0.42 + weekScale * 0.028 + waveScale * 0.009),
        0.34,
        0.82
      );
      finalDamage *= armorMul;
      const maxHitRatio = Phaser.Math.Clamp(ed.bossHitCapRatio ?? 0.03, 0.012, 0.08);
      const maxHit = Math.max(30, (ed.maxHealth || 1000) * maxHitRatio);
      finalDamage = Math.min(finalDamage, maxHit);
    }
    ed.health = (ed.health || 30) - finalDamage;
    gameState.data.stats.damageDealt += finalDamage;

    if (source.type === 'companion' && ed.health > 0 && Math.random() < 0.1) {
      this.maybeEmitCompanionCombatChatter(source, 'engage');
    }

    // Damage number
    this.showDamageNumber(enemy.x, enemy.y - 10, finalDamage, isCrit);
    if (source.type === 'companion' && source.companionId && ed.health > 0) {
      const progress = this.companionSystem.registerDamage(source.companionId, finalDamage);
      this.handleCompanionProgressUpdate(source.companionId, progress, '作战成长');
    }

    // Hit effect
    this.animationSystem.playHitEffect(enemy);
    if (ed.health > 0) {
      this.playEnemyAction(enemy, 'hurt', true, 170);
    }

    // Combo
    this.comboCount++;
    this.comboTimer = 2000;
    if (this.comboCount > gameState.data.stats.highestCombo) {
      gameState.data.stats.highestCombo = this.comboCount;
    }

    if (ed.health <= 0) {
      this.onEnemyKilled(enemy, source);
    }

    // Quest progress
    QuestSystem.updateProgress('kill', ed.enemyType || 'controlled', 1);
    if (ed.isBoss) QuestSystem.updateProgress('kill', 'boss', 1);
  }

  private applyHungerPenalty(damage: number): number {
    const deficit = gameState.data.base.foodDeficit || 0;
    if (deficit <= 0) return damage;
    const penalty = Math.min(0.5, deficit * 0.05);
    return damage * (1 - penalty);
  }

  private hasDayBuff(kind: 'trade' | 'morale' | 'training'): boolean {
    return !!gameState.data.storyFlags[`day_buff_${kind}_${gameState.data.currentDay}`];
  }

  private onEnemyKilled(enemy: Phaser.Physics.Arcade.Sprite, source: DamageSource = { type: 'player' }): void {
    const ed = enemy as any;
    if (ed.dead) return;
    ed.dead = true;
    const body = enemy.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocity(0, 0);
      body.enable = false;
    }

    // XP gem
    const xpValue = ed.xpValue || 5;
    this.lootSystem.spawnXPGem(enemy.x, enemy.y, xpValue);

    // Loot drops
    if (ed.lootTable) {
      let bonusDrops = 0;
      if (ed.isBoss) bonusDrops = 4;
      else if (ed.enemyType === 'tank' || ed.behavior === 'heavy') bonusDrops = 2;
      else if (ed.behavior === 'elite') bonusDrops = 2;
      else if (ed.behavior === 'ranged') bonusDrops = 1;
      this.lootSystem.spawnLoot(enemy.x, enemy.y, ed.lootTable, bonusDrops, this.getRunLootGainMultiplier());
    }

    const gearDrop = GearLootSystem.tryRollDrop(ed);
    if (gearDrop) {
      gameState.addGearToStash(gearDrop);
      const rarityStyle = GearLootSystem.getRarityStyle(gearDrop.rarity);
      const affixSummary = GearLootSystem.formatAffixSummary(gearDrop, 2);
      this.showFloatingText(
        enemy.x,
        enemy.y - 62,
        `掉落[${rarityStyle.label}] ${gearDrop.nameCN}`,
        rarityStyle.uiColor,
        false
      );
      if (affixSummary) {
        this.showFloatingText(
          enemy.x,
          enemy.y - 92,
          `${GearLootSystem.getThemeLabel(gearDrop.sourceTheme)} · ${affixSummary}`,
          '#f8fafc',
          false
        );
      }
      events.emit('gear-stash-updated', {
        count: gameState.data.gearStash.length,
        dropped: gearDrop,
      });
      const codexFlag = `gear_codex_rarity_${gearDrop.rarity}`;
      if (!gameState.data.storyFlags[codexFlag]) {
        gameState.data.storyFlags[codexFlag] = true;
        const discoveryXp = 14 + (gearDrop.rarity === 'legendary' ? 12 : gearDrop.rarity === 'mythic' ? 20 : 0);
        const discoveryBtc = Number((gearDrop.rarity === 'mythic' ? 0.25 : gearDrop.rarity === 'legendary' ? 0.16 : 0.06).toFixed(3));
        this.grantExperience(discoveryXp);
        gameState.addResource('bitcoin', discoveryBtc);
        events.emit('update-resources', gameState.data.resources);
        this.showFloatingText(
          enemy.x,
          enemy.y - 88,
          `图鉴解锁：${rarityStyle.label}品质 · +XP${discoveryXp} +₿${discoveryBtc.toFixed(3)}`,
          '#fbbf24',
          false
        );
      }
    }

    // Death effect
    this.createDeathEffect(enemy.x, enemy.y);

    // Exploder special
    if (ed.special === 'explode_on_death') {
      this.createExplosion(enemy.x, enemy.y, 100, ed.damage || 20);
    }

    // Kill streak tracking
    const now = this.time.now;
    if (now - this.lastKillTime < 1500) {
      this.killStreakCount++;
    } else {
      this.killStreakCount = 1;
    }
    this.lastKillTime = now;

    // Kill streak milestones
    if (this.killStreakCount >= 10 && this.killStreakCount % 10 === 0) {
      const streakNames: Record<number, string> = {
        10: '连杀 x10!', 20: '大屠杀!', 30: '无双!', 50: '神！',
      };
      const streakName = streakNames[this.killStreakCount] || `连杀 x${this.killStreakCount}!`;
      this.showFloatingText(this.cameras.main.width / 2, 230, `🔥 ${streakName}`, '#f59e0b', true);
      this.cameras.main.shake(150, 0.008);
    }

    // Update combo display
    this.updateComboDisplay();

    // Screen shake for bosses
    if (ed.isBoss) {
      this.cameras.main.shake(500, 0.03);
      this.cameras.main.flash(500, 255, 200, 0);
      this.enemySystem.onBossKilled(enemy);
    }

    // Notify wave system
    this.waveSystem.onEnemyKilled(enemy);

    this.gainBattleMomentum(ed, source);
    this.gainOverdriveCharge(source);
    this.handleAutoLevelKill(source);
    if (source.type !== 'companion') {
      const assistWeight = source.type === 'player' ? 0.5 : 0.32;
      const assistProgressList = this.companionSystem.registerTeamAssistKill(assistWeight, 4);
      assistProgressList.forEach((item) => {
        this.handleCompanionProgressUpdate(item.companionId, item.progress, '协同成长');
      });
    }
    this.maybeEmitCompanionCombatChatter(source, 'kill');

    events.emit(GameEvents.ENEMY_KILLED, { enemyType: ed.enemyType, reward: xpValue });

    if (!ed.isBoss) {
      const deathDuration = this.playEnemyAction(enemy, 'death', true, 620);
      if (deathDuration > 0) {
        this.time.delayedCall(deathDuration, () => {
          if (enemy.active) enemy.destroy();
        });
      } else {
        enemy.destroy();
      }
    }
  }

  private isBattleMomentumActive(): boolean {
    return this.time.now < this.battleMomentumBoostUntil;
  }

  private gainBattleMomentum(enemyData: any, source: DamageSource): void {
    let gain = 0;
    if (enemyData?.isBoss) gain = 56;
    else if (enemyData?.behavior === 'elite' || enemyData?.enemyType === 'elite') gain = 22;
    else if (enemyData?.behavior === 'heavy' || enemyData?.enemyType === 'tank') gain = 14;
    else gain = source.type === 'player' ? 8 : source.type === 'companion' ? 6 : 4;
    gain += Math.min(8, Math.floor(this.killStreakCount / 12) * 2);

    if (this.isBattleMomentumActive()) {
      this.battleMomentumBoostUntil = Math.min(this.time.now + 11000, this.battleMomentumBoostUntil + gain * 55);
      return;
    }
    this.battleMomentum = Phaser.Math.Clamp(this.battleMomentum + gain, 0, 100);
    if (this.battleMomentum >= 100) {
      this.battleMomentum = 0;
      this.battleMomentumBoostUntil = this.time.now + 8200;
      this.battleMomentumPulseAt = this.time.now;
      this.showFloatingText(this.cameras.main.width / 2, 154, '战意爆发：火力全面跃迁', '#f97316', true);
      this.cameras.main.flash(180, 249, 115, 22);
    }
  }

  private updateBattleMomentumState(): void {
    if (!this.isBattleMomentumActive()) return;
    if (this.time.now - this.battleMomentumPulseAt < 480) return;
    this.battleMomentumPulseAt = this.time.now;
    if (!this.lowPerfMode) {
      this.createMuzzleFlash(this.player.x + Phaser.Math.Between(-8, 8), this.player.y + Phaser.Math.Between(-8, 8));
    }
  }

  private getDiscoveredGearRarityCount(): number {
    const rarityKeys: Array<'common' | 'magic' | 'rare' | 'epic' | 'legendary' | 'mythic'> = [
      'common', 'magic', 'rare', 'epic', 'legendary', 'mythic',
    ];
    return rarityKeys.reduce((sum, rarity) => sum + (gameState.data.storyFlags[`gear_codex_rarity_${rarity}`] ? 1 : 0), 0);
  }

  private updateGearResonanceState(force: boolean = false): void {
    const weaponTypes: GearWeaponType[] = ['pistol', 'shotgun', 'rifle', 'flamethrower', 'laser', 'rocket'];
    const equipped = weaponTypes
      .map((weaponType) => gameState.getEquippedGearForWeapon(weaponType))
      .filter((item): item is NonNullable<ReturnType<typeof gameState.getEquippedGearForWeapon>> => !!item);
    const rarityCounts = new Map<string, number>();
    equipped.forEach((item) => {
      rarityCounts.set(item.rarity, (rarityCounts.get(item.rarity) || 0) + 1);
    });
    const maxSameRarity = Math.max(0, ...Array.from(rarityCounts.values()));
    const allSlotsEquipped = equipped.length >= 6;
    const highRarityCount = equipped.filter((item) => item.rarity === 'legendary' || item.rarity === 'mythic').length;
    const codexCount = this.getDiscoveredGearRarityCount();
    const codexDamageMul = 1 + Math.min(0.12, codexCount * 0.018);

    let tier = 0;
    let damageMul = codexDamageMul;
    let fireRateMul = 1;
    let speedMul = 1;
    let projectileBonus = 0;
    let lootMul = 1;
    if (maxSameRarity >= 2) {
      tier = 1;
      damageMul *= 1.1;
      fireRateMul *= 1.05;
    }
    if (maxSameRarity >= 4) {
      tier = 2;
      damageMul *= 1.12;
      fireRateMul *= 1.08;
      projectileBonus += 1;
      speedMul *= 1.04;
    }
    if (allSlotsEquipped && highRarityCount >= 2) {
      tier = 3;
      damageMul *= 1.16;
      fireRateMul *= 1.1;
      projectileBonus += 1;
      speedMul *= 1.06;
      lootMul *= 1.12;
    }

    this.gearResonanceDamageMul = Number(damageMul.toFixed(3));
    this.gearResonanceFireRateMul = Number(fireRateMul.toFixed(3));
    this.gearResonanceSpeedMul = Number(speedMul.toFixed(3));
    this.gearResonanceProjectileBonus = projectileBonus;
    this.gearResonanceLootMul = Number(lootMul.toFixed(3));

    const nextSignature = `${tier}|${maxSameRarity}|${allSlotsEquipped ? 1 : 0}|${highRarityCount}|${codexCount}`;
    if (force || nextSignature !== this.gearResonanceSignature) {
      this.gearResonanceSignature = nextSignature;
      if (tier > 0 || force) {
        const tierName = tier >= 3 ? '全装共鸣' : tier === 2 ? '高阶共鸣' : tier === 1 ? '初阶共鸣' : '图鉴加成';
        this.showFloatingText(
          this.cameras.main.width / 2,
          262,
          `装备收集线：${tierName} · 伤害x${this.gearResonanceDamageMul.toFixed(2)} · 射速x${this.gearResonanceFireRateMul.toFixed(2)}`,
          '#a78bfa',
          true
        );
      }
    }
  }

  private isOverdriveActive(): boolean {
    return this.time.now < this.arOverdriveActiveUntil;
  }

  private gainOverdriveCharge(source: DamageSource): void {
    const gain = source.type === 'player' ? 10 : source.type === 'companion' ? 5 : 3;
    if (this.isOverdriveActive()) {
      this.arOverdriveActiveUntil = Math.min(this.time.now + 10000, this.arOverdriveActiveUntil + gain * 42);
      return;
    }
    this.arOverdriveCharge = Math.min(100, this.arOverdriveCharge + gain);
    if (this.arOverdriveCharge >= 100) {
      this.activateOverdrive();
    }
  }

  private activateOverdrive(): void {
    this.arOverdriveCharge = 0;
    this.arOverdriveActiveUntil = this.time.now + 10000;
    this.arOverdrivePulseAt = this.time.now;
    this.showFloatingText(this.cameras.main.width / 2, 168, 'AR超载已启动：弹道增强', '#22d3ee', true);
    this.cameras.main.flash(180, 34, 211, 238);
  }

  private updateOverdriveState(): void {
    if (!this.isOverdriveActive()) return;
    if (this.time.now - this.arOverdrivePulseAt < 650) return;
    this.arOverdrivePulseAt = this.time.now;
    this.createMuzzleFlash(this.player.x, this.player.y);
  }

  private applyDynamicPlayerUpgradeBonuses(showFeedback: boolean): void {
    const level = Math.max(1, gameState.data.playerLevel || 1);
    if (!showFeedback && level === this.lastAppliedUpgradeLevel) return;
    const prevLevel = this.lastAppliedUpgradeLevel;
    this.lastAppliedUpgradeLevel = level;

    const moveSpeedBonus = Math.min(16, Math.floor((level - 1) / 2));
    const healthRegenBonus = Math.min(8, Math.floor((level - 1) / 6));
    const fireRateBonus = Math.min(12, Math.floor((level - 1) / 4));
    const damageBonus = Math.min(18, Math.floor((level - 1) / 3));
    this.playerUpgrades.moveSpeedBonus = moveSpeedBonus;
    this.playerUpgrades.healthRegen = healthRegenBonus;
    this.playerUpgrades.fireRateBonus = fireRateBonus;
    this.playerUpgrades.damageBonus = damageBonus;
    this.playerUpgrades.companionDamage = Math.min(12, Math.floor((level - 1) / 4));
    this.playerUpgrades.turretFireRate = Math.min(12, Math.floor((level - 1) / 5));

    if (!showFeedback || level <= 1 || level === prevLevel) return;
    this.showFloatingText(
      this.cameras.main.width / 2,
      104,
      `等级红利生效 · 机动+${moveSpeedBonus} 续航+${healthRegenBonus} 伤害+${damageBonus}%`,
      '#22d3ee',
      true
    );
  }

  private triggerLevelPowerSurge(choiceName: string): void {
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const duration = 11000 + Math.min(7000, level * 260);
    this.levelSurgeUntil = Math.max(this.levelSurgeUntil, this.time.now + duration);
    this.levelSurgePulseAt = this.time.now;
    events.emit(GameEvents.PLAYER_HEAL_REQUEST, {
      amount: Math.max(6, Math.round((EvolutionSystem.getComputedStats().maxHealth || 100) * 0.08)),
      source: '升级爆发恢复',
    });
    this.cameras.main.flash(220, 56, 189, 248);
    this.showFloatingText(
      this.cameras.main.width / 2,
      144,
      `等级爆发: ${choiceName} · ${Math.round(duration / 1000)}秒强化`,
      '#38bdf8',
      true
    );
  }

  private updateLevelSurgeState(): void {
    if (this.time.now >= this.levelSurgeUntil) {
      this.player.clearTint();
      return;
    }
    const pulse = Math.sin(this.time.now * 0.02);
    const tint = pulse > 0 ? 0x9be9ff : 0xffffff;
    this.player.setTint(tint);
    if (this.time.now - this.levelSurgePulseAt < 450) return;
    this.levelSurgePulseAt = this.time.now;
    this.createMuzzleFlash(this.player.x, this.player.y);
  }

  private getProtocolTotalLevel(levels?: Record<LevelUpProtocolId, number>): number {
    const protocolLevels = levels || EvolutionSystem.getProtocolLevels();
    return (Object.keys(protocolLevels) as LevelUpProtocolId[])
      .reduce((sum, id) => sum + Math.max(0, protocolLevels[id] || 0), 0);
  }

  private toHexColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private ensureProtocolAuraVisual(): void {
    if (!this.player?.active) return;
    if (this.protocolAuraContainer?.active) return;

    const nodeCount = this.ultraLowPerfMode ? 2 : this.lowPerfMode ? 3 : 4;
    const container = this.add.container(this.player.x, this.player.y + 2)
      .setDepth(Math.max(5, (this.player.depth || 8) - 1));

    const outer = this.add.circle(0, 0, 24, this.protocolAuraColor, 0)
      .setStrokeStyle(2, this.protocolAuraColor, 0.46);
    const inner = this.add.circle(0, 0, 14, this.protocolAuraColor, 0.2)
      .setStrokeStyle(1, this.protocolAuraColor, 0.8);
    outer.setBlendMode(Phaser.BlendModes.ADD);
    inner.setBlendMode(Phaser.BlendModes.ADD);
    container.add([outer, inner]);

    const nodes: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const node = this.add.circle(0, 0, 2 + (i % 2), this.protocolAuraColor, 0.9);
      node.setBlendMode(Phaser.BlendModes.ADD);
      container.add(node);
      nodes.push(node);
    }

    this.protocolAuraContainer = container;
    this.protocolAuraOuter = outer;
    this.protocolAuraInner = inner;
    this.protocolAuraNodes = nodes;
  }

  private updateProtocolAuraState(): void {
    if (!this.player?.active) {
      this.protocolAuraContainer?.destroy();
      this.protocolAuraContainer = null;
      this.protocolAuraInner = null;
      this.protocolAuraOuter = null;
      this.protocolAuraNodes = [];
      this.protocolAuraLevel = 0;
      return;
    }

    const levels = EvolutionSystem.getProtocolLevels();
    const totalLevel = this.getProtocolTotalLevel(levels);
    if (totalLevel <= 0) {
      this.protocolAuraContainer?.destroy();
      this.protocolAuraContainer = null;
      this.protocolAuraInner = null;
      this.protocolAuraOuter = null;
      this.protocolAuraNodes = [];
      this.protocolAuraLevel = 0;
      return;
    }

    if (totalLevel !== this.protocolAuraLevel) {
      this.protocolAuraLevel = totalLevel;
      let dominant: LevelUpProtocolId = 'barrage_matrix';
      let dominantLv = -1;
      (Object.keys(levels) as LevelUpProtocolId[]).forEach((id) => {
        const lv = levels[id] || 0;
        if (lv > dominantLv) {
          dominantLv = lv;
          dominant = id;
        }
      });
      this.protocolAuraColor = PROTOCOL_VISUAL_PROFILE[dominant].color;
    }

    this.ensureProtocolAuraVisual();
    if (!this.protocolAuraContainer || !this.protocolAuraOuter || !this.protocolAuraInner) return;

    const boosting = this.time.now < this.protocolAuraBoostUntil;
    const pulseSpeed = 0.007 + Math.min(0.005, totalLevel * 0.00035);
    const pulse = 1 + Math.sin(this.time.now * pulseSpeed) * (boosting ? 0.14 : 0.08);
    const baseRadius = 16 + Math.min(16, totalLevel * 1.8);
    const boostMul = boosting ? 1.16 : 1;
    const outerRadius = baseRadius * boostMul * pulse;
    const innerRadius = Math.max(9, outerRadius * 0.54);

    this.protocolAuraContainer.setPosition(this.player.x, this.player.y + 2);
    this.protocolAuraContainer.setDepth(Math.max(5, (this.player.depth || 8) - 1));
    this.protocolAuraOuter.setRadius(outerRadius);
    this.protocolAuraInner.setRadius(innerRadius);
    this.protocolAuraOuter.setStrokeStyle(
      boosting ? 3 : 2,
      this.protocolAuraColor,
      boosting ? 0.86 : 0.54
    );
    this.protocolAuraInner.setFillStyle(this.protocolAuraColor, boosting ? 0.3 : 0.2);

    const orbitScale = boosting ? 1.22 : 1;
    const orbitRadius = outerRadius * orbitScale;
    const orbitClock = this.time.now * (0.0018 + Math.min(0.0016, totalLevel * 0.00008));
    this.protocolAuraNodes.forEach((node, index) => {
      const angle = orbitClock + (index / Math.max(1, this.protocolAuraNodes.length)) * Math.PI * 2;
      node.setPosition(
        Math.cos(angle) * orbitRadius,
        Math.sin(angle * 1.22) * orbitRadius * 0.64
      );
      node.setFillStyle(this.protocolAuraColor, boosting ? 0.95 : 0.8);
    });

    if (boosting && this.time.now - this.protocolAuraPulseAt >= (this.lowPerfMode ? 360 : 260)) {
      this.protocolAuraPulseAt = this.time.now;
      const burst = this.add.circle(this.player.x, this.player.y + 2, outerRadius * 0.5, this.protocolAuraColor, 0)
        .setStrokeStyle(2, this.protocolAuraColor, 0.72)
        .setDepth(Math.max(6, (this.player.depth || 8) - 1));
      burst.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: burst,
        scale: 1.65,
        alpha: 0,
        duration: this.lowPerfMode ? 220 : 320,
        onComplete: () => burst.destroy(),
      });
    }
  }

  private playProtocolUpgradeSfx(protocolId: LevelUpProtocolId, level: number): void {
    try {
      const manager: any = this.sound;
      const ctx = manager?.context as AudioContext | undefined;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const profile = PROTOCOL_VISUAL_PROFILE[protocolId];
      const t0 = ctx.currentTime + 0.005;
      const master = ctx.createGain();
      master.gain.value = this.mobileViewport ? 0.032 : 0.048;
      master.connect(ctx.destination);

      const playTone = (
        semitone: number,
        start: number,
        duration: number,
        type: OscillatorType
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = profile.baseFreq * Math.pow(2, semitone / 12);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0 + start);
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(master.gain.value, t0 + start + 0.016);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0 + start);
        osc.stop(t0 + start + duration);
      };

      const lift = Math.min(8, Math.max(0, level - 1));
      playTone(0 + lift * 0.4, 0, 0.13, 'triangle');
      playTone(4 + lift * 0.4, 0.08, 0.13, 'sine');
      playTone(7 + lift * 0.4, 0.16, 0.14, 'triangle');
      playTone(12 + lift * 0.3, 0.24, 0.18, 'square');
      if (level >= 3) {
        playTone(16, 0.3, 0.16, 'sawtooth');
      }

      this.time.delayedCall(760, () => master.disconnect());
    } catch {
      // Ignore audio failures (autoplay policy / unsupported context)
    }
  }

  private triggerProtocolLevelFeedback(
    protocolId: LevelUpProtocolId,
    level: number,
    maxLevel?: number
  ): void {
    const profile = PROTOCOL_VISUAL_PROFILE[protocolId];
    this.protocolAuraColor = profile.color;
    this.protocolAuraBoostUntil = Math.max(this.protocolAuraBoostUntil, this.time.now + 4200 + level * 420);
    this.protocolAuraPulseAt = 0;
    this.playProtocolUpgradeSfx(protocolId, level);

    const totalLevel = this.getProtocolTotalLevel();
    const colorText = this.toHexColor(profile.color);
    this.showFloatingText(
      this.player.x,
      this.player.y - 84,
      `协议共鸣 Lv.${totalLevel} · ${level}${maxLevel ? `/${maxLevel}` : ''}`,
      colorText,
      false
    );

    const sw = this.cameras.main.width;
    const sh = this.cameras.main.height;
    const frame = this.add.rectangle(sw / 2, sh / 2, sw - 24, sh - 78, profile.color, 0)
      .setStrokeStyle(3, profile.color, 0.94)
      .setScrollFactor(0)
      .setDepth(2060);
    this.tweens.add({
      targets: frame,
      alpha: 0,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 420,
      onComplete: () => frame.destroy(),
    });

    const sparkCount = this.ultraLowPerfMode ? 4 : this.lowPerfMode ? 7 : 11;
    for (let i = 0; i < sparkCount; i += 1) {
      const spark = this.add.rectangle(
        this.player.x + Phaser.Math.Between(-12, 12),
        this.player.y + Phaser.Math.Between(-16, 10),
        Phaser.Math.Between(2, 5),
        Phaser.Math.Between(4, 9),
        profile.color,
        0.9
      ).setDepth(1105);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-66, 66),
        y: spark.y + Phaser.Math.Between(-46, 46),
        alpha: 0,
        angle: Phaser.Math.Between(-160, 160),
        duration: Phaser.Math.Between(220, 480),
        onComplete: () => spark.destroy(),
      });
    }

    this.cameras.main.flash(this.lowPerfMode ? 100 : 150, 86, 211, 238);
    events.emit('protocol-updated', {
      id: protocolId,
      level,
      totalLevel,
      maxLevel: maxLevel || null,
    });
  }

  private getPowerTierProfile(level: number, week: number, killCount: number): {
    id: 1 | 2 | 3;
    nameCN: string;
    damageMul: number;
    fireRateMul: number;
    speedMul: number;
    projectileBonus: number;
    pierceBonus: number;
  } {
    if (level <= 12 && week <= 2 && killCount < 300) {
      return {
        id: 1,
        nameCN: '前期爽',
        damageMul: 1.34,
        fireRateMul: 1.28,
        speedMul: 1.12,
        projectileBonus: 1,
        pierceBonus: 0,
      };
    }
    if (level <= 26 && week <= 4 && killCount < 1100) {
      return {
        id: 2,
        nameCN: '中期稳',
        damageMul: 1.24,
        fireRateMul: 1.2,
        speedMul: 1.1,
        projectileBonus: level >= 16 ? 1 : 0,
        pierceBonus: 0,
      };
    }
    return {
      id: 3,
      nameCN: '后期极限',
      damageMul: 1.62,
      fireRateMul: 1.42,
      speedMul: 1.18,
      projectileBonus: 1 + (level >= 34 ? 1 : 0),
      pierceBonus: 1 + (week >= 6 ? 1 : 0),
    };
  }

  private updatePowerTierState(): void {
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const killCount = Math.max(0, gameState.data.stats.enemiesKilled || 0);
    const tier = this.getPowerTierProfile(level, week, killCount);
    if (tier.id === this.currentPowerTier) return;
    this.currentPowerTier = tier.id;
    this.showFloatingText(
      this.cameras.main.width / 2,
      154,
      `强度档切换：${tier.nameCN}`,
      tier.id === 3 ? '#f59e0b' : tier.id === 2 ? '#22d3ee' : '#4ade80',
      true
    );
  }

  private handleAutoLevelKill(source: DamageSource): void {
    if (source.type === 'player' && source.weaponType) {
      const weaponType = source.weaponType;
      this.weaponMasteryKills[weaponType] += 1;
      let leveled = false;
      while (this.weaponMasteryKills[weaponType] >= this.weaponMasteryNextKills[weaponType]) {
        this.weaponMasteryLevels[weaponType] += 1;
        this.weaponMasteryNextKills[weaponType] += this.getWeaponMasteryTarget(this.weaponMasteryLevels[weaponType]);
        leveled = true;
      }
      if (leveled) {
        const labelMap: Record<WeaponType, string> = {
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
        this.showFloatingText(
          this.player.x,
          this.player.y - 58,
          `${labelMap[weaponType]}精通 Lv.${this.weaponMasteryLevels[weaponType]}`,
          '#22d3ee',
          false
        );
      }
    }

    if (source.type === 'turret' && source.turretId) {
      const turret = (this.turrets.getChildren() as Phaser.Physics.Arcade.Sprite[]).find(t => {
        const td = t as any;
        return td.runtimeId === source.turretId;
      });
      if (!turret) return;
      const td = turret as any;
      td.killCount = (td.killCount || 0) + 1;
      let leveled = false;
      let promoted = false;
      while ((td.level || 1) < TURRET_MAX_LEVEL && td.killCount >= (td.nextLevelKills || 0)) {
        td.level = Math.max(1, td.level || 1) + 1;
        if (td.level >= TURRET_PROMOTION_LEVEL && !td.advancedClass) {
          const adv = TURRET_ADVANCED_CLASSES[Phaser.Math.Between(0, TURRET_ADVANCED_CLASSES.length - 1)];
          td.advancedClass = adv.nameCN;
          td.promotionTier = 1;
          promoted = true;
        }
        td.nextLevelKills += this.getAutoLevelTarget(td.level);
        leveled = true;
      }
      if ((td.level || 1) >= TURRET_MAX_LEVEL) {
        td.level = TURRET_MAX_LEVEL;
        td.nextLevelKills = Number.MAX_SAFE_INTEGER;
      }
      if (leveled) {
        this.applyTurretLevelStats(turret);
        this.showFloatingText(
          turret.x,
          turret.y - 34,
          promoted ? `炮塔转职：${td.advancedClass}` : `炮塔 Lv.${td.level}`,
          '#22d3ee',
          false
        );
        if (td.level >= TURRET_MAX_LEVEL) {
          this.showFloatingText(
            turret.x,
            turret.y - 52,
            '炮塔已达满级 Lv.40',
            '#f59e0b',
            false
          );
        }
      }
      return;
    }

    if (source.type === 'companion' && source.companionId) {
      const info = this.companionSystem.registerKill(source.companionId);
      this.handleCompanionProgressUpdate(source.companionId, info, '击杀成长');
    }
  }

  private handleCompanionProgressUpdate(
    companionId: string,
    info: ReturnType<CompanionSystem['registerKill']>,
    reason: '作战成长' | '击杀成长' | '协同成长' = '击杀成长'
  ): void {
    if (!info || !info.leveledUp) return;
    const companionData = gameState.data.companions.find(item => item.id === companionId);
    if (companionData) {
      companionData.level = info.level;
      if (info.advancedClass) {
        companionData.advancedClass = info.advancedClass;
        companionData.promotionTier = 1;
      }
    }
    const companionName = info.name.split('(')[0];
    this.showFloatingText(
      this.player.x,
      this.player.y - 52,
      info.promoted
        ? `${companionName} 转职：${info.advancedClass}`
        : `${companionName} ${reason} Lv.${info.level}`,
      Phaser.Display.Color.IntegerToColor(info.tint).rgba,
      false
    );
    if (info.milestoneLevel && info.milestoneTitleCN) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 74,
        `${companionName} 里程碑 · Lv.${info.milestoneLevel} ${info.milestoneTitleCN}`,
        '#67e8f9',
        false
      );
      if (info.milestoneDetailCN) {
        this.showFloatingText(
          this.player.x,
          this.player.y - 94,
          info.milestoneDetailCN,
          '#bae6fd',
          false
        );
      }
      this.cameras.main.flash(120, 80, 180, 255, false);
    }
    if (info.reachedMax) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 72,
        `${companionName} 已达满级 Lv.40`,
        '#f59e0b',
        false
      );
    }
    if (!this.lowPerfMode) {
      this.createMuzzleFlash(
        this.player.x + Phaser.Math.Between(-10, 10),
        this.player.y - Phaser.Math.Between(8, 18)
      );
    }
    this.lastCompanionRosterSignature = '';
  }

  private resetWeaponMasteryProgress(): void {
    const types: WeaponType[] = ['pistol', 'shotgun', 'rifle', 'flamethrower', 'laser', 'rocket'];
    types.forEach((type) => {
      this.weaponMasteryKills[type] = 0;
      this.weaponMasteryLevels[type] = 1;
      this.weaponMasteryNextKills[type] = this.getWeaponMasteryTarget(1);
    });
  }

  private getWeaponMasteryTarget(level: number): number {
    const lv = Math.max(1, level);
    return Math.floor(12 + Math.pow(lv, 1.18) * 4.4);
  }

  private updateComboDisplay(): void {
    if (this.comboCount < 3 && !this.isBattleMomentumActive() && this.battleMomentum < 8) {
      if (this.comboText) { this.comboText.setVisible(false); }
      return;
    }

    const sw = this.cameras.main.width;
    const needsRecreate =
      !this.comboText
      || !this.comboText.active
      || !this.comboText.scene
      || !this.comboText.frame
      || !this.comboText.texture
      || !this.textures.exists(this.comboText.texture.key);
    if (needsRecreate) {
      if (this.comboText) {
        this.comboText.destroy();
        this.comboText = null;
      }
      this.comboText = this.add.text(sw - 80, 180, '', {
        fontSize: '28px', color: '#fbbf24', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);
    }

    const text = this.comboText;
    if (!text) return;

    const color = this.isBattleMomentumActive()
      ? '#fb923c'
      : this.comboCount >= 20
        ? '#ef4444'
        : this.comboCount >= 10
          ? '#f59e0b'
          : '#fbbf24';
    text.setColor(color);
    const momentumText = this.isBattleMomentumActive()
      ? '⚡爆发'
      : `⚡${Math.floor(this.battleMomentum)}`;
    text.setText(`${Math.max(0, this.comboCount)}x ${momentumText}`);
    text.setVisible(true);
    text.setScale(1);

    // Pop animation
    this.tweens.killTweensOf(text);
    this.tweens.add({
      targets: text,
      scale: { from: 1.3, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean): void {
    if (this.ultraLowPerfMode && !isCrit) return;
    if (this.lowPerfMode && !isCrit && Math.random() < 0.55) return;
    if (this.activeDamageNumberCount > (this.ultraLowPerfMode ? 10 : this.lowPerfMode ? 20 : 36)) return;
    this.activeDamageNumberCount += 1;
    const offsetX = Phaser.Math.Between(-15, 15);
    const text = this.add.text(x + offsetX, y - 20, `${Math.floor(damage)}${isCrit ? '!' : ''}`, {
      fontFamily: this.getUIFontFamily(),
      fontSize: isCrit ? (this.lowPerfMode ? '20px' : '24px') : (this.lowPerfMode ? '14px' : '16px'),
      color: isCrit ? '#fbbf24' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCrit ? 4 : 2,
    }).setOrigin(0.5).setDepth(1500);

    this.tweens.add({
      targets: text, y: y - 60, alpha: 0, duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.activeDamageNumberCount = Math.max(0, this.activeDamageNumberCount - 1);
        text.destroy();
      },
    });
  }

  private createMuzzleFlash(x: number, y: number): void {
    // Core flash
    const flash = this.add.circle(x, y, 6, 0x0ea5e9, 0.9);
    flash.setDepth(100);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2.5, duration: 100,
      onComplete: () => flash.destroy(),
    });

    if (this.ultraLowPerfMode) return;

    // Outer glow
    const glow = this.add.circle(x, y, 12, 0x38bdf8, 0.3);
    glow.setDepth(99);
    this.tweens.add({
      targets: glow, alpha: 0, scale: 2, duration: 150,
      onComplete: () => glow.destroy(),
    });

    // Small spark particles (2-3)
    const sparkCount = this.lowPerfMode ? 1 : Phaser.Math.Between(2, 3);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(8, 20);
      const spark = this.add.rectangle(x, y, 2, 2, 0x7dd3fc, 0.8).setDepth(100);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0, duration: 120,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private createDeathEffect(x: number, y: number): void {
    // Flash circle
    const flash = this.add.circle(x, y, 15, 0xffff00, 0.6);
    flash.setDepth(100);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2.5, duration: 200,
      onComplete: () => flash.destroy(),
    });

    // Particle burst - small squares flying outward
    const particleCount = this.ultraLowPerfMode ? Phaser.Math.Between(2, 3)
      : this.lowPerfMode ? Phaser.Math.Between(3, 5)
        : Phaser.Math.Between(4, 8);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const speed = Phaser.Math.Between(60, 140);
      const size = Phaser.Math.Between(2, 5);
      const color = Phaser.Utils.Array.GetRandom([0xff4444, 0xff8800, 0xffdd00, 0xaaaaaa]);
      const p = this.add.rectangle(x, y, size, size, color, 0.9).setDepth(100);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration: Phaser.Math.Between(250, 500),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private createExplosion(
    x: number,
    y: number,
    radius: number,
    damage: number,
    source: DamageSource = { type: 'player' }
  ): void {
    // Expanding ring
    const ring = this.add.circle(x, y, 10, 0xff4400, 0);
    ring.setStrokeStyle(3, 0xff6600, 0.8);
    ring.setDepth(100);
    this.tweens.add({
      targets: ring, scale: radius / 10, alpha: 0, duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Inner flash
    const circle = this.add.circle(x, y, radius * 0.4, 0xff4400, 0.5);
    circle.setDepth(100);
    this.tweens.add({
      targets: circle, alpha: 0, scale: 2, duration: 300,
      onComplete: () => circle.destroy(),
    });

    // Explosion particles
    const particleCount = this.ultraLowPerfMode ? 5 : this.lowPerfMode ? 8 : 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const dist = Phaser.Math.Between(20, radius);
      const p = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0xff6600, 0.8).setDepth(100);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0, duration: Phaser.Math.Between(200, 400),
        onComplete: () => p.destroy(),
      });
    }

    // Damage enemies in radius
    this.enemies.getChildren().forEach(e => {
      const enemy = e as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < radius) {
        this.damageEnemy(enemy, damage, source);
      }
    });

    // Screen shake
    this.cameras.main.shake(this.lowPerfMode ? 130 : 200, this.lowPerfMode ? 0.006 : 0.01);
  }

  private showFloatingText(x: number, y: number, message: string, color: string, isScreenSpace: boolean = false): void {
    const text = this.add.text(x, y, message, {
      fontFamily: this.getUIFontFamily(), fontSize: '22px', color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(2000);
    if (isScreenSpace) text.setScrollFactor(0);

    this.tweens.add({
      targets: text, y: y - 50, alpha: 0,
      duration: 1500, ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private clearResourceFloatingToasts(): void {
    for (const entry of this.resourceFloatingToasts) {
      entry.timer?.remove(false);
      entry.timer = null;
      entry.tween?.remove();
      entry.tween = null;
      entry.text.destroy();
    }
    this.resourceFloatingToasts = [];
    this.resourceFloatingToastsByType.clear();
  }

  private relayoutResourceFloatingToasts(): void {
    if (this.resourceFloatingToasts.length <= 0) return;
    const gap = 24;
    const latestIndex = this.resourceFloatingToasts.length - 1;
    for (let i = 0; i < this.resourceFloatingToasts.length; i += 1) {
      const entry = this.resourceFloatingToasts[i];
      if (!entry.text.active) continue;
      const stackOffset = latestIndex - i;
      entry.text.setPosition(this.resourceToastBaseX, this.resourceToastBaseY - stackOffset * gap);
    }
  }

  private dismissResourceFloatingToast(toastId: number): void {
    const idx = this.resourceFloatingToasts.findIndex((entry) => entry.id === toastId);
    if (idx < 0) return;
    const [entry] = this.resourceFloatingToasts.splice(idx, 1);
    if (this.resourceFloatingToastsByType.get(entry.type)?.id === toastId) {
      this.resourceFloatingToastsByType.delete(entry.type);
    }
    entry.timer?.remove(false);
    entry.timer = null;
    entry.tween?.remove();
    entry.tween = null;
    entry.text.destroy();
    this.relayoutResourceFloatingToasts();
  }

  private armResourceFloatingToast(entry: ResourceFloatingToastEntry): void {
    entry.timer?.remove(false);
    entry.timer = null;
    entry.tween?.remove();
    entry.tween = null;
    if (!entry.text.active) return;
    entry.text.setAlpha(1);
    entry.timer = this.time.delayedCall(1200, () => {
      this.dismissResourceFloatingToast(entry.id);
    });
    entry.tween = this.tweens.add({
      targets: entry.text,
      y: entry.text.y - 22,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.dismissResourceFloatingToast(entry.id);
      },
    });
  }

  private enqueueResourceFloatingToast(type: string, label: string, color: string, amount: number): void {
    if (!this.player?.active) return;
    const safeAmount = Math.max(1, Math.floor(amount || 1));
    this.resourceToastBaseX = this.player.x;
    this.resourceToastBaseY = this.player.y - 58;

    const existing = this.resourceFloatingToastsByType.get(type);
    if (existing && existing.text.active) {
      existing.amount += safeAmount;
      existing.text.setText(`+${label} ${existing.amount}`);
      const existingIndex = this.resourceFloatingToasts.findIndex((entry) => entry.id === existing.id);
      if (existingIndex >= 0) {
        this.resourceFloatingToasts.splice(existingIndex, 1);
        this.resourceFloatingToasts.push(existing);
      }
      this.relayoutResourceFloatingToasts();
      this.armResourceFloatingToast(existing);
      return;
    }

    while (this.resourceFloatingToasts.length >= 4) {
      const oldest = this.resourceFloatingToasts[0];
      if (!oldest) break;
      this.dismissResourceFloatingToast(oldest.id);
    }

    const text = this.add.text(this.resourceToastBaseX, this.resourceToastBaseY, `+${label} ${safeAmount}`, {
      fontFamily: this.getUIFontFamily(),
      fontSize: '22px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(2000);

    const entry: ResourceFloatingToastEntry = {
      id: ++this.resourceToastSeed,
      type,
      label,
      amount: safeAmount,
      text,
      timer: null,
      tween: null,
    };
    this.resourceFloatingToasts.push(entry);
    this.resourceFloatingToastsByType.set(type, entry);
    this.relayoutResourceFloatingToasts();
    this.armResourceFloatingToast(entry);
  }

  private applyBurnEffect(enemy: Phaser.Physics.Arcade.Sprite): void {
    if ((enemy as any).isBurning) return;
    (enemy as any).isBurning = true;
    enemy.setTint(0xff4400);
    let ticks = 0;
    const timer = this.time.addEvent({
      delay: 500, repeat: 5,
      callback: () => {
        if (enemy.active) {
          this.damageEnemy(enemy, 3);
          ticks++;
          if (ticks >= 5) { (enemy as any).isBurning = false; }
        } else { timer.remove(); }
      },
    });
  }

  private applySlowEffect(enemy: Phaser.Physics.Arcade.Sprite): void {
    if ((enemy as any).isSlowed) return;
    (enemy as any).isSlowed = true;
    const origSpeed = (enemy as any).speed || 60;
    (enemy as any).speed = origSpeed * 0.4;
    enemy.setTint(0x93c5fd);
    this.time.delayedCall(3000, () => {
      if (enemy.active) {
        (enemy as any).speed = origSpeed;
        (enemy as any).isSlowed = false;
        enemy.clearTint();
      }
    });
  }

  private applyPoisonEffect(enemy: Phaser.Physics.Arcade.Sprite): void {
    if ((enemy as any).isPoisoned) return;
    (enemy as any).isPoisoned = true;
    enemy.setTint(0x84cc16);
    let ticks = 0;
    const timer = this.time.addEvent({
      delay: 600, repeat: 4,
      callback: () => {
        if (enemy.active) {
          this.damageEnemy(enemy, 2);
          ticks++;
          if (ticks >= 4) { (enemy as any).isPoisoned = false; }
        } else { timer.remove(); }
      },
    });
  }

  private createChainLightning(start: Phaser.Physics.Arcade.Sprite, bounces: number, damage: number): void {
    let current: Phaser.Physics.Arcade.Sprite = start;
    for (let i = 0; i < bounces; i++) {
      let nearest: Phaser.Physics.Arcade.Sprite | null = null;
      let nearDist = 200;
      this.enemies.getChildren().forEach(e => {
        const enemy = e as Phaser.Physics.Arcade.Sprite;
        if (enemy === current || !enemy.active) return;
        const d = Phaser.Math.Distance.Between(current.x, current.y, enemy.x, enemy.y);
        if (d < nearDist) { nearDist = d; nearest = enemy; }
      });
      if (!nearest) break;

      const target: Phaser.Physics.Arcade.Sprite = nearest;
      const line = this.add.graphics();
      line.lineStyle(2, 0xa855f7, 0.8);
      line.lineBetween(current.x, current.y, target.x, target.y);
      line.setDepth(100);
      this.tweens.add({ targets: line, alpha: 0, duration: 200, onComplete: () => line.destroy() });

      this.damageEnemy(target, damage);
      current = target;
    }
  }

  private handleEffectBulletHit(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active) return;
    const bulletData = bullet as any;
    const effect = bulletData.bulletEffect?.type || 'normal';
    const damage = this.applyHungerPenalty(bulletData.damage || 8);
    const source: DamageSource = bulletData.ownerType === 'companion'
      ? { type: 'companion', companionId: bulletData.ownerId || null }
      : { type: 'player' };

    if (effect === 'burning') this.applyBurnEffect(enemy);
    if (effect === 'frozen') this.applySlowEffect(enemy);
    if (effect === 'poison') this.applyPoisonEffect(enemy);
    if (effect === 'explosive') {
      const radius = bulletData.bulletEffect?.explosionRadius || 60;
      this.createExplosion(enemy.x, enemy.y, radius, damage * 0.6);
    }
    if (effect === 'chain') {
      const count = bulletData.bulletEffect?.chainCount || 2;
      this.createChainLightning(enemy, count, damage * 0.6);
    }

    if (effect === 'piercing' || effect === 'laser') {
      if (bulletData.pierceLeft == null) {
        bulletData.pierceLeft = bulletData.bulletEffect?.pierceCount ?? 2;
      }
      bulletData.pierceLeft -= 1;
      if (bulletData.pierceLeft > 0) {
        this.damageEnemy(enemy, damage, source);
        this.createBulletImpactVfx(
          enemy.x,
          enemy.y,
          effect,
          bullet.tintTopLeft || 0x93c5fd,
          (bullet as any).bulletTextureKey || bullet.texture?.key
        );
        return;
      }
    }

    this.disableBullet(bullet);
    this.createBulletImpactVfx(
      enemy.x,
      enemy.y,
      effect,
      bullet.tintTopLeft || 0x93c5fd,
      (bullet as any).bulletTextureKey || bullet.texture?.key
    );
    this.damageEnemy(enemy, damage, source);
  }

  private enemyHitPlayer(_enemy: any, _player: any): void {
    const ed = _enemy as any;
    this.playEnemyAction(_enemy as Phaser.Physics.Arcade.Sprite, 'attack', true, 170);
    const rawDamage = ed.damage || 10;
    const guardBuffActive = (this.player.getData('guardedUntil') || 0) > this.time.now;
    const guardedDamage = guardBuffActive ? Math.max(1, Math.round(rawDamage * 0.72)) : rawDamage;
    const damage = Math.max(1, Math.round(guardedDamage * this.runMutatorEffects.incomingDamageMul));
    events.emit(GameEvents.PLAYER_HIT, { damage });
    gameState.data.stats.damageTaken += damage;

    // Screen shake on hit
    this.cameras.main.shake(100, 0.006);

    // Red flash
    this.cameras.main.flash(100, 255, 0, 0, false, (_cam: any, progress: number) => {
      if (progress >= 1) { /* done */ }
    });

    // Hit particles from player
    for (let i = 0; i < 3; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const p = this.add.circle(this.player.x, this.player.y, 3, 0xff0000, 0.7).setDepth(100);
      this.tweens.add({
        targets: p,
        x: this.player.x + Math.cos(angle) * 30,
        y: this.player.y + Math.sin(angle) * 30,
        alpha: 0, duration: 300,
        onComplete: () => p.destroy(),
      });
    }

    const hp = this.playerSystem?.getHealth?.() ?? 100;
    if (hp <= 35 && Math.random() < 0.75) {
      this.tryEmitRescueChatter();
    }
  }

  // ============================================================
  // BUILDING
  // ============================================================
  private toggleBuildMode(): void {
    // Fixed panel-first flow:
    // B opens/closes the same workshop panel as C, defaulting to building tab.
    if (this.currentFacility) return;
    if (this.isCraftingPanelOpen) {
      events.emit('toggle-crafting');
      return;
    }
    if (this.isBuildMode) {
      this.exitBuildMode();
      return;
    }
    events.emit('open-crafting-category', { category: 'building', buildOnly: true });
  }

  private initBuildList(): void {
    this.buildList = Object.keys(BUILDING_DEFS);
    if (!this.buildList.includes(this.selectedBuildingId)) {
      this.buildIndex = 0;
      this.selectedBuildingId = this.buildList[0];
    } else {
      this.buildIndex = Math.max(0, this.buildList.indexOf(this.selectedBuildingId));
    }
  }

  private selectBuildByIndex(index: number): void {
    if (!this.isBuildMode || this.buildList.length === 0) return;
    const safeIndex = Phaser.Math.Clamp(index, 0, this.buildList.length - 1);
    this.buildIndex = safeIndex;
    this.selectedBuildingId = this.buildList[this.buildIndex];
    this.refreshBuildPalette();
  }

  private showBuildPalette(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const portrait = this.mobileViewport && h > w;
    const panelW = portrait
      ? Math.min(560, Math.max(340, w - 16))
      : Math.min(420, Math.max(260, w - 20));
    const panelH = portrait ? 124 : 92;
    let panelX = Phaser.Math.Clamp(w - panelW - 10, 10, Math.max(10, w - panelW - 10));
    let panelY = h - panelH - 120;

    // Avoid overlapping minimap (bottom-left)
    const minimapRect = new Phaser.Geom.Rectangle(10, h - 122, 150, 112);
    const panelRect = new Phaser.Geom.Rectangle(panelX, panelY, panelW, panelH);
    if (Phaser.Geom.Intersects.RectangleToRectangle(panelRect, minimapRect)) {
      panelX = minimapRect.right + 10;
      if (panelX + panelW > w - 10) {
        panelX = w - panelW - 10;
        panelY = minimapRect.y - panelH - 10;
      }
      if (panelY < 10) panelY = 10;
    }
    if (!this.buildPalette) {
      this.buildPalette = this.add.container(0, 0).setDepth(1800).setScrollFactor(0);
      this.buildPaletteBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0f172a, 0.85)
        .setOrigin(0, 0).setStrokeStyle(1, 0x0ea5e9, 0.6);
      this.buildPaletteText = this.add.text(panelX + 8, panelY + 8, '', {
        fontSize: portrait ? '20px' : (this.mobileViewport ? '15px' : '13px'),
        color: '#e2e8f0',
        fontFamily: 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif',
      });
      this.buildPalette.add(this.buildPaletteBg);
      this.buildPalette.add(this.buildPaletteText);
    } else if (this.buildPaletteBg && this.buildPaletteText) {
      this.buildPaletteBg.setPosition(panelX, panelY);
      this.buildPaletteText.setPosition(panelX + 8, panelY + 8);
      this.buildPaletteText.setStyle({
        fontSize: portrait ? '20px' : (this.mobileViewport ? '15px' : '13px'),
      });
    }
    this.buildPalette.setVisible(true);
    this.refreshBuildPalette();
  }

  private hideBuildPalette(): void {
    if (this.buildPalette) this.buildPalette.setVisible(false);
  }

  private refreshBuildPalette(): void {
    if (!this.buildPaletteText) return;
    const def = BUILDING_DEFS[this.selectedBuildingId];
    if (!def) {
      this.buildPaletteText.setText('未选择建筑');
      return;
    }
    const costParts: string[] = [];
    for (const [res, amt] of Object.entries(def.cost)) {
      const names: Record<string, string> = {
        wood: '木', metal: '金', scrap: '件', food: '食',
        water: '水', medical: '医', ammo: '弹', energyCore: '核',
      };
      costParts.push(`${names[res] || res}${amt}`);
    }
    const lines = [
      `建造模式：制造工坊-建筑页选择  |  左键放置  |  B退出`,
      `当前：${def.nameCN}  T${def.tier}  HP${def.health}`,
      `成本：${costParts.join(' ')}`,
    ];
    lines.push(getBuildingUpgradeHint(def.id));
    const chain = BaseSystem.getBuildChainStatus(def.id);
    lines.push(`链路：${chain.roleCN} | 分区：${chain.zoneLabelCN}`);
    if (chain.blockedReasons.length > 0) {
      lines.push(`阻塞：${chain.blockedReasons.slice(0, 2).join('；')}`);
    }
    this.buildPaletteText.setText(lines.join('\n'));
  }

  private onBuildSelection(payload: { buildingId?: string } | null): void {
    const buildingId = payload?.buildingId;
    if (!buildingId || !BUILDING_DEFS[buildingId]) return;
    const chain = BaseSystem.getBuildChainStatus(buildingId);
    if (!chain.canConstruct) {
      const msg = `建造链未满足：${chain.blockedReasons[0] || '请先完成前置设施'}`;
      this.showFloatingText(this.cameras.main.width / 2, 220, msg, '#f87171', true);
      return;
    }
    this.selectedBuildingId = buildingId;
    this.initBuildList();
    this.isBuildMode = true;
    this.showBuildPalette();
    this.refreshBuildPalette();
    events.emit(GameEvents.BUILD_MODE_TOGGLED, { active: true });
  }

  private onCraftingPanelState(payload: { open?: boolean } | null): void {
    this.isCraftingPanelOpen = !!payload?.open;
  }

  private exitBuildMode(): void {
    if (!this.isBuildMode) return;
    this.isBuildMode = false;
    this.hideBuildPalette();
    if (this.buildPreview) {
      this.buildPreview.destroy();
      this.buildPreview = null;
    }
    events.emit(GameEvents.BUILD_MODE_TOGGLED, { active: false });
  }

  private toggleCrafting(): void {
    // Emit event for UIScene to handle
    events.emit('toggle-crafting');
  }

  private toggleQuests(): void {
    events.emit('toggle-quests');
  }

  private updateBuildPreview(): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridX = Math.floor(worldPoint.x / 64) * 64 + 32;
    const gridY = Math.floor(worldPoint.y / 64) * 64 + 32;

    if (!this.buildPreview) {
      this.buildPreview = this.add.rectangle(gridX, gridY, 56, 56, 0x4ade80, 0.3);
      this.buildPreview.setStrokeStyle(2, 0x4ade80);
      this.buildPreview.setDepth(100);
    }

    this.buildPreview.setPosition(gridX, gridY);

    // Check validity
    const bDef = BUILDING_DEFS[this.selectedBuildingId];
    const canAfford = bDef ? gameState.canAfford(bDef.cost as any) : false;
    const occupied = this.findPlacedBuildingAt(gridX, gridY);
    let blocked = false;
    let blockReason = '';
    let canExecute = canAfford;
    let actionHint = '放置';
    let upgradeCostHint = '';
    if (occupied && bDef) {
      const fromId = String((occupied as any).buildingId || '');
      const fromTier = Math.max(1, Number((occupied as any).buildingTier || BUILDING_DEFS[fromId]?.tier || 1));
      const upgradeCheck = BaseSystem.getBuildingUpgradeCheck(fromId, bDef.id, fromTier, gameState.data.currentDay, gameState.data.buildings, { x: gridX, y: gridY });
      actionHint = upgradeCheck.kind === 'tier' || upgradeCheck.kind === 'morph' ? '升级' : '占位';
      if (upgradeCheck.kind !== 'none') {
        upgradeCostHint = BaseSystem.getBuildingUpgradeCostText(upgradeCheck);
      }
      if (!upgradeCheck.available) {
        blocked = true;
        blockReason = upgradeCheck.blockedReasons[0] || '位置已被占用';
      } else if (!upgradeCheck.canAfford) {
        blocked = true;
        blockReason = '升级资源不足';
      } else {
        blocked = false;
        canExecute = true;
      }
    }
    if (bDef) {
      const placement = BaseSystem.validateBuildPlacement(bDef.id, gridX, gridY);
      if (!occupied && !placement.canPlace) {
        blocked = true;
        blockReason = placement.positionReason || placement.blockedReasons[0] || '建造链不满足';
      }
    }
    if (!occupied && bDef?.category === 'turret') {
      const powerCapacity = BaseSystem.computePowerCapacity(gameState.data.buildings);
      const powerUsed = BaseSystem.computePowerUsed(gameState.data.buildings);
      const need = bDef.powerUse ?? BASE_POWER_PER_TURRET;
      if (powerUsed + need > powerCapacity) {
        blocked = true;
        blockReason = '电力不足';
      }
    }
    if (!occupied && !canAfford) {
      blockReason = '资源不足';
    }
    if (this.buildPaletteText && bDef) {
      const chain = BaseSystem.validateBuildPlacement(bDef.id, gridX, gridY);
      const lines = [
        `建造模式：制造工坊-建筑页选择  |  左键放置  |  B退出`,
        `当前：${bDef.nameCN}  T${bDef.tier}  HP${bDef.health}`,
        `成本：${Object.entries(bDef.cost).map(([res, amt]) => {
          const names: Record<string, string> = { wood: '木', metal: '金', scrap: '件', food: '食', water: '水', medical: '医', ammo: '弹', energyCore: '核' };
          return `${names[res] || res}${amt}`;
        }).join(' ')}`,
        getBuildingUpgradeHint(bDef.id),
        occupied ? `同格行为：${actionHint}${upgradeCostHint ? ` | 升级耗材 ${upgradeCostHint}` : ''}` : `同格行为：放置`,
        `链路：${chain.roleCN} | 分区：${chain.zoneLabelCN} | 距核心${Math.round(chain.distanceToCore)}`,
        blocked ? `状态：阻塞 - ${blockReason || '不可执行'}` : `状态：可${occupied ? '升级' : '放置'}`,
      ];
      this.buildPaletteText.setText(lines.join('\n'));
    }

    const color = canExecute && !blocked ? 0x4ade80 : 0xef4444;
    this.buildPreview.setFillStyle(color, 0.3);
    this.buildPreview.setStrokeStyle(2, color);
  }

  private placeBuilding(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridX = Math.floor(worldPoint.x / 64) * 64 + 32;
    const gridY = Math.floor(worldPoint.y / 64) * 64 + 32;

    const bDef = BUILDING_DEFS[this.selectedBuildingId];
    if (!bDef) return;
    if (this.findPendingConstructionAt(gridX, gridY)) {
      this.showFloatingText(this.cameras.main.width / 2, 200, '该位置已有施工任务', '#fbbf24', true);
      return;
    }
    const occupied = this.findPlacedBuildingAt(gridX, gridY);
    if (occupied) {
      if (!this.tryUpgradeOnSameTile(occupied, bDef.id, 'manual')) {
        this.showFloatingText(this.cameras.main.width / 2, 200, '该建筑不可按当前路线升级', '#ef4444', true);
      }
      return;
    }

    const placement = BaseSystem.validateBuildPlacement(bDef.id, gridX, gridY);
    if (!placement.canPlace) {
      this.showFloatingText(
        this.cameras.main.width / 2,
        200,
        placement.positionReason || placement.blockedReasons[0] || '建造链不满足',
        '#ef4444',
        true
      );
      return;
    }

    // Power check for turrets
    if (bDef.category === 'turret') {
      const powerCapacity = BaseSystem.computePowerCapacity(gameState.data.buildings);
      const powerUsed = BaseSystem.computePowerUsed(gameState.data.buildings);
      const need = bDef.powerUse ?? BASE_POWER_PER_TURRET;
      if (powerUsed + need > powerCapacity) {
        this.showFloatingText(this.cameras.main.width / 2, 200, '电力不足!', '#ef4444', true);
        return;
      }
    }

    if (this.findPlacedBuildingAt(gridX, gridY)) return;

    if (!gameState.spendResources(bDef.cost as any)) {
      this.showFloatingText(this.cameras.main.width / 2, 200, '资源不足!', '#ef4444', true);
      return;
    }
    const durationMs = this.computeConstructionDurationMs('build', bDef.id, bDef.tier, bDef.cost as Partial<Resources>, 'manual');
    this.enqueueConstructionTask({
      id: `ct_${this.time.now}_${Math.floor(Math.random() * 100000)}`,
      kind: 'build',
      status: 'queued',
      source: 'manual',
      buildingId: bDef.id,
      x: gridX,
      y: gridY,
      targetTier: bDef.tier,
      cost: { ...(bDef.cost as any) },
      durationMs,
      progressMs: 0,
      queuedAt: Math.floor(this.time.now),
    });
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(gridX, gridY - 24, `开始施工 ${bDef.nameCN}`, '#38bdf8', false);
  }

  private getTurretBaseProfileById(buildingId: string): { damage: number; fireRate: number; range: number } {
    if (buildingId === 'missile_turret') return { damage: 30, fireRate: 880, range: 300 };
    if (buildingId === 'laser_turret') return { damage: 24, fireRate: 760, range: 280 };
    if (buildingId === 'slow_turret') return { damage: 14, fireRate: 620, range: 250 };
    if (buildingId === 'sniper_nest') return { damage: 42, fireRate: 1120, range: 420 };
    if (buildingId === 'flame_turret') return { damage: 12, fireRate: 520, range: 172 };
    return { damage: 15, fireRate: 700, range: 250 };
  }

  private tryUpgradeOnSameTile(
    existing: Phaser.Physics.Arcade.Sprite,
    toSelectedId: string,
    source: 'manual' | 'auto' = 'manual'
  ): boolean {
    const fromId = String((existing as any).buildingId || '');
    if (!fromId || !BUILDING_DEFS[fromId]) return false;
    const posX = Math.round(existing.x);
    const posY = Math.round(existing.y);
    if (this.findPendingConstructionAt(posX, posY)) {
      if (source === 'manual') {
        this.showFloatingText(this.cameras.main.width / 2, 200, '该建筑已有升级施工', '#fbbf24', true);
      }
      return false;
    }
    const fromTier = Math.max(
      1,
      Number((existing as any).buildingTier || (existing as any).tier || BUILDING_DEFS[fromId].tier || 1)
    );
    const check = BaseSystem.getBuildingUpgradeCheck(
      fromId,
      toSelectedId,
      fromTier,
      gameState.data.currentDay,
      gameState.data.buildings,
      { x: posX, y: posY }
    );
    if (!check.available) {
      if (source === 'manual') {
        const reason = check.blockedReasons[0] || '升级条件不满足';
        this.showFloatingText(this.cameras.main.width / 2, 200, reason, '#ef4444', true);
      }
      return false;
    }
    if (!check.canAfford) {
      if (source === 'manual') {
        this.showFloatingText(this.cameras.main.width / 2, 200, '升级资源不足', '#ef4444', true);
      }
      return false;
    }
    if (!gameState.spendResources(check.cost as any)) {
      if (source === 'manual') {
        this.showFloatingText(this.cameras.main.width / 2, 200, '升级资源不足', '#ef4444', true);
      }
      return false;
    }
    const durationMs = this.computeConstructionDurationMs(
      check.kind === 'tier' ? 'upgrade-tier' : 'upgrade-morph',
      check.toId,
      check.toTier,
      check.cost as Partial<Resources>,
      source
    );
    this.enqueueConstructionTask({
      id: `ct_${this.time.now}_${Math.floor(Math.random() * 100000)}`,
      kind: check.kind === 'tier' ? 'upgrade-tier' : 'upgrade-morph',
      status: 'queued',
      source,
      fromBuildingId: check.fromId,
      buildingId: check.toId,
      x: posX,
      y: posY,
      targetTier: check.toTier,
      cost: { ...(check.cost as any) },
      durationMs,
      progressMs: 0,
      queuedAt: Math.floor(this.time.now),
    });
    events.emit('update-resources', gameState.data.resources);
    if (source === 'manual') {
      this.showFloatingText(
        existing.x,
        existing.y - 26,
        `升级施工 ${check.summary}`,
        '#4ade80',
        false
      );
    }
    return true;
  }

  private getConstructionTasks(): ConstructionTaskData[] {
    if (!Array.isArray(gameState.data.constructionTasks)) {
      gameState.data.constructionTasks = [];
    }
    return gameState.data.constructionTasks;
  }

  private findPendingConstructionAt(x: number, y: number): ConstructionTaskData | null {
    const tasks = this.getConstructionTasks();
    return tasks.find((task) => (
      task.status !== 'done'
      && task.status !== 'failed'
      && Math.abs(task.x - x) < 2
      && Math.abs(task.y - y) < 2
    )) || null;
  }

  private enqueueConstructionTask(task: ConstructionTaskData): void {
    this.getConstructionTasks().push(task);
    this.createConstructionSiteVisual(task);
    this.updateConstructionSiteVisual(task);
    BaseSystem.refreshBaseState();
    events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
    events.emit('update-resources', gameState.data.resources);
  }

  private computeConstructionDurationMs(
    kind: ConstructionTaskKind,
    buildingId: string,
    targetTier: number,
    cost: Partial<Resources>,
    source: 'manual' | 'auto'
  ): number {
    const weightMap: Partial<Record<keyof Resources, number>> = {
      wood: 0.9,
      metal: 1.2,
      scrap: 1.15,
      food: 0.5,
      water: 0.5,
      medical: 1.4,
      ammo: 1.05,
      energyCore: 9,
      bitcoin: 0,
    };
    let costWeight = 0;
    (Object.entries(cost || {}) as Array<[keyof Resources, number]>).forEach(([key, amount]) => {
      if (!amount || amount <= 0) return;
      costWeight += amount * (weightMap[key] || 1);
    });
    const base = kind === 'build' ? 4800 : kind === 'upgrade-tier' ? 4200 : 4600;
    const tierBonus = Math.max(0, targetTier - 1) * 420;
    const def = BUILDING_DEFS[buildingId];
    const categoryBonus = def?.category === 'turret' ? 900 : def?.category === 'defense' ? 360 : 620;
    const sourceMul = source === 'manual' ? 0.94 : 1;
    return Math.max(1800, Math.round((base + costWeight * 180 + tierBonus + categoryBonus) * sourceMul));
  }

  private updateConstructionAutomation(delta: number): void {
    const tasks = this.getConstructionTasks();
    if (tasks.length <= 0 && !gameState.data.autoBuild.enabled) return;

    if (this.time.now >= this.nextAutoBuildCrewSyncAt) {
      this.nextAutoBuildCrewSyncAt = this.time.now + 2200;
      this.maintainAutoBuildCrew();
    }

    this.processConstructionTasks(delta);

    if (this.time.now >= this.nextAutoBuildPlanAt) {
      this.nextAutoBuildPlanAt = this.time.now + (this.lowPerfMode ? 1600 : 980);
      this.planAutoConstruction();
    }

    if (this.time.now >= this.nextConstructionSummaryAt) {
      this.nextConstructionSummaryAt = this.time.now + 5200;
      const activeCount = tasks.filter((task) => task.status === 'active').length;
      const queueCount = tasks.filter((task) => task.status === 'queued').length;
      if (activeCount > 0 || queueCount > 0) {
        this.showFloatingText(
          this.player.x,
          this.player.y - 82,
          `施工队列：进行中${activeCount} · 排队${queueCount}`,
          '#67e8f9',
          false
        );
      }
    }
  }

  private processConstructionTasks(delta: number): void {
    const tasks = this.getConstructionTasks();
    if (tasks.length <= 0) return;

    const autoCfg = gameState.data.autoBuild;
    let activeCount = tasks.filter((task) => task.status === 'active').length;
    let activeAutoCount = tasks.filter((task) => task.status === 'active' && task.source === 'auto').length;
    const maxConcurrent = Math.max(1, autoCfg.maxConcurrent || 1);
    const crewCapacity = this.getConstructionCrewCapacity();
    const queued = tasks
      .filter((task) => task.status === 'queued')
      .sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
    for (const task of queued) {
      if (activeCount >= maxConcurrent) break;
      if (task.source === 'auto' && autoCfg.pauseAtNight && gameState.data.isNight) continue;
      if (task.source === 'auto' && (crewCapacity <= 0 || activeAutoCount >= crewCapacity)) continue;
      task.status = 'active';
      task.startedAt = Math.floor(this.time.now);
      task.progressMs = Math.max(0, task.progressMs || 0);
      this.assignResidentToConstruction(task);
      this.updateConstructionSiteVisual(task);
      activeCount += 1;
      if (task.source === 'auto') activeAutoCount += 1;
    }

    const finishedTaskIds: string[] = [];
    for (const task of tasks) {
      if (task.status !== 'active') continue;
      if (task.source === 'auto' && autoCfg.pauseAtNight && gameState.data.isNight) {
        this.updateConstructionSiteVisual(task);
        continue;
      }
      if (!this.constructionAssignedResidents.has(task.id) && !gameState.data.isNight) {
        this.assignResidentToConstruction(task);
      }
      const speedMul = this.getConstructionSpeedMultiplier(task);
      task.progressMs += delta * speedMul;
      this.updateConstructionSiteVisual(task);
      if (task.progressMs < task.durationMs) continue;

      const done = this.completeConstructionTask(task);
      if (done) {
        task.status = 'done';
      } else {
        this.failConstructionTask(task, '施工失败，资源已返还');
      }
      finishedTaskIds.push(task.id);
    }

    if (finishedTaskIds.length > 0) {
      gameState.data.constructionTasks = tasks.filter((task) => (
        task.status !== 'done' && task.status !== 'failed'
      ));
      events.emit('update-resources', gameState.data.resources);
      BaseSystem.refreshBaseState();
      events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
    }
  }

  private getConstructionSpeedMultiplier(task: ConstructionTaskData): number {
    const assigned = gameState.data.base.jobAssigned || { idle: 0, workshop: 0, power: 0 };
    const workshop = Math.max(0, assigned.workshop || 0);
    const power = Math.max(0, assigned.power || 0);
    const idle = Math.max(0, assigned.idle || 0);
    let mul = 1 + workshop * 0.24 + power * 0.09 + Math.min(0.2, idle * 0.03);
    if (task.source === 'manual') mul += 0.08;
    if (gameState.data.isNight) mul *= 0.86;
    if (!this.constructionAssignedResidents.has(task.id)) {
      mul *= task.source === 'auto' ? 0.48 : 0.78;
    } else {
      mul *= 1.12;
      const companionId = this.constructionAssignedResidents.get(task.id);
      const companion = companionId ? gameState.data.companions.find((item) => item.id === companionId) : null;
      if (companion) {
        const duty = this.getCompanionAutoDuty(companion);
        const milestone = getCompanionMilestoneBonuses(companion.role || 'tank', Math.max(1, companion.level || 1));
        if (duty === 'builder') mul *= 1.26;
        else if (duty === 'defender') mul *= 1.12;
        mul *= milestone.constructionSpeedMul;
      }
    }
    return Phaser.Math.Clamp(mul, 0.62, 3.2);
  }

  private completeConstructionTask(task: ConstructionTaskData): boolean {
    this.releaseResidentFromConstruction(task.id);
    this.removeConstructionSiteVisual(task.id);
    if (task.kind === 'build') {
      const ok = this.createPlacedBuilding(task.buildingId, task.x, task.y, task.targetTier);
      if (ok) {
        this.showFloatingText(task.x, task.y - 24, `完工 ${BUILDING_DEFS[task.buildingId]?.nameCN || task.buildingId}`, '#4ade80', false);
      }
      return ok;
    }

    const existing = this.findPlacedBuildingAt(task.x, task.y);
    if (!existing) return false;
    const toDef = BUILDING_DEFS[task.buildingId];
    if (!toDef) return false;
    const fromDef = (existing as any).buildingDef || BUILDING_DEFS[String((existing as any).buildingId || '')];
    if (!fromDef) return false;
    const fromMax = Math.max(1, Number((existing as any).maxHealth || fromDef.health));
    const fromHp = Phaser.Math.Clamp(Number((existing as any).health || fromMax), 0, fromMax);
    const hpRatio = Phaser.Math.Clamp(fromHp / fromMax, 0.25, 1);
    const toMax = Math.max(1, toDef.health + Math.max(0, task.targetTier - toDef.tier) * toDef.healthPerTier);
    const toHp = Math.max(1, Math.round(toMax * hpRatio));

    const texture = this.getBuildingTextureKey(toDef.id, toDef.category);
    const textureWithVariant = this.pickBuildTextureWithVariant(texture, toDef.id, existing.x, existing.y);
    existing.setTexture(textureWithVariant);
    const useTint = texture === 'wall' || texture === 'turret';
    if (useTint) existing.setTint(toDef.color);
    else existing.clearTint();

    (existing as any).buildingId = toDef.id;
    (existing as any).buildingDef = toDef;
    (existing as any).buildingTier = task.targetTier;
    (existing as any).maxHealth = toMax;
    (existing as any).health = toHp;
    existing.setAlpha(Phaser.Math.Clamp(toHp / toMax, 0.35, 1));

    if (toDef.category === 'turret') {
      const profile = this.getTurretBaseProfileById(toDef.id);
      (existing as any).baseHealth = toMax;
      this.initTurretAutoLevelStats(existing, profile.damage, profile.fireRate, profile.range);
    }

    const idx = this.findBuildingRecordIndexByPos(Math.round(existing.x), Math.round(existing.y));
    if (idx !== -1) {
      gameState.data.buildings[idx] = {
        ...gameState.data.buildings[idx],
        id: toDef.id,
        type: toDef.category,
        tier: task.targetTier,
        health: toHp,
      };
    }
    this.showFloatingText(existing.x, existing.y - 24, `升级完工 ${toDef.nameCN} T${task.targetTier}`, '#4ade80', false);
    QuestSystem.updateProgress('build', toDef.id, 1);
    return true;
  }

  private failConstructionTask(task: ConstructionTaskData, reason: string): void {
    task.status = 'failed';
    this.releaseResidentFromConstruction(task.id);
    this.removeConstructionSiteVisual(task.id);
    this.restoreConstructionCost(task.cost);
    this.showFloatingText(task.x, task.y - 24, reason, '#ef4444', false);
  }

  private restoreConstructionCost(cost: Partial<Resources>): void {
    (Object.entries(cost || {}) as Array<[keyof Resources, number]>).forEach(([key, amount]) => {
      if (!amount || amount <= 0) return;
      gameState.addResource(key, amount);
    });
  }

  private createPlacedBuilding(buildingId: string, gridX: number, gridY: number, targetTier: number): boolean {
    const bDef = BUILDING_DEFS[buildingId];
    if (!bDef) return false;
    if (this.findPlacedBuildingAt(gridX, gridY)) return false;
    const group = bDef.category === 'turret' ? this.turrets : this.walls;
    const texture = this.getBuildingTextureKey(bDef.id, bDef.category);
    const textureWithVariant = this.pickBuildTextureWithVariant(texture, bDef.id, gridX, gridY);
    const building = group.create(gridX, gridY, textureWithVariant) as Phaser.Physics.Arcade.Sprite;
    this.configureStructure(building);
    const useTint = texture === 'wall' || texture === 'turret';
    if (useTint) building.setTint(bDef.color);
    else building.clearTint();
    const tier = Math.max(bDef.tier, targetTier || bDef.tier);
    const maxHealth = Math.max(1, bDef.health + Math.max(0, tier - bDef.tier) * bDef.healthPerTier);
    (building as any).health = maxHealth;
    (building as any).maxHealth = maxHealth;
    (building as any).buildingId = bDef.id;
    (building as any).buildingDef = bDef;
    (building as any).buildingTier = tier;

    if (bDef.category === 'turret') {
      const turretProfile = this.getTurretBaseProfileById(bDef.id);
      this.initTurretAutoLevelStats(building, turretProfile.damage, turretProfile.fireRate, turretProfile.range);
    }

    gameState.data.stats.buildingsPlaced += 1;
    gameState.data.buildings.push({
      id: bDef.id,
      type: bDef.category,
      x: gridX,
      y: gridY,
      tier,
      health: maxHealth,
    });
    QuestSystem.updateProgress('build', bDef.id, 1);
    return true;
  }

  private planAutoConstruction(): void {
    const autoBuild = gameState.data.autoBuild;
    if (!autoBuild?.enabled) return;
    if (autoBuild.pauseAtNight && gameState.data.isNight) return;
    if (this.getConstructionCrewCapacity() <= 0) return;

    const taskList = this.getConstructionTasks();
    const pendingCount = taskList.filter((task) => task.status === 'queued' || task.status === 'active').length;
    const queueCap = Math.max(autoBuild.maxConcurrent, autoBuild.queueCap || autoBuild.maxConcurrent * 3);
    if (pendingCount >= queueCap) return;

    const dutyCounts = this.getBaseAutoDutyCounts();
    const rules = [...(autoBuild.rules || [])]
      .map((rule) => ({
        rule,
        targetCount: this.getEffectiveRuleTarget(rule, dutyCounts),
        active: rule.enabled || (dutyCounts.defender > 0 && this.isDefenseRuleBuilding(rule.buildingId)),
        priority: rule.priority + (this.isDefenseRuleBuilding(rule.buildingId) ? dutyCounts.defender * 6 : dutyCounts.builder * 2),
      }))
      .filter((entry) => entry.active && entry.targetCount > 0 && !!BUILDING_DEFS[entry.rule.buildingId])
      .sort((a, b) => b.priority - a.priority);
    for (const entry of rules) {
      if (this.tryQueueAutoRule(entry.rule, entry.targetCount)) break;
    }
  }

  private tryQueueAutoRule(rule: AutoBuildRule, effectiveTargetCount?: number): boolean {
    const def = BUILDING_DEFS[rule.buildingId];
    if (!def) return false;
    const targetCount = Math.max(0, Math.floor(effectiveTargetCount ?? rule.targetCount));
    const existingCount = gameState.data.buildings.filter((building) => building.id === rule.buildingId).length;
    const plannedCount = this.getConstructionTasks().filter((task) => (
      (task.status === 'queued' || task.status === 'active') && task.buildingId === rule.buildingId
    )).length;
    const totalCount = existingCount + plannedCount;

    if (totalCount < targetCount) {
      const pos = this.findAutoBuildPlacement(rule.buildingId);
      if (!pos) return false;
      const cost = def.cost as Partial<Resources>;
      if (!this.canSpendWithReserve(cost)) return false;
      if (!gameState.spendResources(cost as any)) return false;
      const durationMs = this.computeConstructionDurationMs('build', def.id, def.tier, cost, 'auto');
      this.enqueueConstructionTask({
        id: `ct_${this.time.now}_${Math.floor(Math.random() * 100000)}`,
        kind: 'build',
        status: 'queued',
        source: 'auto',
        buildingId: def.id,
        x: pos.x,
        y: pos.y,
        targetTier: def.tier,
        cost: { ...(cost as any) },
        durationMs,
        progressMs: 0,
        queuedAt: Math.floor(this.time.now),
      });
      this.showFloatingText(pos.x, pos.y - 22, `自动施工 ${def.nameCN}`, '#67e8f9', false);
      return true;
    }

    if (!rule.allowUpgrade) return false;
    const maxTier = Math.min(def.maxTier, Math.max(def.tier, rule.maxTier || def.maxTier));
    if (maxTier <= def.tier) return false;

    const candidates = gameState.data.buildings
      .filter((building) => building.id === rule.buildingId && (building.tier || def.tier) < maxTier)
      .sort((a, b) => (a.tier || 1) - (b.tier || 1));
    for (const candidate of candidates) {
      if (this.findPendingConstructionAt(candidate.x, candidate.y)) continue;
      const sprite = this.findPlacedBuildingAt(candidate.x, candidate.y);
      if (!sprite) continue;
      if (this.tryUpgradeOnSameTile(sprite, rule.buildingId, 'auto')) {
        this.showFloatingText(candidate.x, candidate.y - 22, `自动升级 ${def.nameCN}`, '#a78bfa', false);
        return true;
      }
    }
    return false;
  }

  private findAutoBuildPlacement(buildingId: string): { x: number; y: number } | null {
    const chain = BaseSystem.getBuildChainStatus(buildingId, gameState.data.currentDay, gameState.data.buildings);
    const centerX = Math.floor(BASE_PLACEMENT_RULE.innerCenterX / 64) * 64 + 32;
    const centerY = Math.floor(BASE_PLACEMENT_RULE.innerCenterY / 64) * 64 + 32;
    const minRing = chain.zone === 'outer' ? 3 : 0;
    const maxRing = chain.zone === 'inner' ? 5 : 10;

    for (let ring = minRing; ring <= maxRing; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = centerX + dx * 64;
          const y = centerY + dy * 64;
          if (x < 32 || x > 1968 || y < 32 || y > 1468) continue;
          if (this.findPlacedBuildingAt(x, y)) continue;
          if (this.findPendingConstructionAt(x, y)) continue;
          const placement = BaseSystem.validateBuildPlacement(buildingId, x, y);
          if (placement.canPlace) return { x, y };
        }
      }
    }
    return null;
  }

  private canSpendWithReserve(cost: Partial<Resources>): boolean {
    const reserve = gameState.data.autoBuild.reserve || {};
    return (Object.entries(cost || {}) as Array<[keyof Resources, number]>).every(([key, amount]) => {
      if (!amount || amount <= 0) return true;
      if (key === 'bitcoin') return true;
      const remain = (gameState.data.resources[key] || 0) - amount;
      const keep = Number((reserve as any)[key] || 0);
      return remain >= keep;
    });
  }

  private getCompanionAutoDuty(companion: CompanionData): 'builder' | 'scavenger' | 'defender' | 'support' {
    const duty = companion.autoDuty || BaseSystem.getCompanionAutoDuty(companion);
    companion.autoDuty = duty;
    return duty;
  }

  private getBaseAutoDutyCounts(): Record<'builder' | 'scavenger' | 'defender' | 'support', number> {
    const counts = {
      builder: 0,
      scavenger: 0,
      defender: 0,
      support: 0,
    };
    gameState.data.companions.forEach((companion) => {
      if (companion.status !== 'base') return;
      counts[this.getCompanionAutoDuty(companion)] += 1;
    });
    return counts;
  }

  private maintainAutoDutyDispatch(): void {
    const cfg = gameState.data.autoBuild;
    if (!cfg?.autoAssignDuties) return;
    const baseRoster = gameState.data.companions.filter((companion) => companion.status === 'base');
    if (baseRoster.length <= 0) return;

    let shouldAssign = false;
    for (const companion of baseRoster) {
      const duty = this.getCompanionAutoDuty(companion);
      const expectedJob = BaseSystem.recommendJobForCompanion(companion);
      if (duty === 'builder' || duty === 'defender') {
        if (companion.job !== 'workshop') {
          shouldAssign = true;
          break;
        }
        continue;
      }
      if (companion.job === 'idle' || companion.job !== expectedJob) {
        shouldAssign = true;
        break;
      }
    }
    if (!shouldAssign) return;

    const result = BaseSystem.autoAssignBaseCompanions();
    if (result.assigned <= 0) return;
    BaseSystem.refreshBaseState();
    this.syncBaseResidents();
    this.syncCompanionRoster();
    if (this.time.now >= this.nextAutoDutyDispatchTipAt) {
      this.nextAutoDutyDispatchTipAt = this.time.now + 6000;
      this.showFloatingText(
        this.player.x,
        this.player.y - 70,
        `自动分工：建筑工/拾荒者/防御者已派任`,
        '#67e8f9',
        false
      );
    }
  }

  private updateScavengerCollectors(): void {
    if (this.time.now < this.nextScavengerCollectorSyncAt) return;
    this.nextScavengerCollectorSyncAt = this.time.now + (this.lowPerfMode ? 320 : 160);
    const collectors: Array<{ x: number; y: number; radius: number }> = [];
    let scavengerCount = 0;
    let scavengerLevelSum = 0;
    for (const [companionId, container] of this.baseResidents.entries()) {
      if (!container.active || !container.visible) continue;
      if (container.getData('constructionBusy')) continue;
      const companion = gameState.data.companions.find((item) => item.id === companionId);
      if (!companion || companion.status !== 'base') continue;
      if (this.getCompanionAutoDuty(companion) !== 'scavenger') continue;
      scavengerCount += 1;
      scavengerLevelSum += Math.max(1, companion.level || 1);
      const milestone = getCompanionMilestoneBonuses(companion.role || 'tank', Math.max(1, companion.level || 1));
      const radius = Phaser.Math.Clamp(
        132 + (companion.level || 1) * 6 + milestone.scavengerRadiusBonus,
        132,
        360
      );
      collectors.push({ x: container.x, y: container.y, radius });
    }
    if (scavengerCount > 0) {
      const avgScavengerLevel = scavengerLevelSum / scavengerCount;
      collectors.push({
        x: BASE_PLACEMENT_RULE.innerCenterX,
        y: BASE_PLACEMENT_RULE.innerCenterY,
        radius: Phaser.Math.Clamp(180 + scavengerCount * 24 + avgScavengerLevel * 4, 180, 420),
      });
      collectors.push({
        x: this.player.x,
        y: this.player.y,
        radius: Phaser.Math.Clamp(84 + scavengerCount * 8, 84, 160),
      });
    }
    this.lootSystem.setCompanionCollectors(collectors);
  }

  private isDefenseRuleBuilding(buildingId: string): boolean {
    return buildingId.includes('wall')
      || buildingId.includes('turret')
      || buildingId === 'gate'
      || buildingId === 'spike_trap'
      || buildingId === 'electric_fence'
      || buildingId === 'mine_field';
  }

  private getEffectiveRuleTarget(rule: AutoBuildRule, counts: Record<'builder' | 'scavenger' | 'defender' | 'support', number>): number {
    let target = Math.max(0, Math.floor(rule.targetCount || 0));
    const id = rule.buildingId;
    if (id.includes('wall') || id === 'gate') {
      const defenseTarget = counts.defender > 0 ? 2 + counts.defender * 2 : 0;
      target = Math.max(target, defenseTarget);
    } else if (id.includes('turret')) {
      const defenseTarget = counts.defender > 0 ? 1 + Math.ceil(counts.defender * 0.6) : 0;
      target = Math.max(target, defenseTarget);
    } else if (id === 'generator' && counts.builder > 0) {
      target = Math.max(target, 1);
    }
    return Phaser.Math.Clamp(target, 0, 40);
  }

  private maintainAutoBuildCrew(): void {
    const cfg = gameState.data.autoBuild;
    if (!cfg?.enabled || !cfg.autoAssignBuilders) return;

    const baseRoster = gameState.data.companions.filter((comp) => comp.status === 'base');
    if (baseRoster.length <= 0) return;
    const dutyCounts = this.getBaseAutoDutyCounts();
    const dutyDrivenTarget = dutyCounts.builder + Math.ceil(dutyCounts.defender * 0.6);
    const requestedTarget = Math.max(0, Math.floor(cfg.desiredBuilderCount || 0));
    const autoDutyMode = !!cfg.autoAssignDuties;
    const moderatedRequested = autoDutyMode
      ? Math.min(requestedTarget, dutyDrivenTarget + 1)
      : requestedTarget;
    const targetBuilders = Phaser.Math.Clamp(
      Math.max(moderatedRequested, dutyDrivenTarget),
      0,
      Math.min(12, baseRoster.length)
    );

    const buildTasks = this.getConstructionTasks().filter((task) => task.status === 'queued' || task.status === 'active');
    const activeTasks = buildTasks.filter((task) => task.status === 'active');
    let workshopCount = baseRoster.filter((comp) => comp.job === 'workshop').length;
    let changed = 0;

    if (targetBuilders <= 0 && activeTasks.length <= 0 && workshopCount > 0) {
      const candidates = baseRoster
        .filter((comp) => comp.job === 'workshop' && !this.isCompanionConstructionBusy(comp.id))
        .sort((a, b) => Number(a.level || 1) - Number(b.level || 1));
      for (const candidate of candidates) {
        candidate.job = 'idle';
        changed += 1;
      }
      workshopCount = 0;
    } else if (workshopCount < targetBuilders) {
      const dutyWeight = (companion: CompanionData): number => {
        const duty = this.getCompanionAutoDuty(companion);
        if (autoDutyMode) {
          if (duty === 'builder') return 4;
          if (duty === 'defender') return 3;
          if (duty === 'support') return 1;
          return -1;
        }
        if (duty === 'builder') return 3;
        if (duty === 'defender') return 2;
        if (duty === 'scavenger') return 1;
        return 0;
      };
      const candidates = baseRoster
        .filter((comp) => comp.job === 'idle')
        .sort((a, b) => {
          const da = dutyWeight(a);
          const db = dutyWeight(b);
          if (da !== db) return db - da;
          const la = Number(a.level || 1);
          const lb = Number(b.level || 1);
          return lb - la;
        });
      for (const candidate of candidates) {
        if (workshopCount >= targetBuilders) break;
        if (!BaseSystem.canAssignJob('workshop')) break;
        candidate.job = 'workshop';
        workshopCount += 1;
        changed += 1;
      }
    } else if (workshopCount > targetBuilders && activeTasks.length <= 0) {
      const demote = workshopCount - targetBuilders;
      if (demote > 0) {
        const candidates = baseRoster
          .filter((comp) => comp.job === 'workshop' && !this.isCompanionConstructionBusy(comp.id))
          .sort((a, b) => {
            const dutyOrder = (companion: CompanionData): number => {
              const duty = this.getCompanionAutoDuty(companion);
              if (autoDutyMode) {
                if (duty === 'scavenger') return 0;
                if (duty === 'support') return 1;
                if (duty === 'defender') return 2;
                return 3;
              }
              if (duty === 'support') return 0;
              if (duty === 'scavenger') return 1;
              if (duty === 'defender') return 2;
              return 3;
            };
            const oa = dutyOrder(a);
            const ob = dutyOrder(b);
            if (oa !== ob) return oa - ob;
            return Number(a.level || 1) - Number(b.level || 1);
          });
        for (let i = 0; i < candidates.length && i < demote; i += 1) {
          candidates[i].job = 'idle';
          changed += 1;
        }
      }
    }

    if (changed <= 0) return;
    BaseSystem.refreshBaseState();
    this.syncBaseResidents();
    events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
      this.showFloatingText(
      this.player.x,
      this.player.y - 76,
      `施工委派已调整：${targetBuilders}名工坊`,
      '#67e8f9',
      false
    );
  }

  private getConstructionCrewCapacity(): number {
    const cfg = gameState.data.autoBuild;
    if (!cfg?.enabled) return 0;
    const mode = cfg.crewMode === 'workshop_only' ? 'workshop_only' : 'workshop_idle';
    const desired = Math.max(0, Math.floor(cfg.desiredBuilderCount || 0));
    if (desired <= 0) return 0;

    const workers = gameState.data.companions.filter((comp) => {
      if (comp.status !== 'base') return false;
      if (this.isCompanionConstructionBusy(comp.id)) return false;
      if (mode === 'workshop_only') return comp.job === 'workshop';
      return comp.job === 'workshop' || comp.job === 'idle';
    }).length;
    return Math.max(0, Math.min(desired, workers));
  }

  private isCompanionConstructionBusy(companionId: string): boolean {
    const container = this.baseResidents.get(companionId);
    if (!container || !container.active) return false;
    return !!container.getData('constructionBusy');
  }

  private createConstructionSiteVisual(task: ConstructionTaskData): void {
    if (this.constructionSiteVisuals.has(task.id)) return;
    const wrap = this.add.container(task.x, task.y - 30).setDepth(120);
    const frame = this.add.rectangle(0, 0, 64, 30, 0x020617, 0.88).setStrokeStyle(1, 0x1e293b, 1);
    const barBg = this.add.rectangle(0, 4, 48, 4, 0x111827, 0.95).setOrigin(0.5, 0.5);
    const bar = this.add.rectangle(-24, 4, 48, 4, 0x38bdf8, 0.95).setOrigin(0, 0.5);
    const label = this.add.text(0, -8, '施工', {
      fontSize: this.worldFs(10, 9),
      color: '#93c5fd',
      fontFamily: this.getUIFontFamily(),
    }).setOrigin(0.5, 0.5);
    const eta = this.add.text(0, 12, '--', {
      fontSize: this.worldFs(9, 8),
      color: '#94a3b8',
      fontFamily: this.getUIFontFamily(),
    }).setOrigin(0.5, 0.5);
    wrap.add([frame, barBg, bar, label, eta]);
    this.constructionSiteVisuals.set(task.id, { container: wrap, bar, label, eta });
  }

  private updateConstructionSiteVisual(task: ConstructionTaskData): void {
    let visual = this.constructionSiteVisuals.get(task.id);
    if (!visual) {
      this.createConstructionSiteVisual(task);
      visual = this.constructionSiteVisuals.get(task.id);
      if (!visual) return;
    }
    visual.container.setPosition(task.x, task.y - 30);
    const progressRatio = Phaser.Math.Clamp(task.durationMs > 0 ? task.progressMs / task.durationMs : 0, 0, 1);
    visual.bar.setScale(Math.max(0.06, progressRatio), 1);
    const remainMs = Math.max(0, Math.round(task.durationMs - task.progressMs));
    const remainSec = Math.ceil(remainMs / 1000);
    visual.eta.setText(task.status === 'queued' ? '等待派工' : `剩余 ${remainSec}s`);
    const pausedAtNight = task.status === 'active'
      && task.source === 'auto'
      && gameState.data.isNight
      && gameState.data.autoBuild.pauseAtNight;
    if (task.status === 'active') {
      if (pausedAtNight) {
        visual.bar.setFillStyle(0xf59e0b, 0.9);
        visual.label.setText('夜间暂停').setColor('#fbbf24');
      } else {
        visual.bar.setFillStyle(task.source === 'auto' ? 0x22d3ee : 0x4ade80, 0.95);
        visual.label.setText(`施工 ${Math.round(progressRatio * 100)}%`).setColor('#e2e8f0');
        const nextFxAt = this.constructionFxNextAt.get(task.id) || 0;
        if (this.time.now >= nextFxAt) {
          this.constructionFxNextAt.set(task.id, this.time.now + Phaser.Math.Between(260, 440));
          this.emitConstructionPulseFx(task.x, task.y, task.source === 'auto' ? 0x38bdf8 : 0x4ade80);
        }
      }
    } else if (task.status === 'queued') {
      visual.bar.setFillStyle(0x64748b, 0.75);
      visual.label.setText('排队中').setColor('#94a3b8');
    } else {
      visual.bar.setFillStyle(0xf87171, 0.95);
      visual.label.setText('失败').setColor('#fca5a5');
    }
  }

  private removeConstructionSiteVisual(taskId: string): void {
    const visual = this.constructionSiteVisuals.get(taskId);
    if (!visual) return;
    this.constructionSiteVisuals.delete(taskId);
    this.constructionFxNextAt.delete(taskId);
    this.tweens.add({
      targets: visual.container,
      alpha: 0,
      y: visual.container.y - 8,
      duration: 180,
      onComplete: () => visual.container.destroy(),
    });
  }

  private clearConstructionSiteVisuals(): void {
    this.constructionSiteVisuals.forEach((visual) => visual.container.destroy());
    this.constructionSiteVisuals.clear();
    this.constructionFxNextAt.clear();
  }

  private assignResidentToConstruction(task: ConstructionTaskData): void {
    if (gameState.data.isNight) return;
    if (this.constructionAssignedResidents.has(task.id)) return;
    const mode = gameState.data.autoBuild.crewMode === 'workshop_only' ? 'workshop_only' : 'workshop_idle';
    const candidates = Array.from(this.baseResidents.entries()).filter(([companionId, container]) => {
      if (!container.active || !container.visible) return false;
      if (container.getData('constructionBusy')) return false;
      const comp = gameState.data.companions.find((item) => item.id === companionId);
      if (!comp || comp.status !== 'base') return false;
      if (mode === 'workshop_only') return comp.job === 'workshop';
      return comp.job === 'workshop' || comp.job === 'idle';
    });
    if (candidates.length <= 0) return;
    candidates.sort((a, b) => {
      const ca = gameState.data.companions.find((item) => item.id === a[0]);
      const cb = gameState.data.companions.find((item) => item.id === b[0]);
      const sa = (ca?.job === 'workshop' ? 2 : ca?.job === 'idle' ? 1 : 0);
      const sb = (cb?.job === 'workshop' ? 2 : cb?.job === 'idle' ? 1 : 0);
      if (sa !== sb) return sb - sa;
      const da = ca ? (this.getCompanionAutoDuty(ca) === 'builder' ? 2 : this.getCompanionAutoDuty(ca) === 'defender' ? 1 : 0) : 0;
      const db = cb ? (this.getCompanionAutoDuty(cb) === 'builder' ? 2 : this.getCompanionAutoDuty(cb) === 'defender' ? 1 : 0) : 0;
      if (da !== db) return db - da;
      return Phaser.Math.Distance.Between(a[1].x, a[1].y, task.x, task.y)
        - Phaser.Math.Distance.Between(b[1].x, b[1].y, task.x, task.y);
    });
    const [companionId, container] = candidates[0];
    this.constructionAssignedResidents.set(task.id, companionId);
    container.setData('constructionBusy', true);
    container.setData('constructionTaskId', task.id);
    container.setData('residentMode', 'moving');
    this.setResidentConstructionDecor(container, true);
    const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
    if (label?.active) {
      const name = (container.getData('residentName') || '伙伴') as string;
      label.setText(`${name}·施工`);
    }
    this.tweens.killTweensOf(container);
    this.tweens.add({
      targets: container,
      x: task.x + Phaser.Math.Between(-16, 16),
      y: task.y + Phaser.Math.Between(-12, 12),
      duration: 780,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!container.active) return;
        container.setData('residentMode', 'inside');
      },
    });
  }

  private releaseResidentFromConstruction(taskId: string): void {
    const companionId = this.constructionAssignedResidents.get(taskId);
    if (!companionId) return;
    this.constructionAssignedResidents.delete(taskId);
    const container = this.baseResidents.get(companionId);
    if (!container || !container.active) return;
    container.setData('constructionBusy', false);
    container.setData('constructionTaskId', null);
    container.setData('residentMode', 'idle');
    this.setResidentConstructionDecor(container, false);
    const companion = gameState.data.companions.find((item) => item.id === companionId);
    if (companion && companion.status === 'base' && !gameState.data.isNight) {
      this.applyResidentBehavior(container, this.getResidentBehaviorForCompanion(companion, Phaser.Math.Between(0, 999), 'stroll'), false);
    }
  }

  private releaseAllConstructionResidents(): void {
    const taskIds = Array.from(this.constructionAssignedResidents.keys());
    taskIds.forEach((taskId) => this.releaseResidentFromConstruction(taskId));
  }

  private setResidentConstructionDecor(container: Phaser.GameObjects.Container, active: boolean): void {
    const oldIcon = container.getData('constructionIcon') as Phaser.GameObjects.Text | undefined;
    const oldTween = container.getData('constructionIconTween') as Phaser.Tweens.Tween | undefined;
    oldTween?.remove();
    if (!active) {
      oldIcon?.destroy();
      container.setData('constructionIcon', null);
      container.setData('constructionIconTween', null);
      return;
    }
    if (oldIcon?.active) {
      const tw = this.tweens.add({
        targets: oldIcon,
        y: -50,
        duration: 360,
        yoyo: true,
        repeat: -1,
      });
      container.setData('constructionIconTween', tw);
      return;
    }
    const icon = this.add.text(0, -50, '工', {
      fontSize: this.worldFs(11, 10),
      color: '#fbbf24',
      fontFamily: this.getUIFontFamily(),
      stroke: '#0f172a',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    container.add(icon);
    const tw = this.tweens.add({
      targets: icon,
      y: -46,
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
    container.setData('constructionIcon', icon);
    container.setData('constructionIconTween', tw);
  }

  private emitConstructionPulseFx(x: number, y: number, color: number): void {
    const spark = this.add.circle(
      x + Phaser.Math.Between(-8, 8),
      y + Phaser.Math.Between(-10, 8),
      Phaser.Math.Between(2, 4),
      color,
      0.88
    ).setDepth(121);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 1.5,
      y: spark.y - Phaser.Math.Between(8, 16),
      duration: Phaser.Math.Between(220, 360),
      onComplete: () => spark.destroy(),
    });
  }

  private getBuildingTextureKey(buildingId: string, category: string): string {
    const textureMap: Record<string, string> = {
      wall: 'wall',
      reinforced_wall: 'reinforced_wall',
      gate: 'gate',
      spike_trap: 'spike_trap',
      electric_fence: 'electric_fence',
      mine_field: 'mine_field',
      turret: 'turret',
      laser_turret: 'laser_turret',
      slow_turret: 'slow_turret',
      missile_turret: 'missile_turret',
      generator: 'generator',
      farm: 'farm',
      kitchen: 'kitchen',
      water_collector: 'water_collector',
      ammo_factory: 'ammo_factory',
      medical_station: 'medical_station',
      radar: 'radar',
      storage: 'storage',
      workbench: 'workbench',
      room_quarters: 'room_quarters',
      bunk_bed: 'bunk_bed',
      guard_post: 'guard_post',
      kitchen_station: 'kitchen_station',
      teleporter: 'teleporter',
      shield_generator: 'shield_generator',
      campfire: 'campfire',
      flag: 'flag',
    };
    const mapped = textureMap[buildingId];
    if (mapped && this.textures.exists(mapped)) return mapped;
    if (buildingId === 'sniper_nest' && this.textures.exists('laser_turret')) return 'laser_turret';
    if (buildingId === 'flame_turret' && this.textures.exists('missile_turret')) return 'missile_turret';
    if (category === 'turret' && this.textures.exists('turret')) return 'turret';
    return 'wall';
  }

  private pickBuildTextureWithVariant(baseTexture: string, buildingId: string, x: number, y: number): string {
    if (buildingId === 'wall') return this.pickVariantTexture('wall', x, y);
    if (buildingId === 'reinforced_wall') return this.pickVariantTexture('reinforced_wall', x, y);
    if (buildingId === 'gate') return this.pickVariantTexture('gate', x, y);
    return baseTexture;
  }

  private pickVariantTexture(baseTexture: string, x: number, y: number): string {
    const candidates = [baseTexture, `${baseTexture}_v2`, `${baseTexture}_v3`]
      .filter((key) => this.textures.exists(key));
    if (candidates.length === 0) return baseTexture;
    const gx = Math.floor(x / 64);
    const gy = Math.floor(y / 64);
    const hash = Math.abs((gx * 73856093) ^ (gy * 19349663));
    return candidates[hash % candidates.length];
  }

  private findPlacedBuildingAt(gridX: number, gridY: number): Phaser.Physics.Arcade.Sprite | null {
    const hitTest = (children: Phaser.GameObjects.GameObject[]): Phaser.Physics.Arcade.Sprite | null => {
      for (const obj of children) {
        const sprite = obj as Phaser.Physics.Arcade.Sprite;
        if (!sprite.active) continue;
        if (Math.abs(sprite.x - gridX) < 32 && Math.abs(sprite.y - gridY) < 32) return sprite;
      }
      return null;
    };
    return hitTest(this.turrets.getChildren()) || hitTest(this.walls.getChildren());
  }

  private findBuildingRecordIndexByPos(x: number, y: number): number {
    return gameState.data.buildings.findIndex((b) => Math.abs(b.x - x) < 2 && Math.abs(b.y - y) < 2);
  }

  private removeBuildingRecord(building: Phaser.Physics.Arcade.Sprite): void {
    const bx = Math.round(building.x);
    const by = Math.round(building.y);
    const idx = this.findBuildingRecordIndexByPos(bx, by);
    if (idx !== -1) {
      gameState.data.buildings.splice(idx, 1);
    }
  }

  private demolishNearbyBuilding(): void {
    const range = 100;
    let nearest: Phaser.Physics.Arcade.Sprite | null = null;
    let nearDist = range;

    [...this.walls.getChildren(), ...this.turrets.getChildren()].forEach(b => {
      const s = b as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < nearDist) { nearDist = d; nearest = s; }
    });

    if (nearest) {
      const found: Phaser.Physics.Arcade.Sprite = nearest;
      // Refund 50% resources
      const bDef = (found as any).buildingDef;
      if (bDef?.cost) {
        for (const [res, amt] of Object.entries(bDef.cost)) {
          gameState.addResource(res as any, Math.floor((amt as number) * 0.5));
        }
      }
      this.removeBuildingRecord(found);
      found.destroy();
      events.emit('update-resources', gameState.data.resources);
      BaseSystem.refreshBaseState();
    }
  }

  private enemyDamageBuilding(enemy: Phaser.Physics.Arcade.Sprite, building: Phaser.Physics.Arcade.Sprite): void {
    const ed = enemy as any;
    const bd = building as any;
    const now = this.time.now;
    if (!ed.lastBuildingAttack) ed.lastBuildingAttack = 0;
    if (now - ed.lastBuildingAttack < 700) return;
    ed.lastBuildingAttack = now;
    this.playEnemyAction(enemy, 'attack', true, 180);
    const structureDamageMul = ed.isBoss ? 1.85 : 1.15;
    bd.health = (bd.health || 100) - Math.max(1, Math.round((ed.damage || 10) * structureDamageMul));
    building.setAlpha(Math.max(0.3, bd.health / (bd.maxHealth || 100)));

    if (bd.health <= 0) {
      this.createDeathEffect(building.x, building.y);
      this.removeBuildingRecord(building);
      building.destroy();
      BaseSystem.refreshBaseState();
    }
  }

  // ============================================================
  // TURRETS
  // ============================================================
  private getTurretSupportSnapshot(
    turret: Phaser.Physics.Arcade.Sprite
  ): { stage: number; watchtowerCount: number; damageMul: number; fireRateMul: number; rangeMul: number } {
    const td = turret as any;
    const level = Math.max(1, Number(td.level || td.buildingTier || 1));
    const stage = level >= 20 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
    const watchtowerCount = gameState.data.buildings.filter((building) => (
      building.id === 'watchtower'
      && Phaser.Math.Distance.Between(turret.x, turret.y, building.x, building.y) <= 192
    )).length;
    return {
      stage,
      watchtowerCount,
      damageMul: 1 + stage * 0.14 + watchtowerCount * 0.08,
      fireRateMul: 1 + stage * 0.08 + watchtowerCount * 0.06,
      rangeMul: 1 + stage * 0.05 + watchtowerCount * 0.08,
    };
  }

  private spawnTurretProjectile(
    turret: Phaser.Physics.Arcade.Sprite,
    angle: number,
    textureKey: string,
    damage: number,
    color: number,
    options: {
      speed?: number;
      scale?: number;
      lifetime?: number;
      swayAmplitude?: number;
      swayFrequency?: number;
      effect?: 'pulse' | 'laser' | 'slow' | 'missile' | 'flame';
      homingTarget?: Phaser.Physics.Arcade.Sprite | null;
      pierceLeft?: number;
      explosionRadius?: number;
      slowRadius?: number;
      intensity?: number;
    } = {}
  ): Phaser.Physics.Arcade.Sprite | null {
    const bullet = this.turretBullets.create(turret.x, turret.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    if (!bullet) return null;
    const speed = options.speed ?? 360;
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    bullet.setTexture(textureKey);
    bullet.setScale(options.scale ?? 2);
    bullet.setTint(color);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setDepth(10);
    bullet.setVelocity(velocityX, velocityY);
    const bulletData = bullet as any;
    bulletData.damage = damage;
    bulletData.ownerType = 'turret';
    bulletData.ownerId = (turret as any).runtimeId || null;
    bulletData.bulletTextureKey = textureKey;
    bulletData.baseVelocityX = velocityX;
    bulletData.baseVelocityY = velocityY;
    bulletData.swayAmplitude = options.swayAmplitude ?? 0;
    bulletData.swayFrequency = options.swayFrequency ?? 0;
    bulletData.swayPhase = Math.random() * Math.PI * 2;
    bulletData.turretEffect = options.effect || 'pulse';
    bulletData.isHoming = !!options.homingTarget;
    bulletData.homingTarget = options.homingTarget || null;
    bulletData.pierceLeft = options.pierceLeft ?? 0;
    bulletData.explosionRadius = options.explosionRadius ?? 0;
    bulletData.slowRadius = options.slowRadius ?? 0;
    this.createBulletMuzzleVfx(
      turret.x,
      turret.y,
      angle,
      color,
      textureKey,
      options.intensity ?? 1
    );
    this.time.delayedCall(options.lifetime ?? 1500, () => {
      if (bullet.active) this.disableBullet(bullet);
    });
    return bullet;
  }

  private fireTurretPattern(
    turret: Phaser.Physics.Arcade.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
    damage: number,
    support: { stage: number; watchtowerCount: number; damageMul: number; fireRateMul: number; rangeMul: number }
  ): void {
    const td = turret as any;
    const baseAngle = Phaser.Math.Angle.Between(turret.x, turret.y, target.x, target.y);
    const color = td.levelColor || 0x22d3ee;
    const intensity = 1 + support.stage * 0.22 + support.watchtowerCount * 0.12;
    const spawn = (angleOffset: number, textureKey: string, options: Parameters<GameScene['spawnTurretProjectile']>[5]) => {
      this.spawnTurretProjectile(
        turret,
        baseAngle + angleOffset,
        textureKey,
        damage,
        color,
        { ...options, intensity }
      );
    };

    if (td.buildingId === 'laser_turret' || td.buildingId === 'sniper_nest') {
      spawn(0, 'bullet_pierce', {
        effect: 'laser',
        scale: td.buildingId === 'sniper_nest' ? 2.8 : 2.3,
        speed: td.buildingId === 'sniper_nest' ? 780 : 620,
        lifetime: td.buildingId === 'sniper_nest' ? 920 : 760,
        pierceLeft: td.buildingId === 'sniper_nest' ? 4 + support.stage : 2 + support.stage,
      });
      if (support.stage >= 1) {
        spawn(0.08, 'bullet_pierce', {
          effect: 'laser',
          scale: 2.1,
          speed: td.buildingId === 'sniper_nest' ? 720 : 560,
          lifetime: 700,
          pierceLeft: 1 + support.stage,
        });
      }
      if (support.stage >= 3) {
        spawn(-0.08, 'bullet_pierce', {
          effect: 'laser',
          scale: 2.1,
          speed: td.buildingId === 'sniper_nest' ? 720 : 560,
          lifetime: 700,
          pierceLeft: 1 + support.stage,
        });
      }
      return;
    }

    if (td.buildingId === 'slow_turret') {
      spawn(0, 'bullet_frost', {
        effect: 'slow',
        scale: 2.5,
        speed: 280,
        lifetime: 1200,
        slowRadius: 86 + support.stage * 18 + support.watchtowerCount * 10,
      });
      if (support.stage >= 2) {
        spawn(0.22, 'bullet_frost', {
          effect: 'slow',
          scale: 2.1,
          speed: 260,
          lifetime: 1050,
          slowRadius: 66 + support.stage * 14,
        });
        spawn(-0.22, 'bullet_frost', {
          effect: 'slow',
          scale: 2.1,
          speed: 260,
          lifetime: 1050,
          slowRadius: 66 + support.stage * 14,
        });
      }
      return;
    }

    if (td.buildingId === 'missile_turret') {
      spawn(0, 'bullet_cannon', {
        effect: 'missile',
        scale: 2.9,
        speed: 250,
        lifetime: 1800,
        homingTarget: target,
        explosionRadius: 82 + support.stage * 18 + support.watchtowerCount * 12,
      });
      if (support.stage >= 3) {
        spawn(0.14, 'bullet_cannon', {
          effect: 'missile',
          scale: 2.4,
          speed: 235,
          lifetime: 1600,
          homingTarget: target,
          explosionRadius: 64 + support.stage * 14,
        });
      }
      return;
    }

    if (td.buildingId === 'flame_turret') {
      const spread = [0, 0.18, -0.18];
      if (support.stage >= 2) spread.push(0.34, -0.34);
      if (support.stage >= 3) spread.push(0.5, -0.5);
      spread.forEach((offset, idx) => {
        spawn(offset, 'bullet_flame', {
          effect: 'flame',
          scale: idx === 0 ? 2.5 : 2.1,
          speed: 220 + support.stage * 18,
          lifetime: 620,
          swayAmplitude: 16 + support.stage * 3,
          swayFrequency: 0.018,
        });
      });
      return;
    }

    const burstCount = 1 + (support.stage >= 1 ? 1 : 0) + (support.stage >= 3 ? 1 : 0);
    for (let i = 0; i < burstCount; i += 1) {
      const offset = burstCount === 1 ? 0 : (i - (burstCount - 1) / 2) * 0.12;
      spawn(offset, 'bullet_pulse', {
        effect: 'pulse',
        scale: 2 + support.stage * 0.22,
        speed: 350 + support.stage * 24,
        lifetime: 1500,
        swayAmplitude: 14 + support.stage * 4 + support.watchtowerCount * 2,
        swayFrequency: 0.012,
      });
    }
    if (support.watchtowerCount > 0 && !this.lowPerfMode) {
      const ring = this.add.circle(turret.x, turret.y, 10, color, 0).setDepth(11);
      ring.setStrokeStyle(2, color, 0.4);
      this.tweens.add({
        targets: ring,
        scale: 2.4,
        alpha: 0,
        duration: 260,
        onComplete: () => ring.destroy(),
      });
    }
  }

  private updateTurrets(): void {
    const now = this.time.now;
    const base = gameState.data.base;
    const overload = base.powerUsed > base.powerCapacity;
    const structureMul = Phaser.Math.Clamp(base.structureIntegrity || 1, 0.55, 1);
    const breachOpen = !!base.structureBreachOpen;
    let remainingPower = base.powerCapacity;
    const turrets = this.turrets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    turrets.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    if (overload && now - this.lastPowerWarning > 6000) {
      this.lastPowerWarning = now;
      this.showFloatingText(this.cameras.main.width / 2, 160, '⚡ 电力超载，部分炮塔停机', '#ef4444', true);
    }
    if (breachOpen && now - this.lastStructureWarning > 6500) {
      this.lastStructureWarning = now;
      this.showFloatingText(this.cameras.main.width / 2, 186, '⚠ 防线破口，炮塔效率下降', '#fb7185', true);
    }

    turrets.forEach(t => {
      const turret = t as Phaser.Physics.Arcade.Sprite;
      const td = turret as any;
      if (!turret.active) return;
      const healthAlpha = Phaser.Math.Clamp((td.health || 100) / (td.maxHealth || 100), 0.35, 1);

      if (overload) {
        const def = td.buildingDef;
        const need = def?.powerUse ?? BASE_POWER_PER_TURRET;
        if (remainingPower < need) {
          turret.setAlpha(Math.max(0.25, healthAlpha * 0.45));
          return;
        }
        remainingPower -= need;
        turret.setAlpha(healthAlpha);
      } else {
        turret.setAlpha(healthAlpha);
      }

      const support = this.getTurretSupportSnapshot(turret);
      const fireRate = td.fireRate || 700;
      const effectiveFireRate = Math.max(
        110,
        Math.round((fireRate / support.fireRateMul) * (1 + (1 - structureMul) * 0.42))
      );
      const range = Math.round((td.range || 220) * support.rangeMul);
      if (now - (td.lastFireTime || 0) < effectiveFireRate) return;

      let nearest: Phaser.Physics.Arcade.Sprite | null = null;
      let nearDist = range;
      this.enemies.getChildren().forEach(e => {
        const enemy = e as Phaser.Physics.Arcade.Sprite;
        const d = Phaser.Math.Distance.Between(turret.x, turret.y, enemy.x, enemy.y);
        if (d < nearDist) { nearDist = d; nearest = enemy; }
      });

      if (nearest) {
        td.lastFireTime = now;
        const target: Phaser.Physics.Arcade.Sprite = nearest;
        const damage = Math.max(1, Math.round((td.damage || 15) * structureMul * support.damageMul));
        this.fireTurretPattern(turret, target, damage, support);
      }
    });
  }

  private turretBulletHitEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active) return;
    const bulletData = bullet as any;
    const damage = bulletData.damage || 15;
    const effect = bulletData.turretEffect || 'pulse';
    const source: DamageSource = { type: 'turret', turretId: bulletData.ownerId || null };
    const impactArchetype = effect === 'missile'
      ? 'cannon'
      : effect === 'laser'
        ? 'pierce'
        : effect === 'slow'
          ? 'frost'
          : effect === 'flame'
            ? 'flame'
            : 'pulse';
    this.createBulletImpactVfx(
      enemy.x,
      enemy.y,
      impactArchetype,
      bullet.tintTopLeft || 0x22d3ee,
      bulletData.bulletTextureKey || bullet.texture?.key
    );

    if (effect === 'slow') {
      const radius = bulletData.slowRadius || 88;
      this.enemies.getChildren().forEach((entry) => {
        const target = entry as Phaser.Physics.Arcade.Sprite;
        if (!target.active) return;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y) > radius) return;
        this.applySlowEffect(target);
        this.damageEnemy(target, Math.max(1, Math.round(damage * 0.52)), source);
      });
      this.disableBullet(bullet);
      return;
    }

    if (effect === 'flame') {
      this.applyBurnEffect(enemy);
      this.damageEnemy(enemy, damage, source);
      this.disableBullet(bullet);
      return;
    }

    if (effect === 'missile') {
      this.createExplosion(enemy.x, enemy.y, bulletData.explosionRadius || 84, damage * 0.62, source);
      this.disableBullet(bullet);
      return;
    }

    if (effect === 'laser') {
      bulletData.pierceLeft = Math.max(0, Number(bulletData.pierceLeft || 0));
      this.damageEnemy(enemy, damage, source);
      bulletData.pierceLeft -= 1;
      if (bulletData.pierceLeft <= 0) {
        this.disableBullet(bullet);
      }
      return;
    }

    this.disableBullet(bullet);
    this.damageEnemy(enemy, damage, source);
  }

  // ============================================================
  // INTERACTION
  // ============================================================
  private updateInteractionHints(): void {
    this.pendingInteractable = null;
    this.pendingFacility = null;
    this.pendingExplorationSpot = null;
    this.pendingResidentAssist = null;

    if (this.currentFacility && !this.facilityTransitioning) {
      this.interactionHint.setText(`[E] 离开设施 · ${this.currentFacility.name}`);
      this.interactionHint.setVisible(true);
      return;
    }

    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const npc of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (d < 80 && d < nearestDistance) {
        this.pendingInteractable = npc;
        nearestDistance = d;
      }
    }

    for (const facility of this.facilityInteractables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, facility.enterX, facility.enterY);
      if (d < facility.radius && d < nearestDistance) {
        this.pendingFacility = facility;
        this.pendingInteractable = null;
        this.pendingExplorationSpot = null;
        this.pendingResidentAssist = null;
        nearestDistance = d;
      }
    }

    for (const spot of this.explorationSpots) {
      if (!spot.marker.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y);
      if (d < spot.radius && d < nearestDistance) {
        this.pendingExplorationSpot = spot;
        this.pendingFacility = null;
        this.pendingInteractable = null;
        this.pendingResidentAssist = null;
        nearestDistance = d;
      }
    }

    if (this.residentAssistTask) {
      const resident = this.baseResidents.get(this.residentAssistTask.companionId);
      if (resident?.active && resident.visible) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, resident.x, resident.y);
        if (d < 86 && d < nearestDistance) {
          this.pendingResidentAssist = this.residentAssistTask;
          this.pendingFacility = null;
          this.pendingExplorationSpot = null;
          this.pendingInteractable = null;
          nearestDistance = d;
        }
      }
    }

    if (this.pendingFacility) {
      this.interactionHint.setText(`[E] 进入设施 · ${this.pendingFacility.name}`);
      this.interactionHint.setVisible(true);
      return;
    }

    if (this.pendingExplorationSpot) {
      this.interactionHint.setText(this.getExplorationHintText(this.pendingExplorationSpot));
      this.interactionHint.setVisible(true);
      return;
    }

    if (this.pendingResidentAssist) {
      const resident = this.baseResidents.get(this.pendingResidentAssist.companionId);
      const name = (resident?.getData('residentName') || '伙伴') as string;
      this.interactionHint.setText(`[E] 协助${name} · ${this.pendingResidentAssist.assistLabel}`);
      this.interactionHint.setVisible(true);
      return;
    }

    if (this.pendingInteractable) {
      const action = this.pendingInteractable.type === 'merchant'
        ? '交易'
        : this.pendingInteractable.type === 'commander'
          ? (this.getDayOpsContractsByStage('handoff').length > 0
            ? '交付委托'
            : this.getDayOpsContractsByStage('prep').length > 0
              ? '委托前置'
              : '接任务')
          : '逛商店';
      this.interactionHint.setText(`[E] ${action} · ${this.pendingInteractable.name}`);
      this.interactionHint.setVisible(true);
    } else {
      this.interactionHint.setVisible(false);
    }
  }

  private onMobileMove(payload: { x?: number; y?: number } | null): void {
    const x = Number(payload?.x ?? 0);
    const y = Number(payload?.y ?? 0);
    if (this.caveRaidMiniGameActive) {
      this.caveRaidMobileMoveX = Phaser.Math.Clamp(Number.isFinite(x) ? x : 0, -1, 1);
      this.caveRaidMobileMoveY = Phaser.Math.Clamp(Number.isFinite(y) ? y : 0, -1, 1);
      if (this.caveRaidMobileMoveY <= -0.72) {
        this.requestCaveRaidJump();
      }
      return;
    }
    if (this.forestHuntMiniGameActive) {
      this.forestHuntMobileMoveX = Phaser.Math.Clamp(Number.isFinite(x) ? x : 0, -1, 1);
      return;
    }
    if (this.cityScavengeMiniGameActive) {
      this.cityScavengeMoveX = Phaser.Math.Clamp(Number.isFinite(x) ? x : 0, -1, 1);
      this.cityScavengeMoveY = Phaser.Math.Clamp(Number.isFinite(y) ? y : 0, -1, 1);
      return;
    }
    this.playerSystem?.setVirtualDirection(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0);
  }

  private onMobileInteract(): void {
    if (this.dayChallengeSelectionOpen || this.nightDirectiveSelectionOpen) return;
    if (this.daySpotMiniGameOpen) {
      if (this.caveRaidMiniGameActive) {
        this.tryCaveRaidAttack();
        return;
      }
      if (this.forestHuntMiniGameActive) {
        this.triggerForestHuntAction();
        return;
      }
      if (this.cityScavengeMiniGameActive) {
        this.triggerCityScavengeAction();
        return;
      }
      this.resolveDayExplorationMiniGame();
      return;
    }
    if (this.isGameOver || this.runEventOpen) return;
    if (this.currentFacility) {
      this.exitFacility();
      return;
    }
    if (this.time.now < this.interactionDebounceUntil) return;
    this.interactionDebounceUntil = this.time.now + 130;
    this.handleInteraction();
  }

  private onMobileToggleBuild(): void {
    if (this.dayChallengeSelectionOpen || this.runEventOpen || this.daySpotMiniGameOpen) return;
    if (this.currentFacility) return;
    if (this.isBuildMode) {
      this.exitBuildMode();
      return;
    }
    this.toggleBuildMode();
  }

  private handleInteraction(): void {
    if (this.facilityTransitioning) {
      // Hard recover first so a second E press never gets trapped in transition state.
      this.recoverFacilityTransitionState();
    }

    if (this.currentFacility) {
      this.exitFacility();
      return;
    }

    if (this.pendingResidentAssist && this.residentAssistTask === this.pendingResidentAssist) {
      this.completeResidentAssistTask();
      return;
    }

    if (this.pendingFacility) {
      this.enterFacility(this.pendingFacility);
      return;
    }

    if (this.pendingExplorationSpot) {
      this.handleExplorationSpotInteraction(this.pendingExplorationSpot);
      return;
    }

    if (!this.pendingInteractable) return;
    const now = this.time.now;
    const npc = this.pendingInteractable;
    if (now - npc.lastInteract < npc.cooldown) return;
    npc.lastInteract = now;

    if (npc.type === 'merchant') this.showMerchantUI();
    else if (npc.type === 'commander') this.showCommanderUI();
    else if (npc.type === 'weaponsmith') this.showWeaponsmithUI();
  }

  private enterFacility(facility: FacilityInteractable): void {
    // Use deterministic instant enter to avoid rare tween-lock edge cases.
    if (this.isBuildMode) this.exitBuildMode();
    if (this.isCraftingPanelOpen) events.emit('toggle-crafting');
    this.currentFacility = facility;
    this.facilityLockPosition = new Phaser.Math.Vector2(facility.enterX, facility.enterY);
    this.facilityTransitioning = false;
    this.facilityTransitionStartedAt = 0;
    this.clearFacilityTransitionFallback();
    this.playerSystem.setMovementEnabled(false);
    this.placePlayerAtSafeSpot(facility.enterX, facility.enterY);
    this.player.setAlpha(1);
    this.lockPlayerBodyInFacility();
    this.enforceFacilityLock();
    this.applyFacilityInteractionReward(facility);
  }

  private exitFacility(): void {
    if (!this.currentFacility) return;
    const facility = this.currentFacility;
    this.currentFacility = null;
    this.facilityLockPosition = null;
    this.facilityTransitioning = false;
    this.facilityTransitionStartedAt = 0;
    this.clearFacilityTransitionFallback();
    this.unlockPlayerBodyFromFacility();
    this.playerSystem.setMovementEnabled(true);
    this.placePlayerAtSafeSpot(facility.exitX, facility.exitY);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    this.showFloatingText(this.player.x, this.player.y - 24, `离开 ${facility.name}`, '#cbd5e1', false);
  }

  private lockPlayerBodyInFacility(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    body.stop();
    body.moves = false;
    body.setImmovable(true);
    body.setAllowGravity(false);
    this.playerSystem.setMovementEnabled(false);
  }

  private unlockPlayerBodyFromFacility(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    body.setImmovable(false);
    body.moves = true;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
  }

  private placePlayerAtSafeSpot(x: number, y: number): void {
    const offsets = [
      [0, 0], [24, 0], [-24, 0], [0, 24], [0, -24],
      [36, 0], [-36, 0], [0, 36], [0, -36], [28, 20], [-28, 20], [28, -20], [-28, -20],
    ];
    for (const [dx, dy] of offsets) {
      const tx = x + dx;
      const ty = y + dy;
      if (!this.isPositionBlockedForPlayer(tx, ty)) {
        this.player.setPosition(tx, ty);
        return;
      }
    }
    this.player.setPosition(x, y);
  }

  private isPositionBlockedForPlayer(x: number, y: number): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    const w = Math.max(14, body?.width || 14);
    const h = Math.max(18, body?.height || 18);
    const probe = new Phaser.Geom.Rectangle(x - w * 0.5, y - h * 0.5, w, h);
    const blockedBy = (group: Phaser.Physics.Arcade.Group): boolean => {
      return group.getChildren().some((obj) => {
        const sprite = obj as Phaser.Physics.Arcade.Sprite;
        if (!sprite.active) return false;
        const b = sprite.getBounds();
        return Phaser.Geom.Intersects.RectangleToRectangle(probe, b);
      });
    };
    return blockedBy(this.walls) || blockedBy(this.turrets);
  }

  private clearFacilityTransitionFallback(): void {
    this.facilityTransitionFallback?.remove(false);
    this.facilityTransitionFallback = null;
  }

  private recoverFacilityTransitionState(): void {
    this.facilityTransitioning = false;
    this.facilityTransitionStartedAt = 0;
    this.clearFacilityTransitionFallback();
    this.player.setAlpha(1);
    this.playerSystem.setMovementEnabled(!this.currentFacility);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    if (this.currentFacility) {
      if (!this.facilityLockPosition) {
        this.facilityLockPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
      }
      this.lockPlayerBodyInFacility();
      this.enforceFacilityLock();
    } else {
      this.unlockPlayerBodyFromFacility();
      this.facilityLockPosition = null;
    }
  }

  private enforceFacilityLock(): void {
    if (!this.currentFacility) return;
    if (!this.facilityLockPosition) {
      this.facilityLockPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.stop();
      body.moves = false;
      body.setImmovable(true);
      body.setAllowGravity(false);
    }
    this.player.setPosition(this.facilityLockPosition.x, this.facilityLockPosition.y);
    this.playerSystem.setMovementEnabled(false);
  }

  private applyFacilityInteractionReward(facility: FacilityInteractable): void {
    if (gameState.data.isNight) {
      this.showFloatingText(this.player.x, this.player.y - 26, `${facility.name} 夜间仅提供基础功能`, '#fbbf24', false);
      return;
    }

    if (facility.id === 'kitchen') {
      gameState.addResource('food', 2);
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(this.player.x, this.player.y - 26, '炊事台：食物 +2', '#fb923c', false);
      return;
    }
    if (facility.id === 'workbench') {
      gameState.addResource('scrap', 2);
      let repaired = false;
      if (this.scavengeDurabilityStacks > 0) {
        this.scavengeDurabilityStacks = Math.max(0, this.scavengeDurabilityStacks - 1);
        repaired = true;
        if (this.scavengeDurabilityStacks <= 0) {
          this.scavengeDurabilityStacks = 0;
          this.scavengeDurabilityPenaltyUntil = 0;
          this.scavengeDurabilityPenaltyStartAt = 0;
          this.scavengeDurabilityPenaltyDurationMs = 0;
        } else {
          const remain = Math.max(8000, this.scavengeDurabilityPenaltyUntil - this.time.now - 5000);
          this.scavengeDurabilityPenaltyUntil = this.time.now + remain;
          this.scavengeDurabilityPenaltyStartAt = this.time.now;
          this.scavengeDurabilityPenaltyDurationMs = remain;
        }
      }
      events.emit('update-resources', gameState.data.resources);
      if (repaired) {
        const reductionPercent = Math.round((1 - this.getScavengeDurabilityDamageMultiplier()) * 100);
        this.showFloatingText(
          this.player.x,
          this.player.y - 26,
          `工作台：零件 +2 · 修复耐久(剩余伤害-${reductionPercent}%)`,
          '#60a5fa',
          false
        );
      } else {
        this.showFloatingText(this.player.x, this.player.y - 26, '工作台：零件 +2', '#60a5fa', false);
      }
      return;
    }
    if (facility.id === 'guard_post') {
      this.player.setData('guardedUntil', this.time.now + 18000);
      this.showFloatingText(this.player.x, this.player.y - 26, '哨岗：短时防御强化', '#93c5fd', false);
      return;
    }
    if (facility.id === 'quarters') {
      events.emit(GameEvents.PLAYER_HEAL_REQUEST, { amount: 10 });
      this.showFloatingText(this.player.x, this.player.y - 26, '宿舍：恢复 10 点生命', '#a78bfa', false);
    }
  }

  private showMerchantUI(): void {
    events.emit('toggle-exchange');
    const quote = this.getMerchantFactionQuoteProfile();
    this.showFloatingText(this.player.x, this.player.y - 58, '打开数据交易所', '#fbbf24', false);
    this.showFloatingText(
      this.player.x,
      this.player.y - 36,
      `报价x${quote.rateMul.toFixed(2)} · 镜价x${quote.glassesMul.toFixed(2)}`,
      '#67e8f9',
      false
    );
  }

  private showCommanderUI(): void {
    const handoffCount = this.handoffReadyDayOpsContracts();
    const prep = this.prepareDayOpsFromCommander();
    if (handoffCount > 0) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 66,
        `任务交付 ${handoffCount} 项完成`,
        '#22d3ee',
        false
      );
    }
    if (prep.prepared > 0) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 52,
        `已下发执行 ${prep.prepared} 项`,
        '#38bdf8',
        false
      );
    }
    let msg = '';
    if (QuestSystem.getActiveQuestCount() < QuestSystem.getMaxActiveQuests()) {
      const issued = QuestSystem.acceptRandomQuestFromGiver('awakened_leader');
      if (issued.ok) msg = issued.message;
    }
    events.emit('open-quests');
    this.showFloatingText(this.player.x, this.player.y - 44, msg || '打开任务列表', '#38bdf8', false);
  }

  private showWeaponsmithUI(): void {
    events.emit('open-glasses-shop');
    this.showFloatingText(this.player.x, this.player.y - 44, '欢迎来到宝岛眼镜店', '#38bdf8', false);
  }

  // ============================================================
  // COMPANIONS & SURVIVORS
  // ============================================================
  private spawnSurvivor(): void {
    const x = Phaser.Math.Between(100, 1900);
    const y = Phaser.Math.Between(100, 1400);
    // Don't spawn inside base
    if (x > 780 && x < 1220 && y > 530 && y < 970) return;

    const survivorKeys = ['companion', 'companion_tank', 'companion_sniper', 'companion_medic', 'companion_engineer', 'companion_raider', 'companion_support']
      .filter((key) => this.textures.exists(key));
    const survivor = this.survivors.create(
      x,
      y,
      survivorKeys.length > 0 ? Phaser.Utils.Array.GetRandom(survivorKeys) : 'companion'
    ) as Phaser.Physics.Arcade.Sprite;
    if (!survivor) return;
    survivor.setScale(2.2);
    survivor.setTintFill(0x89cfff);
    survivor.setDepth(5);
    this.tweens.add({ targets: survivor, alpha: { from: 0.5, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    const helpText = this.add.text(x, y - 25, '💬 救救我！', {
      fontSize: this.worldFs(13, 12),
      color: '#fbbf24',
      fontFamily: this.getUIFontFamily(),
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);

    (survivor as any).helpText = helpText;
    this.time.delayedCall(30000, () => {
      if (survivor.active) { survivor.destroy(); helpText.destroy(); }
    });
  }

  private rescueSurvivor(survivor: Phaser.Physics.Arcade.Sprite): void {
    const helpText = (survivor as any).helpText;
    if (helpText) helpText.destroy();
    survivor.destroy();

    const populationUsed = BaseSystem.getPopulationUsage();
    const populationCap = BaseSystem.getPopulationCapacity();
    if (!BaseSystem.canRecruitCompanion(1)) {
      gameState.addResource('food', 1);
      gameState.addResource('water', 1);
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(
        this.cameras.main.width / 2,
        200,
        `人口已满 ${populationUsed}/${populationCap} · 先建宿舍或床位`,
        '#ef4444',
        true
      );
      this.showFloatingText(
        this.cameras.main.width / 2,
        226,
        '幸存者留下少量补给后离开',
        '#fbbf24',
        true
      );
      return;
    }

    const config = this.companionSystem.addCompanion(this.player.x + Phaser.Math.Between(-50, 50), this.player.y + Phaser.Math.Between(-50, 50));
    gameState.data.stats.companionsRecruited++;
    gameState.data.companions.push({
      id: config.id,
      name: config.name,
      role: config.role || 'tank',
      level: config.level,
      bulletEffect: config.bulletEffect.type,
      textureKey: config.textureKey,
      status: 'party',
      job: 'idle',
      advancedClass: config.advancedClass,
      promotionTier: config.promotionTier || (config.advancedClass ? 1 : 0),
    });
    const addedCompanion = gameState.data.companions[gameState.data.companions.length - 1];
    if (addedCompanion) CompanionPersonalitySystem.ensureProfile(addedCompanion);
    BaseSystem.refreshBaseState();
    events.emit('update-resources', gameState.data.resources);

    this.showFloatingText(this.cameras.main.width / 2, 200, `队友加入: ${config.name}`, '#4ade80', true);
    QuestSystem.updateProgress('protect', undefined, 1);
  }

  private syncCompanionRoster(): void {
    const configs: CompanionConfig[] = this.companionSystem.getConfigs();
    const sig = configs.map(c => `${c.id}:${c.level}:${c.advancedClass || '-'}`).join('|');
    if (sig === this.lastCompanionRosterSignature) return;
    this.lastCompanionRosterSignature = sig;
    // Ensure GameState companion list includes all active companions
    let dirty = false;
    configs.forEach(c => {
      const existing = gameState.data.companions.find(item => item.id === c.id);
      if (!existing) {
        gameState.data.companions.push({
          id: c.id,
          name: c.name,
          role: c.role || 'tank',
          level: c.level || 1,
          bulletEffect: c.bulletEffect?.type || 'normal',
          textureKey: c.textureKey,
          status: 'party',
          job: 'idle',
          advancedClass: c.advancedClass,
          promotionTier: c.promotionTier || (c.advancedClass ? 1 : 0),
        });
        const addedCompanion = gameState.data.companions[gameState.data.companions.length - 1];
        if (addedCompanion) CompanionPersonalitySystem.ensureProfile(addedCompanion);
        dirty = true;
      } else {
        CompanionPersonalitySystem.ensureProfile(existing);
        const nextLevel = c.level || 1;
        if ((existing.level || 1) !== nextLevel) {
          existing.level = nextLevel;
          dirty = true;
        }
        if ((existing.name || '') !== (c.name || '')) {
          existing.name = c.name;
          dirty = true;
        }
        if ((existing.textureKey || '') !== (c.textureKey || '')) {
          existing.textureKey = c.textureKey;
          dirty = true;
        }
        const nextClass = c.advancedClass || undefined;
        if ((existing.advancedClass || undefined) !== nextClass) {
          existing.advancedClass = nextClass;
          existing.promotionTier = nextClass ? 1 : 0;
          dirty = true;
        }
      }
    });
    if (dirty) {
      BaseSystem.refreshBaseState();
    }
    events.emit(GameEvents.COMPANION_ROSTER_UPDATED, { configs });
  }

  private syncCompanionPresence(): void {
    const partyIds = new Set(gameState.data.companions.filter(c => c.status !== 'base').map(c => c.id));
    const activeConfigs = this.companionSystem.getConfigs();

    // Deactivate companions that moved to base
    activeConfigs.forEach(cfg => {
      if (!partyIds.has(cfg.id)) {
        this.companionSystem.setCompanionActive(cfg.id, false);
      }
    });

    // Activate companions that should be in party
    gameState.data.companions.forEach(c => {
      if (c.status !== 'party') return;
      if (this.companionSystem.hasCompanion(c.id)) {
        this.companionSystem.setCompanionActive(c.id, true, this.player.x + Phaser.Math.Between(-40, 40), this.player.y + Phaser.Math.Between(-40, 40));
      } else {
        const config = this.companionSystem.buildConfigFromData(c);
        this.companionSystem.addCompanion(this.player.x + Phaser.Math.Between(-40, 40), this.player.y + Phaser.Math.Between(-40, 40), config);
      }
    });
  }

  private syncBaseResidents(): void {
    const baseCompanions = gameState.data.companions.filter(c => c.status === 'base');

    // Full rebuild keeps visual behavior consistent when job/status changes.
    this.baseResidents.forEach(container => {
      this.clearResidentRuntime(container);
      container.destroy();
    });
    this.baseResidents.clear();
    this.baseResidentAssignments.clear();
    this.facilityOccupants.clear();
    this.residentDayYieldNextAt.clear();
    this.residentDefenseNextFireAt.clear();
    this.residentNightAnchorIndex.clear();

    const behaviorBuckets = this.getResidentBehaviorAnchors();
    const usage: Record<'fishing' | 'cooking' | 'guard' | 'sleep' | 'forage' | 'adventure' | 'stroll', number> = {
      fishing: 0,
      cooking: 0,
      guard: 0,
      sleep: 0,
      forage: 0,
      adventure: 0,
      stroll: 0,
    };

    baseCompanions.forEach((comp, index) => {
      CompanionPersonalitySystem.ensureProfile(comp);
      const behavior = this.getResidentBehaviorForCompanion(comp, index, undefined);
      const points = behaviorBuckets[behavior];
      const point = points[usage[behavior] % points.length];
      usage[behavior] += 1;
      this.baseResidentAssignments.set(comp.id, index);

      const container = this.add.container(point.x, point.y).setDepth(-1);
      container.setData('companionId', comp.id);
      container.setData('preferredBehavior', behavior);
      container.setData('residentName', comp.name.split('(')[0]);
      container.setData('residentMode', 'idle' as ResidentMode);
      const roleColor = this.getCompanionRoleColor(comp.role);
      const aura = this.add.circle(0, 12, 20, roleColor, 0.18);
      const ring = this.add.circle(0, 12, 21, 0x000000, 0).setStrokeStyle(1, roleColor, 0.88);
      container.add(aura);
      container.add(ring);
      const roleTexture = this.getCompanionRoleTexture(comp.role, comp.id);
      const sprite = this.add.sprite(0, 0, roleTexture);
      const texScale = this.getResidentVisualScale();
      sprite.setScale(texScale);
      container.add(sprite);
      container.setData('spriteObj', sprite);

      const name = comp.name.split('(')[0];
      const roleTag = comp.role === 'tank' ? '坦' : comp.role === 'sniper' ? '狙' : comp.role === 'medic' ? '医' : '伴';
      const label = this.add.text(0, -40, `${name}[${roleTag}]·${behaviorName[behavior]}`, {
        fontSize: this.worldFs(11, 10),
        color: '#e2e8f0',
        fontFamily: this.getUIFontFamily(),
        stroke: '#0b1220',
        strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(label);
      container.setData('labelObj', label);

      this.applyResidentBehavior(container, behavior, true);
      this.villageLayer.add(container);
      this.baseResidents.set(comp.id, container);
    });

    this.scheduleBaseResidentRoutine();
  }

  private getResidentBehaviorAnchors(): Record<ResidentBehavior, Array<{ x: number; y: number }>> {
    return {
      fishing: [
        { x: 860, y: 910 },
        { x: 900, y: 930 },
        { x: 1120, y: 930 },
      ],
      cooking: [
        { x: 926, y: 746 },
        { x: 950, y: 748 },
        { x: 980, y: 744 },
      ],
      guard: [
        { x: 1000, y: 560 },
        { x: 860, y: 760 },
        { x: 1140, y: 760 },
        { x: 1000, y: 940 },
      ],
      sleep: [
        { x: 1040, y: 808 },
        { x: 1090, y: 816 },
        { x: 1060, y: 854 },
      ],
      forage: [
        { x: 820, y: 840 },
        { x: 1180, y: 860 },
        { x: 790, y: 700 },
      ],
      adventure: [
        { x: 760, y: 600 },
        { x: 1240, y: 600 },
        { x: 1000, y: 1000 },
      ],
      stroll: [
        { x: 960, y: 820 },
        { x: 1000, y: 820 },
        { x: 1040, y: 820 },
        { x: 1000, y: 900 },
      ],
    };
  }

  private getResidentBehavior(job: string, idx: number, current: ResidentBehavior | undefined): ResidentBehavior {
    const pool: ResidentBehavior[] = ['stroll', 'forage', 'guard', 'sleep', 'adventure', 'fishing', 'cooking'];
    if (job === 'kitchen') pool.unshift('cooking', 'cooking');
    if (job === 'farm') pool.unshift('fishing', 'forage');
    if (job === 'power' || job === 'workshop') pool.unshift('guard', 'adventure');
    if (job === 'medical') pool.unshift('sleep', 'stroll');
    if (current) pool.push(current);
    return pool[(idx + Phaser.Math.Between(0, pool.length - 1)) % pool.length];
  }

  private getResidentBehaviorForCompanion(
    companion: CompanionData,
    idx: number,
    current: ResidentBehavior | undefined
  ): ResidentBehavior {
    const duty = this.getCompanionAutoDuty(companion);
    const pool: ResidentBehavior[] = [this.getResidentBehavior(companion.job, idx, current)];
    if (duty === 'builder') {
      pool.unshift('adventure', 'guard');
    } else if (duty === 'scavenger') {
      pool.unshift('forage', 'fishing', 'adventure');
    } else if (duty === 'defender') {
      pool.unshift('guard', 'guard', 'adventure');
    } else {
      pool.unshift('stroll', 'cooking', 'sleep');
    }
    if (current) pool.push(current);
    return pool[(idx + Phaser.Math.Between(0, pool.length - 1)) % pool.length];
  }

  private getFacilityForBehavior(behavior: ResidentBehavior): FacilityInteractable | null {
    let id: FacilityInteractable['id'] | null = null;
    if (behavior === 'cooking') id = 'kitchen';
    else if (behavior === 'sleep') id = 'quarters';
    else if (behavior === 'guard') id = 'guard_post';
    else if (behavior === 'adventure') id = 'workbench';
    if (!id) return null;
    return this.facilityInteractables.find(f => f.id === id) || null;
  }

  private getExplorationSpotsForBehavior(behavior: ResidentBehavior): ExplorationSpot[] {
    const wanted: ExplorationActionType[] = [];
    if (behavior === 'fishing') wanted.push('fish', 'swim');
    if (behavior === 'forage') wanted.push('hunt');
    if (behavior === 'adventure') wanted.push('cave_explore', 'scavenge');
    if (behavior === 'stroll') wanted.push('scavenge');
    if (wanted.length <= 0) return [];
    return this.explorationSpots.filter((spot) => wanted.includes(spot.actionType));
  }

  private startResidentExplorationRoutine(
    container: Phaser.GameObjects.Container,
    behavior: ResidentBehavior,
    spot: ExplorationSpot
  ): void {
    if (!container.active) return;
    if (gameState.data.isNight) {
      this.applyResidentBehavior(container, 'guard', false);
      return;
    }

    this.clearResidentRuntime(container);
    container.setData('residentMode', 'moving' as ResidentMode);
    container.setData('behavior', behavior);
    container.setData('residentExplorationSpotId', spot.id);
    container.setData('residentExplorationAction', spot.actionType);

    const name = (container.getData('residentName') || '伙伴') as string;
    const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
    if (label?.active) {
      label.setText(`${name}·前往${spot.name}`);
    }

    const tx = spot.x + Phaser.Math.Between(-10, 10);
    const ty = spot.y + Phaser.Math.Between(-8, 8);
    const dist = Phaser.Math.Distance.Between(container.x, container.y, tx, ty);
    this.tweens.add({
      targets: container,
      x: tx,
      y: ty,
      duration: Phaser.Math.Clamp(900 + dist * 2.8, 1100, 3400),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!container.active) return;
        container.setData('residentMode', 'inside' as ResidentMode);
        if (label?.active) {
          label.setText(`${name}·${spot.hint}`);
        }
        const stay = Phaser.Math.Between(2600, 5200);
        const timer = this.time.delayedCall(stay, () => {
          if (!container.active) return;
          this.resolveResidentExplorationOutcome(container, behavior, spot);
          container.setData('residentMode', 'moving' as ResidentMode);

          const backPoints = this.getResidentBehaviorAnchors()[behavior];
          const fallback = Phaser.Utils.Array.GetRandom(backPoints);
          const bx = fallback.x + Phaser.Math.Between(-5, 5);
          const by = fallback.y + Phaser.Math.Between(-4, 4);
          const returnDist = Phaser.Math.Distance.Between(container.x, container.y, bx, by);
          this.tweens.add({
            targets: container,
            x: bx,
            y: by,
            duration: Phaser.Math.Clamp(900 + returnDist * 2.5, 1000, 3000),
            ease: 'Sine.easeInOut',
            onComplete: () => {
              if (!container.active) return;
              container.setData('residentMode', 'idle' as ResidentMode);
              container.setData('residentExplorationSpotId', null);
              container.setData('residentExplorationAction', null);
              const next: ResidentBehavior = gameState.data.isNight
                ? 'guard'
                : (Math.random() < 0.45 ? 'stroll' : behavior);
              this.applyResidentBehavior(container, next, false);
            },
          });
        });
        container.setData('residentTimer', timer);
      },
    });
  }

  private resolveResidentExplorationOutcome(
    container: Phaser.GameObjects.Container,
    behavior: ResidentBehavior,
    spot: ExplorationSpot
  ): void {
    const companionId = (container.getData('companionId') || '') as string;
    const companion = gameState.data.companions.find(c => c.id === companionId);
    const roster = gameState.data.companions.filter((c) => c.status === 'base');
    const profileMul = companion
      ? CompanionPersonalitySystem.getDayEfficiencyMultiplier(companion, roster)
      : 1;
    const moraleMul = this.hasDayBuff('morale') ? 1.22 : 1;
    const runMul = this.getRunDayActivityGainMultiplier();
    const duty = companion ? this.getCompanionAutoDuty(companion) : 'support';
    const milestone = companion
      ? getCompanionMilestoneBonuses(companion.role || 'tank', Math.max(1, companion.level || 1))
      : getCompanionMilestoneBonuses('tank', 1);
    let gainMul = profileMul * moraleMul * runMul * milestone.dayYieldMul;
    if (duty === 'builder') gainMul *= milestone.constructionSpeedMul;
    else if (duty === 'scavenger') gainMul *= milestone.scavengerYieldMul;
    else if (duty === 'defender') gainMul *= milestone.defenseDamageMul;
    else gainMul *= milestone.supportYieldMul;
    gainMul = Phaser.Math.Clamp(gainMul, 0.62, 2.8);
    const addGain = (base: number): number => Math.max(1, Math.round(base * gainMul));
    const addResource = (key: keyof Resources, base: number): number => {
      const amount = addGain(base);
      gameState.addResource(key, amount);
      QuestSystem.updateProgress('collect', key, amount);
      return amount;
    };
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    if (used >= usageLimit) {
      this.showFloatingText(
        container.x,
        container.y - 32,
        `${spot.name} 今日已完成 ${used}/${usageLimit}`,
        '#94a3b8',
        false
      );
      return;
    }
    this.dayActivityUsage.set(spot.actionType, used + 1);

    let summary = '';
    let color = '#93c5fd';
    let exp = 2;
    let dangerRoll = 0;
    let dangerMin = 0;
    let dangerMax = 0;
    let dangerText = '';

    if (spot.actionType === 'fish') {
      const food = addResource('food', 2);
      const water = addResource('water', 1);
      const metal = Math.random() < 0.45 ? addResource('metal', 1) : 0;
      if (Math.random() < 0.22) addResource('scrap', 1);
      exp = Phaser.Math.Between(3, 6);
      summary = metal > 0
        ? `河流淘金 +食物${food} +净水${water} +金属${metal}`
        : `河流钓鱼 +食物${food} +净水${water}`;
      color = '#38bdf8';
      dangerRoll = 0.16;
      dangerMin = 1;
      dangerMax = 2;
      dangerText = '水边动静引来敌人';
    } else if (spot.actionType === 'swim') {
      const water = addResource('water', 1);
      const heal = Phaser.Math.Between(2, 6);
      events.emit(GameEvents.PLAYER_HEAL_REQUEST, { amount: heal, source: '河流游泳恢复' });
      exp = Phaser.Math.Between(2, 5);
      summary = `河流游泳 +净水${water} · 主角恢复${heal}`;
      color = '#60a5fa';
    } else if (spot.actionType === 'hunt') {
      const food = addResource('food', 3);
      const ammo = addResource('ammo', 1);
      if (Math.random() < 0.28) addResource('medical', 1);
      exp = Phaser.Math.Between(5, 9);
      summary = `森林打猎 +食物${food} +弹药${ammo}`;
      color = '#22c55e';
      dangerRoll = 0.34;
      dangerMin = 2;
      dangerMax = 4;
      dangerText = '枪声惊动森林敌群';
    } else if (spot.actionType === 'scavenge') {
      const med = addResource('medical', 1);
      const scrap = addResource('scrap', 2);
      const metal = addResource('metal', 1);
      if (Math.random() < 0.14) gameState.addResource('bitcoin', Number((Math.random() * 0.08 + 0.03).toFixed(2)));
      exp = Phaser.Math.Between(4, 8);
      summary = `城区搜刮 +医疗${med} +零件${scrap} +金属${metal}`;
      color = '#f59e0b';
      dangerRoll = 0.3;
      dangerMin = 1;
      dangerMax = 3;
      dangerText = '搜刮噪音暴露位置';
    } else {
      const scrap = addResource('scrap', 2);
      const metal = addResource('metal', 3);
      if (Math.random() < 0.35) addResource('energyCore', 1);
      exp = Phaser.Math.Between(7, 12);
      summary = `山洞挖矿 +金属${metal} +零件${scrap}`;
      color = '#a78bfa';
      dangerRoll = 0.48;
      dangerMin = 2;
      dangerMax = 5;
      dangerText = '洞穴异动触发敌潮';
    }

    this.grantExperience(exp);
    const residentQuality: 'poor' | 'good' | 'perfect' = Math.random() < 0.22 ? 'perfect' : 'good';
    this.applyDayOpsContractProgress(spot, residentQuality, false);
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(container.x, container.y - 36, summary, color, false);
    this.showFloatingText(container.x, container.y - 56, `伙伴远征经验 +${exp}`, '#93c5fd', false);

    if (dangerRoll > 0 && Math.random() < dangerRoll) {
      const enemyCount = Phaser.Math.Between(dangerMin, dangerMax);
      for (let i = 0; i < enemyCount; i += 1) {
        this.enemySystem.spawnEnemy(
          Math.max(1, gameState.data.currentWave || 1),
          Math.max(1, gameState.data.currentDay || 1)
        );
      }
      this.showFloatingText(container.x, container.y - 74, `${dangerText} · +${enemyCount}敌`, '#ef4444', false);
    }

    if (behavior === 'adventure' && Math.random() < 0.28) {
      this.tryEmitRescueChatter();
    }
  }

  private clearResidentRuntime(container: Phaser.GameObjects.Container): void {
    this.releaseResidentFacility(container);
    const oldTimer = container.getData('residentTimer') as Phaser.Time.TimerEvent | undefined;
    oldTimer?.remove(false);
    const oldBubble = container.getData('facilityBubble') as Phaser.GameObjects.GameObject | undefined;
    oldBubble?.destroy();
    const oldBubbleTween = container.getData('facilityBubbleTween') as Phaser.Tweens.Tween | undefined;
    oldBubbleTween?.remove();
    const oldDecor = (container.getData('decorNodes') || []) as Phaser.GameObjects.GameObject[];
    oldDecor.forEach((obj) => obj?.destroy());
    const oldTweens = (container.getData('decorTweens') || []) as Phaser.Tweens.Tween[];
    oldTweens.forEach((tw) => tw?.remove());
    const actionTimer = container.getData('residentActionTimer') as Phaser.Time.TimerEvent | undefined;
    actionTimer?.remove(false);
    container.setData('residentTimer', null);
    container.setData('facilityBubble', null);
    container.setData('facilityBubbleTween', null);
    container.setData('decorNodes', []);
    container.setData('decorTweens', []);
    container.setData('residentActionTimer', null);
    container.setVisible(true);
    container.setAlpha(1);
    container.setData('residentMode', 'idle' as ResidentMode);
  }

  private residentBusy(container: Phaser.GameObjects.Container): boolean {
    const mode = (container.getData('residentMode') || 'idle') as ResidentMode;
    return mode === 'moving' || mode === 'inside';
  }

  private reserveResidentFacility(container: Phaser.GameObjects.Container, facility: FacilityInteractable): boolean {
    const companionId = (container.getData('companionId') || '') as string;
    if (!companionId) return false;
    const occupiedBy = this.facilityOccupants.get(facility.id);
    if (occupiedBy && occupiedBy !== companionId) return false;
    this.facilityOccupants.set(facility.id, companionId);
    container.setData('residentFacilityId', facility.id);
    return true;
  }

  private releaseResidentFacility(container: Phaser.GameObjects.Container): void {
    const facilityId = container.getData('residentFacilityId') as FacilityInteractable['id'] | undefined;
    if (!facilityId) return;
    const companionId = container.getData('companionId') as string | undefined;
    if (companionId && this.facilityOccupants.get(facilityId) === companionId) {
      this.facilityOccupants.delete(facilityId);
    }
    container.setData('residentFacilityId', null);
  }

  private scheduleBaseResidentRoutine(): void {
    this.baseRoutineTimer?.remove(false);
    this.baseRoutineTimer = this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => this.updateBaseResidentRoutine(),
    });
  }

  private updateBaseResidentRoutine(): void {
    if (gameState.data.isNight) return;
    for (const [companionId, container] of this.baseResidents.entries()) {
      if (!container.active) continue;
      if (container.getData('constructionBusy')) continue;
      if (this.residentBusy(container)) continue;
      const companion = gameState.data.companions.find(c => c.id === companionId);
      if (!companion || companion.status !== 'base') continue;
      const current = (container.getData('behavior') || 'stroll') as ResidentBehavior;
      const next = this.getResidentBehaviorForCompanion(companion, Phaser.Math.Between(0, 999), current);
      const keepCurrent = current === next && Math.random() < 0.45;
      this.applyResidentBehavior(container, keepCurrent ? current : next, false);
    }
  }

  private activateNightResidentDefense(): void {
    const anchors = this.getNightDefenseAnchors();
    const roster = this.getNightDefenseRoster();
    let defenders = 0;
    let idx = 0;
    for (const item of roster) {
      const { companionId, container, companion: comp } = item;
      defenders += 1;

      this.clearResidentRuntime(container);
      container.setVisible(true);
      container.setAlpha(1);
      container.setData('residentMode', 'idle' as ResidentMode);
      container.setData('behavior', 'guard' as ResidentBehavior);
      this.residentNightAnchorIndex.set(companionId, idx % anchors.length);
      container.setData('nightDefensePriority', item.priority);
      const nearGuardPost = idx < 2;
      container.setData('nightGuardPost', nearGuardPost);

      const anchor = anchors[idx % anchors.length];
      const offset = this.getNightDefenseOffset(companionId, nearGuardPost);
      idx += 1;
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
        duration: 500 + Phaser.Math.Between(0, 300),
        ease: 'Sine.easeOut',
      });
      const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
      if (label?.active) label.setText(`${comp.name.split('(')[0]}·夜间防卫`);
      this.residentDefenseNextFireAt.set(companionId, 0);
    }
    if (defenders > 0) {
      this.showFloatingText(
        this.cameras.main.width / 2,
        188,
        `基地夜间防卫已启动 · ${defenders}名伙伴就位（岗哨优先）`,
        '#38bdf8',
        true
      );
    }
  }

  private getNightDefenseRoster(): Array<{
    companionId: string;
    companion: CompanionData;
    container: Phaser.GameObjects.Container;
    priority: number;
  }> {
    const roster: Array<{
      companionId: string;
      companion: CompanionData;
      container: Phaser.GameObjects.Container;
      priority: number;
    }> = [];

    for (const [companionId, container] of this.baseResidents.entries()) {
      if (!container.active) continue;
      const companion = gameState.data.companions.find((c) => c.id === companionId);
      if (!companion || companion.status !== 'base') continue;
      const profileMods = CompanionPersonalitySystem.getProfileModifiers(companion);
      const jobPriority =
        companion.job === 'power' || companion.job === 'workshop'
          ? 2.4
          : companion.job === 'medical'
            ? 1.2
            : companion.job === 'farm' || companion.job === 'kitchen'
              ? 0.6
              : 0.9;
      const rolePriority =
        companion.role === 'sniper'
          ? 2.2
          : companion.role === 'tank'
            ? 1.4
            : companion.role === 'medic'
              ? 1.1
              : 1.6;
      const levelPriority = Math.max(1, companion.level || 1) * 0.14;
      const profilePriority = profileMods.nightAccuracy * 1.4 + profileMods.teamwork * 0.9;
      const priority = jobPriority + rolePriority + levelPriority + profilePriority;
      roster.push({ companionId, companion, container, priority });
    }

    roster.sort((a, b) => b.priority - a.priority);
    return roster;
  }

  private deactivateNightResidentDefense(): void {
    this.residentDefenseNextFireAt.clear();
    this.residentNightAnchorIndex.clear();
    for (const [companionId, container] of this.baseResidents.entries()) {
      if (!container.active) continue;
      const comp = gameState.data.companions.find(c => c.id === companionId);
      if (!comp || comp.status !== 'base') continue;
      this.clearResidentRuntime(container);
      this.applyResidentBehavior(container, this.getResidentBehaviorForCompanion(comp, Phaser.Math.Between(0, 999), 'stroll'), false);
    }
  }

  private getNightDefenseAnchors(): Array<{ x: number; y: number }> {
    const anchors: Array<{ x: number; y: number }> = [];
    const baseMinX = 800;
    const baseMaxX = 1200;
    const baseMinY = 560;
    const baseMaxY = 940;

    for (let x = baseMinX; x <= baseMaxX; x += 80) {
      anchors.push({ x, y: baseMinY });
      anchors.push({ x, y: baseMaxY });
    }
    for (let y = baseMinY + 70; y <= baseMaxY - 70; y += 80) {
      anchors.push({ x: baseMinX, y });
      anchors.push({ x: baseMaxX, y });
    }

    const guardPost = this.facilityInteractables.find(f => f.id === 'guard_post');
    if (guardPost) {
      anchors.unshift(
        { x: guardPost.enterX - 20, y: guardPost.enterY - 18 },
        { x: guardPost.enterX + 18, y: guardPost.enterY - 8 },
        { x: guardPost.enterX - 6, y: guardPost.enterY + 22 },
        { x: guardPost.exitX - 12, y: guardPost.exitY + 12 },
      );
    }

    // De-duplicate nearby anchors while keeping distribution.
    const deduped: Array<{ x: number; y: number }> = [];
    anchors.forEach((anchor) => {
      const exists = deduped.some(item => Phaser.Math.Distance.Between(item.x, item.y, anchor.x, anchor.y) < 24);
      if (!exists) deduped.push(anchor);
    });
    return deduped;
  }

  private getNightDefenseOffset(companionId: string, nearGuardPost: boolean): { x: number; y: number } {
    const seed = companionId.split('').reduce((acc, ch, idx) => (
      (acc + ch.charCodeAt(0) * (idx + 11)) % 100000
    ), 97);
    const spreadX = nearGuardPost ? 4 : 10;
    const spreadY = nearGuardPost ? 3 : 8;
    return {
      x: (seed % (spreadX * 2 + 1)) - spreadX,
      y: ((seed * 7) % (spreadY * 2 + 1)) - spreadY,
    };
  }

  private updateNightBaseDefense(): void {
    if (!gameState.data.isNight) return;
    const now = this.time.now;
    const anchors = this.getNightDefenseAnchors();

    for (const [companionId, container] of this.baseResidents.entries()) {
      if (!container.active) continue;
      const comp = gameState.data.companions.find(c => c.id === companionId);
      if (!comp || comp.status !== 'base') continue;

      if (this.residentBusy(container)) {
        this.clearResidentRuntime(container);
        container.setData('residentMode', 'idle' as ResidentMode);
      }

      const anchorIndex = this.residentNightAnchorIndex.get(companionId) ?? Phaser.Math.Between(0, anchors.length - 1);
      this.residentNightAnchorIndex.set(companionId, anchorIndex);
      const anchor = anchors[anchorIndex % anchors.length];
      const isGuardPostAnchor = !!container.getData('nightGuardPost');
      const offset = this.getNightDefenseOffset(companionId, isGuardPostAnchor);
      const targetX = anchor.x + offset.x;
      const targetY = anchor.y + offset.y;
      const dist = Phaser.Math.Distance.Between(container.x, container.y, targetX, targetY);
      if (dist > 20) {
        const activeTweens = this.tweens.getTweensOf(container).filter(tw => tw.isPlaying());
        if (activeTweens.length === 0) {
          this.tweens.add({
            targets: container,
            x: targetX,
            y: targetY,
            duration: Phaser.Math.Clamp(300 + dist * 6, 450, 1300),
            ease: 'Sine.easeInOut',
          });
        }
      }

      const level = Math.max(1, comp.level || 1);
      const week = Math.max(1, gameState.data.currentWeek || 1);
      const range = 260 + Math.min(180, level * 9 + week * 6);
      const target = this.enemySystem.findNearestEnemy(container.x, container.y, range);
      if (!target) continue;

      const nextFireAt = this.residentDefenseNextFireAt.get(companionId) || 0;
      if (now < nextFireAt) continue;
      const guardPost = this.facilityInteractables.find(f => f.id === 'guard_post');
      const nearGuardPost = isGuardPostAnchor || (
        !!guardPost
          && Phaser.Math.Distance.Between(container.x, container.y, guardPost.enterX, guardPost.enterY) < 96
      );
      const intervalBase = Phaser.Math.Clamp(760 - level * 22 - week * 10, 240, 820);
      const interval = Math.max(180, nearGuardPost ? intervalBase * 0.82 : intervalBase);
      this.residentDefenseNextFireAt.set(companionId, now + interval);
      this.fireNightResidentShot(container, companionId, comp, target);
    }
  }

  private fireNightResidentShot(
    container: Phaser.GameObjects.Container,
    companionId: string,
    companion: { id?: string; level?: number; role?: string; job?: string },
    target: Phaser.Physics.Arcade.Sprite
  ): void {
    const level = Math.max(1, companion.level || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const roster = gameState.data.companions.filter((c) => c.status === 'base');
    const companionData = gameState.data.companions.find((c) => c.id === companionId);
    const nightAccuracyMul = companionData
      ? CompanionPersonalitySystem.getNightAccuracyMultiplier(companionData, roster)
      : 1;
    const combatDamageMul = companionData
      ? CompanionPersonalitySystem.getCombatDamageMultiplier(companionData, roster)
      : 1;
    const milestone = companionData
      ? getCompanionMilestoneBonuses(companionData.role || 'tank', Math.max(1, companionData.level || 1))
      : getCompanionMilestoneBonuses((companion.role as any) || 'tank', level);
    const guardPost = this.facilityInteractables.find(f => f.id === 'guard_post');
    const nearGuardPost = !!guardPost
      && Phaser.Math.Distance.Between(container.x, container.y, guardPost.enterX, guardPost.enterY) < 96;
    const guardPostDamageBonus = nearGuardPost ? 1.18 : 1;
    const roleBonus = companion.role === 'sniper' ? 1.28 : companion.role === 'tank' ? 1.1 : 1;
    const jobBonus = companion.job === 'workshop' || companion.job === 'power' ? 1.16 : 1;
    const damage = Math.max(
      7,
      Math.round(
        (8 + level * 2.1 + week * 1.4)
        * roleBonus
        * jobBonus
        * guardPostDamageBonus
        * combatDamageMul
        * milestone.defenseDamageMul
        * this.nightDirectiveEffects.residentDamageMul
        * this.runMutatorEffects.nightResidentDamageMul
      )
    );

    const bullet = this.acquireBulletFromGroup(this.companionBullets, container.x, container.y);
    if (!bullet) return;

    const baseAngle = Phaser.Math.Angle.Between(container.x, container.y, target.x, target.y);
    const spreadDeg = Phaser.Math.Clamp(10 - nightAccuracyMul * 5.6, 1.8, 10);
    const angle = baseAngle + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-spreadDeg, spreadDeg));
    const speed = (430 + Math.min(260, level * 14)) * (nearGuardPost ? 1.1 : 1);
    const color = this.getAutoLevelColor(level);
    const texture = this.textures.exists('bullet_pulse') ? 'bullet_pulse' : 'bullet';

    bullet.enableBody(true, container.x, container.y, true, true);
    bullet.setActive(true).setVisible(true);
    bullet.setTexture(texture);
    bullet.setTint(color);
    bullet.setAlpha(1);
    const bulletScale = level >= 20 ? 3 : 2;
    bullet.setScale(bulletScale);
    bullet.setDepth(10);
    bullet.setBlendMode(Phaser.BlendModes.ADD);

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.reset(container.x, container.y);
    body.setAllowGravity(false);
    const hitRadius = bulletScale >= 3 ? 7 : 6;
    body.setCircle(hitRadius, bullet.width / 2 - hitRadius, bullet.height / 2 - hitRadius);
    body.setBounce(0, 0);
    body.setDrag(0, 0);
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    body.setVelocity(velocityX, velocityY);
    bullet.setRotation(angle + Math.PI / 2);
    this.createBulletMuzzleVfx(container.x, container.y, angle, color, texture);

    const b = bullet as any;
    b.bulletEffect = { type: 'normal', damage, speed, color, size: 1.2 };
    b.damage = damage;
    b.ownerType = 'companion';
    b.ownerId = companionId;
    b.bulletTextureKey = texture;
    b.baseVelocityX = velocityX;
    b.baseVelocityY = velocityY;
    b.swayAmplitude = texture === 'bullet_pulse' ? Math.min(20, 8 + level * 0.35) : 0;
    b.swayFrequency = b.swayAmplitude > 0 ? 0.013 : 0;
    b.swayPhase = Math.random() * Math.PI * 2;
    b.spawnTime = this.time.now;
    const lifetime = Math.max(320, 1200 - Math.min(400, level * 10));
    b.maxLifetime = lifetime + 120;
    if (b.lifetimeTimer) {
      b.lifetimeTimer.remove();
      b.lifetimeTimer = null;
    }
    b.lifetimeTimer = this.time.delayedCall(lifetime, () => {
      b.lifetimeTimer = null;
      if (bullet.active) this.disableBullet(bullet);
    });

    const chatterRoll = Math.random();
    if (chatterRoll < 0.1) {
      this.maybeEmitCompanionCombatChatter({ type: 'companion', companionId }, 'defend');
    } else if (chatterRoll < 0.16) {
      this.maybeEmitCompanionCombatChatter({ type: 'companion', companionId }, 'engage');
    }
  }

  private applyResidentBehavior(container: Phaser.GameObjects.Container, behavior: ResidentBehavior, instant: boolean): void {
    const expeditionSpot = !instant && !gameState.data.isNight
      ? this.pickExplorationSpotForBehavior(behavior)
      : null;
    const shouldPrioritizeExploration = behavior === 'fishing' || behavior === 'forage' || behavior === 'adventure';
    if (expeditionSpot && (shouldPrioritizeExploration || Math.random() < 0.78)) {
      const pick = expeditionSpot;
      this.startResidentExplorationRoutine(container, behavior, pick);
      return;
    }

    const facility = this.getFacilityForBehavior(behavior);
    if (!instant && facility && Math.random() < 0.78) {
      this.startResidentFacilityRoutine(container, behavior, facility);
      return;
    }

    const points = this.getResidentBehaviorAnchors()[behavior];
    const target = Phaser.Utils.Array.GetRandom(points);
    const tx = target.x + Phaser.Math.Between(-4, 4);
    const ty = target.y + Phaser.Math.Between(-3, 3);
    this.tweens.killTweensOf(container);
    if (instant) {
      container.setPosition(tx, ty);
    } else {
      const dist = Phaser.Math.Distance.Between(container.x, container.y, tx, ty);
      this.tweens.add({
        targets: container,
        x: tx,
        y: ty,
        duration: Phaser.Math.Clamp(550 + dist * 5, 650, 1900),
        ease: 'Sine.easeInOut',
      });
    }
    container.setData('behavior', behavior);
    const name = (container.getData('residentName') || '伙伴') as string;
    const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
    if (label && label.active) {
      label.setText(`${name}·${behaviorName[behavior]}`);
    }
    const sprite = container.getData('spriteObj') as Phaser.GameObjects.Sprite | undefined;
    if (sprite && sprite.active) {
      const tints: Record<ResidentBehavior, number> = {
        fishing: 0x93c5fd,
        cooking: 0xfbbf24,
        guard: 0xdbeafe,
        sleep: 0xc4b5fd,
        forage: 0x86efac,
        adventure: 0xfda4af,
        stroll: 0xbfdbfe,
      };
      sprite.setTint(tints[behavior]);
    }
    this.decorateResidentBehavior(container, behavior);
  }

  private startResidentFacilityRoutine(
    container: Phaser.GameObjects.Container,
    behavior: ResidentBehavior,
    facility: FacilityInteractable
  ): void {
    if (gameState.data.isNight) {
      this.applyResidentBehavior(container, 'sleep', false);
      return;
    }
    if (!this.reserveResidentFacility(container, facility)) {
      this.applyResidentBehavior(container, 'stroll', false);
      return;
    }
    this.clearResidentRuntime(container);
    this.reserveResidentFacility(container, facility);
    container.setData('residentMode', 'moving' as ResidentMode);
    container.setData('behavior', behavior);
    const name = (container.getData('residentName') || '伙伴') as string;
    const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
    if (label?.active) {
      label.setText(`${name}·前往${facility.name}`);
    }

    const moveToEntry = () => {
      const dist = Phaser.Math.Distance.Between(container.x, container.y, facility.enterX, facility.enterY);
      this.tweens.add({
        targets: container,
        x: facility.enterX,
        y: facility.enterY,
        duration: Phaser.Math.Clamp(600 + dist * 4, 650, 2100),
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!container.active) return;
          this.tweens.add({
            targets: container,
            x: facility.sprite.x + Phaser.Math.Between(-8, 8),
            y: facility.sprite.y + Phaser.Math.Between(6, 12),
            alpha: 0.42,
            duration: 520,
            onComplete: () => this.enterResidentFacility(container, facility),
          });
        },
      });
    };
    moveToEntry();
  }

  private enterResidentFacility(
    container: Phaser.GameObjects.Container,
    facility: FacilityInteractable
  ): void {
    if (!container.active) return;
    container.setData('residentMode', 'inside' as ResidentMode);
    const label = container.getData('labelObj') as Phaser.GameObjects.Text | undefined;
    const name = (container.getData('residentName') || '伙伴') as string;
    const companionId = (container.getData('companionId') || '') as string;
    const companion = gameState.data.companions.find(c => c.id === companionId);
    const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
    const mood = gameState.data.base.foodDeficit > 0
      ? 'hungry'
      : (gameState.data.base.powerUsed > gameState.data.base.powerCapacity ? 'power_low' : 'normal');
    const recentLines = this.residentRecentChatter.get(companionId) || [];
    const chatter = companion
      ? CompanionPersonalitySystem.generateChatter(companion, {
        behavior,
        isNight: gameState.data.isNight,
        day: gameState.data.currentDay,
        week: gameState.data.currentWeek,
        mood,
      }, recentLines)
      : `${name} 在${facility.name}${facility.action}中`;
    if (companion) this.rememberResidentChatter(companionId, chatter);
    if (label?.active) {
      label.setText(`${name}·${facility.action}`);
    }
    // Keep resident logically present but visually "inside" the facility.
    container.setVisible(false);
    const bubble = this.add.text(
      facility.sprite.x,
      facility.sprite.y - 28,
      chatter,
      {
        fontSize: '10px',
        color: '#fde68a',
        fontFamily: this.getUIFontFamily(),
        stroke: '#0b1220',
        strokeThickness: 3,
        backgroundColor: '#111827cc',
        padding: { x: 6, y: 3 },
      }
    ).setOrigin(0.5).setDepth(1002);
    this.villageLayer.add(bubble);
    const bubbleTween = this.tweens.add({
      targets: bubble,
      y: bubble.y - 2,
      duration: 550,
      yoyo: true,
      repeat: -1,
    });
    container.setData('facilityBubble', bubble);
    container.setData('facilityBubbleTween', bubbleTween);

    const insideStay = Phaser.Math.Between(2600, 5200);
    const timer = this.time.delayedCall(insideStay, () => {
      if (!container.active) return;
      const activeBubbleTween = container.getData('facilityBubbleTween') as Phaser.Tweens.Tween | undefined;
      activeBubbleTween?.remove();
      container.setData('facilityBubbleTween', null);
      bubble.destroy();
      container.setData('facilityBubble', null);
      container.setVisible(true);
      container.setData('residentMode', 'moving' as ResidentMode);
      this.tweens.add({
        targets: container,
        x: facility.exitX + Phaser.Math.Between(-10, 10),
        y: facility.exitY + Phaser.Math.Between(-6, 6),
        alpha: 1,
        duration: 520,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (!container.active) return;
          this.releaseResidentFacility(container);
          container.setData('residentMode', 'idle' as ResidentMode);
          const next: ResidentBehavior = gameState.data.isNight
            ? 'sleep'
            : (Math.random() < 0.35 ? 'stroll' : 'forage');
          this.applyResidentBehavior(container, next, false);
        },
      });
    });
    container.setData('residentTimer', timer);
  }

  private decorateResidentBehavior(container: Phaser.GameObjects.Container, behavior: ResidentBehavior): void {
    const oldDecor = (container.getData('decorNodes') || []) as Phaser.GameObjects.GameObject[];
    oldDecor.forEach((obj) => obj?.destroy());
    const oldTweens = (container.getData('decorTweens') || []) as Phaser.Tweens.Tween[];
    oldTweens.forEach((tw) => tw?.remove());
    const oldActionTimer = container.getData('residentActionTimer') as Phaser.Time.TimerEvent | undefined;
    oldActionTimer?.remove(false);

    const decorNodes: Phaser.GameObjects.GameObject[] = [];
    const decorTweens: Phaser.Tweens.Tween[] = [];
    const sprite = container.getData('spriteObj') as Phaser.GameObjects.Sprite | undefined;
    if (sprite?.active) {
      sprite.setAngle(0);
      sprite.setScale(0.95);
      sprite.setPosition(0, 0);
    }

    if (behavior === 'fishing') {
      const rod = this.add.rectangle(10, -8, 2, 16, 0x9a6b3a, 0.95);
      const line = this.add.rectangle(12, 2, 1, 12, 0xcbd5e1, 0.9);
      const bobber = this.add.circle(12, 10, 2, 0xf87171, 0.95);
      const ripple = this.add.circle(12, 14, 4, 0x7dd3fc, 0.18);
      const fish = this.add.ellipse(16, 12, 8, 4, 0x22d3ee, 0.4);
      container.add([rod, line, bobber, ripple, fish]);
      decorNodes.push(rod, line, bobber, ripple);
      decorNodes.push(fish);
      decorTweens.push(this.tweens.add({ targets: bobber, y: 12, duration: 700, yoyo: true, repeat: -1 }));
      decorTweens.push(this.tweens.add({ targets: ripple, scale: 1.9, alpha: 0, duration: 1000, repeat: -1 }));
      decorTweens.push(this.tweens.add({ targets: fish, y: 8, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, angle: { from: -6, to: 5 }, y: 1, duration: 720, yoyo: true, repeat: -1 }));
      }
    } else if (behavior === 'cooking') {
      const pot = this.add.circle(8, 8, 5, 0x334155, 0.95);
      const fire = this.add.circle(8, 11, 2, 0xf59e0b, 0.9);
      const smoke = this.add.circle(10, 1, 2, 0x94a3b8, 0.5);
      const spoon = this.add.rectangle(13, 8, 2, 10, 0xe5e7eb, 0.9);
      container.add([pot, fire, smoke, spoon]);
      decorNodes.push(pot, fire, smoke, spoon);
      decorTweens.push(this.tweens.add({ targets: smoke, y: -6, alpha: 0, duration: 900, repeat: -1, yoyo: false }));
      decorTweens.push(this.tweens.add({ targets: fire, scale: { from: 1, to: 1.3 }, duration: 350, yoyo: true, repeat: -1 }));
      decorTweens.push(this.tweens.add({ targets: spoon, angle: { from: -25, to: 22 }, duration: 460, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, y: { from: 0, to: -1.5 }, duration: 420, yoyo: true, repeat: -1 }));
      }
    } else if (behavior === 'guard') {
      const post = this.add.rectangle(0, 12, 18, 4, 0x334155, 0.8);
      const beam = this.add.triangle(0, -6, 0, 0, 40, 8, 40, -8, 0x93c5fd, 0.18);
      beam.setOrigin(0.1, 0.5);
      container.add([post, beam]);
      decorNodes.push(post, beam);
      decorTweens.push(this.tweens.add({ targets: beam, angle: { from: -18, to: 18 }, duration: 900, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, x: { from: -1.5, to: 1.5 }, duration: 550, yoyo: true, repeat: -1 }));
      }
    } else if (behavior === 'sleep') {
      const bed = this.add.rectangle(0, 12, 18, 6, 0x475569, 0.85);
      const zzz = this.add.text(8, -18, 'Zz', {
        fontSize: '10px',
        color: '#cbd5e1',
        fontFamily: this.getUIFontFamily(),
      });
      container.add([bed, zzz]);
      decorNodes.push(bed, zzz);
      decorTweens.push(this.tweens.add({ targets: zzz, y: -24, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        sprite.setAngle(90);
        sprite.setScale(0.9, 0.82);
        decorTweens.push(this.tweens.add({ targets: sprite, scaleY: { from: 0.8, to: 0.88 }, duration: 1000, yoyo: true, repeat: -1 }));
      }
    } else if (behavior === 'forage') {
      const bag = this.add.rectangle(8, 8, 7, 8, 0x92400e, 0.95);
      const leaf = this.add.rectangle(11, 4, 2, 3, 0x22c55e, 0.95);
      container.add([bag, leaf]);
      decorNodes.push(bag, leaf);
      decorTweens.push(this.tweens.add({ targets: bag, y: 10, duration: 700, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, x: { from: -2, to: 2 }, duration: 430, yoyo: true, repeat: -1 }));
      }
    } else if (behavior === 'adventure') {
      const blade = this.add.rectangle(10, -2, 2, 12, 0xe2e8f0, 0.95);
      const hilt = this.add.rectangle(10, 4, 6, 2, 0x9a3412, 0.95);
      container.add([blade, hilt]);
      decorNodes.push(blade, hilt);
      decorTweens.push(this.tweens.add({ targets: blade, angle: { from: -15, to: 15 }, duration: 500, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, angle: { from: -7, to: 7 }, duration: 420, yoyo: true, repeat: -1 }));
      }
    } else {
      const footA = this.add.rectangle(-5, 12, 4, 2, 0x64748b, 0.9);
      const footB = this.add.rectangle(5, 12, 4, 2, 0x64748b, 0.9);
      container.add([footA, footB]);
      decorNodes.push(footA, footB);
      decorTweens.push(this.tweens.add({ targets: [footA, footB], x: '+=2', duration: 380, yoyo: true, repeat: -1 }));
      if (sprite?.active) {
        decorTweens.push(this.tweens.add({ targets: sprite, y: { from: 0, to: -1 }, duration: 280, yoyo: true, repeat: -1 }));
      }
    }

    container.setData('decorNodes', decorNodes);
    container.setData('decorTweens', decorTweens);
    const actionTimer = this.time.addEvent({
      delay: Phaser.Math.Between(1200, 1900),
      loop: true,
      callback: () => {
        this.emitResidentActionPulse(container, behavior);
        this.animateResidentActionBeat(container, behavior);
      },
    });
    container.setData('residentActionTimer', actionTimer);
  }

  private emitResidentActionPulse(container: Phaser.GameObjects.Container, behavior: ResidentBehavior): void {
    if (!container.active || !container.visible || gameState.data.isNight) return;
    const iconMap: Record<ResidentBehavior, string> = {
      fishing: '<><',
      cooking: '^^',
      guard: '!',
      sleep: 'Zz',
      forage: '+',
      adventure: '/',
      stroll: '.',
    };
    const colorMap: Record<ResidentBehavior, string> = {
      fishing: '#38bdf8',
      cooking: '#fb923c',
      guard: '#93c5fd',
      sleep: '#c4b5fd',
      forage: '#4ade80',
      adventure: '#fda4af',
      stroll: '#cbd5e1',
    };
    const icon = this.add.text(
      container.x + Phaser.Math.Between(-8, 8),
      container.y - 30 + Phaser.Math.Between(-4, 4),
      iconMap[behavior],
      {
        fontSize: '11px',
        color: colorMap[behavior],
        fontFamily: this.getUIFontFamily(),
        fontStyle: 'bold',
        stroke: '#0b1220',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(1002);
    this.villageLayer.add(icon);
    this.tweens.add({
      targets: icon,
      y: icon.y - 10,
      alpha: 0,
      duration: Phaser.Math.Between(520, 860),
      onComplete: () => icon.destroy(),
    });
  }

  private animateResidentActionBeat(container: Phaser.GameObjects.Container, behavior: ResidentBehavior): void {
    if (!container.active || !container.visible || gameState.data.isNight) return;
    const sprite = container.getData('spriteObj') as Phaser.GameObjects.Sprite | undefined;
    if (!sprite || !sprite.active) return;

    if (behavior === 'fishing') {
      const splash = this.add.circle(container.x + 14, container.y + 12, 2, 0x7dd3fc, 0.65).setDepth(1002);
      this.villageLayer.add(splash);
      this.tweens.add({
        targets: splash,
        scale: { from: 0.7, to: 2.4 },
        alpha: { from: 0.65, to: 0 },
        duration: 360,
        onComplete: () => splash.destroy(),
      });
      return;
    }

    if (behavior === 'cooking') {
      const smoke = this.add.circle(container.x + Phaser.Math.Between(5, 11), container.y - 7, 2, 0x94a3b8, 0.46).setDepth(1002);
      this.villageLayer.add(smoke);
      this.tweens.add({
        targets: smoke,
        y: smoke.y - Phaser.Math.Between(10, 16),
        x: smoke.x + Phaser.Math.Between(-4, 4),
        alpha: 0,
        scale: { from: 1, to: 2.1 },
        duration: 720,
        onComplete: () => smoke.destroy(),
      });
      return;
    }

    if (behavior === 'guard') {
      const flash = this.add.circle(container.x + 14, container.y - 2, 2.5, 0x93c5fd, 0.45).setDepth(1002);
      this.villageLayer.add(flash);
      this.tweens.add({
        targets: flash,
        scale: { from: 0.7, to: 2.2 },
        alpha: 0,
        duration: 240,
        onComplete: () => flash.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        angle: { from: -8, to: 8 },
        duration: 260,
        yoyo: true,
      });
      return;
    }

    if (behavior === 'sleep') {
      const z = this.add.text(container.x + 8, container.y - 24, 'z', {
        fontSize: '10px',
        color: '#cbd5e1',
        fontFamily: this.getUIFontFamily(),
        stroke: '#0b1220',
        strokeThickness: 2,
      }).setDepth(1002);
      this.villageLayer.add(z);
      this.tweens.add({
        targets: z,
        y: z.y - 14,
        alpha: 0,
        duration: 900,
        onComplete: () => z.destroy(),
      });
      return;
    }

    if (behavior === 'forage') {
      const item = this.add.rectangle(
        container.x + Phaser.Math.Between(7, 12),
        container.y + Phaser.Math.Between(4, 8),
        4,
        4,
        0x22c55e,
        0.8
      ).setDepth(1002);
      this.villageLayer.add(item);
      this.tweens.add({
        targets: item,
        x: item.x + Phaser.Math.Between(8, 14),
        y: item.y - Phaser.Math.Between(6, 10),
        alpha: 0,
        duration: 420,
        onComplete: () => item.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        x: { from: sprite.x, to: sprite.x + Phaser.Math.Between(-2, 2) },
        duration: 220,
        yoyo: true,
      });
      return;
    }

    if (behavior === 'adventure') {
      const spark = this.add.star(
        container.x + Phaser.Math.Between(8, 14),
        container.y - Phaser.Math.Between(4, 12),
        4,
        1.5,
        4.2,
        0xfda4af,
        0.88
      ).setDepth(1002);
      this.villageLayer.add(spark);
      this.tweens.add({
        targets: spark,
        angle: Phaser.Math.Between(120, 220),
        scale: { from: 0.9, to: 1.7 },
        alpha: 0,
        duration: 520,
        onComplete: () => spark.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        angle: { from: -11, to: 11 },
        duration: 280,
        yoyo: true,
      });
      return;
    }

    if (behavior === 'stroll') {
      const foot = this.add.rectangle(
        container.x + Phaser.Math.Between(-6, 6),
        container.y + 11,
        4,
        2,
        0x94a3b8,
        0.7
      ).setDepth(1002);
      this.villageLayer.add(foot);
      this.tweens.add({
        targets: foot,
        y: foot.y + Phaser.Math.Between(3, 5),
        alpha: 0,
        duration: 280,
        onComplete: () => foot.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        x: { from: sprite.x - 1.6, to: sprite.x + 1.6 },
        duration: 250,
        yoyo: true,
      });
      return;
    }

    this.tweens.add({
      targets: sprite,
      y: { from: sprite.y, to: sprite.y - 1.6 },
      duration: 180,
      yoyo: true,
    });
  }

  private clearResidentAssistTask(): void {
    if (!this.residentAssistTask) return;
    this.residentAssistTask.marker?.destroy();
    this.residentAssistTask = null;
    this.pendingResidentAssist = null;
  }

  private updateResidentAssistTask(): void {
    if (!this.residentAssistTask) return;
    if (gameState.data.isNight) {
      this.clearResidentAssistTask();
      return;
    }
    if (this.time.now >= this.residentAssistTask.expiresAt) {
      this.clearResidentAssistTask();
      return;
    }
    const container = this.baseResidents.get(this.residentAssistTask.companionId);
    if (!container?.active || !container.visible) {
      this.clearResidentAssistTask();
      return;
    }
    const currentBehavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
    if (currentBehavior !== this.residentAssistTask.behavior) {
      this.clearResidentAssistTask();
      return;
    }
    this.residentAssistTask.marker.setPosition(container.x, container.y - 48);
    if (Math.random() < 0.06) {
      this.residentAssistTask.marker.setAlpha(0.72 + Math.random() * 0.28);
    }
  }

  private spawnResidentAssistTask(companionId: string, behavior: ResidentBehavior, chainStep: 1 | 2 = 1): boolean {
    if (this.residentAssistTask || gameState.data.isNight) return false;
    const container = this.baseResidents.get(companionId);
    if (!container?.active || !container.visible) return false;

    const rewardMap: Record<ResidentBehavior, { resource: keyof Resources; amount: [number, number]; exp: [number, number]; text: string }> = {
      fishing: { resource: 'food', amount: [1, 2], exp: [3, 7], text: '抛竿协助' },
      cooking: { resource: 'food', amount: [1, 2], exp: [4, 8], text: '切配协助' },
      guard: { resource: 'ammo', amount: [1, 2], exp: [5, 9], text: '哨岗校准' },
      forage: { resource: 'wood', amount: [1, 2], exp: [3, 7], text: '拾荒协助' },
      adventure: { resource: 'scrap', amount: [1, 2], exp: [6, 10], text: '探险支援' },
      sleep: { resource: 'water', amount: [1, 1], exp: [2, 4], text: '休息协助' },
      stroll: { resource: 'water', amount: [1, 1], exp: [2, 4], text: '散步协助' },
    };

    const reward = { ...rewardMap[behavior] };
    if (behavior === 'fishing' && Math.random() < 0.4) {
      reward.resource = 'metal';
      reward.text = '淘金协助';
    } else if (behavior === 'adventure' && Math.random() < 0.55) {
      reward.resource = 'metal';
      reward.text = '矿脉协助';
    }
    const chainMult = chainStep === 2 ? 1.8 : 1;
    const assistLabel = chainStep === 2 ? `连携${reward.text}` : reward.text;
    const marker = this.add.text(container.x, container.y - 48, `E 协助 · ${assistLabel}`, {
      fontSize: '11px',
      color: chainStep === 2 ? '#f97316' : '#facc15',
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#0b1220',
      strokeThickness: 3,
      backgroundColor: '#0b1220cc',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(1003);
    this.villageLayer.add(marker);
    this.tweens.add({
      targets: marker,
      y: marker.y - 2,
      duration: 560,
      yoyo: true,
      repeat: -1,
    });

    this.residentAssistTask = {
      companionId,
      behavior,
      expiresAt: this.time.now + (chainStep === 2 ? 3200 : 6200),
      rewardResource: reward.resource,
      rewardAmount: Math.max(1, Math.round(Phaser.Math.Between(reward.amount[0], reward.amount[1]) * chainMult)),
      rewardExp: Math.max(1, Math.round(Phaser.Math.Between(reward.exp[0], reward.exp[1]) * chainMult)),
      assistLabel,
      chainStep,
      marker,
    };
    return true;
  }

  private maybeCreateResidentAssistTask(companionId: string, behavior: ResidentBehavior): void {
    if (this.residentAssistTask || gameState.data.isNight) return;
    const moraleBoost = this.hasDayBuff('morale') ? 0.16 : 0;
    if (Math.random() > 0.36 + moraleBoost) return;
    if ((behavior === 'sleep' || behavior === 'stroll') && Math.random() > 0.25) return;
    this.spawnResidentAssistTask(companionId, behavior, 1);
  }

  private completeResidentAssistTask(): void {
    if (!this.residentAssistTask) return;
    const task = this.residentAssistTask;
    const container = this.baseResidents.get(task.companionId);
    const name = (container?.getData('residentName') || '伙伴') as string;
    const bonusMult = Math.max(1, 1 + Math.floor((gameState.data.playerLevel || 1) / 12));
    const companion = gameState.data.companions.find((item) => item.id === task.companionId);
    const duty = companion ? this.getCompanionAutoDuty(companion) : 'support';
    const milestone = companion
      ? getCompanionMilestoneBonuses(companion.role || 'tank', Math.max(1, companion.level || 1))
      : getCompanionMilestoneBonuses('tank', 1);
    let supportMul = milestone.dayYieldMul;
    if (duty === 'builder') supportMul *= milestone.constructionSpeedMul;
    else if (duty === 'scavenger') supportMul *= milestone.scavengerYieldMul;
    else if (duty === 'defender') supportMul *= milestone.defenseDamageMul;
    else supportMul *= milestone.supportYieldMul;
    const amount = Math.max(
      1,
      Math.round(task.rewardAmount * bonusMult * this.getRunDayActivityGainMultiplier() * supportMul)
    );
    gameState.addResource(task.rewardResource, amount);
    this.grantExperience(task.rewardExp + Math.floor((gameState.data.currentDay || 1) / 2));
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(
      container?.x || this.player.x,
      (container?.y || this.player.y) - 40,
      `${task.chainStep === 2 ? '连携协助' : '协助成功'} ${name} +${amount}${task.rewardResource === 'food' ? '食物' : task.rewardResource === 'ammo' ? '弹药' : task.rewardResource === 'wood' ? '木材' : task.rewardResource === 'scrap' ? '零件' : task.rewardResource === 'metal' ? '金属' : '资源'}`,
      task.chainStep === 2 ? '#f97316' : '#22c55e',
      false
    );
    const behavior = task.behavior;
    this.clearResidentAssistTask();

    if (!gameState.data.isNight && task.chainStep === 1 && Math.random() < 0.45) {
      const spawned = this.spawnResidentAssistTask(task.companionId, behavior, 2);
      if (spawned) {
        this.showFloatingText(
          container?.x || this.player.x,
          (container?.y || this.player.y) - 58,
          '连携机会！3秒内再次按 E',
          '#f97316',
          false
        );
      }
    }
  }

  private updateDayResidentEconomy(): void {
    if (this.isGameOver || gameState.data.isNight) return;
    if (this.baseResidents.size <= 0) return;
    const now = this.time.now;
    const moraleMul = this.hasDayBuff('morale') ? 1.28 : 1;
    const runMul = this.getRunDayActivityGainMultiplier();
    const roster = gameState.data.companions.filter((c) => c.status === 'base');
    const activeResidents = Array.from(this.baseResidents.entries())
      .filter(([, container]) => container.active && container.visible && !container.getData('constructionBusy'));
    if (activeResidents.length <= 0) return;

    Phaser.Utils.Array.Shuffle(activeResidents);
    const takeCount = Math.min(2, activeResidents.length);
    let hadGain = false;

    for (let i = 0; i < takeCount; i += 1) {
      const [companionId, container] = activeResidents[i];
      const companion = gameState.data.companions.find((c) => c.id === companionId);
      const profileMul = companion
        ? CompanionPersonalitySystem.getDayEfficiencyMultiplier(companion, roster)
        : 1;
      const duty = companion ? this.getCompanionAutoDuty(companion) : 'support';
      const milestone = companion
        ? getCompanionMilestoneBonuses(companion.role || 'tank', Math.max(1, companion.level || 1))
        : getCompanionMilestoneBonuses('tank', 1);
      const nextAt = this.residentDayYieldNextAt.get(companionId) || 0;
      if (now < nextAt) continue;
      this.residentDayYieldNextAt.set(companionId, now + Phaser.Math.Between(6800, 10600));

      const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
      const roll = Math.random();
      let resource: keyof Resources | null = null;
      let amount = 0;
      let exp = 1;
      let color = '#a7f3d0';
      let text = '白天产出';

      if (behavior === 'fishing' && roll < 0.72) {
        const fishingRoll = Math.random();
        resource = fishingRoll < 0.28 ? 'metal' : (fishingRoll < 0.56 ? 'water' : 'food');
        amount = Math.max(1, Math.round((Math.random() < 0.2 ? 2 : 1) * moraleMul * profileMul));
        exp = resource === 'metal' ? 3 : 2;
        color = resource === 'metal' ? '#fbbf24' : '#38bdf8';
        text = resource === 'metal'
          ? '河流淘金'
          : (resource === 'water' ? '净水补给' : '渔获补给');
      } else if (behavior === 'cooking' && roll < 0.75) {
        resource = 'food';
        amount = Math.max(1, Math.round((Math.random() < 0.22 ? 2 : 1) * moraleMul * profileMul));
        exp = 2;
        color = '#fb923c';
        text = '厨房出餐';
      } else if (behavior === 'forage' && roll < 0.7) {
        resource = Math.random() < 0.5 ? 'wood' : 'scrap';
        amount = Math.max(1, Math.round((Math.random() < 0.2 ? 2 : 1) * moraleMul * profileMul));
        exp = 2;
        color = '#4ade80';
        text = '野外搜集';
      } else if (behavior === 'adventure' && roll < 0.64) {
        resource = Math.random() < 0.68 ? 'metal' : 'scrap';
        amount = Math.max(1, Math.round((Math.random() < 0.28 ? 2 : 1) * moraleMul * profileMul));
        exp = 3;
        color = resource === 'metal' ? '#c4b5fd' : '#fda4af';
        text = resource === 'metal' ? '山洞挖矿' : '洞穴探险';
      } else if (behavior === 'guard' && roll < 0.56) {
        resource = Math.random() < 0.52 ? 'ammo' : 'scrap';
        amount = Math.max(1, Math.round(1 * moraleMul * profileMul));
        exp = 2;
        color = '#93c5fd';
        text = '哨岗缴获';
      } else if (behavior === 'sleep' && roll < 0.45) {
        resource = Math.random() < 0.5 ? 'medical' : 'water';
        amount = Math.max(1, Math.round(profileMul >= 1.15 ? 2 : 1));
        exp = 2;
        color = '#c4b5fd';
        text = '休整补给';
      } else if (behavior === 'stroll' && roll < 0.45) {
        resource = Math.random() < 0.5 ? 'water' : 'food';
        amount = Math.max(1, Math.round(profileMul >= 1.22 ? 2 : 1));
        exp = 1;
        color = '#cbd5e1';
        text = '社区拾取';
      }

      if (amount > 0) {
        let dutyMul = milestone.dayYieldMul;
        if (duty === 'builder') dutyMul *= milestone.constructionSpeedMul;
        else if (duty === 'scavenger') dutyMul *= milestone.scavengerYieldMul;
        else if (duty === 'defender') dutyMul *= milestone.defenseDamageMul;
        else dutyMul *= milestone.supportYieldMul;
        amount = Math.max(1, Math.round(amount * runMul * dutyMul));
      }

      if (!resource || amount <= 0) continue;
      hadGain = true;
      gameState.addResource(resource, amount);
      this.grantExperience(exp);
      const label: Record<keyof Resources, string> = {
        wood: '木材',
        metal: '金属',
        food: '食物',
        water: '净水',
        scrap: '零件',
        medical: '医疗',
        ammo: '弹药',
        bitcoin: '比特币',
        energyCore: '能量核',
      };
      this.showFloatingText(
        container.x + Phaser.Math.Between(-18, 24),
        container.y - 42 + Phaser.Math.Between(-8, 4),
        `${text} +${amount}${label[resource]}`,
        color,
        false
      );
    }

    if (activeResidents.length >= 2 && Math.random() < 0.3) {
      const pair = Phaser.Utils.Array.Shuffle([...activeResidents]).slice(0, 2);
      const [a, b] = pair;
      if (a && b) {
        const compA = gameState.data.companions.find((c) => c.id === a[0]);
        const compB = gameState.data.companions.find((c) => c.id === b[0]);
        const mx = ((a[1].x + b[1].x) / 2) + Phaser.Math.Between(-8, 8);
        const my = ((a[1].y + b[1].y) / 2) - 26;
        if (compA && compB) {
          const relation = CompanionPersonalitySystem.getRelationship(compA, compB);
          if (relation.kind === 'conflict' && Math.random() < 0.4) {
            const after = CompanionPersonalitySystem.recordInteraction(compA, compB, 'day_conflict');
            const socialText = `${compA.name.split('(')[0]} 与 ${compB.name.split('(')[0]} 争执 (${after.label})`;
            this.showFloatingText(mx, my, socialText, '#fda4af', false);
          } else {
            const after = CompanionPersonalitySystem.recordInteraction(compA, compB, 'day_collab');
            const socialText = Phaser.Utils.Array.GetRandom([
              `伙伴交流战术心得 +1经验 (${after.label})`,
              `伙伴共享情报 +1经验 (${after.label})`,
              `伙伴协作提升士气 +1经验 (${after.label})`,
            ]);
            this.grantExperience(1);
            this.showFloatingText(mx, my, socialText, '#bae6fd', false);
          }
        }
      }
    }

    if (hadGain) {
      events.emit('update-resources', gameState.data.resources);
    }
  }

  private emitBaseLifePulse(): void {
    if (this.isGameOver || gameState.data.isNight) return;
    if (this.baseResidents.size <= 0) return;

    const entries = Array.from(this.baseResidents.entries())
      .filter(([, container]) => !container.getData('constructionBusy'));
    if (entries.length <= 0) return;
    const [companionId, container] = Phaser.Utils.Array.GetRandom(entries);
    if (!container || !container.active) return;
    const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
    const companion = gameState.data.companions.find(c => c.id === companionId);
    const name = companion?.name?.split('(')[0] || '伙伴';
    const hints: Record<ResidentBehavior, { text: string; color: string; icon: string }> = {
      fishing: { text: `${name} 正在河流淘金`, color: '#38bdf8', icon: '◉' },
      cooking: { text: `${name} 正在做饭`, color: '#fb923c', icon: '♨' },
      guard: { text: `${name} 正在巡逻`, color: '#93c5fd', icon: '⚑' },
      sleep: { text: `${name} 在休息`, color: '#c4b5fd', icon: 'Z' },
      forage: { text: `${name} 外出搜集`, color: '#4ade80', icon: '✦' },
      adventure: { text: `${name} 正在山洞挖矿`, color: '#fca5a5', icon: '✧' },
      stroll: { text: `${name} 在散步`, color: '#bfdbfe', icon: '·' },
    };
    const hint = hints[behavior];
    const mood = gameState.data.base.foodDeficit > 0
      ? 'hungry'
      : (gameState.data.base.powerUsed > gameState.data.base.powerCapacity ? 'power_low' : 'normal');
    const recentLines = this.residentRecentChatter.get(companionId) || [];
    const usePersonaLine = !!companion && Math.random() < 0.78;
    const line = (usePersonaLine && companion)
      ? CompanionPersonalitySystem.generateChatter(companion, {
        behavior,
        isNight: false,
        day: gameState.data.currentDay,
        week: gameState.data.currentWeek,
        mood,
      }, recentLines)
      : hint.text;
    if (usePersonaLine && companion) this.rememberResidentChatter(companionId, line);
    const icon = this.add.text(container.x - 40, container.y - 36, hint.icon, {
      fontSize: '14px',
      color: hint.color,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1002);
    const pop = this.add.text(container.x, container.y - 34, line, {
      fontSize: usePersonaLine ? '11px' : '12px',
      color: hint.color,
      fontFamily: this.getUIFontFamily(),
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1002);
    this.tweens.add({
      targets: [pop, icon],
      y: pop.y - 18,
      alpha: 0,
      duration: 1100,
      onComplete: () => {
        pop.destroy();
        icon.destroy();
      },
    });

    // Passive daytime livelihood gains from visible resident behaviors.
    const moraleBoost = this.hasDayBuff('morale') ? 0.14 : 0;
    const gainScale = this.hasDayBuff('morale') ? 1.35 : 1;
    const gainRoll = Math.random();
    if (behavior === 'fishing' && gainRoll < 0.45 + moraleBoost) {
      if (Math.random() < 0.34 + moraleBoost * 0.5) {
        gameState.addResource('metal', Math.max(1, Math.round(1 * gainScale)));
        this.showFloatingText(container.x + 22, container.y - 48, '+淘金', '#fbbf24', false);
      } else {
        gameState.addResource('food', Math.max(1, Math.round(1 * gainScale)));
        if (Math.random() < 0.28 + moraleBoost * 0.5) gameState.addResource('water', 1);
        this.showFloatingText(container.x + 22, container.y - 48, '+食物', '#22c55e', false);
      }
      events.emit('update-resources', gameState.data.resources);
    } else if (behavior === 'cooking' && gainRoll < 0.42 + moraleBoost) {
      gameState.addResource('food', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 22, container.y - 48, '+食物', '#fb923c', false);
    } else if (behavior === 'forage' && gainRoll < 0.48 + moraleBoost) {
      gameState.addResource(Math.random() < 0.5 ? 'wood' : 'scrap', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+材料', '#4ade80', false);
    } else if (behavior === 'adventure' && gainRoll < 0.4 + moraleBoost) {
      gameState.addResource(Math.random() < 0.7 ? 'metal' : 'scrap', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+挖矿发现', '#fda4af', false);
    } else if (behavior === 'guard' && gainRoll < 0.25 + moraleBoost * 0.7) {
      gameState.addResource('ammo', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+弹药', '#93c5fd', false);
    }

    this.maybeCreateResidentAssistTask(companionId, behavior);
  }

  private maybeEmitDayLifeAtmosphere(): void {
    if (this.isGameOver || gameState.data.isNight) return;
    if (this.runEventOpen || this.levelUpPanelOpen || this.daySpotMiniGameOpen) return;

    const now = this.time.now;
    const expiredSpotIds: string[] = [];
    this.daySpotBonuses.forEach((bonus, spotId) => {
      if (bonus.expiresAt <= now) expiredSpotIds.push(spotId);
    });
    if (expiredSpotIds.length > 0) {
      expiredSpotIds.forEach((spotId) => this.daySpotBonuses.delete(spotId));
      this.updateExplorationSpotStatus(true);
    }

    const shouldSpawnHotspot = Math.random() < 0.58 && this.explorationSpots.length > 0;
    if (shouldSpawnHotspot) {
      const spotCandidates = this.explorationSpots.filter((spot) => {
        if (this.getActiveDaySpotBonus(spot.id)) return false;
        if (this.getActivityUsage(spot.actionType) >= this.getActivityUsageLimit(spot.actionType)) return false;
        const cooldownLeft = spot.cooldown - (now - spot.lastInteract);
        return cooldownLeft <= 7000;
      });
      if (spotCandidates.length > 0) {
        const spot = Phaser.Utils.Array.GetRandom(spotCandidates);
        const bonusPool: Record<ExplorationActionType, Omit<DayLifeSpotBonus, 'expiresAt'>[]> = {
          fish: [
            { label: '河岸抛竿赛', summary: '收益+28% 风险+6%', rewardMul: 1.28, dangerMul: 1.06, bonusXp: 4, color: '#22d3ee' },
            { label: '鱼群回潮', summary: '收益+20% 风险不变', rewardMul: 1.2, dangerMul: 1.0, bonusXp: 3, color: '#38bdf8' },
          ],
          swim: [
            { label: '急流冲刺', summary: '收益+18% 风险+12%', rewardMul: 1.18, dangerMul: 1.12, bonusXp: 4, color: '#60a5fa' },
            { label: '浅滩救援', summary: '收益+16% 风险+4%', rewardMul: 1.16, dangerMul: 1.04, bonusXp: 3, color: '#93c5fd' },
          ],
          hunt: [
            { label: '追踪脚印', summary: '收益+24% 风险+18%', rewardMul: 1.24, dangerMul: 1.18, bonusXp: 5, color: '#4ade80' },
            { label: '林间伏击', summary: '收益+30% 风险+24%', rewardMul: 1.3, dangerMul: 1.24, bonusXp: 6, color: '#22c55e' },
          ],
          scavenge: [
            { label: '民宅线索', summary: '收益+26% 风险+15%', rewardMul: 1.26, dangerMul: 1.15, bonusXp: 5, color: '#f59e0b' },
            { label: '黑市暗门', summary: '收益+34% 风险+22%', rewardMul: 1.34, dangerMul: 1.22, bonusXp: 7, color: '#f97316' },
          ],
          cave_explore: [
            { label: '异响回廊', summary: '收益+32% 风险+26%', rewardMul: 1.32, dangerMul: 1.26, bonusXp: 7, color: '#a78bfa' },
            { label: '深层矿脉', summary: '收益+40% 风险+35%', rewardMul: 1.4, dangerMul: 1.35, bonusXp: 9, color: '#c4b5fd' },
          ],
        };
        const picked = Phaser.Utils.Array.GetRandom(bonusPool[spot.actionType]);
        const bonus: DayLifeSpotBonus = {
          ...picked,
          expiresAt: now + Phaser.Math.Between(16000, 23000),
        };
        this.daySpotBonuses.set(spot.id, bonus);
        this.updateExplorationSpotStatus(true);

        this.tweens.add({
          targets: spot.marker,
          scaleX: { from: 1, to: 1.11 },
          scaleY: { from: 1, to: 1.11 },
          alpha: { from: 1, to: 0.76 },
          duration: 280,
          yoyo: true,
          repeat: 4,
        });
        this.showFloatingText(spot.x, spot.y - 44, `白天热点：${picked.label}`, picked.color, false);
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) <= 280) {
          this.showFloatingText(this.player.x, this.player.y - 56, `${spot.name} 热点开启 · 按E发起小游戏`, '#fbbf24', false);
        }
        return;
      }
    }

    const residents = Array.from(this.baseResidents.entries())
      .filter(([, container]) => container.active && container.visible && !container.getData('constructionBusy'));
    if (residents.length <= 0) return;

    const [companionId, container] = Phaser.Utils.Array.GetRandom(residents);
    const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
    const companion = gameState.data.companions.find((c) => c.id === companionId);
    const name = companion?.name?.split('(')[0] || ((container.getData('residentName') || '伙伴') as string);

    const lifeLinePool: Record<ResidentBehavior, string[]> = {
      fishing: ['正在浅滩淘金', '在比拼抛竿技巧', '把渔获送去炊事台'],
      cooking: ['在分发热汤', '把食材切分装箱', '给巡逻队准备便当'],
      guard: ['在补强路障', '正在轮班巡逻', '检查探照灯电量'],
      sleep: ['在短暂午休', '靠墙打个盹', '整理床位轮休'],
      forage: ['翻到可用零件', '捡回了木料', '推着小车回营'],
      adventure: ['记录矿脉路线', '整理洞穴见闻', '校准随身终端'],
      stroll: ['和邻里打招呼', '在广场散步', '正在喂营地小狗'],
    };
    const line = `${name} ${Phaser.Utils.Array.GetRandom(lifeLinePool[behavior])}`;
    const colorByBehavior: Record<ResidentBehavior, string> = {
      fishing: '#38bdf8',
      cooking: '#fbbf24',
      guard: '#93c5fd',
      sleep: '#c4b5fd',
      forage: '#4ade80',
      adventure: '#fda4af',
      stroll: '#cbd5e1',
    };
    this.showFloatingText(
      container.x + Phaser.Math.Between(-14, 14),
      container.y - 34 + Phaser.Math.Between(-3, 3),
      line,
      colorByBehavior[behavior],
      false
    );
    this.rememberResidentChatter(companionId, line);

    if (Math.random() < 0.2) {
      const rewardByBehavior: Record<ResidentBehavior, keyof Resources> = {
        fishing: Math.random() < 0.36 ? 'metal' : 'food',
        cooking: 'food',
        guard: 'ammo',
        sleep: 'water',
        forage: 'scrap',
        adventure: 'metal',
        stroll: 'water',
      };
      const reward = rewardByBehavior[behavior];
      const rewardName: Record<keyof Resources, string> = {
        wood: '木材',
        metal: '金属',
        food: '食物',
        water: '净水',
        scrap: '零件',
        medical: '医疗',
        ammo: '弹药',
        bitcoin: '比特币',
        energyCore: '能量核',
      };
      gameState.addResource(reward, 1);
      this.grantExperience(1);
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 52, `民生补给 +1${rewardName[reward]}`, '#86efac', false);
    }
    if (!this.residentAssistTask && Math.random() < 0.18) {
      this.maybeCreateResidentAssistTask(companionId, behavior);
    }
  }

  private maybeEmitResidentSocialMoment(): void {
    if (this.isGameOver || gameState.data.isNight) return;
    const activeResidents = Array.from(this.baseResidents.entries())
      .filter(([, container]) => container.active && container.visible && !container.getData('constructionBusy'));
    if (activeResidents.length < 2) return;
    if (Math.random() > 0.72) return;

    const shuffled = Phaser.Utils.Array.Shuffle([...activeResidents]).slice(0, 2);
    const [a, b] = shuffled;
    if (!a || !b) return;

    const compA = gameState.data.companions.find((c) => c.id === a[0]);
    const compB = gameState.data.companions.find((c) => c.id === b[0]);
    if (!compA || !compB) return;

    const relation = CompanionPersonalitySystem.getRelationship(compA, compB);
    const ax = a[1].x;
    const ay = a[1].y;
    const bx = b[1].x;
    const by = b[1].y;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5 - 26;

    if (relation.kind === 'ally') {
      CompanionPersonalitySystem.recordInteraction(compA, compB, 'day_collab');
      this.tweens.add({
        targets: [a[1], b[1]],
        y: '-=2',
        duration: 220,
        yoyo: true,
      });
      this.showFloatingText(mx, my, `默契协作 · ${relation.label}`, '#86efac', false);
      if (Math.random() < 0.5) {
        this.grantExperience(1);
      }
      return;
    }

    if (relation.kind === 'conflict') {
      CompanionPersonalitySystem.recordInteraction(compA, compB, 'day_conflict');
      this.tweens.add({
        targets: a[1],
        x: ax - Phaser.Math.Between(5, 9),
        duration: 180,
        yoyo: true,
      });
      this.tweens.add({
        targets: b[1],
        x: bx + Phaser.Math.Between(5, 9),
        duration: 180,
        yoyo: true,
      });
      this.showFloatingText(mx, my, `拌嘴冲突 · ${relation.label}`, '#fda4af', false);
      return;
    }

    this.showFloatingText(mx, my, '交换情报', '#93c5fd', false);
  }

  private rememberResidentChatter(companionId: string, line: string): void {
    if (!companionId || !line) return;
    const recent = this.residentRecentChatter.get(companionId) || [];
    recent.push(line);
    while (recent.length > 8) recent.shift();
    this.residentRecentChatter.set(companionId, recent);
  }

  private tryEmitRescueChatter(): void {
    const party = gameState.data.companions.filter((c) => c.status === 'party');
    if (party.length <= 0) return;
    const chosen = [...party].sort((a, b) => {
      const ma = CompanionPersonalitySystem.getProfileModifiers(a);
      const mb = CompanionPersonalitySystem.getProfileModifiers(b);
      const sa = (a.role === 'medic' ? 1.35 : 1) * ma.teamwork * ma.nightAccuracy;
      const sb = (b.role === 'medic' ? 1.35 : 1) * mb.teamwork * mb.nightAccuracy;
      return sb - sa;
    })[0];
    if (!chosen) return;
    this.maybeEmitCompanionCombatChatter({ type: 'companion', companionId: chosen.id }, 'rescue');
  }

  private maybeEmitCompanionCombatChatter(
    source: DamageSource,
    type: 'engage' | 'kill' | 'rescue' | 'defend'
  ): void {
    if (source.type !== 'companion' || !source.companionId) return;
    const companion = gameState.data.companions.find((c) => c.id === source.companionId);
    if (!companion) return;

    const now = this.time.now;
    const nextAt = this.companionCombatNextAt.get(companion.id) || 0;
    if (now < nextAt) return;
    this.companionCombatNextAt.set(companion.id, now + Phaser.Math.Between(4200, 7400));

    const roster = gameState.data.companions.filter((c) => {
      if (c.id === companion.id) return false;
      if (type === 'defend') return c.status === 'base';
      return c.status === 'party';
    });
    const recent = this.companionCombatRecentChatter.get(companion.id) || [];
    let partnerCompanion: typeof roster[number] | undefined;
    if (roster.length > 0) {
      partnerCompanion = [...roster].sort((a, b) => (
        CompanionPersonalitySystem.getRelationship(companion, b).score
        - CompanionPersonalitySystem.getRelationship(companion, a).score
      ))[0];
    }
    const partnerName = partnerCompanion
      ? partnerCompanion.name.split('(')[0]
      : CompanionPersonalitySystem.getPreferredPartnerName(companion, [companion, ...roster]);
    if (partnerCompanion) {
      if (type === 'rescue') CompanionPersonalitySystem.recordInteraction(companion, partnerCompanion, 'night_rescue');
      else if (type === 'engage' || type === 'defend') {
        CompanionPersonalitySystem.recordInteraction(companion, partnerCompanion, 'night_cover');
      }
    }
    const line = CompanionPersonalitySystem.generateCombatChatter(
      companion,
      {
        type,
        isNight: gameState.data.isNight,
        day: gameState.data.currentDay,
        week: gameState.data.currentWeek,
        partnerName: partnerName || (roster.length > 1 ? Phaser.Utils.Array.GetRandom(roster).name.split('(')[0] : undefined),
      },
      recent
    );
    recent.push(line);
    while (recent.length > 6) recent.shift();
    this.companionCombatRecentChatter.set(companion.id, recent);

    const x = this.player.x + Phaser.Math.Between(-30, 30);
    const y = this.player.y - Phaser.Math.Between(26, 52);
    this.showFloatingText(x, y - 22, line, '#93c5fd', false);
  }

  // ============================================================
  // LIGHTING
  // ============================================================
  private updateLighting(): void {
    const darkness = this.dayCycleSystem.getDarkness();

    if (darkness <= 0) {
      this.lightingLayer.setVisible(false);
      return;
    }

    this.lightingLayer.setVisible(true);
    this.lightingLayer.clear();
    const tint = gameState.data.isBloodMoon ? 0x200505 : 0x050520;
    this.lightingLayer.fill(tint, darkness);

    // Use erase so lights reveal the scene instead of painting white blobs
    this.lightBrush.setScale(1.1);
    this.lightingLayer.erase(this.lightBrush, this.player.x, this.player.y);

    this.lightBrush.setScale(1.6);
    this.lightingLayer.erase(this.lightBrush, 1000, 750);

    for (const vl of this.villageLights) {
      this.lightBrush.setScale(vl.scale * 0.8);
      this.lightingLayer.erase(this.lightBrush, vl.x, vl.y);
    }

    this.companions.getChildren().forEach(c => {
      const comp = c as Phaser.Physics.Arcade.Sprite;
      this.lightBrush.setScale(0.35);
      this.lightingLayer.erase(this.lightBrush, comp.x, comp.y);
    });
  }

  // ============================================================
  // EVENTS
  // ============================================================
  private onNightStart(): void {
    this.closeDayChallengeSelectionPanel();
    this.closeDayExplorationMiniGame();
    this.closeNightDirectiveSelectionPanel();
    this.daySpotBonuses.clear();
    this.clearResidentAssistTask();
    this.residentDayYieldNextAt.clear();
    this.pendingDayRunEventAfterChallenge = false;
    this.releaseAllConstructionResidents();
    this.activateNightResidentDefense();
    const triggered = this.maybeTriggerRunEvent('night');
    if (triggered) {
      this.pendingNightWaveStartAfterEvent = true;
    } else {
      this.openNightDirectiveSelectionPanel();
    }
    this.updateExplorationSpotStatus(true);
  }

  private onDayStart(): void {
    this.waveSystem.stopWaves();
    this.closeNightDirectiveSelectionPanel();
    this.dayOpsRenownBonuses = gameState.getDayOpsRenownBonuses();
    this.nightDirectiveId = null;
    this.nightDirectiveEffects = {
      playerDamageMul: 1,
      companionDamageMul: 1,
      turretDamageMul: 1,
      residentDamageMul: 1,
      lootMul: 1,
      xpMul: 1,
      enemyPressureMul: 1,
    };
    this.nightDirectivePressureNextAt = 0;
    this.deactivateNightResidentDefense();
    CompanionPersonalitySystem.applyDailyDrift(gameState.data.companions);
    this.residentDayYieldNextAt.clear();
    this.dayActivityUsage.clear();
    this.daySpotBonuses.clear();
    this.dayAdventureChain = 0;
    this.dayAdventureLastAt = 0;
    this.dayChallengeHintCooldownUntil = 0;
    this.pendingDayRunEventAfterChallenge = true;
    this.createOrRefreshDayExplorationChallenge(true);
    this.createOrRefreshDayOpsContracts(true);
    this.updateExplorationSpotStatus(true);
    QuestSystem.updateProgress('survive_time', undefined, 1);
    this.pendingNightWaveStartAfterEvent = false;

    const tick = BaseSystem.applyDailyTick();
    let totalFoodDeficit = Math.max(0, gameState.data.base.foodDeficit || 0);
    const foodMul = this.getRunFoodConsumptionMultiplier();
    let extraFoodDrain = 0;
    if (foodMul > 1.001 && tick.consumption > 0) {
      extraFoodDrain = Math.max(0, Math.floor(tick.consumption * (foodMul - 1)));
      if (extraFoodDrain > 0) {
        const beforeFood = gameState.data.resources.food || 0;
        if (beforeFood >= extraFoodDrain) {
          gameState.spendResource('food', extraFoodDrain);
        } else {
          gameState.data.resources.food = 0;
          gameState.data.base.foodDeficit = (gameState.data.base.foodDeficit || 0) + (extraFoodDrain - beforeFood);
          totalFoodDeficit = Math.max(0, gameState.data.base.foodDeficit || 0);
        }
      }
    } else if (foodMul < 0.999 && tick.consumption > 0) {
      const savedFood = Math.max(0, Math.floor(tick.consumption * (1 - foodMul)));
      if (savedFood > 0) {
        const deficit = Math.max(0, gameState.data.base.foodDeficit || 0);
        if (deficit > 0) {
          const restored = Math.min(deficit, savedFood);
          gameState.data.base.foodDeficit = deficit - restored;
          totalFoodDeficit = gameState.data.base.foodDeficit;
          const remain = savedFood - restored;
          if (remain > 0) gameState.addResource('food', remain);
        } else {
          gameState.addResource('food', savedFood);
        }
      }
    }
    this.syncBaseResidents();
    events.emit('update-resources', gameState.data.resources);

    // Daily summary feedback (delay to avoid overlap with day announcement)
    this.time.delayedCall(3200, () => {
      const w = this.cameras.main.width;
      let y = 90;
      const gainParts: string[] = [];
      Object.entries(tick.production).forEach(([res, amount]) => {
        if (amount <= 0) return;
        const names: Record<string, string> = {
          wood: '木', metal: '金', scrap: '件', food: '食',
          water: '水', medical: '医', ammo: '弹', energyCore: '核',
        };
        gainParts.push(`+${names[res] || res}${amount}`);
      });
      if (tick.jobFood > 0) gainParts.push(`+食${tick.jobFood}`);
      if (tick.jobMedical > 0) gainParts.push(`+医${tick.jobMedical}`);
      if (tick.jobScrap > 0) gainParts.push(`+件${tick.jobScrap}`);
      Object.entries(tick.professionBonus).forEach(([res, amount]) => {
        if (!amount || amount <= 0) return;
        const names: Record<string, string> = {
          wood: '木', metal: '金', scrap: '件', food: '食',
          water: '水', medical: '医', ammo: '弹', energyCore: '核',
        };
        gainParts.push(`+${names[res] || res}${amount}`);
      });
      if (gainParts.length > 0) {
        this.showFloatingText(w / 2, y, `日结算: ${gainParts.join(' ')}`, '#4ade80', true);
        y += 30;
      }
      if (tick.consumption > 0) {
        this.showFloatingText(w / 2, y, `消耗: 食物 -${tick.consumption}`, '#fbbf24', true);
        y += 30;
      }
      if (extraFoodDrain > 0) {
        this.showFloatingText(w / 2, y, `词缀追加消耗: 食物 -${extraFoodDrain}`, '#f97316', true);
        y += 30;
      }
      if (totalFoodDeficit > 0) {
        this.showFloatingText(w / 2, y, `⚠ 缺粮 ${totalFoodDeficit}`, '#ef4444', true);
      }

      const quote = this.getMerchantFactionQuoteProfile();
      const rates = BaseSystem.getDailyExchangeRates(gameState.data.currentDay, quote.rateMul);
      const topRates = (Object.keys(rates) as Array<keyof typeof rates>)
        .sort((a, b) => rates[b] - rates[a])
        .slice(0, 2)
        .map(key => `${BaseSystem.getResourceShortName(key)} ${rates[key].toFixed(3)}₿`)
        .join(' | ');
      const glassesIndex = BaseSystem.getDailyGlassesPriceMultiplier(gameState.data.currentDay, quote.glassesMul);
      this.showFloatingText(
        w / 2,
        y + 30,
        `行情: ${topRates}  ·  镜价指数 x${glassesIndex.toFixed(2)}  ·  派系报价 x${quote.rateMul.toFixed(2)}`,
        '#38bdf8',
        true
      );
      this.showFloatingText(w / 2, y + 60, '白天日常开启：伙伴将持续产出与触发协助事件', '#93c5fd', true);
      this.showFloatingText(w / 2, y + 90, '白天探索升级：地点可手动触发高风险高收益连携事件', '#22d3ee', true);
      if (this.dayExplorationChallenge && !this.dayExplorationChallenge.completed) {
        const qualityText = this.dayExplorationChallenge.targetQuality === 'perfect' ? '完美' : '良好';
        this.showFloatingText(
          w / 2,
          y + 120,
          `今日挑战: ${this.dayExplorationChallenge.branchNameCN} · ${this.dayExplorationChallenge.title} · ${qualityText} ${this.dayExplorationChallenge.required}次`,
          '#67e8f9',
          true
        );
      }
      if (this.activeRunMutators.length > 0) {
        this.showFloatingText(
          w / 2,
          y + (this.dayExplorationChallenge && !this.dayExplorationChallenge.completed ? 150 : 120),
          `本局词缀: ${this.activeRunMutators.map((m) => m.nameCN).join(' · ')}`,
          '#fbbf24',
          true
        );
      }
      if (this.dayOpsContracts.length > 0) {
        const ops = this.dayOpsContracts
          .map((contract) => {
            const stageCN = contract.stage === 'prep'
              ? '前置'
              : contract.stage === 'execute'
                ? '执行'
                : contract.stage === 'handoff'
                  ? '交付'
                  : '完成';
            return `${stageCN}:${contract.title} ${contract.progress}/${contract.target}`;
          })
          .join('  |  ');
        this.showFloatingText(
          w / 2,
          y + (this.activeRunMutators.length > 0
            ? (this.dayExplorationChallenge && !this.dayExplorationChallenge.completed ? 180 : 150)
            : (this.dayExplorationChallenge && !this.dayExplorationChallenge.completed ? 150 : 120)),
          `白天委托链: ${ops} · 永久声望Lv.${gameState.getDayOpsRenown()}`,
          '#f97316',
          true
        );
      }
    });
  }

  private onLevelUp(): void {
    // Emit to UIScene to show LevelUpPanel there (UIScene is on top for input)
    this.levelUpPanelOpen = true;
    events.emit('show-levelup-panel');
  }

  private onLevelUpChoice(choice: any): void {
    this.levelUpPanelOpen = false;
    const w = this.cameras.main.width;
    this.showFloatingText(w / 2, 120, `获得: ${choice.nameCN}`, '#fbbf24', true);
    if (choice?.milestoneTitleCN && choice?.milestoneLevel) {
      this.showFloatingText(
        w / 2,
        146,
        `武器跃迁 · Lv.${choice.milestoneLevel} ${choice.milestoneTitleCN}`,
        '#22c55e',
        true
      );
      if (choice?.milestoneDetailCN) {
        this.showFloatingText(
          w / 2,
          172,
          choice.milestoneDetailCN,
          '#86efac',
          true
        );
      }
      this.cameras.main.flash(220, 120, 255, 180);
    }
    if (choice?.type === 'upgrade_protocol') {
      const protocolId = (choice.protocolId || choice.id) as LevelUpProtocolId;
      const level = EvolutionSystem.getProtocolLevel(protocolId);
      const bonuses = EvolutionSystem.getProtocolCombatBonuses();
      this.showFloatingText(
        w / 2,
        146,
        `战斗协议升级: ${choice.nameCN} Lv.${level}${choice.maxLevel ? `/${choice.maxLevel}` : ''}`,
        '#22d3ee',
        true
      );
      this.showFloatingText(
        w / 2,
        172,
        `弹幕强度+${bonuses.patternPower} · 触发率x${bonuses.signatureRateMul.toFixed(2)} · 伙伴x${bonuses.companionDamageMul.toFixed(2)}`,
        '#67e8f9',
        true
      );
      this.triggerProtocolLevelFeedback(protocolId, level, choice.maxLevel);
    }
    this.applyDynamicPlayerUpgradeBonuses(true);
    this.triggerLevelPowerSurge(choice.nameCN || '强化');

    // Check evolution
    const evolutions = EvolutionSystem.checkEvolutions();
    for (const evo of evolutions) {
      const evoDef = WEAPON_DEFS[evo.evolvedId];
      if (evoDef) {
        this.showFloatingText(w / 2, 160, `🌟 武器进化: ${evoDef.nameCN}!`, '#f59e0b', true);
        this.cameras.main.flash(500, 255, 200, 0);
      }
    }
  }

  private onQuestCompleted(data: any): void {
    const w = this.cameras.main.width;
    this.showFloatingText(w / 2, 80, `✅ 任务完成!`, '#4ade80', true);
    const rewards = data?.rewards || {};
    const parts: string[] = [];
    if (rewards.resources) {
      Object.entries(rewards.resources).forEach(([k, v]) => {
        const names: Record<string, string> = {
          wood: '木', metal: '金', scrap: '件', food: '食',
          water: '水', medical: '医', ammo: '弹', energyCore: '核', bitcoin: '₿',
        };
        const value = typeof v === 'number' ? (Number.isInteger(v) ? `${v}` : v.toFixed(2)) : `${v}`;
        parts.push(`+${names[k] || k}${value}`);
      });
    }
    if (rewards.xp) parts.push(`+XP${rewards.xp}`);
    if (rewards.skillPoints) parts.push(`+技能点${rewards.skillPoints}`);
    if (parts.length > 0) {
      this.showFloatingText(w / 2, 110, `奖励: ${parts.join(' ')}`, '#fbbf24', true);
    }
  }

  private getLootLegendSeenFlagKey(resourceId: string): string {
    return `loot_legend_seen_${resourceId}`;
  }

  private enqueueLootLegend(resourceId: string): void {
    const codex = LOOT_CODEX_BY_ID[resourceId];
    if (!codex) return;
    const seenFlag = this.getLootLegendSeenFlagKey(resourceId);
    if (gameState.data.storyFlags[seenFlag]) return;
    gameState.data.storyFlags[seenFlag] = true;
    if (this.lootLegendActiveResourceId === resourceId || this.lootLegendQueue.includes(resourceId)) return;
    this.lootLegendQueue.push(resourceId);
    this.tryShowLootLegend();
  }

  private tryShowLootLegend(): void {
    if (this.lootLegendContainer || this.lootLegendQueue.length <= 0) return;
    const resourceId = this.lootLegendQueue.shift();
    if (!resourceId) return;
    this.lootLegendActiveResourceId = resourceId;
    this.lootLegendAutoCloseTimer?.remove(false);
    this.lootLegendAutoCloseTimer = null;

    const codex = LOOT_CODEX_BY_ID[resourceId];
    const iconKey = codex?.iconKey || 'loot_scrap';
    const style = codex ? {
      name: codex.nameCN,
      desc: codex.usageCN,
      color: codex.accentColor,
      colorText: codex.accentText,
    } : {
      name: resourceId,
      desc: '资源图例已解锁',
      color: 0x67e8f9,
      colorText: '#67e8f9',
    };

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const x = w - 186;
    const y = h - (this.mobileViewport ? 190 : 166);
    const container = this.add.container(0, 0).setDepth(3430).setScrollFactor(0).setAlpha(0);
    this.lootLegendContainer = container;

    const bg = this.add.rectangle(x, y, 320, 94, 0x020617, 0.94)
      .setStrokeStyle(2, style.color, 0.9)
      .setInteractive({ useHandCursor: true });
    const iconPlate = this.add.rectangle(x - 126, y, 54, 54, 0x0b1220, 0.96)
      .setStrokeStyle(1, style.color, 0.85);
    const icon = this.textures.exists(iconKey)
      ? this.add.image(x - 126, y, iconKey).setScale(1.35)
      : this.add.image(x - 126, y, 'loot_scrap').setScale(1.35);
    const title = this.add.text(x - 92, y - 32, `图例解锁 · ${style.name}`, {
      fontSize: this.worldFs(16, 13),
      color: style.colorText,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    const desc = this.add.text(x - 92, y - 8, style.desc, {
      fontSize: this.worldFs(14, 12),
      color: '#cbd5e1',
      fontFamily: this.getUIFontFamily(),
      wordWrap: { width: 215 },
    }).setOrigin(0, 0);
    const tip = this.add.text(x + 134, y + 30, '点击关闭', {
      fontSize: this.worldFs(12, 10),
      color: '#64748b',
      fontFamily: this.getUIFontFamily(),
    }).setOrigin(1, 1);
    container.add([bg, iconPlate, icon, title, desc, tip]);

    const closeLegend = () => {
      this.lootLegendAutoCloseTimer?.remove(false);
      this.lootLegendAutoCloseTimer = null;
      this.tweens.add({
        targets: container,
        alpha: 0,
        y: '-=8',
        duration: 180,
        onComplete: () => {
          container.destroy();
          if (this.lootLegendContainer === container) {
            this.lootLegendContainer = null;
          }
          this.lootLegendActiveResourceId = null;
          if (this.lootLegendQueue.length > 0) {
            this.time.delayedCall(120, () => this.tryShowLootLegend());
          }
        },
      });
    };
    bg.on('pointerdown', closeLegend);
    this.tweens.add({ targets: container, alpha: 1, duration: 180 });
    this.lootLegendAutoCloseTimer = this.time.delayedCall(3600, closeLegend);
  }

  private onLootCollected(data: { type: string; amount: number }): void {
    if (!data || !data.type) return;
    const amount = Math.max(1, data.amount || 1);
    this.lootCodexCollected[data.type] = (this.lootCodexCollected[data.type] || 0) + amount;
    this.enqueueLootLegend(data.type);
    events.emit('loot-codex-updated');
    QuestSystem.updateProgress('collect', data.type, amount);

    const names: Record<string, { label: string; color: string }> = {
      wood: { label: '木材', color: '#f59e0b' },
      metal: { label: '金属', color: '#93c5fd' },
      food: { label: '食物', color: '#fbbf24' },
      water: { label: '净水', color: '#38bdf8' },
      scrap: { label: '零件', color: '#cbd5e1' },
      medical: { label: '医疗', color: '#f87171' },
      ammo: { label: '弹药', color: '#fb923c' },
      energyCore: { label: '能量核', color: '#c4b5fd' },
    };
    const entry = names[data.type] || { label: data.type, color: '#e2e8f0' };
    this.enqueueResourceFloatingToast(data.type, entry.label, entry.color, amount);
  }

  private onCompanionStatusChanged(data: { id: string; status: 'party' | 'base' }): void {
    const comp = gameState.data.companions.find(c => c.id === data.id);
    if (!comp) return;
    comp.status = data.status;
    if (data.status === 'party') {
      comp.job = 'idle';
      this.syncCompanionPresence();
      this.syncBaseResidents();
      this.showFloatingText(this.player.x, this.player.y - 30, `${comp.name} 出战`, '#38bdf8', false);
    } else {
      comp.autoDuty = BaseSystem.getCompanionAutoDuty(comp);
      if (gameState.data.autoBuild.autoAssignDuties) {
        BaseSystem.autoAssignBaseCompanions();
      }
      this.syncCompanionPresence();
      this.syncBaseResidents();
      this.showFloatingText(this.player.x, this.player.y - 30, `${comp.name} 驻守基地`, '#fbbf24', false);
    }
    BaseSystem.refreshBaseState();
    this.syncCompanionRoster();
  }

  private onCompanionBulkStatusChanged(data: { status: 'party' | 'base' }): void {
    const nextStatus = data.status;
    let changed = 0;
    gameState.data.companions.forEach((comp) => {
      if (comp.status === nextStatus) return;
      comp.status = nextStatus;
      if (nextStatus === 'party') comp.job = 'idle';
      if (nextStatus === 'base') comp.autoDuty = BaseSystem.getCompanionAutoDuty(comp);
      changed += 1;
    });
    if (changed <= 0) return;

    if (nextStatus === 'base') {
      if (gameState.data.autoBuild.autoAssignDuties) {
        BaseSystem.autoAssignBaseCompanions();
      }
      this.showFloatingText(this.player.x, this.player.y - 30, `全部伙伴转为驻守 (${changed})`, '#fbbf24', false);
    } else {
      this.showFloatingText(this.player.x, this.player.y - 30, `全部伙伴转为出战 (${changed})`, '#38bdf8', false);
    }

    this.syncCompanionPresence();
    this.syncBaseResidents();
    BaseSystem.refreshBaseState();
    this.syncCompanionRoster();
  }

  private onCompanionJobChanged(data: { id: string; job: string }): void {
    const comp = gameState.data.companions.find(c => c.id === data.id);
    if (!comp) return;
    comp.job = data.job as any;
    BaseSystem.refreshBaseState();
    this.syncBaseResidents();
    const jobNames: Record<string, string> = {
      idle: '空闲',
      kitchen: '厨房',
      farm: '农场',
      power: '供电',
      medical: '医疗',
      workshop: '工坊',
    };
    this.showFloatingText(this.player.x, this.player.y - 30, `${comp.name} → ${jobNames[data.job] || data.job}`, '#a78bfa', false);
  }

  private onAutoBuildConfigUpdated(payload?: { enabled?: boolean; ruleCount?: number; builders?: number }): void {
    BaseSystem.refreshBaseState();
    const enabled = payload?.enabled ?? gameState.data.autoBuild.enabled;
    const ruleCount = payload?.ruleCount ?? gameState.data.autoBuild.rules.filter((rule) => rule.enabled && rule.targetCount > 0).length;
    const builders = payload?.builders ?? Math.max(0, Math.floor(gameState.data.autoBuild.desiredBuilderCount || 0));
    this.showFloatingText(
      this.player.x,
      this.player.y - 54,
      enabled ? `自动建造启用 · 目标${ruleCount}项 · 施工${builders}` : '自动建造已停用',
      enabled ? '#67e8f9' : '#94a3b8',
      false
    );
  }

  private updateHomingBullets(): void {
    const updateGroup = (group: Phaser.Physics.Arcade.Group) => group.getChildren().forEach(b => {
      const bullet = b as Phaser.Physics.Arcade.Sprite;
      if (!(bullet as any).isHoming || !bullet.active) return;
      const anyBullet = bullet as any;
      const body = bullet.body as Phaser.Physics.Arcade.Body | null;
      let target = anyBullet.homingTarget as Phaser.Physics.Arcade.Sprite | null;
      if (!target || !target.active) {
        target = this.enemySystem.findNearestEnemy(bullet.x, bullet.y, 320);
        anyBullet.homingTarget = target;
      }
      if (target) {
        const angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, target.x, target.y);
        const currentSpeed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
        const speed = Phaser.Math.Clamp(currentSpeed || 320, 220, 900);
        bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      }
    });
    updateGroup(this.bullets);
    updateGroup(this.companionBullets);
    updateGroup(this.turretBullets);
    updateGroup(this.vsBullets);
  }

  // ============================================================
  // GAME OVER
  // ============================================================
  private gameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.closeDayChallengeSelectionPanel();
    this.closeDayExplorationMiniGame();
    this.waveSystem.stopWaves();
    this.playPlayerAction('death', true, 2400);

    // Screen shake and flash
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(500, 255, 0, 0);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const banked = gameState.bankRunBitcoin();

    // Fade-in overlay
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
      .setScrollFactor(0).setDepth(2500);
    this.tweens.add({ targets: overlay, alpha: 0.85, duration: 800 });

    // Title with scale-in
    const title = this.add.text(w / 2, h / 2 - 140, '💀 AR连接中断 💀', {
      fontSize: '42px', color: '#ef4444', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0).setScale(0.5);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 600, delay: 500, ease: 'Back.easeOut' });

    // Grade with special animation
    const stats = gameState.data.stats;
    const grade = this.calculateGrade();
    const gradeColors: Record<string, string> = {
      'S+': '#f59e0b', 'S': '#fbbf24', 'A': '#4ade80', 'B': '#38bdf8', 'C': '#a78bfa', 'D': '#94a3b8',
    };
    const gradeText = this.add.text(w / 2, h / 2 - 80, grade, {
      fontSize: '64px', color: gradeColors[grade] || '#94a3b8',
      fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0).setScale(3);
    this.tweens.add({ targets: gradeText, alpha: 1, scale: 1, duration: 800, delay: 900, ease: 'Back.easeOut' });

    // Stats table
    const survivalMins = Math.floor((stats.survivalTime || 0) / 60);
    const survivalSecs = Math.floor((stats.survivalTime || 0) % 60);
    const statsLines = [
      `存活天数: ${gameState.data.currentDay - 1}  |  时间: ${survivalMins}:${String(survivalSecs).padStart(2, '0')}`,
      `消灭敌人: ${stats.enemiesKilled}  |  Boss击杀: ${stats.bossesKilled}`,
      `最高连击: ${stats.highestCombo}  |  血月幸存: ${stats.bloodMoonsSurvived}`,
      `建筑建造: ${stats.buildingsPlaced}  |  任务完成: ${stats.questsCompleted}`,
      `武器进化: ${stats.weaponsEvolved}  |  伙伴招募: ${stats.companionsRecruited}`,
    ].join('\n');

    const statsTextObj = this.add.text(w / 2, h / 2 + 20, statsLines, {
      fontSize: '16px', color: '#e2e8f0', fontFamily: this.getUIFontFamily(),
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0);
    this.tweens.add({ targets: statsTextObj, alpha: 1, duration: 500, delay: 1400 });

    const btcText = this.add.text(w / 2, h / 2 + 120, `本轮结算: +₿${banked.toFixed(3)}  |  永久账户: ₿${gameState.meta.bitcoinBank.toFixed(3)}`, {
      fontSize: '15px', color: '#fbbf24', fontFamily: this.getUIFontFamily(),
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0);
    this.tweens.add({ targets: btcText, alpha: 1, duration: 500, delay: 1650 });

    // Permanent talent pick (one branch upgrade each loop).
    const choices = gameState.getPermanentTalentChoices();
    let picked = choices.length <= 0;
    const cardY = h / 2 + 200;
    const spacing = 250;
    const cards: Phaser.GameObjects.Rectangle[] = [];
    const labels: Phaser.GameObjects.Text[] = [];
    const selectedMark = this.add.text(0, 0, '已选择', {
      fontSize: '12px', color: '#22c55e', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      backgroundColor: '#052e16', padding: { x: 6, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2503).setVisible(false).setAlpha(0);

    choices.forEach((choice, idx) => {
      const offset = idx - (choices.length - 1) / 2;
      const cx = w / 2 + offset * spacing;
      const card = this.add.rectangle(cx, cardY, 230, 108, 0x0f172a, 0.92)
        .setStrokeStyle(2, 0x334155)
        .setScrollFactor(0)
        .setDepth(2502)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0);
      const label = this.add.text(
        cx,
        cardY,
        `${choice.branchCN} · ${choice.nameCN}\nLv.${choice.level} → Lv.${choice.nextLevel}/${choice.maxLevel}\n${choice.descCN}`,
        {
          fontSize: '12px',
          color: '#e2e8f0',
          fontFamily: this.getUIFontFamily(),
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: 214 },
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(2503).setAlpha(0);
      if (choice.branch === 'turret') {
        card.setStrokeStyle(2, 0x22d3ee, 0.8);
      } else if (choice.branch === 'companion') {
        card.setStrokeStyle(2, 0x34d399, 0.8);
      } else if (choice.branch === 'economy') {
        card.setStrokeStyle(2, 0xf59e0b, 0.8);
      }
      if (choice.level <= 0) {
        label.setColor('#bae6fd');
      } else {
        label.setColor('#e2e8f0');
      }
      cards.push(card);
      labels.push(label);

      card.on('pointerover', () => {
        if (!picked) card.setStrokeStyle(2, 0x38bdf8);
      });
      card.on('pointerout', () => {
        if (!picked) card.setStrokeStyle(2, 0x334155);
      });
      card.on('pointerdown', () => {
        if (picked) return;
        const res = gameState.applyPermanentTalentChoice(choice.id);
        if (!res) return;
        picked = true;
        this.permanentTalentBonuses = gameState.getPermanentTalentBonuses();
        selectedMark.setPosition(cx, cardY + 48).setVisible(true).setAlpha(1);
        cards.forEach(c => c.disableInteractive());
        card.setStrokeStyle(2, 0x22c55e);
        restartBtn.setText('[ 重新觉醒 ]').setColor('#0ea5e9');
        this.showFloatingText(w / 2, h / 2 + 260, `${res.branchCN} · ${res.nameCN} 升至 Lv.${res.level}/${res.maxLevel}`, '#22c55e', true);
      });
    });

    if (choices.length <= 0) {
      this.showFloatingText(w / 2, h / 2 + 202, '永久天赋已全部满级', '#94a3b8', true);
    }
    this.tweens.add({ targets: [...cards, ...labels], alpha: 1, duration: 350, delay: 1750 });

    // Restart button
    const restartBtn = this.add.text(w / 2, h / 2 + 286, picked ? '[ 重新觉醒 ]' : '[ 选择永久天赋后重生 ]', {
      fontSize: '22px', color: picked ? '#0ea5e9' : '#64748b', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      backgroundColor: '#0c1829', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setInteractive({ useHandCursor: true }).setAlpha(0);
    this.tweens.add({ targets: restartBtn, alpha: 1, duration: 500, delay: 1800 });

    // Pulse on restart button
    this.tweens.add({
      targets: restartBtn, scale: { from: 1, to: 1.05 },
      duration: 800, yoyo: true, repeat: -1, delay: 2000,
    });

    restartBtn.on('pointerdown', () => {
      if (!picked) {
        this.showFloatingText(w / 2, h / 2 + 320, '先选择一项永久天赋', '#ef4444', true);
        return;
      }
      this.restartGame();
    });
    restartBtn.on('pointerover', () => restartBtn.setColor('#fbbf24'));
    restartBtn.on('pointerout', () => restartBtn.setColor(picked ? '#0ea5e9' : '#64748b'));
  }

  private calculateGrade(): string {
    const s = gameState.data.stats;
    const score = s.enemiesKilled * 10 + s.bossesKilled * 200 + s.questsCompleted * 50 +
      s.buildingsPlaced * 5 + (gameState.data.currentDay - 1) * 30 + s.highestCombo * 5 +
      s.bloodMoonsSurvived * 150 + s.weaponsEvolved * 80 + s.companionsRecruited * 20;

    if (score >= 8000) return 'S+';
    if (score >= 5000) return 'S';
    if (score >= 3000) return 'A';
    if (score >= 1500) return 'B';
    if (score >= 500) return 'C';
    return 'D';
  }

  private restartGame(): void {
    gameState.save();
    // Resume physics before restart (it was paused on death)
    this.physics.resume();
    // Stop CRT overlay to prevent stacking
    try { this.scene.stop('CRTScene'); } catch (_e) { /* ignore */ }
    const restartSelf = () => {
      if (!this.scene.isActive()) return;
      this.time.delayedCall(0, () => {
        if (this.scene.isActive()) this.scene.restart();
      });
    };
    try {
      const uiScene = this.scene.get('UIScene') as Phaser.Scene | null;
      if (uiScene && uiScene.scene.isActive()) {
        uiScene.events.once(Phaser.Scenes.Events.SHUTDOWN, restartSelf);
        this.scene.stop('UIScene');
        return;
      }
    } catch (_e) {
      // fall through to local restart
    }
    restartSelf();
  }

  // ============================================================
  // SHUTDOWN
  // ============================================================
  shutdown(): void {
    events.off(GameEvents.GAME_OVER, this.gameOver, this);
    events.off(GameEvents.PLAYER_HIT);
    events.off(GameEvents.PLAYER_HEAL_REQUEST);
    events.off(GameEvents.NIGHT_START, this.onNightStart, this);
    events.off(GameEvents.DAY_START, this.onDayStart, this);
    events.off(GameEvents.PLAYER_LEVEL_UP, this.onLevelUp, this);
    events.off('levelup-choice-made', this.onLevelUpChoice, this);
    events.off('quest-completed', this.onQuestCompleted, this);
    events.off(GameEvents.LOOT_COLLECTED, this.onLootCollected, this);
    events.off('companion-status-changed', this.onCompanionStatusChanged, this);
    events.off('companion-bulk-status-changed', this.onCompanionBulkStatusChanged, this);
    events.off('companion-job-changed', this.onCompanionJobChanged, this);
    events.off('base-autobuild-updated', this.onAutoBuildConfigUpdated, this);
    events.off('select-build-item', this.onBuildSelection, this);
    events.off('crafting-panel-state', this.onCraftingPanelState, this);
    events.off('mobile-move', this.onMobileMove, this);
    events.off('mobile-interact', this.onMobileInteract, this);
    events.off('mobile-toggle-build', this.onMobileToggleBuild, this);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.dayCycleSystem?.destroy();
    this.waveSystem?.destroy();
    this.lootSystem?.destroy();
    this.weatherSystem?.destroy();
    this.exitBuildMode();
    this.baseLifePulseTimer?.remove(false);
    this.residentSocialPulseTimer?.remove(false);
    this.baseRoutineTimer?.remove(false);
    this.dayResidentEconomyTimer?.remove(false);
    this.dayLifePulseTimer?.remove(false);
    this.baseLifePulseTimer = null;
    this.residentSocialPulseTimer = null;
    this.baseRoutineTimer = null;
    this.dayResidentEconomyTimer = null;
    this.dayLifePulseTimer = null;
    this.clearConstructionSiteVisuals();
    this.constructionAssignedResidents.clear();
    this.residentDayYieldNextAt.clear();
    this.daySpotBonuses.clear();
    this.dayExplorationChallenge = null;
    this.dayChallengeHintCooldownUntil = 0;
    this.scavengeDurabilityStacks = 0;
    this.scavengeDurabilityPenaltyUntil = 0;
    this.scavengeDurabilityPenaltyStartAt = 0;
    this.scavengeDurabilityPenaltyDurationMs = 0;
    this.companionCombatRecentChatter.clear();
    this.companionCombatNextAt.clear();
    this.clearResidentAssistTask();
    this.clearExplorationEdgeIndicators();
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;
    this.runEventOpen = false;
    this.runEventRecentHistory = [];
    this.runEventRecentLorePieces = [];
    this.runEventActiveLoreSnippet = null;
    this.runEventMissStreak = { day: 0, night: 0 };
    this.runEventLastTriggerDay = { day: -99, night: -99 };
    this.runEventLastAnyTriggerDay = -99;
    this.runEventLastAnyTriggerPeriod = null;
    this.runEventGlobalCooldownUntilDay = 1;
    this.runEventCurrentChapter = 1;
    this.runEventFactionStanding = {
      survivorUnion: 0,
      tradeRing: 0,
      citadelAI: 0,
      labRemnant: 0,
      mutantSwarm: 0,
    };
    this.nightDirectiveAutoPickTimer?.remove(false);
    this.nightDirectiveAutoPickTimer = null;
    this.nightDirectiveSelectionContainer?.destroy();
    this.nightDirectiveSelectionContainer = null;
    this.nightDirectiveSelectionOpen = false;
    this.nightDirectiveId = null;
    this.dayOpsContracts = [];
    this.dayOpsNightPrepStacks = 0;
    this.dayChallengeBranchRecentActions = { stable: [], adventure: [], extreme: [] };
    this.battleMomentum = 0;
    this.battleMomentumBoostUntil = 0;
    this.battleMomentumPulseAt = 0;
    this.nextGearResonanceCheckAt = 0;
    this.gearResonanceSignature = '';
    this.gearResonanceDamageMul = 1;
    this.gearResonanceFireRateMul = 1;
    this.gearResonanceSpeedMul = 1;
    this.gearResonanceProjectileBonus = 0;
    this.gearResonanceLootMul = 1;
    this.closeDayChallengeSelectionPanel();
    this.closeDayExplorationMiniGame();
    this.protocolAuraContainer?.destroy();
    this.protocolAuraContainer = null;
    this.protocolAuraInner = null;
    this.protocolAuraOuter = null;
    this.protocolAuraNodes = [];
    this.protocolAuraLevel = 0;
    this.protocolAuraBoostUntil = 0;
    this.protocolAuraPulseAt = 0;
    this.setUISceneInputEnabled(true);
    this.pendingNightWaveStartAfterEvent = false;
    this.pendingDayRunEventAfterChallenge = false;
    this.playerSystem?.setVirtualDirection(0, 0);
    (window as any).__force_bloodmoon_test = undefined;
    (window as any).__debug_trigger_run_event = undefined;
    (window as any).__debug_show_loot_legend = undefined;
    (window as any).__debug_spawn_loot_preview = undefined;
    (window as any).__debug_open_cave_raid = undefined;
    (window as any).__debug_open_forest_hunt = undefined;
    (window as any).__debug_open_city_scavenge = undefined;
    (window as any).__in_game = false;
  }
}
