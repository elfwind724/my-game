/**
 * GameScene - Central coordinator
 * Delegates to systems: DayCycle, Wave, Loot, Build, Weapon, Companion, Enemy, Player
 * Manages physics groups, collisions, and inter-system communication
 */
import Phaser from 'phaser';
import { gameState, type Resources, type CompanionData, type PermanentTalentBonuses } from '../state/GameState';
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
import { EvolutionSystem } from '../systems/EvolutionSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { BaseSystem } from '../systems/BaseSystem';
import { CompanionPersonalitySystem } from '../systems/CompanionPersonalitySystem';
import { GearLootSystem } from '../systems/GearLootSystem';
import { BASE_POWER_PER_TURRET } from '../data/base';
import { BUILDING_DEFS } from '../data/buildings';
import { WEAPON_DEFS } from '../data/weapons';
import { CompanionConfig } from '../types/SkillTypes';

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

type RunEventPeriod = 'day' | 'night';

interface RunEventChoiceDef {
  id: string;
  titleCN: string;
  detailCN: string;
  resources?: Partial<Record<keyof Resources, [number, number]>>;
  xp?: [number, number];
  heal?: [number, number];
  selfDamage?: [number, number];
  spawnEnemies?: [number, number];
  bitcoin?: [number, number];
}

interface RunEventDef {
  id: string;
  period: RunEventPeriod;
  titleCN: string;
  descCN: string;
  choices: [RunEventChoiceDef, RunEventChoiceDef];
}

const AUTO_LEVEL_COLOR_CYCLE: number[] = [
  0x22d3ee, 0x38bdf8, 0x34d399, 0xfacc15,
  0xfb923c, 0xf472b6, 0xa78bfa, 0xf43f5e,
];

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

const RUN_EVENT_DEFS: RunEventDef[] = [
  {
    id: 'day_caravan_signal',
    period: 'day',
    titleCN: '白天事件：流动商队信号',
    descCN: '一支流动商队靠近基地，通信混乱。你可以交易，也可以强夺。',
    choices: [
      {
        id: 'trade_safe',
        titleCN: '稳妥交易',
        detailCN: '低风险，获得基础补给。',
        resources: { food: [2, 4], water: [1, 3], scrap: [1, 2] },
        xp: [8, 14],
      },
      {
        id: 'raid_risky',
        titleCN: '强夺车队',
        detailCN: '高收益，高风险，可能引来敌袭。',
        resources: { metal: [4, 8], scrap: [4, 8], ammo: [2, 5], medical: [1, 2] },
        xp: [14, 24],
        selfDamage: [5, 11],
        spawnEnemies: [2, 5],
      },
    ],
  },
  {
    id: 'day_abandoned_clinic',
    period: 'day',
    titleCN: '白天事件：废弃诊所',
    descCN: '城区边缘发现一座半坍塌诊所，内部有药械与潜在感染体。',
    choices: [
      {
        id: 'careful_search',
        titleCN: '谨慎搜集',
        detailCN: '慢速清点，收益稳定。',
        resources: { medical: [2, 4], water: [1, 2] },
        xp: [7, 12],
      },
      {
        id: 'force_entry',
        titleCN: '暴力破门',
        detailCN: '高收益但触发骚动。',
        resources: { medical: [4, 8], scrap: [3, 6], energyCore: [0, 1] },
        xp: [14, 22],
        selfDamage: [4, 9],
        spawnEnemies: [3, 6],
      },
    ],
  },
  {
    id: 'night_perimeter_breach',
    period: 'night',
    titleCN: '夜间事件：周界破口',
    descCN: '基地东侧围栏出现破口，需立刻决策。',
    choices: [
      {
        id: 'seal_breach',
        titleCN: '紧急封堵',
        detailCN: '降低压力，收益一般。',
        resources: { wood: [2, 4], ammo: [1, 2] },
        xp: [10, 16],
      },
      {
        id: 'counter_push',
        titleCN: '反冲突击',
        detailCN: '高压反击，收益与风险都更高。',
        resources: { metal: [4, 7], ammo: [3, 6], energyCore: [0, 1] },
        xp: [18, 30],
        selfDamage: [6, 12],
        spawnEnemies: [4, 8],
        bitcoin: [0.03, 0.11],
      },
    ],
  },
  {
    id: 'night_signal_hunt',
    period: 'night',
    titleCN: '夜间事件：异常讯号追踪',
    descCN: '探测到高能信号源，可能是补给缓存，也可能是敌方诱饵。',
    choices: [
      {
        id: 'jam_signal',
        titleCN: '干扰屏蔽',
        detailCN: '保守处理，降低暴露。',
        resources: { scrap: [2, 4], medical: [1, 2] },
        xp: [10, 18],
      },
      {
        id: 'trace_source',
        titleCN: '直扑源头',
        detailCN: '风险最大，潜在回报最高。',
        resources: { energyCore: [1, 2], scrap: [3, 6], metal: [3, 6] },
        xp: [22, 34],
        selfDamage: [7, 13],
        spawnEnemies: [5, 9],
        bitcoin: [0.05, 0.16],
      },
    ],
  },
];

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
  private dayActivityUsage: Map<ExplorationActionType, number> = new Map();
  private explorationStatusNextAt: number = 0;
  private activeRunMutators: RunMutatorDef[] = [];
  private runMutatorEffects: RunMutatorEffects = { ...DEFAULT_RUN_MUTATOR_EFFECTS };
  private permanentTalentBonuses: PermanentTalentBonuses = gameState.getPermanentTalentBonuses();
  private runEventOpen: boolean = false;
  private runEventContainer: Phaser.GameObjects.Container | null = null;
  private pendingNightWaveStartAfterEvent: boolean = false;
  private runEventAutoPickTimer: Phaser.Time.TimerEvent | null = null;

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
  private residentAssistTask: ResidentAssistTask | null = null;
  private residentRecentChatter: Map<string, string[]> = new Map();
  private companionCombatRecentChatter: Map<string, string[]> = new Map();
  private companionCombatNextAt: Map<string, number> = new Map();

  // VS-style multi-weapon fire timers
  private weaponTimers: Map<string, number> = new Map();

  // Combo tracking
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private comboText: Phaser.GameObjects.Text | null = null;
  private killStreakCount: number = 0;
  private lastKillTime: number = 0;
  private turretIdSeed: number = 0;
  private bulletTrailTick: number = 0;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private emergencyExitKey?: Phaser.Input.Keyboard.Key;
  private interactionDebounceUntil: number = 0;
  private weaponMasteryKills: Record<WeaponType, number> = {
    pistol: 0, shotgun: 0, rifle: 0, flamethrower: 0, laser: 0, rocket: 0,
  };
  private weaponMasteryLevels: Record<WeaponType, number> = {
    pistol: 1, shotgun: 1, rifle: 1, flamethrower: 1, laser: 1, rocket: 1,
  };
  private weaponMasteryNextKills: Record<WeaponType, number> = {
    pistol: 14, shotgun: 14, rifle: 14, flamethrower: 14, laser: 14, rocket: 14,
  };
  private arOverdriveCharge: number = 0;
  private arOverdriveActiveUntil: number = 0;
  private arOverdrivePulseAt: number = 0;
  private currentPowerTier: 1 | 2 | 3 = 1;
  private mobileViewport: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 900;
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
    const mobileViewport = this.isMobileViewport();
    const mobilePortrait = mobileViewport && this.scale.height > this.scale.width;
    this.mobileViewport = mobileViewport;

    // Reset state
    gameState.resetRun();
    this.permanentTalentBonuses = gameState.getPermanentTalentBonuses();
    this.activeRunMutators = [];
    this.runMutatorEffects = { ...DEFAULT_RUN_MUTATOR_EFFECTS };
    this.runEventOpen = false;
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;
    this.pendingNightWaveStartAfterEvent = false;
    this.rollRunMutators();
    this.isGameOver = false;
    this.isBuildMode = false;
    this.comboCount = 0;
    this.comboTimer = 0;
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
    this.turretIdSeed = 0;
    this.isCraftingPanelOpen = false;
    this.bulletTrailTick = 0;
    this.resetWeaponMasteryProgress();
    this.arOverdriveCharge = 0;
    this.arOverdriveActiveUntil = 0;
    this.arOverdrivePulseAt = 0;
    this.currentPowerTier = 1;
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
    this.facilityOccupants.clear();
    this.residentDayYieldNextAt.clear();
    this.residentDefenseNextFireAt.clear();
    this.residentNightAnchorIndex.clear();
    this.residentRecentChatter.clear();
    this.companionCombatRecentChatter.clear();
    this.companionCombatNextAt.clear();
    this.dayActivityUsage.clear();
    this.explorationStatusNextAt = 0;
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
    this.player = this.physics.add.sprite(1000, 750, 'player');
    const playerFrame = this.player.frame;
    const nativeH = Math.max(1, playerFrame?.height || 32);
    const playerScale = Phaser.Math.Clamp(34 / nativeH, 1.0, 1.45);
    this.player.setScale(playerScale);
    this.player.setData('baseScaleX', playerScale);
    this.player.setData('baseScaleY', playerScale);
    this.player.setCollideWorldBounds(true);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setSize(16, 22);
    playerBody.setOffset(8, 10);
    playerBody.setMaxVelocity(200);
    this.cameras.main.startFollow(this.player);
    const portraitAspect = this.scale.height / Math.max(1, this.scale.width);
    const portraitZoom = portraitAspect >= 1.9 ? 1.32 : 1.26;
    this.cameras.main.setZoom(mobileViewport ? (mobilePortrait ? portraitZoom : 0.98) : 1);

    // Physics groups
    this.enemies = this.physics.add.group();
    const bulletPoolSize = mobileViewport ? (mobilePortrait ? 700 : 820) : 1200;
    const vsBulletPoolSize = mobileViewport ? (mobilePortrait ? 1100 : 1300) : 2000;
    const companionBulletPoolSize = mobileViewport ? (mobilePortrait ? 220 : 260) : 400;
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

    // Initialize systems
    this.weatherSystem = new WeatherSystem(this);
    this.weatherSystem.enable();
    this.animationSystem = new AnimationSystem(this);
    this.weaponSystem = new WeaponSystem(this, this.bullets, [this.walls, this.turrets], []);
    this.companionSystem = new CompanionSystem(this, this.companions, this.player);
    this.enemySystem = new EnemySystem(this, this.enemies, this.player);
    this.cursors = this.input.keyboard!.createCursorKeys();

    const upgrades = { fireRateBonus: 0, damageBonus: 0, healthRegen: 0, moveSpeedBonus: 0, companionDamage: 0, turretFireRate: 0 };
    this.playerSystem = new PlayerSystem(this, this.player, this.cursors, upgrades);

    this.dayCycleSystem = new DayCycleSystem(this);
    this.dayCycleSystem.start();

    this.waveSystem = new WaveSystem(this, this.enemies, this.player);
    this.lootSystem = new LootSystem(this, this.player);

    // Event listeners
    events.on(GameEvents.GAME_OVER, this.gameOver, this);
    events.on(GameEvents.NIGHT_START, this.onNightStart, this);
    events.on(GameEvents.DAY_START, this.onDayStart, this);
    events.on(GameEvents.PLAYER_LEVEL_UP, this.onLevelUp, this);
    events.on('levelup-choice-made', this.onLevelUpChoice, this);
    events.on('quest-completed', this.onQuestCompleted, this);
    events.on(GameEvents.LOOT_COLLECTED, this.onLootCollected, this);
    events.on('companion-status-changed', this.onCompanionStatusChanged, this);
    events.on('companion-bulk-status-changed', this.onCompanionBulkStatusChanged, this);
    events.on('companion-job-changed', this.onCompanionJobChanged, this);
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
      const pool = RUN_EVENT_DEFS.filter((def) => def.period === period);
      if (pool.length <= 0) return { ok: false, reason: 'no_event_pool' };
      const picked = Phaser.Utils.Array.GetRandom(pool);
      this.showRunEventPanel(picked);
      if (period === 'night') {
        this.pendingNightWaveStartAfterEvent = true;
      }
      return { ok: true, period, id: picked.id };
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
        population: {
          used: BaseSystem.getPopulationUsage(),
          cap: BaseSystem.getPopulationCapacity(),
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
    return Phaser.Math.Clamp(this.runMutatorEffects.lootGainMul * perkMul, 0.45, 2.8);
  }

  private getRunDayActivityGainMultiplier(): number {
    return Phaser.Math.Clamp(this.runMutatorEffects.dayActivityGainMul, 0.55, 2.2);
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

  private maybeTriggerRunEvent(period: RunEventPeriod): boolean {
    if (this.isGameOver || this.runEventOpen) return false;
    const pool = RUN_EVENT_DEFS.filter((def) => def.period === period);
    if (pool.length <= 0) return false;
    const baseChance = period === 'night' ? 0.82 : 0.68;
    const mutatorFactor = Math.min(0.18, this.activeRunMutators.length * 0.05);
    if (Math.random() > Math.min(0.98, baseChance + mutatorFactor)) return false;
    const picked = Phaser.Utils.Array.GetRandom(pool);
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

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
      .setScrollFactor(0);
    container.add(overlay);

    const panelW = Math.min(920, w - 70);
    const panelH = Math.min(440, h - 80);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.96)
      .setScrollFactor(0)
      .setStrokeStyle(2, eventDef.period === 'night' ? 0xf97316 : 0x0ea5e9, 0.85);
    container.add(panel);

    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 24, eventDef.titleCN, {
      fontSize: '24px',
      color: eventDef.period === 'night' ? '#fdba74' : '#7dd3fc',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 64, eventDef.descCN, {
      fontSize: '14px',
      color: '#cbd5e1',
      fontFamily: 'Courier New',
      align: 'center',
      wordWrap: { width: panelW - 42 },
    }).setOrigin(0.5, 0));

    container.add(this.add.text(w / 2, h / 2 - panelH / 2 + 108, `词缀联动：奖励 x${rewardMul.toFixed(2)} · 风险 x${riskMul.toFixed(2)}`, {
      fontSize: '12px',
      color: '#fbbf24',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    const btnY = h / 2 + 35;
    const leftX = w / 2 - panelW * 0.25;
    const rightX = w / 2 + panelW * 0.25;
    const buttonW = Math.max(260, panelW * 0.42);
    const buttonH = 190;

    eventDef.choices.forEach((choice, index) => {
      const cx = index === 0 ? leftX : rightX;
      const accent = index === 0 ? 0x22c55e : 0xf97316;
      const card = this.add.rectangle(cx, btnY, buttonW, buttonH, 0x111827, 0.92)
        .setScrollFactor(0)
        .setStrokeStyle(2, accent, 0.9);
      container.add(card);

      const preview = this.describeRunEventChoice(choice, eventDef.period);
      container.add(this.add.text(cx, btnY - 78, choice.titleCN, {
        fontSize: '18px',
        color: '#e2e8f0',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0));
      container.add(this.add.text(cx, btnY - 48, choice.detailCN, {
        fontSize: '12px',
        color: '#94a3b8',
        fontFamily: 'Courier New',
        align: 'center',
        wordWrap: { width: buttonW - 20 },
      }).setOrigin(0.5, 0));
      container.add(this.add.text(cx, btnY - 6, preview, {
        fontSize: '12px',
        color: '#cbd5e1',
        fontFamily: 'Courier New',
        align: 'center',
        wordWrap: { width: buttonW - 24 },
        lineSpacing: 4,
      }).setOrigin(0.5, 0));
      container.add(this.add.text(cx, btnY + buttonH / 2 - 24, '点击选择', {
        fontSize: '11px',
        color: '#64748b',
        fontFamily: 'Courier New',
      }).setOrigin(0.5, 0.5));

      const clickZone = this.add.zone(cx, btnY, buttonW, buttonH)
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

  private describeRunEventChoice(choice: RunEventChoiceDef, period: RunEventPeriod): string {
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
    return previewParts.join('\n');
  }

  private resolveRunEventChoice(eventDef: RunEventDef, choice: RunEventChoiceDef): void {
    const rewardMul = this.getRunEventRewardMultiplier(eventDef.period);
    const riskMul = this.getRunEventRiskMultiplier(eventDef.period);
    const rewardParts: string[] = [];
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
      gameState.addExperience(xp);
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

    this.runEventOpen = false;
    this.setUISceneInputEnabled(true);
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;

    if (this.pendingNightWaveStartAfterEvent) {
      this.pendingNightWaveStartAfterEvent = false;
      this.waveSystem.startNightWaves();
    }
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
    // Keep world texture readable; avoid giant haze blobs on top of map tiles.
    this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x030712, 0.06).setDepth(-29);

    const baseOuter = this.add.rectangle(1000, 750, 470, 470, 0x0f172a, 0.08);
    baseOuter.setStrokeStyle(2, 0x64748b, 0.22);
    baseOuter.setDepth(-9);
    const baseInner = this.add.rectangle(1000, 750, 438, 438, 0x020617, 0.08);
    baseInner.setStrokeStyle(1, 0x94a3b8, 0.25);
    baseInner.setDepth(-9);
    this.add.text(1000, 540, '觉醒者基地', {
      fontSize: '13px',
      color: '#dbeafe',
      fontFamily: 'Courier New',
      stroke: '#0b1220',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.30).setDepth(-8);
  }

  private createExplorationWorld(): void {
    this.worldFeatureLayer = this.add.container(0, 0).setDepth(-18);

    // River lanes (left vertical trunk + lower branch)
    const riverSegments = [
      { x: 560, y: 760, w: 190, h: 1260 },
      { x: 760, y: 1110, w: 360, h: 160 },
      { x: 650, y: 340, w: 210, h: 220 },
    ];
    riverSegments.forEach((segment, idx) => {
      const water = this.add.rectangle(segment.x, segment.y, segment.w, segment.h, 0x0ea5e9, idx === 0 ? 0.18 : 0.16);
      water.setStrokeStyle(1, 0x7dd3fc, 0.28);
      const foam = this.add.rectangle(segment.x, segment.y, segment.w * 0.92, segment.h * 0.92, 0x93c5fd, 0.08);
      this.worldFeatureLayer.add(water);
      this.worldFeatureLayer.add(foam);
    });
    for (let i = 0; i < 14; i += 1) {
      const ripple = this.add.ellipse(
        Phaser.Math.Between(485, 870),
        Phaser.Math.Between(150, 1360),
        Phaser.Math.Between(18, 34),
        Phaser.Math.Between(6, 12),
        0xbfe8ff,
        0.14
      );
      this.worldFeatureLayer.add(ripple);
    }

    // Forest biome (top-right)
    const forestArea = this.add.rectangle(1570, 420, 580, 620, 0x14532d, 0.14);
    forestArea.setStrokeStyle(1, 0x22c55e, 0.2);
    this.worldFeatureLayer.add(forestArea);
    for (let i = 0; i < 28; i += 1) {
      const tree = this.add.image(
        Phaser.Math.Between(1280, 1880),
        Phaser.Math.Between(120, 730),
        'deco_tree'
      ).setScale(Phaser.Math.FloatBetween(0.78, 1.12));
      this.worldFeatureLayer.add(tree);
    }
    for (let i = 0; i < 10; i += 1) {
      const bush = this.add.circle(
        Phaser.Math.Between(1300, 1860),
        Phaser.Math.Between(150, 740),
        Phaser.Math.Between(8, 16),
        0x166534,
        0.34
      );
      this.worldFeatureLayer.add(bush);
    }

    // City biome (top-left): ruined houses + small shops
    const cityArea = this.add.rectangle(430, 400, 620, 610, 0x334155, 0.1);
    cityArea.setStrokeStyle(1, 0x94a3b8, 0.25);
    this.worldFeatureLayer.add(cityArea);
    const cityBlocks = [
      { x: 250, y: 220, s: 0.88 },
      { x: 390, y: 240, s: 0.92 },
      { x: 540, y: 210, s: 0.82 },
      { x: 660, y: 270, s: 0.78 },
      { x: 300, y: 430, s: 0.86 },
      { x: 500, y: 470, s: 0.84 },
      { x: 660, y: 520, s: 0.8 },
    ];
    cityBlocks.forEach((block, idx) => {
      const ruin = this.add.image(block.x, block.y, 'deco_ruin').setScale(block.s);
      if (idx % 2 === 0) ruin.setTint(0x9ca3af);
      this.worldFeatureLayer.add(ruin);
      if (idx % 3 === 0) {
        const shop = this.add.image(block.x + 34, block.y + 18, 'store_counter').setScale(0.65);
        shop.setTint(0x64748b);
        this.worldFeatureLayer.add(shop);
      }
    });
    for (let i = 0; i < 11; i += 1) {
      const machine = this.add.image(
        Phaser.Math.Between(170, 720),
        Phaser.Math.Between(160, 670),
        'deco_machine'
      ).setScale(Phaser.Math.FloatBetween(0.52, 0.85));
      machine.setTint(0x6b7280);
      this.worldFeatureLayer.add(machine);
    }

    // Cave biome (bottom-right)
    const caveArea = this.add.rectangle(1670, 1160, 360, 320, 0x1f2937, 0.2);
    caveArea.setStrokeStyle(1, 0x64748b, 0.35);
    this.worldFeatureLayer.add(caveArea);
    const caveMouth = this.add.ellipse(1650, 1168, 170, 98, 0x020617, 0.88);
    const caveInner = this.add.ellipse(1654, 1172, 104, 54, 0x000000, 0.78);
    const caveGlow = this.add.ellipse(1654, 1144, 126, 44, 0x334155, 0.22);
    this.worldFeatureLayer.add(caveMouth);
    this.worldFeatureLayer.add(caveInner);
    this.worldFeatureLayer.add(caveGlow);
    for (let i = 0; i < 8; i += 1) {
      const crater = this.add.image(
        Phaser.Math.Between(1510, 1830),
        Phaser.Math.Between(1010, 1370),
        'deco_crater'
      ).setScale(Phaser.Math.FloatBetween(0.65, 1.0));
      this.worldFeatureLayer.add(crater);
    }

    // Zone labels (readability-first on mobile portrait)
    this.spawnWorldZoneLabel({ x: 545, y: 260, text: '河流区', color: '#22d3ee' });
    this.spawnWorldZoneLabel({ x: 360, y: 252, text: '城区', color: '#f8fafc' });
    this.spawnWorldZoneLabel({ x: 1560, y: 252, text: '森林区', color: '#86efac' });
    this.spawnWorldZoneLabel({ x: 1650, y: 974, text: '山洞区', color: '#c4b5fd' });

    // Exploration points for day-life gameplay
    this.spawnExplorationSpot({
      id: 'river_fishing_1',
      zone: 'river',
      actionType: 'fish',
      name: '河岸钓点',
      hint: '河流钓鱼',
      x: 610,
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
      x: 670,
      y: 900,
      radius: 86,
      cooldown: 10000,
      iconKey: 'loot_water',
      color: 0x60a5fa,
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
      iconKey: 'deco_tree',
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
      iconKey: 'deco_tree',
      color: 0x4ade80,
    });
    this.spawnExplorationSpot({
      id: 'city_scavenge_1',
      zone: 'city',
      actionType: 'scavenge',
      name: '破败小店',
      hint: '城区搜刮',
      x: 430,
      y: 320,
      radius: 88,
      cooldown: 13000,
      iconKey: 'loot_medical',
      color: 0xf59e0b,
    });
    this.spawnExplorationSpot({
      id: 'city_scavenge_2',
      zone: 'city',
      actionType: 'scavenge',
      name: '废墟民宅',
      hint: '城区搜刮',
      x: 610,
      y: 540,
      radius: 88,
      cooldown: 13000,
      iconKey: 'deco_ruin',
      color: 0xf97316,
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
      iconKey: 'loot_core',
      color: 0xa78bfa,
    });
    this.updateExplorationSpotStatus(true);
  }

  private spawnWorldZoneLabel(def: { x: number; y: number; text: string; color: string }): void {
    this.add.text(def.x, def.y, def.text, {
      fontSize: this.worldFs(13, 12),
      color: def.color,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 4,
      backgroundColor: '#0b1220',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
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
    const halo = this.add.circle(0, 0, 16, 0x0b1220, 0.82).setStrokeStyle(2, def.color, 0.95);
    marker.add(halo);

    if (this.textures.exists(def.iconKey)) {
      const iconBase = def.iconKey === 'deco_tree' || def.iconKey === 'deco_ruin' ? 0.42 : 0.8;
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

    const zoneTag = this.add.text(0, -26, zoneName, {
      fontSize: this.worldFs(10, 9),
      color: '#93c5fd',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: '#0b1220',
      padding: { left: 6, right: 6, top: 1, bottom: 1 },
    }).setOrigin(0.5, 1);
    marker.add(zoneTag);

    const label = this.add.text(0, -11, def.name, {
      fontSize: this.worldFs(12, 11),
      color: '#cbd5e1',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 4,
      backgroundColor: '#0b1220',
      padding: { left: 7, right: 7, top: 2, bottom: 2 },
    }).setOrigin(0.5, 1);
    marker.add(label);

    const statusText = this.add.text(0, 16, '0/0', {
      fontSize: this.worldFs(10, 9),
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
    const main = x >= 465 && x <= 650 && y >= 100 && y <= 1410;
    const branch = x >= 560 && x <= 940 && y >= 1020 && y <= 1190;
    const upper = x >= 540 && x <= 760 && y >= 180 && y <= 470;
    return main || branch || upper;
  }

  private getWorldZoneAt(x: number, y: number): WorldZoneId {
    if (this.isInsideBaseArea(x, y)) return 'base';
    if (this.isInsideRiver(x, y)) return 'river';
    if (x >= 1470 && x <= 1860 && y >= 980 && y <= 1400) return 'cave';
    if (x >= 1260 && x <= 1910 && y >= 100 && y <= 760) return 'forest';
    if (x >= 100 && x <= 760 && y >= 100 && y <= 730) return 'city';
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
      if (gameState.data.isNight) {
        spot.statusText.setText('夜间封锁');
        spot.statusText.setColor('#64748b');
      } else if (active > 0) {
        spot.statusText.setText(`执行中${active} · ${used}/${usageLimit}`);
        spot.statusText.setColor('#38bdf8');
      } else {
        spot.statusText.setText(`${used}/${usageLimit}`);
        spot.statusText.setColor('#64748b');
      }
    });
  }

  private getExplorationHintText(spot: ExplorationSpot): string {
    if (gameState.data.isNight) {
      return `[E] ${spot.name} · 夜间封锁`;
    }
    const zoneName = this.getWorldZoneNameCN(spot.zone);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    if (stationed <= 0) {
      return `[E] ${spot.name}(${zoneName}) · 驻守伙伴会自动执行（当前0人，${used}/${usageLimit}）`;
    }
    return `[E] ${spot.name}(${zoneName}) · 驻守伙伴自动执行（执行中${active}人，${used}/${usageLimit}）`;
  }

  private handleExplorationSpotInteraction(spot: ExplorationSpot): void {
    if (gameState.data.isNight) {
      this.showFloatingText(this.player.x, this.player.y - 24, `${spot.name} 夜间封锁`, '#ef4444', false);
      return;
    }
    const stationed = gameState.data.companions.filter((c) => c.status === 'base').length;
    const active = this.getExplorationSpotResidentCount(spot.id);
    const usageLimit = this.getActivityUsageLimit(spot.actionType);
    const used = this.getActivityUsage(spot.actionType);
    if (stationed <= 0) {
      this.showFloatingText(this.player.x, this.player.y - 24, '没有驻守伙伴，无法自动探索', '#f59e0b', false);
      return;
    }
    this.showFloatingText(
      this.player.x,
      this.player.y - 24,
      `${spot.name} 自动执行中 ${active}人 · 今日${used}/${usageLimit}`,
      '#38bdf8',
      false
    );
  }

  private createVillageScenery(): void {
    this.villageLayer = this.add.container(0, 0).setDepth(-3);
    this.villageLights = [];

    const tileSize = 64;
    const cols = 8;
    const rows = 7;
    const startX = 1000 - (cols * tileSize) / 2;
    const startY = 750 - (rows * tileSize) / 2;

    // Ground tiles inside base
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tex = row >= 2 && row <= 4 ? 'village_path' : 'village_ground';
        const tile = this.add.image(startX + col * tileSize + tileSize / 2, startY + row * tileSize + tileSize / 2, tex).setDepth(-4);
        this.villageLayer.add(tile);
      }
    }

    // Storefront center piece
    const storeCenterX = startX + cols * tileSize * 0.5;
    const storeY = startY + tileSize * 1.8;
    const store = this.add.image(storeCenterX, storeY, 'store_front').setDepth(-2);
    this.villageLayer.add(store);
    const signBoard = this.add.image(storeCenterX, storeY - 88, 'store_sign_board').setDepth(-1);
    this.villageLayer.add(signBoard);
    const signText = this.add.text(storeCenterX, storeY - 88, '影目AR眼镜体验中心', {
      fontSize: '16px',
      color: '#f8fafc',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(0);
    this.villageLayer.add(signText);

    // Counter and props
    this.villageLayer.add(this.add.image(storeCenterX - 86, startY + tileSize * 3.15, 'store_counter').setDepth(-1));
    this.villageLayer.add(this.add.image(storeCenterX + 86, startY + tileSize * 3.15, 'store_counter').setDepth(-1));
    [
      { x: storeCenterX - 170, y: startY + tileSize * 4.2, s: 0.95 },
      { x: storeCenterX + 170, y: startY + tileSize * 4.2, s: 0.95 },
      { x: storeCenterX + 10, y: startY + tileSize * 5.0, s: 1.0 },
    ].forEach(p => {
      const crate = this.add.image(p.x, p.y, 'supply_crate').setDepth(-1).setScale(p.s);
      const shadow = this.add.ellipse(p.x, p.y + 12, 38 * p.s, 12 * p.s, 0x000000, 0.24).setDepth(-2);
      this.villageLayer.add(shadow);
      this.villageLayer.add(crate);
    });

    // Lamps and lighting
    [
      { x: startX + tileSize * 0.5, y: startY + tileSize * 0.5 },
      { x: startX + tileSize * (cols - 0.5), y: startY + tileSize * 0.5 },
      { x: startX + tileSize * 0.5, y: startY + tileSize * (rows - 0.5) },
      { x: startX + tileSize * (cols - 0.5), y: startY + tileSize * (rows - 0.5) },
    ].forEach(pos => {
      this.villageLayer.add(this.add.image(pos.x, pos.y, 'street_lamp').setDepth(-1));
      this.villageLayer.add(this.add.circle(pos.x, pos.y + 16, 26, 0xfff3b0, 0.12).setDepth(-2));
      this.villageLights.push({ x: pos.x, y: pos.y + 10, scale: 0.7 });
    });

    // Plaza campfire
    const cf = this.add.sprite(storeCenterX, startY + tileSize * 3.55, 'campfire').setDepth(-1);
    this.villageLayer.add(cf);
    this.villageLayer.add(this.add.circle(cf.x, cf.y, 36, 0xffa94a, 0.18).setDepth(-2));
    this.villageLights.push({ x: cf.x, y: cf.y, scale: 1.1 });

    // Info board
    const board = this.add.rectangle(storeCenterX, startY + tileSize * 5.35, 152, 34, 0x2b2117, 0.94);
    board.setStrokeStyle(2, 0xfacc15);
    this.villageLayer.add(board);
    const bText = this.add.text(board.x, board.y, '觉醒者基地安全区', {
      fontSize: '13px',
      color: '#facc15',
      fontFamily: 'Courier New',
      align: 'center',
    }).setOrigin(0.5).setDepth(-1);
    this.villageLayer.add(bText);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '12px',
      color: '#f8fafc',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    };
    const signs = [
      { x: storeCenterX - 145, y: startY + tileSize * 1.35, text: '数据交易区' },
      { x: storeCenterX + 145, y: startY + tileSize * 1.35, text: '眼镜体验区' },
      { x: storeCenterX, y: startY + tileSize * 4.15, text: '任务中心' },
    ];
    signs.forEach((s) => {
      const t = this.add.text(s.x, s.y, s.text, labelStyle).setOrigin(0.5).setDepth(-1);
      this.villageLayer.add(t);
    });

    // Walls around base
    this.createBaseWalls(startX, startY, tileSize, cols, rows);

    // NPCs
    this.spawnNPC(storeCenterX - 80, startY + tileSize * 1.95, 'merchant', '数据交易员');
    this.spawnNPC(storeCenterX, startY + tileSize * 5.2, 'commander', '任务官');
    this.spawnNPC(storeCenterX + 80, startY + tileSize * 1.95, 'weaponsmith', '宝岛眼镜店');

    // Day-life facilities (enterable)
    this.spawnFacility({
      id: 'kitchen',
      name: '炊事台',
      action: '做饭',
      texture: 'kitchen_station',
      x: storeCenterX - 74,
      y: startY + tileSize * 3.95,
      enterX: storeCenterX - 76,
      enterY: startY + tileSize * 3.55,
      exitX: storeCenterX - 120,
      exitY: startY + tileSize * 4.25,
      radius: 88,
    });
    this.spawnFacility({
      id: 'quarters',
      name: '宿舍房间',
      action: '休息',
      texture: 'room_quarters',
      x: storeCenterX + 84,
      y: startY + tileSize * 4.1,
      enterX: storeCenterX + 84,
      enterY: startY + tileSize * 3.72,
      exitX: storeCenterX + 120,
      exitY: startY + tileSize * 4.28,
      radius: 92,
    });
    this.spawnFacility({
      id: 'guard_post',
      name: '哨岗',
      action: '站岗',
      texture: 'guard_post',
      x: storeCenterX + 176,
      y: startY + tileSize * 4.28,
      enterX: storeCenterX + 176,
      enterY: startY + tileSize * 4.05,
      exitX: storeCenterX + 148,
      exitY: startY + tileSize * 4.35,
      radius: 78,
    });
    this.spawnFacility({
      id: 'workbench',
      name: '工作台',
      action: '加工',
      texture: 'workbench',
      x: storeCenterX - 168,
      y: startY + tileSize * 4.25,
      enterX: storeCenterX - 168,
      enterY: startY + tileSize * 4.0,
      exitX: storeCenterX - 142,
      exitY: startY + tileSize * 4.35,
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
    const sprite = this.add.sprite(x, y, 'companion');
    sprite.setDepth(3);
    const colors: Record<string, number> = { merchant: 0xfbbf24, commander: 0x0ea5e9, weaponsmith: 0xef4444 };
    sprite.setTint(colors[type] || 0xffffff);
    this.villageLayer.add(sprite);

    this.tweens.add({ targets: sprite, scale: { from: 1, to: 1.08 }, duration: 800, yoyo: true, repeat: -1 });

    const label = this.add.text(x, y - 26, name, {
      fontSize: '13px', color: '#fef08a', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);
    this.villageLayer.add(label);

    this.interactables.push({ sprite, type, name, cooldown: 1000, lastInteract: 0 });
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
    this.input.keyboard!.on('keydown-T', () => {
      if (this.currentFacility) return;
      if (this.scene.isActive('UIScene')) return;
      events.emit('toggle-base');
    });
    this.input.keyboard!.on('keydown-H', () => {
      if (this.currentFacility) return;
      if (this.scene.isActive('UIScene')) return;
      events.emit('toggle-leisure');
    });

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
      fontSize: '20px', color: '#facc15', fontFamily: 'Courier New',
      backgroundColor: '#111827cc', padding: { x: 16, y: 8 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1200).setVisible(false);
  }

  // ============================================================
  // UPDATE LOOP
  // ============================================================
  update(_time: number, delta: number): void {
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
    this.lootSystem.update();
    this.weatherSystem.update();

    // VS-style multi-weapon auto-fire
    if (!this.currentFacility) {
      this.autoFireAllWeapons(delta);
    }

    // Turret AI
    this.updateTurrets();

    // Companion system
    const companionGlobalBonus = Math.max(0, Math.floor((gameState.data.playerLevel || 1) * 2.6 + Math.max(0, this.comboCount) * 0.2));
    this.companionSystem.update(
      this.enemies,
      this.companionBullets,
      companionGlobalBonus,
      this.permanentTalentBonuses.companionFireRateMul
    );
    this.syncCompanionRoster();
    this.updateNightBaseDefense();
    this.updateExplorationSpotStatus();
    this.updateResidentAssistTask();

    // Homing bullets
    this.updateHomingBullets();

    // Bullet cleanup (prevents pool exhaustion / stuck bullets)
    this.cleanupBullets();
    this.updateBulletTrails(delta);

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
    this.updateLighting();

    // Animation
    if (this.player?.active) {
      this.animationSystem.updateSquashAndStretch(this.player);
    }

    // Interaction hints
    this.updateInteractionHints();
    this.updateExplorationEdgeIndicators();

    // Combo decay
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) {
      this.comboCount = 0;
      if (this.comboText) this.comboText.setVisible(false);
    }
    this.updateOverdriveState();
    this.updatePowerTierState();

    // Speed lines when moving fast
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed > 150 && Math.random() < 0.3) {
        const line = this.add.rectangle(
          this.player.x - body.velocity.x * 0.1 + Phaser.Math.Between(-10, 10),
          this.player.y - body.velocity.y * 0.1 + Phaser.Math.Between(-10, 10),
          2, 8, 0x0ea5e9, 0.3
        ).setDepth(3);
        this.tweens.add({ targets: line, alpha: 0, duration: 200, onComplete: () => line.destroy() });
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
    };

    // Fire primary weapon
    const didFire = this.weaponSystem.fire(this.player.x, this.player.y, nearest.x, nearest.y, brandMods);
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

      const firedCount = this.fireVSWeapon(weapon.def, nearest, brandMods);
      if (firedCount > 0) {
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
  }

  private getPlayerCombatBoost(): {
    fireRateMul: number;
    damageMul: number;
    projectileBonus: number;
    speedMul: number;
    spreadMul: number;
    pierceBonus: number;
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
    const runMomentumTier = Math.min(20, Math.floor(killCount / 35));
    const runMomentumMul = runMomentumTier * 0.02;
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
      (masteryPeak >= 5 ? 1 : 0) +
      (runMomentumTier >= 10 ? 1 : 0);
    const pierceBonus =
      (level >= 7 ? 1 : 0) +
      (level >= 13 ? 1 : 0) +
      (level >= 19 ? 1 : 0) +
      (masteryPeak >= 7 ? 1 : 0);
    const companionDamageBonus = Math.min(0.25, avgCompanionLevel * 0.013 + roleVariety * 0.018);
    const fireRateMul = 1 + Math.min(
      1.08,
      (level - 1) * 0.017 +
      0.1 +
      (week - 1) * 0.022 +
      comboTier * 0.014 +
      partySyncBonus * 0.9 +
      masteryBonus * 0.85 +
      runMomentumMul * 0.9
    );
    const damageMul = 1 + Math.min(
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
    );
    const speedMul = 1 + Math.min(0.62, (level - 1) * 0.012 + partySyncBonus * 0.55 + masteryBonus * 0.34 + runMomentumMul * 0.2 + permanentSpeedBonus);
    const spreadMul = Math.max(0.5, 1 - Math.min(0.5, (level - 1) * 0.014 + partySyncBonus * 0.28 + masteryBonus * 0.32 + runMomentumMul * 0.14));
    const tieredBoost = {
      fireRateMul: fireRateMul * tier.fireRateMul,
      damageMul: damageMul * tier.damageMul,
      projectileBonus: projectileBonus + tier.projectileBonus,
      speedMul: speedMul * tier.speedMul,
      spreadMul: spreadMul,
      pierceBonus: pierceBonus + tier.pierceBonus,
    };
    if (this.isOverdriveActive()) {
      return {
        fireRateMul: tieredBoost.fireRateMul * 1.32,
        damageMul: tieredBoost.damageMul * 1.5,
        projectileBonus: tieredBoost.projectileBonus + 1,
        speedMul: tieredBoost.speedMul * 1.22,
        spreadMul: Math.max(0.45, tieredBoost.spreadMul * 0.78),
        pierceBonus: tieredBoost.pierceBonus + 1,
      };
    }
    return tieredBoost;
  }

  private fireVSWeapon(weaponDef: any, target: Phaser.Physics.Arcade.Sprite, brandMods?: ReturnType<typeof EvolutionSystem.getEquippedBrandCombatModifiers>): number {
    if (!weaponDef) return 0;
    const mods = brandMods || EvolutionSystem.getEquippedBrandCombatModifiers();
    const glassesSpecials = EvolutionSystem.getGlassesSpecials();
    const enableGlobalHoming = glassesSpecials.has('emergence_resonance') || glassesSpecials.has('gemini_assist');
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    const projectileCount = Math.max(1, (weaponDef.projectileCount || 1) + (mods.projectileBonus || 0));
    const spreadDeg = (weaponDef.spread || 0) * (mods.spreadMul || 1);
    const speed = Math.max(80, (weaponDef.speed || 400) * (mods.speedMul || 1));
    const finalSpecial = weaponDef.special || mods.forceSpecial;
    const damage = (weaponDef.damage || 10) * (mods.damageMul || 1);
    let created = 0;

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
      const bulletScale = this.getVSBulletScale(bulletTexture);
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
      body.setVelocity(Math.cos(bulletAngle) * speed, Math.sin(bulletAngle) * speed);
      bullet.setRotation(bulletAngle + Math.PI / 2);

      // Store weapon data on bullet
      (bullet as any).weaponDamage = damage;
      (bullet as any).weaponSpecial = finalSpecial;
      (bullet as any).weaponRange = weaponDef.range || 400;
      (bullet as any).originX = this.player.x;
      (bullet as any).originY = this.player.y;
      (bullet as any).isHoming = !!(enableGlobalHoming || mods.homing);
      (bullet as any).homingTarget = (enableGlobalHoming || mods.homing) ? target : null;
      (bullet as any).brandDamageApplied = true;
      if (finalSpecial === 'pierce') {
        (bullet as any).pierceLeft = 1 + (mods.pierceBonus || 0);
      } else {
        (bullet as any).pierceLeft = null;
      }

      // Auto-destroy after range
      const lifetime = (weaponDef.range || 400) / speed * 1000;
      const anyBullet = bullet as any;
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
          bullet.setVelocity(0, 0);
          bullet.disableBody(true, true);
        }
      });
    }
    return created;
  }

  private getVSBulletTexture(weaponDef: any, special: string | undefined): string {
    const id = String(weaponDef?.id || '');
    if (special === 'burn') return 'bullet_flame';
    if (special === 'pierce') return 'bullet_pierce';
    if (special === 'explode') return 'bullet_cannon';
    if (special === 'slow') return 'bullet_frost';
    if (special === 'chain') return 'bullet_chain';
    if (id.includes('scatter') || id.includes('crit_storm')) return 'bullet_scatter';
    if (id.includes('pulse') || id.includes('bullet_hell')) return 'bullet_pulse';
    if (id.includes('frost') || id.includes('absolute_zero')) return 'bullet_frost';
    if (id.includes('cannon') || id.includes('reflection')) return 'bullet_cannon';
    if (id.includes('pierce') || id.includes('annihilation')) return 'bullet_pierce';
    return 'bullet';
  }

  private getVSBulletScale(texture: string): number {
    if (texture === 'bullet_cannon') return 1.9;
    if (texture === 'bullet_chain') return 1.72;
    if (texture === 'bullet_flame') return 1.68;
    if (texture === 'bullet_frost') return 1.66;
    if (texture === 'bullet_pierce') return 1.62;
    if (texture === 'bullet_pulse') return 1.58;
    if (texture === 'bullet_scatter') return 1.64;
    return 1.52;
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
    let damage = bulletData.weaponDamage ?? bulletData.damage ?? this.weaponSystem.getCurrentWeapon().damage ?? 10;
    if (!bulletData.brandDamageApplied) {
      damage *= (mods.damageMul || 1);
    }
    const special = bulletData.weaponSpecial ?? bulletData.special ?? mods.forceSpecial;
    damage = this.applyHungerPenalty(damage);

    // Apply special effects
    if (special === 'burn') this.applyBurnEffect(enemy);
    else if (special === 'slow') this.applySlowEffect(enemy);
    else if (special === 'explode') this.createExplosion(enemy.x, enemy.y, 80, damage * 0.5);
    else if (special === 'chain') this.createChainLightning(enemy, 3, damage * 0.6);
    else if (EvolutionSystem.getGlassesSpecials().has('neural_chain')) this.createChainLightning(enemy, 1, damage * 0.45);

    if (special === 'pierce') {
      if (bulletData.pierceLeft == null) bulletData.pierceLeft = 1 + (mods.pierceBonus || 0);
      bulletData.pierceLeft -= 1;
      if (bulletData.pierceLeft <= 0) this.disableBullet(bullet);
    } else {
      this.disableBullet(bullet);
    }
    this.createBulletImpactVfx(enemy.x, enemy.y, special, bullet.tintTopLeft || 0x7dd3fc);

    const source: DamageSource = bulletData.ownerType === 'companion'
      ? { type: 'companion', companionId: bulletData.ownerId || null }
      : bulletData.ownerType === 'turret'
        ? { type: 'turret', turretId: bulletData.ownerId || null }
        : { type: 'player', weaponType: (bulletData.weaponType || this.weaponSystem.getCurrentWeaponType()) as WeaponType };
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
    if (this.bulletTrailTick < (mobile ? 34 : 20)) return;
    this.bulletTrailTick = 0;

    const emitTrail = (group: Phaser.Physics.Arcade.Group, rate: number, radius: number): void => {
      let emitted = 0;
      group.getChildren().forEach((child) => {
        if (emitted >= (mobile ? 10 : 18)) return;
        const bullet = child as Phaser.Physics.Arcade.Sprite;
        if (!bullet.active || Math.random() > rate) return;
        emitted += 1;
        const tint = (bullet.tintTopLeft && bullet.tintTopLeft !== 0xffffff) ? bullet.tintTopLeft : 0x7dd3fc;
        const trail = this.add.circle(bullet.x, bullet.y, radius, tint, 0.28).setDepth(9);
        trail.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 1.85,
          duration: 140,
          onComplete: () => trail.destroy(),
        });
      });
    };

    emitTrail(this.bullets, mobile ? 0.2 : 0.30, 2.8);
    emitTrail(this.vsBullets, mobile ? 0.24 : 0.36, 3.2);
    emitTrail(this.companionBullets, mobile ? 0.18 : 0.28, 2.9);
    emitTrail(this.turretBullets, mobile ? 0.2 : 0.32, 3.1);
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
    anyBullet.spawnTime = null;
    anyBullet.maxLifetime = null;
    bullet.setVelocity(0, 0);
    bullet.disableBody(true, true);
  }

  private createBulletImpactVfx(x: number, y: number, special: string | undefined, color: number): void {
    const ringColor = special === 'explode' || special === 'explosive' ? 0xfb923c
      : special === 'chain' ? 0xa78bfa
        : special === 'slow' || special === 'frozen' ? 0x93c5fd
          : special === 'burn' || special === 'burning' ? 0xf97316
            : color;

    const core = this.add.circle(x, y, 4, ringColor, 0.75).setDepth(110);
    core.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: core,
      alpha: 0,
      scale: 2.4,
      duration: 130,
      onComplete: () => core.destroy(),
    });

    for (let i = 0; i < 4; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(8, 18);
      const spark = this.add.rectangle(x, y, 2, 2, ringColor, 0.9).setDepth(111);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 170,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number, source: DamageSource = { type: 'player' }): void {
    const stats = EvolutionSystem.getComputedStats();
    const level = Math.max(1, gameState.data.playerLevel || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    let sourceMultiplier = 1;
    if (source.type === 'player') {
      sourceMultiplier *= 1 + Math.min(0.75, (level - 1) * 0.025 + (week - 1) * 0.04);
      if (this.comboCount >= 20) {
        sourceMultiplier *= 1 + Math.min(0.22, Math.floor(this.comboCount / 20) * 0.04);
      }
    } else if (source.type === 'companion') {
      sourceMultiplier *= 1 + Math.min(0.26, (level - 1) * 0.01);
    } else if (source.type === 'turret') {
      sourceMultiplier *= 1 + Math.min(0.2, (week - 1) * 0.025);
    }
    if (gameState.data.isNight && this.hasDayBuff('training')) {
      if (source.type === 'player') sourceMultiplier *= 1.16;
      else if (source.type === 'companion') sourceMultiplier *= 1.12;
      else sourceMultiplier *= 1.1;
    }

    let finalDamage = damage * (1 + stats.damage / 100) * sourceMultiplier;
    if (source.type === 'player') {
      finalDamage *= this.runMutatorEffects.playerDamageMul;
    } else if (source.type === 'companion') {
      finalDamage *= this.runMutatorEffects.companionDamageMul;
    } else if (source.type === 'turret') {
      finalDamage *= this.runMutatorEffects.turretDamageMul;
    }
    finalDamage /= Math.max(0.4, this.runMutatorEffects.enemyToughnessMul);

    // Crit
    const isCrit = Math.random() * 100 < stats.critChance;
    if (isCrit) finalDamage *= stats.critDamage / 100;

    const ed = enemy as any;
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

    // Hit effect
    this.animationSystem.playHitEffect(enemy);

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
      this.showFloatingText(
        enemy.x,
        enemy.y - 62,
        `掉落[${rarityStyle.label}] ${gearDrop.nameCN}`,
        rarityStyle.uiColor,
        false
      );
      events.emit('gear-stash-updated', {
        count: gameState.data.gearStash.length,
        dropped: gearDrop,
      });
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

    this.gainOverdriveCharge(source);
    this.handleAutoLevelKill(source);
    this.maybeEmitCompanionCombatChatter(source, 'kill');

    events.emit(GameEvents.ENEMY_KILLED, { enemyType: ed.enemyType, reward: xpValue });

    if (!ed.isBoss) {
      enemy.destroy();
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
      if (!info) return;
      if (info.leveledUp) {
        const c = gameState.data.companions.find(item => item.id === source.companionId);
        if (c) {
          c.level = info.level;
          if (info.advancedClass) {
            c.advancedClass = info.advancedClass;
            c.promotionTier = 1;
          }
        }
        this.showFloatingText(
          this.player.x,
          this.player.y - 52,
          info.promoted
            ? `${info.name.split('(')[0]} 转职：${info.advancedClass}`
            : `${info.name.split('(')[0]} 升级 Lv.${info.level}`,
          Phaser.Display.Color.IntegerToColor(info.tint).rgba,
          false
        );
        if (info.reachedMax) {
          this.showFloatingText(
            this.player.x,
            this.player.y - 72,
            `${info.name.split('(')[0]} 已达满级 Lv.40`,
            '#f59e0b',
            false
          );
        }
        this.lastCompanionRosterSignature = '';
      }
    }
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
    if (this.comboCount < 3) {
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
        fontSize: '28px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1500);
    }

    const text = this.comboText;
    if (!text) return;

    const color = this.comboCount >= 20 ? '#ef4444' : this.comboCount >= 10 ? '#f59e0b' : '#fbbf24';
    text.setColor(color);
    text.setText(`${this.comboCount}x`);
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
    const offsetX = Phaser.Math.Between(-15, 15);
    const text = this.add.text(x + offsetX, y - 20, `${Math.floor(damage)}${isCrit ? '!' : ''}`, {
      fontFamily: 'Courier New',
      fontSize: isCrit ? '24px' : '16px',
      color: isCrit ? '#fbbf24' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCrit ? 4 : 2,
    }).setOrigin(0.5).setDepth(1500);

    this.tweens.add({
      targets: text, y: y - 60, alpha: 0, duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
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

    // Outer glow
    const glow = this.add.circle(x, y, 12, 0x38bdf8, 0.3);
    glow.setDepth(99);
    this.tweens.add({
      targets: glow, alpha: 0, scale: 2, duration: 150,
      onComplete: () => glow.destroy(),
    });

    // Small spark particles (2-3)
    const sparkCount = Phaser.Math.Between(2, 3);
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
    const particleCount = Phaser.Math.Between(4, 8);
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

  private createExplosion(x: number, y: number, radius: number, damage: number): void {
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
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
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
        this.damageEnemy(enemy, damage);
      }
    });

    // Screen shake
    this.cameras.main.shake(200, 0.01);
  }

  private showFloatingText(x: number, y: number, message: string, color: string, isScreenSpace: boolean = false): void {
    const text = this.add.text(x, y, message, {
      fontFamily: 'Courier New', fontSize: '22px', color,
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
        this.createBulletImpactVfx(enemy.x, enemy.y, effect, bullet.tintTopLeft || 0x93c5fd);
        return;
      }
    }

    this.disableBullet(bullet);
    this.createBulletImpactVfx(enemy.x, enemy.y, effect, bullet.tintTopLeft || 0x93c5fd);
    this.damageEnemy(enemy, damage, source);
  }

  private enemyHitPlayer(_enemy: any, _player: any): void {
    const ed = _enemy as any;
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
    this.buildPaletteText.setText(lines.join('\n'));
  }

  private onBuildSelection(payload: { buildingId?: string } | null): void {
    const buildingId = payload?.buildingId;
    if (!buildingId || !BUILDING_DEFS[buildingId]) return;
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
    let blocked = false;
    [...this.walls.getChildren(), ...this.turrets.getChildren()].forEach(b => {
      const s = b as Phaser.Physics.Arcade.Sprite;
      if (Math.abs(s.x - gridX) < 32 && Math.abs(s.y - gridY) < 32) blocked = true;
    });
    if (bDef?.category === 'turret') {
      const powerCapacity = BaseSystem.computePowerCapacity(gameState.data.buildings);
      const powerUsed = BaseSystem.computePowerUsed(gameState.data.buildings);
      const need = bDef.powerUse ?? BASE_POWER_PER_TURRET;
      if (powerUsed + need > powerCapacity) blocked = true;
    }

    const color = canAfford && !blocked ? 0x4ade80 : 0xef4444;
    this.buildPreview.setFillStyle(color, 0.3);
    this.buildPreview.setStrokeStyle(2, color);
  }

  private placeBuilding(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridX = Math.floor(worldPoint.x / 64) * 64 + 32;
    const gridY = Math.floor(worldPoint.y / 64) * 64 + 32;

    const bDef = BUILDING_DEFS[this.selectedBuildingId];
    if (!bDef) return;

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

    // Check overlap
    let blocked = false;
    [...this.walls.getChildren(), ...this.turrets.getChildren()].forEach(b => {
      const s = b as Phaser.Physics.Arcade.Sprite;
      if (Math.abs(s.x - gridX) < 32 && Math.abs(s.y - gridY) < 32) blocked = true;
    });
    if (blocked) return;

    if (!gameState.spendResources(bDef.cost as any)) {
      this.showFloatingText(this.cameras.main.width / 2, 200, '资源不足!', '#ef4444', true);
      return;
    }

    // Place
    const group = bDef.category === 'turret' ? this.turrets : this.walls;
    const texture = this.getBuildingTextureKey(bDef.id, bDef.category);
    const textureWithVariant = this.pickBuildTextureWithVariant(texture, bDef.id, gridX, gridY);
    const building = group.create(gridX, gridY, textureWithVariant) as Phaser.Physics.Arcade.Sprite;
    this.configureStructure(building);
    const useTint = texture === 'wall' || texture === 'turret';
    if (useTint) building.setTint(bDef.color);
    else building.clearTint();
    (building as any).health = bDef.health;
    (building as any).maxHealth = bDef.health;
    (building as any).buildingId = bDef.id;
    (building as any).buildingDef = bDef;

    if (bDef.category === 'turret') {
      this.initTurretAutoLevelStats(building, 15, 700, 250);
    }

    gameState.data.stats.buildingsPlaced++;
    gameState.data.buildings.push({ id: bDef.id, type: bDef.category, x: gridX, y: gridY, tier: bDef.tier, health: bDef.health });
    events.emit('update-resources', gameState.data.resources);
    BaseSystem.refreshBaseState();

    // Quest progress
    QuestSystem.updateProgress('build', bDef.id, 1);
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

  private removeBuildingRecord(building: Phaser.Physics.Arcade.Sprite): void {
    const id = (building as any).buildingId;
    const bx = Math.round(building.x);
    const by = Math.round(building.y);
    const idx = gameState.data.buildings.findIndex(b =>
      b.id === id && Math.abs(b.x - bx) < 2 && Math.abs(b.y - by) < 2
    );
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
  private updateTurrets(): void {
    const now = this.time.now;
    const base = gameState.data.base;
    const overload = base.powerUsed > base.powerCapacity;
    let remainingPower = base.powerCapacity;
    const turrets = this.turrets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    turrets.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    if (overload && now - this.lastPowerWarning > 6000) {
      this.lastPowerWarning = now;
      this.showFloatingText(this.cameras.main.width / 2, 160, '⚡ 电力超载，部分炮塔停机', '#ef4444', true);
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

      const fireRate = td.fireRate || 700;
      const range = td.range || 220;
      if (now - (td.lastFireTime || 0) < fireRate) return;

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
        const angle = Phaser.Math.Angle.Between(turret.x, turret.y, target.x, target.y);
        const bullet = this.turretBullets.create(turret.x, turret.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
        if (bullet) {
          bullet.setTexture('bullet_pulse');
          bullet.setScale(1.45 + Math.min(0.65, ((td.level || 1) - 1) * 0.03));
          bullet.setTint(td.levelColor || 0x22d3ee);
          bullet.setBlendMode(Phaser.BlendModes.ADD);
          bullet.setDepth(10);
          const bulletSpeed = td.bulletSpeed || 350;
          bullet.setVelocity(Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
          (bullet as any).damage = td.damage || 15;
          (bullet as any).ownerType = 'turret';
          (bullet as any).ownerId = td.runtimeId || null;
          this.time.delayedCall(1500, () => { if (bullet.active) bullet.destroy(); });
        }
      }
    });
  }

  private turretBulletHitEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active) return;
    const damage = (bullet as any).damage || 15;
    const source: DamageSource = { type: 'turret', turretId: (bullet as any).ownerId || null };
    this.createBulletImpactVfx(enemy.x, enemy.y, 'pulse', bullet.tintTopLeft || 0x22d3ee);
    bullet.destroy();
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
          ? '接任务'
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
    this.playerSystem?.setVirtualDirection(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0);
  }

  private onMobileInteract(): void {
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
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(this.player.x, this.player.y - 26, '工作台：零件 +2', '#60a5fa', false);
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
    this.showFloatingText(this.player.x, this.player.y - 44, '打开数据交易所', '#fbbf24', false);
  }

  private showCommanderUI(): void {
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

    const survivor = this.survivors.create(x, y, 'companion') as Phaser.Physics.Arcade.Sprite;
    if (!survivor) return;
    survivor.setTint(0x60a5fa);
    survivor.setDepth(5);
    this.tweens.add({ targets: survivor, alpha: { from: 0.5, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    const helpText = this.add.text(x, y - 25, '💬 救救我！', {
      fontSize: '13px', color: '#fbbf24', fontFamily: 'Courier New',
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
      const behavior = this.getResidentBehavior(comp.job, index, undefined);
      const points = behaviorBuckets[behavior];
      const point = points[usage[behavior] % points.length];
      usage[behavior] += 1;
      this.baseResidentAssignments.set(comp.id, index);

      const container = this.add.container(point.x, point.y).setDepth(-1);
      container.setData('companionId', comp.id);
      container.setData('preferredBehavior', behavior);
      container.setData('residentName', comp.name.split('(')[0]);
      container.setData('residentMode', 'idle' as ResidentMode);
      const sprite = this.add.sprite(0, 0, 'companion');
      sprite.setScale(0.95);
      container.add(sprite);
      container.setData('spriteObj', sprite);

      const name = comp.name.split('(')[0];
      const label = this.add.text(0, -24, `${name}·${behaviorName[behavior]}`, {
        fontSize: '10px',
        color: '#e2e8f0',
        fontFamily: 'Courier New',
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
    const gainMul = Phaser.Math.Clamp(profileMul * moraleMul * runMul, 0.62, 2.2);
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
      if (Math.random() < 0.22) addResource('scrap', 1);
      exp = Phaser.Math.Between(3, 6);
      summary = `河流钓鱼 +食物${food} +净水${water}`;
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
      const scrap = addResource('scrap', 3);
      const metal = addResource('metal', 2);
      if (Math.random() < 0.35) addResource('energyCore', 1);
      exp = Phaser.Math.Between(7, 12);
      summary = `山洞探险 +零件${scrap} +金属${metal}`;
      color = '#a78bfa';
      dangerRoll = 0.48;
      dangerMin = 2;
      dangerMax = 5;
      dangerText = '洞穴异动触发敌潮';
    }

    gameState.addExperience(exp);
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
      if (this.residentBusy(container)) continue;
      const companion = gameState.data.companions.find(c => c.id === companionId);
      if (!companion || companion.status !== 'base') continue;
      const current = (container.getData('behavior') || 'stroll') as ResidentBehavior;
      const next = this.getResidentBehavior(companion.job, Phaser.Math.Between(0, 999), current);
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
      this.applyResidentBehavior(container, this.getResidentBehavior(comp.job, Phaser.Math.Between(0, 999), 'stroll'), false);
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
    bullet.setScale(texture === 'bullet_pulse' ? 1.45 : 1.3);
    bullet.setDepth(10);
    bullet.setBlendMode(Phaser.BlendModes.ADD);

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.reset(container.x, container.y);
    body.setAllowGravity(false);
    body.setCircle(5, bullet.width / 2 - 5, bullet.height / 2 - 5);
    body.setBounce(0, 0);
    body.setDrag(0, 0);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.setRotation(angle + Math.PI / 2);

    const b = bullet as any;
    b.bulletEffect = { type: 'normal', damage, speed, color, size: 1.2 };
    b.damage = damage;
    b.ownerType = 'companion';
    b.ownerId = companionId;
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
        fontFamily: 'Courier New',
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
        fontFamily: 'Courier New',
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
        fontFamily: 'Courier New',
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
        fontFamily: 'Courier New',
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

    const reward = rewardMap[behavior];
    const chainMult = chainStep === 2 ? 1.8 : 1;
    const assistLabel = chainStep === 2 ? `连携${reward.text}` : reward.text;
    const marker = this.add.text(container.x, container.y - 48, `E 协助 · ${assistLabel}`, {
      fontSize: '11px',
      color: chainStep === 2 ? '#f97316' : '#facc15',
      fontFamily: 'Courier New',
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
    const amount = Math.max(
      1,
      Math.round(task.rewardAmount * bonusMult * this.getRunDayActivityGainMultiplier())
    );
    gameState.addResource(task.rewardResource, amount);
    gameState.addExperience(task.rewardExp + Math.floor((gameState.data.currentDay || 1) / 2));
    events.emit('update-resources', gameState.data.resources);
    this.showFloatingText(
      container?.x || this.player.x,
      (container?.y || this.player.y) - 40,
      `${task.chainStep === 2 ? '连携协助' : '协助成功'} ${name} +${amount}${task.rewardResource === 'food' ? '食物' : task.rewardResource === 'ammo' ? '弹药' : task.rewardResource === 'wood' ? '木材' : task.rewardResource === 'scrap' ? '零件' : '资源'}`,
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
      .filter(([, container]) => container.active && container.visible);
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
        resource = Math.random() < 0.3 ? 'water' : 'food';
        amount = Math.max(1, Math.round((Math.random() < 0.2 ? 2 : 1) * moraleMul * profileMul));
        exp = 2;
        color = '#38bdf8';
        text = resource === 'water' ? '净水补给' : '渔获补给';
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
        resource = Math.random() < 0.58 ? 'scrap' : 'metal';
        amount = Math.max(1, Math.round((Math.random() < 0.24 ? 2 : 1) * moraleMul * profileMul));
        exp = 3;
        color = '#fda4af';
        text = '探险发现';
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
        amount = Math.max(1, Math.round(amount * runMul));
      }

      if (!resource || amount <= 0) continue;
      hadGain = true;
      gameState.addResource(resource, amount);
      gameState.addExperience(exp);
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
            gameState.addExperience(1);
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

    const entries = Array.from(this.baseResidents.entries());
    const [companionId, container] = Phaser.Utils.Array.GetRandom(entries);
    if (!container || !container.active) return;
    const behavior = (container.getData('behavior') || 'stroll') as ResidentBehavior;
    const companion = gameState.data.companions.find(c => c.id === companionId);
    const name = companion?.name?.split('(')[0] || '伙伴';
    const hints: Record<ResidentBehavior, { text: string; color: string; icon: string }> = {
      fishing: { text: `${name} 钓到补给`, color: '#38bdf8', icon: '◉' },
      cooking: { text: `${name} 正在做饭`, color: '#fb923c', icon: '♨' },
      guard: { text: `${name} 正在巡逻`, color: '#93c5fd', icon: '⚑' },
      sleep: { text: `${name} 在休息`, color: '#c4b5fd', icon: 'Z' },
      forage: { text: `${name} 外出搜集`, color: '#4ade80', icon: '✦' },
      adventure: { text: `${name} 正在探险`, color: '#fca5a5', icon: '✧' },
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
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1002);
    const pop = this.add.text(container.x, container.y - 34, line, {
      fontSize: usePersonaLine ? '11px' : '12px',
      color: hint.color,
      fontFamily: 'Courier New',
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
      gameState.addResource('food', Math.max(1, Math.round(1 * gainScale)));
      if (Math.random() < 0.28 + moraleBoost * 0.5) gameState.addResource('water', 1);
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 22, container.y - 48, '+食物', '#22c55e', false);
    } else if (behavior === 'cooking' && gainRoll < 0.42 + moraleBoost) {
      gameState.addResource('food', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 22, container.y - 48, '+食物', '#fb923c', false);
    } else if (behavior === 'forage' && gainRoll < 0.48 + moraleBoost) {
      gameState.addResource(Math.random() < 0.5 ? 'wood' : 'scrap', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+材料', '#4ade80', false);
    } else if (behavior === 'adventure' && gainRoll < 0.4 + moraleBoost) {
      gameState.addResource(Math.random() < 0.55 ? 'scrap' : 'metal', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+发现', '#fda4af', false);
    } else if (behavior === 'guard' && gainRoll < 0.25 + moraleBoost * 0.7) {
      gameState.addResource('ammo', Math.max(1, Math.round(1 * gainScale)));
      events.emit('update-resources', gameState.data.resources);
      this.showFloatingText(container.x + 24, container.y - 48, '+弹药', '#93c5fd', false);
    }

    this.maybeCreateResidentAssistTask(companionId, behavior);
  }

  private maybeEmitResidentSocialMoment(): void {
    if (this.isGameOver || gameState.data.isNight) return;
    const activeResidents = Array.from(this.baseResidents.entries())
      .filter(([, container]) => container.active && container.visible);
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
        gameState.addExperience(1);
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
    this.clearResidentAssistTask();
    this.residentDayYieldNextAt.clear();
    this.activateNightResidentDefense();
    const triggered = this.maybeTriggerRunEvent('night');
    if (triggered) {
      this.pendingNightWaveStartAfterEvent = true;
    } else {
      this.waveSystem.startNightWaves();
    }
    this.updateExplorationSpotStatus(true);
  }

  private onDayStart(): void {
    this.waveSystem.stopWaves();
    this.deactivateNightResidentDefense();
    CompanionPersonalitySystem.applyDailyDrift(gameState.data.companions);
    this.residentDayYieldNextAt.clear();
    this.dayActivityUsage.clear();
    this.updateExplorationSpotStatus(true);
    QuestSystem.updateProgress('survive_time', undefined, 1);
    this.pendingNightWaveStartAfterEvent = false;
    this.maybeTriggerRunEvent('day');

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

      const rates = BaseSystem.getDailyExchangeRates();
      const topRates = (Object.keys(rates) as Array<keyof typeof rates>)
        .sort((a, b) => rates[b] - rates[a])
        .slice(0, 2)
        .map(key => `${BaseSystem.getResourceShortName(key)} ${rates[key].toFixed(3)}₿`)
        .join(' | ');
      const glassesIndex = BaseSystem.getDailyGlassesPriceMultiplier();
      this.showFloatingText(w / 2, y + 30, `行情: ${topRates}  ·  镜价指数 x${glassesIndex.toFixed(2)}`, '#38bdf8', true);
      this.showFloatingText(w / 2, y + 60, '白天日常开启：伙伴将持续产出与触发协助事件', '#93c5fd', true);
      this.showFloatingText(w / 2, y + 90, '白天探索：河流钓鱼/游泳 · 森林打猎 · 城区搜刮 · 山洞探险', '#22d3ee', true);
      if (this.activeRunMutators.length > 0) {
        this.showFloatingText(
          w / 2,
          y + 120,
          `本局词缀: ${this.activeRunMutators.map((m) => m.nameCN).join(' · ')}`,
          '#fbbf24',
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

  private onLootCollected(data: { type: string; amount: number }): void {
    if (!data || !data.type) return;
    QuestSystem.updateProgress('collect', data.type, Math.max(1, data.amount || 1));
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
      changed += 1;
    });
    if (changed <= 0) return;

    if (nextStatus === 'base') {
      BaseSystem.autoAssignBaseCompanions();
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
    updateGroup(this.vsBullets);
  }

  // ============================================================
  // GAME OVER
  // ============================================================
  private gameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.waveSystem.stopWaves();

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
      fontSize: '42px', color: '#ef4444', fontFamily: 'Courier New', fontStyle: 'bold',
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
      fontFamily: 'Courier New', fontStyle: 'bold',
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
      fontSize: '16px', color: '#e2e8f0', fontFamily: 'Courier New',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501).setAlpha(0);
    this.tweens.add({ targets: statsTextObj, alpha: 1, duration: 500, delay: 1400 });

    const btcText = this.add.text(w / 2, h / 2 + 120, `本轮结算: +₿${banked.toFixed(3)}  |  永久账户: ₿${gameState.meta.bitcoinBank.toFixed(3)}`, {
      fontSize: '15px', color: '#fbbf24', fontFamily: 'Courier New',
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
      fontSize: '12px', color: '#22c55e', fontFamily: 'Courier New', fontStyle: 'bold',
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
          fontFamily: 'Courier New',
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
      fontSize: '22px', color: picked ? '#0ea5e9' : '#64748b', fontFamily: 'Courier New', fontStyle: 'bold',
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
    this.scene.stop('UIScene');
    this.scene.restart();
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
    this.baseLifePulseTimer = null;
    this.residentSocialPulseTimer = null;
    this.baseRoutineTimer = null;
    this.dayResidentEconomyTimer = null;
    this.residentDayYieldNextAt.clear();
    this.companionCombatRecentChatter.clear();
    this.companionCombatNextAt.clear();
    this.clearResidentAssistTask();
    this.clearExplorationEdgeIndicators();
    this.runEventAutoPickTimer?.remove(false);
    this.runEventAutoPickTimer = null;
    this.runEventContainer?.destroy();
    this.runEventContainer = null;
    this.runEventOpen = false;
    this.setUISceneInputEnabled(true);
    this.pendingNightWaveStartAfterEvent = false;
    this.playerSystem?.setVirtualDirection(0, 0);
    (window as any).__force_bloodmoon_test = undefined;
    (window as any).__debug_trigger_run_event = undefined;
    (window as any).__in_game = false;
  }
}
