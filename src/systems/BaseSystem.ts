import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import type { Resources } from '../state/GameState';
import type { CompanionData } from '../state/GameState';
import type { CompanionAutoDuty } from '../state/GameState';
import type { BaseNodeDiagnostic, BaseNodeIssue } from '../state/GameState';
import {
  BUILDING_DEFS,
  getBuildingMorphUpgrade,
  getBuildingTierTechRequirements,
  type BuildingRequirement,
} from '../data/buildings';
import { BASE_PLACEMENT_RULE, getBuildingEcology, type BuildZone } from '../data/buildingEcology';
import { BASE_JOB_BONUS, BASE_JOB_LABELS, BASE_JOB_ORDER, BASE_POWER_CAPACITY, BASE_POWER_PER_TURRET, BaseJob } from '../data/base';
import { events, GameEvents } from '../utils/EventBus';
import { CompanionPersonalitySystem } from './CompanionPersonalitySystem';

type ExchangeResource = Exclude<keyof Resources, 'bitcoin'>;
type RuntimeBuilding = { id: string; x: number; y: number; tier: number };
type ProfessionBonus = Partial<Pick<Resources, 'food' | 'wood' | 'metal' | 'scrap' | 'medical' | 'water' | 'ammo'>>;
type LeisurePerformance = 'poor' | 'good' | 'perfect';
type DayBuffKind = 'trade' | 'morale' | 'training';
type ResourceKey = Exclude<keyof Resources, 'bitcoin'>;

export type BuildChainStatus = {
  canConstruct: boolean;
  roleCN: string;
  chainCN: string;
  zone: BuildZone;
  zoneLabelCN: string;
  blockedReasons: string[];
};

export type BuildPlacementStatus = BuildChainStatus & {
  canPlace: boolean;
  positionReason?: string;
  distanceToCore: number;
};

export type StructureIntegrityStatus = {
  breachOpen: boolean;
  ringCoverage: number;
  sealedRatio: number;
  defenseMul: number;
  wallCount: number;
  gateCount: number;
};

export type BuildingUpgradeCheck = {
  available: boolean;
  canAfford: boolean;
  kind: 'tier' | 'morph' | 'none';
  fromId: string;
  toId: string;
  fromTier: number;
  toTier: number;
  cost: Partial<Record<ResourceKey, number>>;
  blockedReasons: string[];
  summary: string;
};

type EcologyScore = {
  defense: number;
  sustain: number;
  industry: number;
  comfort: number;
  intel: number;
  total: number;
};

type EcologySnapshot = {
  linkIntegrity: number;
  upkeepRatio: number;
  productionRatio: number;
  score: EcologyScore;
  warnings: string[];
  upkeepNeed: Partial<Record<ResourceKey, number>>;
  inputNeed: Partial<Record<ResourceKey, number>>;
  totalNeed: Partial<Record<ResourceKey, number>>;
  supplyRatioByResource: Partial<Record<ResourceKey, number>>;
  structure: StructureIntegrityStatus;
};

type RuntimeBuildingNeed = {
  idx: number;
  need: Partial<Record<ResourceKey, number>>;
};

export class BaseSystem {
  private static readonly BASE_POPULATION_CAPACITY = 2;
  private static readonly ROOM_QUARTERS_CAPACITY = 4;
  private static readonly ROOM_QUARTERS_PER_TIER = 2;
  private static readonly BUNK_BED_CAPACITY = 2;
  private static readonly BUNK_BED_PER_TIER = 1;
  private static readonly GRID_SIZE = 64;
  private static readonly WORLD_WIDTH = 2000;
  private static readonly WORLD_HEIGHT = 1500;
  private static readonly CORE_BREACH_RADIUS = 164;
  private static readonly RING_SAMPLE_RADIUS = 228;
  private static readonly RING_SAMPLE_COUNT = 28;
  private static readonly RING_COVERAGE_DISTANCE = 86;
  private static readonly BARRIER_IDS = new Set<string>(['wall', 'reinforced_wall', 'gate']);

  private static readonly EXCHANGE_BASE: Record<ExchangeResource, number> = {
    wood: 0.015,
    metal: 0.032,
    food: 0.022,
    water: 0.016,
    scrap: 0.028,
    medical: 0.05,
    ammo: 0.034,
    energyCore: 0.65,
  };

  private static readonly PROFESSION_BONUS_TABLE: Array<{ keywords: string[]; bonus: ProfessionBonus; label: string }> = [
    { keywords: ['厨师'], bonus: { food: 3 }, label: '食物+3/日' },
    { keywords: ['拾荒者', '快递员', '商人'], bonus: { wood: 1, metal: 1, scrap: 1 }, label: '杂项材料+3/日' },
    { keywords: ['工程师', '建筑工人', '电工'], bonus: { scrap: 2, metal: 1 }, label: '零件+2 金属+1/日' },
    { keywords: ['医生', '护士', '心理医生'], bonus: { medical: 1, food: 1 }, label: '医疗+1 食物+1/日' },
    { keywords: ['退伍军人', '武术教练', '消防员'], bonus: { ammo: 2 }, label: '弹药+2/日' },
    { keywords: ['程序员', '黑客', '摄影师', '画家', '飞行员', '会计', '化学老师'], bonus: { scrap: 1 }, label: '零件+1/日' },
  ];

  private static getLeisureFlag(day: number = gameState.data.currentDay): string {
    return `leisure_done_day_${day}`;
  }

  private static getDayBuffFlag(kind: DayBuffKind, day: number = gameState.data.currentDay): string {
    return `day_buff_${kind}_${day}`;
  }

  private static seeded(day: number, salt: number): number {
    const x = Math.sin(day * 997 + salt * 131) * 10000;
    return x - Math.floor(x);
  }

  private static toRuntimeBuildings(
    buildings: Array<{ id: string; x: number; y: number; tier?: number }> = gameState.data.buildings
  ): RuntimeBuilding[] {
    return buildings.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      tier: Math.max(1, b.tier || 1),
    }));
  }

  private static getBuildingCounts(buildings: RuntimeBuilding[]): Record<string, number> {
    const counts: Record<string, number> = {};
    buildings.forEach((b) => {
      counts[b.id] = (counts[b.id] || 0) + 1;
    });
    return counts;
  }

  private static getZoneLabelCN(zone: BuildZone): string {
    if (zone === 'inner') return '内圈';
    if (zone === 'outer') return '外圈';
    return '任意';
  }

  private static getBuildingNameCN(buildingId: string): string {
    return BUILDING_DEFS[buildingId]?.nameCN || buildingId;
  }

  private static getBuildingCountsById(
    buildings: Array<{ id: string }>
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    buildings.forEach((b) => {
      counts[b.id] = (counts[b.id] || 0) + 1;
    });
    return counts;
  }

  private static checkBuildingRequirements(
    requirements: BuildingRequirement[] | undefined,
    counts: Record<string, number>
  ): string[] {
    if (!requirements?.length) return [];
    const blocked: string[] = [];
    requirements.forEach((req) => {
      const own = counts[req.buildingId] || 0;
      if (own < req.minCount) {
        blocked.push(`需${this.getBuildingNameCN(req.buildingId)}x${req.minCount}（当前${own}）`);
      }
    });
    return blocked;
  }

  private static computeScaledCost(
    baseCost: Record<string, number> | undefined,
    scale: number
  ): Partial<Record<ResourceKey, number>> {
    const cost: Partial<Record<ResourceKey, number>> = {};
    if (!baseCost) return cost;
    (Object.entries(baseCost) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
      if (!amount || amount <= 0) return;
      cost[res] = Math.max(1, Math.round(amount * scale));
    });
    return cost;
  }

  private static computeTierUpgradeCost(
    buildingId: string,
    fromTier: number,
    toTier: number
  ): Partial<Record<ResourceKey, number>> {
    const def = BUILDING_DEFS[buildingId];
    if (!def) return {};
    const useUpgradeCost = def.upgradeCost && Object.keys(def.upgradeCost).length > 0
      ? def.upgradeCost
      : def.cost;
    const tierStep = Math.max(1, toTier - Math.max(1, fromTier));
    const scale = 0.72 + Math.max(0, toTier - 2) * 0.2 + Math.max(0, tierStep - 1) * 0.08;
    return this.computeScaledCost(useUpgradeCost as Record<string, number>, scale);
  }

  private static hasResources(cost: Partial<Record<ResourceKey, number>>): boolean {
    return (Object.entries(cost) as Array<[ResourceKey, number]>).every(([res, amount]) => {
      const own = gameState.data.resources[res] || 0;
      return own >= (amount || 0);
    });
  }

  private static buildCostSummary(cost: Partial<Record<ResourceKey, number>>): string {
    const resourceOrder: ResourceKey[] = ['wood', 'metal', 'scrap', 'food', 'water', 'medical', 'ammo', 'energyCore'];
    const parts = resourceOrder
      .map((key) => ({ key, amount: cost[key] || 0 }))
      .filter((item) => item.amount > 0)
      .map((item) => `${this.getResourceShortName(item.key as ExchangeResource)}${item.amount}`);
    return parts.join(' ');
  }

  private static scaleNeedByTier(
    needDef: Partial<Resources> | undefined,
    tier: number
  ): Partial<Record<ResourceKey, number>> {
    const out: Partial<Record<ResourceKey, number>> = {};
    if (!needDef) return out;
    (Object.entries(needDef) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
      if (!amount || amount <= 0) return;
      out[res] = amount * Math.max(1, tier);
    });
    return out;
  }

  private static allocateNeedAndMarkShortage(
    requirements: RuntimeBuildingNeed[],
    available: Partial<Record<ResourceKey, number>>
  ): Map<number, Map<ResourceKey, number>> {
    const shortage = new Map<number, Map<ResourceKey, number>>();
    requirements.forEach((req) => {
      (Object.entries(req.need) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
        if (!amount || amount <= 0) return;
        const own = Math.max(0, available[res] || 0);
        if (own >= amount) {
          available[res] = own - amount;
          return;
        }
        available[res] = 0;
        const missing = Math.max(0, amount - own);
        const current = shortage.get(req.idx) || new Map<ResourceKey, number>();
        current.set(res, (current.get(res) || 0) + missing);
        shortage.set(req.idx, current);
      });
    });
    return shortage;
  }

  private static sumNeedMap(
    a: Partial<Record<ResourceKey, number>>,
    b: Partial<Record<ResourceKey, number>>
  ): Partial<Record<ResourceKey, number>> {
    const keys = new Set<ResourceKey>([
      ...Object.keys(a) as ResourceKey[],
      ...Object.keys(b) as ResourceKey[],
    ]);
    const merged: Partial<Record<ResourceKey, number>> = {};
    keys.forEach((key) => {
      const total = (a[key] || 0) + (b[key] || 0);
      if (total > 0) merged[key] = total;
    });
    return merged;
  }

  private static computeNeedRatio(
    need: Partial<Record<ResourceKey, number>>,
    ratios: Partial<Record<ResourceKey, number>>
  ): number {
    let weightedNeed = 0;
    let weightedSupply = 0;
    (Object.entries(need) as Array<[ResourceKey, number]>).forEach(([key, amount]) => {
      if (!amount || amount <= 0) return;
      const ratio = Phaser.Math.Clamp(ratios[key] || 0, 0, 1);
      weightedNeed += amount;
      weightedSupply += amount * ratio;
    });
    if (weightedNeed <= 0) return 1;
    return Phaser.Math.Clamp(weightedSupply / weightedNeed, 0, 1);
  }

  private static getGridCellCenter(col: number, row: number): { x: number; y: number } {
    const x = 32 + col * this.GRID_SIZE;
    const y = 32 + row * this.GRID_SIZE;
    return { x, y };
  }

  private static worldToGridCell(x: number, y: number): { col: number; row: number } {
    const col = Math.round((x - 32) / this.GRID_SIZE);
    const row = Math.round((y - 32) / this.GRID_SIZE);
    return { col, row };
  }

  private static evaluateStructureIntegrity(buildings: RuntimeBuilding[]): StructureIntegrityStatus {
    const barriers = buildings.filter((b) => this.BARRIER_IDS.has(b.id));
    const wallCount = barriers.filter((b) => b.id !== 'gate').length;
    const gateCount = barriers.filter((b) => b.id === 'gate').length;
    if (barriers.length <= 0) {
      return {
        breachOpen: true,
        ringCoverage: 0,
        sealedRatio: 0.25,
        defenseMul: 0.66,
        wallCount: 0,
        gateCount: 0,
      };
    }

    const cols = Math.max(1, Math.ceil(this.WORLD_WIDTH / this.GRID_SIZE));
    const rows = Math.max(1, Math.ceil(this.WORLD_HEIGHT / this.GRID_SIZE));
    const blocked: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    const blockedCenters: Array<{ x: number; y: number }> = [];
    barriers.forEach((b) => {
      const cell = this.worldToGridCell(b.x, b.y);
      if (cell.col < 0 || cell.col >= cols || cell.row < 0 || cell.row >= rows) return;
      blocked[cell.row][cell.col] = true;
      blockedCenters.push(this.getGridCellCenter(cell.col, cell.row));
    });

    const coreMask: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    let coreCount = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const center = this.getGridCellCenter(col, row);
        const d = Phaser.Math.Distance.Between(
          center.x,
          center.y,
          BASE_PLACEMENT_RULE.innerCenterX,
          BASE_PLACEMENT_RULE.innerCenterY
        );
        if (d <= this.CORE_BREACH_RADIUS) {
          coreMask[row][col] = true;
          coreCount += 1;
        }
      }
    }
    if (coreCount <= 0) {
      const fallback = this.worldToGridCell(BASE_PLACEMENT_RULE.innerCenterX, BASE_PLACEMENT_RULE.innerCenterY);
      if (fallback.col >= 0 && fallback.col < cols && fallback.row >= 0 && fallback.row < rows) {
        coreMask[fallback.row][fallback.col] = true;
      }
    }

    const visited: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    const qCol: number[] = [];
    const qRow: number[] = [];
    const pushIfPassable = (col: number, row: number): void => {
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;
      if (blocked[row][col] || visited[row][col]) return;
      visited[row][col] = true;
      qCol.push(col);
      qRow.push(row);
    };

    for (let col = 0; col < cols; col += 1) {
      pushIfPassable(col, 0);
      pushIfPassable(col, rows - 1);
    }
    for (let row = 0; row < rows; row += 1) {
      pushIfPassable(0, row);
      pushIfPassable(cols - 1, row);
    }

    let breachOpen = false;
    let head = 0;
    while (head < qCol.length) {
      const col = qCol[head];
      const row = qRow[head];
      head += 1;
      if (coreMask[row][col]) {
        breachOpen = true;
        break;
      }
      pushIfPassable(col + 1, row);
      pushIfPassable(col - 1, row);
      pushIfPassable(col, row + 1);
      pushIfPassable(col, row - 1);
    }

    let covered = 0;
    for (let i = 0; i < this.RING_SAMPLE_COUNT; i += 1) {
      const angle = (Math.PI * 2 * i) / this.RING_SAMPLE_COUNT;
      const sx = BASE_PLACEMENT_RULE.innerCenterX + Math.cos(angle) * this.RING_SAMPLE_RADIUS;
      const sy = BASE_PLACEMENT_RULE.innerCenterY + Math.sin(angle) * this.RING_SAMPLE_RADIUS;
      const hasNearbyBarrier = blockedCenters.some((p) => Phaser.Math.Distance.Between(sx, sy, p.x, p.y) <= this.RING_COVERAGE_DISTANCE);
      if (hasNearbyBarrier) covered += 1;
    }
    const ringCoverage = Phaser.Math.Clamp(covered / this.RING_SAMPLE_COUNT, 0, 1);
    const sealedRatio = Phaser.Math.Clamp(
      (breachOpen ? 0.42 : 1) * (0.45 + ringCoverage * 0.55),
      0.22,
      1
    );
    const defenseMul = Phaser.Math.Clamp(0.58 + sealedRatio * 0.42, 0.58, 1);

    return {
      breachOpen,
      ringCoverage,
      sealedRatio,
      defenseMul,
      wallCount,
      gateCount,
    };
  }

  static getStructureIntegrityStatus(
    buildings: Array<{ id: string; x: number; y: number; tier?: number }> = gameState.data.buildings
  ): StructureIntegrityStatus {
    const runtime = this.toRuntimeBuildings(buildings);
    return this.evaluateStructureIntegrity(runtime);
  }

  static getBuildChainStatus(
    buildingId: string,
    day: number = gameState.data.currentDay,
    buildings: Array<{ id: string; x: number; y: number; tier?: number }> = gameState.data.buildings
  ): BuildChainStatus {
    const ecology = getBuildingEcology(buildingId);
    const roleCN = ecology?.roleCN || '基础模块';
    const chainCN = ecology?.chainCN || '通用建造链';
    const zone = ecology?.zone || 'any';
    const zoneLabelCN = this.getZoneLabelCN(zone);
    const blockedReasons: string[] = [];

    if (ecology?.unlockDay && day < ecology.unlockDay) {
      blockedReasons.push(`第${ecology.unlockDay}天解锁`);
    }

    if (ecology?.requires?.length) {
      const runtime = this.toRuntimeBuildings(buildings);
      const counts = this.getBuildingCounts(runtime);
      ecology.requires.forEach((req) => {
        const own = counts[req.buildingId] || 0;
        if (own < req.minCount) {
          blockedReasons.push(
            `需 ${this.getBuildingNameCN(req.buildingId)} x${req.minCount}（当前${own}）`
          );
        }
      });
    }

    return {
      canConstruct: blockedReasons.length === 0,
      roleCN,
      chainCN,
      zone,
      zoneLabelCN,
      blockedReasons,
    };
  }

  static validateBuildPlacement(
    buildingId: string,
    x: number,
    y: number,
    day: number = gameState.data.currentDay,
    buildings: Array<{ id: string; x: number; y: number; tier?: number }> = gameState.data.buildings
  ): BuildPlacementStatus {
    const chain = this.getBuildChainStatus(buildingId, day, buildings);
    const dx = x - BASE_PLACEMENT_RULE.innerCenterX;
    const dy = y - BASE_PLACEMENT_RULE.innerCenterY;
    const distanceToCore = Math.sqrt(dx * dx + dy * dy);
    let positionReason: string | undefined;
    let zoneOk = true;

    if (chain.zone === 'inner' && distanceToCore > BASE_PLACEMENT_RULE.innerRadius) {
      zoneOk = false;
      positionReason = `仅可放置在基地内圈（≤${Math.round(BASE_PLACEMENT_RULE.innerRadius)}）`;
    }
    if (chain.zone === 'outer' && distanceToCore < BASE_PLACEMENT_RULE.outerMinRadius) {
      zoneOk = false;
      positionReason = `仅可放置在基地外圈（≥${Math.round(BASE_PLACEMENT_RULE.outerMinRadius)}）`;
    }

    return {
      ...chain,
      canPlace: chain.canConstruct && zoneOk,
      positionReason,
      distanceToCore,
    };
  }

  static getBuildingUpgradeCheck(
    fromId: string,
    toSelectedId: string,
    fromTier: number,
    day: number = gameState.data.currentDay,
    buildings: Array<{ id: string; x: number; y: number; tier?: number }> = gameState.data.buildings,
    sourcePos?: { x: number; y: number }
  ): BuildingUpgradeCheck {
    const sourceDef = BUILDING_DEFS[fromId];
    const selectedDef = BUILDING_DEFS[toSelectedId];
    if (!sourceDef || !selectedDef) {
      return {
        available: false,
        canAfford: false,
        kind: 'none',
        fromId,
        toId: toSelectedId,
        fromTier,
        toTier: fromTier,
        cost: {},
        blockedReasons: ['建筑数据不存在'],
        summary: '不可升级',
      };
    }

    const runtime = this.toRuntimeBuildings(buildings);
    const counts = this.getBuildingCountsById(runtime);

    // Tier upgrade: same building ID, same coordinate, tier +1
    if (fromId === toSelectedId) {
      const targetTier = Math.max(1, fromTier) + 1;
      if (targetTier > sourceDef.maxTier) {
        return {
          available: false,
          canAfford: false,
          kind: 'none',
          fromId,
          toId: fromId,
          fromTier,
          toTier: fromTier,
          cost: {},
          blockedReasons: ['已达满级'],
          summary: `${sourceDef.nameCN} 已满级`,
        };
      }
      const blockedReasons: string[] = [];
      if (targetTier >= 3 && day < 2) blockedReasons.push('第2天后可升至T3+');
      if (targetTier >= 4 && day < 4) blockedReasons.push('第4天后可升至T4');
      blockedReasons.push(...this.checkBuildingRequirements(getBuildingTierTechRequirements(targetTier), counts));
      const cost = this.computeTierUpgradeCost(fromId, fromTier, targetTier);
      const canAfford = this.hasResources(cost);
      if (!canAfford) blockedReasons.push('资源不足');
      return {
        available: blockedReasons.filter((r) => r !== '资源不足').length === 0,
        canAfford,
        kind: 'tier',
        fromId,
        toId: fromId,
        fromTier,
        toTier: targetTier,
        cost,
        blockedReasons,
        summary: `${sourceDef.nameCN} T${fromTier}→T${targetTier}`,
      };
    }

    // Morph upgrade: branch transform on same coordinate
    const morph = getBuildingMorphUpgrade(fromId, toSelectedId);
    if (!morph) {
      return {
        available: false,
        canAfford: false,
        kind: 'none',
        fromId,
        toId: toSelectedId,
        fromTier,
        toTier: selectedDef.tier,
        cost: {},
        blockedReasons: ['该建筑无法升级为所选目标'],
        summary: '不可升级',
      };
    }

    const blockedReasons: string[] = [];
    if (morph.requiresDay && day < morph.requiresDay) {
      blockedReasons.push(`第${morph.requiresDay}天解锁`);
    }
    blockedReasons.push(...this.checkBuildingRequirements(morph.requiresBuildings, counts));

    // simulate replacement and apply chain rules
    const simulated = runtime.map((b) => ({ ...b }));
    const targetIndex = sourcePos
      ? simulated.findIndex((b) => Math.abs(b.x - sourcePos.x) < 2 && Math.abs(b.y - sourcePos.y) < 2)
      : simulated.findIndex((b) => b.id === fromId);
    if (targetIndex !== -1) {
      simulated[targetIndex].id = toSelectedId;
      simulated[targetIndex].tier = selectedDef.tier;
    }
    const chain = this.getBuildChainStatus(toSelectedId, day, simulated);
    if (!chain.canConstruct && chain.blockedReasons.length > 0) {
      blockedReasons.push(chain.blockedReasons[0]);
    }

    const cost = this.computeScaledCost(selectedDef.cost as Record<string, number>, morph.costMul || 0.7);
    const canAfford = this.hasResources(cost);
    if (!canAfford) blockedReasons.push('资源不足');

    return {
      available: blockedReasons.filter((r) => r !== '资源不足').length === 0,
      canAfford,
      kind: 'morph',
      fromId,
      toId: toSelectedId,
      fromTier,
      toTier: selectedDef.tier,
      cost,
      blockedReasons,
      summary: `${this.getBuildingNameCN(fromId)} → ${selectedDef.nameCN}`,
    };
  }

  static getBuildingUpgradeCostText(check: BuildingUpgradeCheck): string {
    if (!check.cost || Object.keys(check.cost).length <= 0) return '无';
    return this.buildCostSummary(check.cost);
  }

  private static computeEcologySnapshot(
    buildings: RuntimeBuilding[] = this.toRuntimeBuildings(),
    resources: Resources = gameState.data.resources
  ): EcologySnapshot {
    if (buildings.length === 0) {
      const structure = this.evaluateStructureIntegrity(buildings);
      return {
        linkIntegrity: 1,
        upkeepRatio: 1,
        productionRatio: 1,
        score: { defense: 0, sustain: 0, industry: 0, comfort: 0, intel: 0, total: 0 },
        warnings: ['暂无建筑链路，建议尽快建立基础生产与防线'],
        upkeepNeed: {},
        inputNeed: {},
        totalNeed: {},
        supplyRatioByResource: {},
        structure,
      };
    }

    const day = gameState.data.currentDay;
    const warnings: string[] = [];
    const seenWarnings = new Set<string>();
    const addWarning = (msg: string) => {
      if (seenWarnings.has(msg)) return;
      seenWarnings.add(msg);
      warnings.push(msg);
    };

    const upkeepNeed: Partial<Record<ResourceKey, number>> = {};
    const inputNeed: Partial<Record<ResourceKey, number>> = {};
    const score: EcologyScore = { defense: 0, sustain: 0, industry: 0, comfort: 0, intel: 0, total: 0 };
    const structure = this.evaluateStructureIntegrity(buildings);

    let linkedCount = 0;
    buildings.forEach((b) => {
      const chain = this.getBuildChainStatus(b.id, day, buildings);
      const eco = getBuildingEcology(b.id);
      const tier = Math.max(1, b.tier || 1);
      const isLinked = chain.canConstruct;
      if (isLinked) linkedCount += 1;
      if (!isLinked && chain.blockedReasons.length > 0) {
        addWarning(`${this.getBuildingNameCN(b.id)}链路受阻：${chain.blockedReasons[0]}`);
      }
      if (!eco) return;

      const scoreMul = isLinked ? 1 : 0.5;
      if (eco.score) {
        score.defense += (eco.score.defense || 0) * tier * scoreMul;
        score.sustain += (eco.score.sustain || 0) * tier * scoreMul;
        score.industry += (eco.score.industry || 0) * tier * scoreMul;
        score.comfort += (eco.score.comfort || 0) * tier * scoreMul;
        score.intel += (eco.score.intel || 0) * tier * scoreMul;
      }

      if (eco.upkeep) {
        (Object.entries(eco.upkeep) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
          if (!amount || amount <= 0) return;
          upkeepNeed[res] = (upkeepNeed[res] || 0) + amount * tier;
        });
      }
      if (eco.dailyInput) {
        (Object.entries(eco.dailyInput) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
          if (!amount || amount <= 0) return;
          inputNeed[res] = (inputNeed[res] || 0) + amount * tier;
        });
      }
    });

    const totalNeed = this.sumNeedMap(upkeepNeed, inputNeed);
    const supplyRatioByResource: Partial<Record<ResourceKey, number>> = {};
    (Object.entries(totalNeed) as Array<[ResourceKey, number]>).forEach(([res, need]) => {
      if (!need || need <= 0) return;
      const own = Math.max(0, resources[res] || 0);
      supplyRatioByResource[res] = Phaser.Math.Clamp(own / need, 0, 1);
      if ((supplyRatioByResource[res] || 0) < 0.95) {
        addWarning(`${this.getResourceShortName(res as ExchangeResource)}紧缺`);
      }
    });

    const linkIntegrity = Phaser.Math.Clamp(linkedCount / Math.max(1, buildings.length), 0, 1);
    const upkeepRatio = this.computeNeedRatio(upkeepNeed, supplyRatioByResource);
    const productionRatio = this.computeNeedRatio(inputNeed, supplyRatioByResource);
    score.defense *= structure.defenseMul;

    if (linkIntegrity < 0.95) {
      addWarning(`建造链完整度不足（${Math.round(linkIntegrity * 100)}%）`);
    }
    if (upkeepRatio < 0.95) {
      addWarning(`维护不足（${Math.round(upkeepRatio * 100)}%），防线性能下降`);
    }
    if (productionRatio < 0.95) {
      addWarning(`生产输入不足（${Math.round(productionRatio * 100)}%），产能下降`);
    }

    const powerCapacity = this.computePowerCapacity(buildings);
    const powerUsed = this.computePowerUsed(buildings);
    if (powerUsed > powerCapacity) {
      addWarning(`电力超载 ${powerUsed}/${powerCapacity}`);
    }
    if (structure.breachOpen) {
      addWarning('防线存在破口，敌人可直达核心');
    } else if (structure.ringCoverage < 0.72) {
      addWarning(`防线覆盖不足（${Math.round(structure.ringCoverage * 100)}%）`);
    }

    score.total = Math.round(
      score.defense * 1.2 +
      score.sustain * 1.05 +
      score.industry * 1.0 +
      score.comfort * 0.85 +
      score.intel * 1.1
    );

    return {
      linkIntegrity,
      upkeepRatio,
      productionRatio,
      score,
      warnings: warnings.slice(0, 5),
      upkeepNeed,
      inputNeed,
      totalNeed,
      supplyRatioByResource,
      structure,
    };
  }

  private static computeNodeDiagnostics(
    buildings: RuntimeBuilding[],
    resources: Resources,
    day: number,
    powerCapacity: number
  ): BaseNodeDiagnostic[] {
    if (buildings.length <= 0) return [];
    const available: Partial<Record<ResourceKey, number>> = {
      wood: Math.max(0, resources.wood || 0),
      metal: Math.max(0, resources.metal || 0),
      scrap: Math.max(0, resources.scrap || 0),
      food: Math.max(0, resources.food || 0),
      water: Math.max(0, resources.water || 0),
      medical: Math.max(0, resources.medical || 0),
      ammo: Math.max(0, resources.ammo || 0),
      energyCore: Math.max(0, resources.energyCore || 0),
    };
    const issueMap = new Map<number, Set<BaseNodeIssue>>();
    const shortageMap = new Map<number, Map<ResourceKey, number>>();
    const linkedFlags = buildings.map((b) => this.getBuildChainStatus(b.id, day, buildings).canConstruct);

    const sortedIndices = buildings
      .map((_b, idx) => idx)
      .sort((a, b) => {
        const ba = buildings[a];
        const bb = buildings[b];
        if (ba.y !== bb.y) return ba.y - bb.y;
        return ba.x - bb.x;
      });

    const upkeepReqs: RuntimeBuildingNeed[] = [];
    const inputReqs: RuntimeBuildingNeed[] = [];
    sortedIndices.forEach((idx) => {
      if (!linkedFlags[idx]) return;
      const building = buildings[idx];
      const eco = getBuildingEcology(building.id);
      if (!eco) return;
      const tier = Math.max(1, building.tier || 1);
      const upkeepNeed = this.scaleNeedByTier(eco.upkeep, tier);
      if (Object.keys(upkeepNeed).length > 0) upkeepReqs.push({ idx, need: upkeepNeed });
      const inputNeed = this.scaleNeedByTier(eco.dailyInput, tier);
      if (Object.keys(inputNeed).length > 0) inputReqs.push({ idx, need: inputNeed });
    });

    const upkeepShort = this.allocateNeedAndMarkShortage(upkeepReqs, available);
    upkeepShort.forEach((resourcesMissing, idx) => {
      const issues = issueMap.get(idx) || new Set<BaseNodeIssue>();
      issues.add('upkeep');
      issueMap.set(idx, issues);
      const shortage = shortageMap.get(idx) || new Map<ResourceKey, number>();
      resourcesMissing.forEach((missing, res) => shortage.set(res, (shortage.get(res) || 0) + missing));
      shortageMap.set(idx, shortage);
    });

    const inputShort = this.allocateNeedAndMarkShortage(inputReqs, available);
    inputShort.forEach((resourcesMissing, idx) => {
      const issues = issueMap.get(idx) || new Set<BaseNodeIssue>();
      issues.add('input');
      issueMap.set(idx, issues);
      const shortage = shortageMap.get(idx) || new Map<ResourceKey, number>();
      resourcesMissing.forEach((missing, res) => shortage.set(res, (shortage.get(res) || 0) + missing));
      shortageMap.set(idx, shortage);
    });

    const powerConsumers = sortedIndices
      .filter((idx) => linkedFlags[idx])
      .map((idx) => {
        const building = buildings[idx];
        const def = BUILDING_DEFS[building.id];
        const need = def?.powerUse || (def?.category === 'turret' ? BASE_POWER_PER_TURRET : 0);
        return { idx, need };
      })
      .filter((item) => item.need > 0);

    let remainingPower = Math.max(0, Math.floor(powerCapacity));
    powerConsumers.forEach((entry) => {
      if (remainingPower >= entry.need) {
        remainingPower -= entry.need;
        return;
      }
      const issues = issueMap.get(entry.idx) || new Set<BaseNodeIssue>();
      issues.add('power');
      issueMap.set(entry.idx, issues);
    });

    const diagnostics: BaseNodeDiagnostic[] = [];
    issueMap.forEach((issues, idx) => {
      if (!issues || issues.size <= 0) return;
      const building = buildings[idx];
      diagnostics.push({
        id: building.id,
        nameCN: this.getBuildingNameCN(building.id),
        x: Math.round(building.x),
        y: Math.round(building.y),
        tier: Math.max(1, building.tier || 1),
        issues: Array.from(issues.values()),
        shortageResources: Array.from(shortageMap.get(idx)?.keys() || []),
        shortageAmounts: Array.from(shortageMap.get(idx)?.entries() || []).reduce<Record<string, number>>((acc, [res, amount]) => {
          acc[res] = Math.max(0, Math.round(amount));
          return acc;
        }, {}),
      });
    });

    diagnostics.sort((a, b) => {
      if (a.issues.length !== b.issues.length) return b.issues.length - a.issues.length;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    return diagnostics;
  }

  static refreshBaseState(): void {
    gameState.data.companions.forEach(c => {
      if (!c.status) c.status = 'party';
      if (!c.job) c.job = 'idle';
      CompanionPersonalitySystem.ensureProfile(c);
    });
    const buildings = this.toRuntimeBuildings();
    const powerCapacity = this.computePowerCapacity(buildings);
    const powerUsed = this.computePowerUsed(buildings);
    const { jobSlots, jobAssigned } = this.computeJobSlotsAndAssignments(buildings);
    const foodProduction = this.computeFoodProduction(buildings, jobAssigned);
    const foodConsumption = this.computeFoodConsumption();
    const eco = this.computeEcologySnapshot(buildings, gameState.data.resources);
    const nodeDiagnostics = this.computeNodeDiagnostics(
      buildings,
      gameState.data.resources,
      gameState.data.currentDay,
      powerCapacity
    );
    const diagnosticUpkeepNodes = nodeDiagnostics.filter((d) => d.issues.includes('upkeep')).length;
    const diagnosticInputNodes = nodeDiagnostics.filter((d) => d.issues.includes('input')).length;
    const diagnosticPowerNodes = nodeDiagnostics.filter((d) => d.issues.includes('power')).length;
    const ecologyIntegrity = Phaser.Math.Clamp(
      eco.linkIntegrity * 0.45 + eco.upkeepRatio * 0.2 + eco.productionRatio * 0.2 + eco.structure.sealedRatio * 0.15,
      0,
      1
    );

    gameState.data.base.powerCapacity = powerCapacity;
    gameState.data.base.powerUsed = powerUsed;
    gameState.data.base.jobSlots = jobSlots;
    gameState.data.base.jobAssigned = jobAssigned;
    gameState.data.base.foodProduction = foodProduction;
    gameState.data.base.foodConsumption = foodConsumption;
    gameState.data.base.ecologyIntegrity = ecologyIntegrity;
    gameState.data.base.ecologyUpkeepRatio = eco.upkeepRatio;
    gameState.data.base.ecologyProductionRatio = eco.productionRatio;
    gameState.data.base.ecologyDefenseScore = Math.round(eco.score.defense);
    gameState.data.base.ecologySustainScore = Math.round(eco.score.sustain);
    gameState.data.base.ecologyIndustryScore = Math.round(eco.score.industry);
    gameState.data.base.ecologyComfortScore = Math.round(eco.score.comfort);
    gameState.data.base.ecologyIntelScore = Math.round(eco.score.intel);
    gameState.data.base.ecologyTotalScore = Math.round(eco.score.total);
    gameState.data.base.ecologyWarnings = [...eco.warnings];
    gameState.data.base.diagnosticUpkeepNodes = diagnosticUpkeepNodes;
    gameState.data.base.diagnosticInputNodes = diagnosticInputNodes;
    gameState.data.base.diagnosticPowerNodes = diagnosticPowerNodes;
    gameState.data.base.nodeDiagnostics = nodeDiagnostics.slice(0, 80);
    gameState.data.base.structureIntegrity = eco.structure.sealedRatio;
    gameState.data.base.structureCoverage = eco.structure.ringCoverage;
    gameState.data.base.structureBreachOpen = eco.structure.breachOpen;

    events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
  }

  static applyDailyTick(): {
    production: Record<string, number>;
    jobFood: number;
    jobMedical: number;
    jobScrap: number;
    professionBonus: ProfessionBonus;
    consumption: number;
    deficit: number;
  } {
    const buildings = this.toRuntimeBuildings();
    const day = gameState.data.currentDay;
    const ecoSnapshot = this.computeEcologySnapshot(buildings, gameState.data.resources);

    // Consume upkeep + production inputs first. Shortage will lower ratios and production.
    (Object.entries(ecoSnapshot.totalNeed) as Array<[ResourceKey, number]>).forEach(([res, need]) => {
      if (!need || need <= 0) return;
      const ratio = Phaser.Math.Clamp(ecoSnapshot.supplyRatioByResource[res] || 0, 0, 1);
      const spend = Math.floor(need * ratio);
      if (spend <= 0) return;
      const own = gameState.data.resources[res] || 0;
      const actualSpend = Math.min(spend, own);
      if (actualSpend > 0) {
        gameState.spendResource(res, actualSpend);
      }
    });

    // Production from buildings with chain-aware efficiency
    const productionTotals: Record<string, number> = {};
    buildings.forEach(b => {
      const def = BUILDING_DEFS[b.id];
      if (!def?.production) return;

      const chain = this.getBuildChainStatus(b.id, day, buildings);
      if (!chain.canConstruct) return;

      let localRatio = 1;
      const ecology = getBuildingEcology(b.id);
      if (ecology?.upkeep) {
        (Object.keys(ecology.upkeep) as ResourceKey[]).forEach((res) => {
          localRatio = Math.min(localRatio, ecoSnapshot.supplyRatioByResource[res] ?? 1);
        });
      }
      if (ecology?.dailyInput) {
        (Object.keys(ecology.dailyInput) as ResourceKey[]).forEach((res) => {
          localRatio = Math.min(localRatio, ecoSnapshot.supplyRatioByResource[res] ?? 1);
        });
      }
      const chainEfficiency = Phaser.Math.Clamp(
        ecoSnapshot.linkIntegrity * 0.5 + ecoSnapshot.upkeepRatio * 0.2 + ecoSnapshot.productionRatio * 0.3,
        0.35,
        1
      );
      const key = def.production.resource;
      const amount = def.production.amount * (b.tier || 1) * localRatio * chainEfficiency;
      productionTotals[key] = (productionTotals[key] || 0) + amount;
    });

    Object.entries(productionTotals).forEach(([res, amount]) => {
      if (amount <= 0) return;
      gameState.addResource(res as keyof Resources, Math.max(1, Math.round(amount)));
    });

    // Food production from jobs
    const { jobAssigned } = this.computeJobSlotsAndAssignments(buildings);
    const jobFood = this.computeJobFoodBonus(jobAssigned);
    if (jobFood > 0) {
      gameState.addResource('food', jobFood);
    }
    const { medical, scrap } = this.computeJobResourceBonus(jobAssigned);
    if (medical > 0) gameState.addResource('medical', medical);
    if (scrap > 0) gameState.addResource('scrap', scrap);
    const professionBonus = this.computeProfessionResourceBonus();
    (Object.entries(professionBonus) as Array<[keyof ProfessionBonus, number | undefined]>).forEach(([res, amount]) => {
      if (amount && amount > 0) gameState.addResource(res as keyof Resources, amount);
    });

    // Food consumption
    const consumption = this.computeFoodConsumption();
    let deficit = 0;
    if (consumption > 0) {
      const before = gameState.data.resources.food;
      if (before >= consumption) {
        gameState.spendResource('food', consumption);
        gameState.data.base.foodDeficit = 0;
      } else {
        gameState.data.resources.food = 0;
        deficit = consumption - before;
        gameState.data.base.foodDeficit = deficit;
      }
    } else {
      gameState.data.base.foodDeficit = 0;
    }

    this.refreshBaseState();
    return { production: productionTotals, jobFood, jobMedical: medical, jobScrap: scrap, professionBonus, consumption, deficit };
  }

  static getDailyExchangeRates(day: number = gameState.data.currentDay, quoteMul: number = 1): Record<ExchangeResource, number> {
    const rates = {} as Record<ExchangeResource, number>;
    const tradeBuff = gameState.data.storyFlags[this.getDayBuffFlag('trade', day)] ? 1.12 : 1;
    const safeQuoteMul = Phaser.Math.Clamp(Number.isFinite(quoteMul) ? quoteMul : 1, 0.65, 1.45);
    const keys = Object.keys(this.EXCHANGE_BASE) as ExchangeResource[];
    keys.forEach((key, idx) => {
      const base = this.EXCHANGE_BASE[key];
      const wave = (this.seeded(day, idx + 1) - 0.5) * 0.5;
      const trend = (Math.sin((day + idx) * 0.35) * 0.15);
      const mult = Phaser.Math.Clamp(1 + wave + trend, 0.6, 1.55);
      rates[key] = Math.round(base * mult * tradeBuff * safeQuoteMul * 1000) / 1000;
    });
    return rates;
  }

  static getDailyGlassesPriceMultiplier(day: number = gameState.data.currentDay, factionMul: number = 1): number {
    const base = 0.9 + this.seeded(day, 88) * 0.4;
    const safeFactionMul = Phaser.Math.Clamp(Number.isFinite(factionMul) ? factionMul : 1, 0.72, 1.35);
    return Math.round(base * safeFactionMul * 100) / 100;
  }

  static getResourceShortName(resource: ExchangeResource): string {
    const names: Record<ExchangeResource, string> = {
      wood: '木材',
      metal: '金属',
      food: '食物',
      water: '净水',
      scrap: '零件',
      medical: '医疗',
      ammo: '弹药',
      energyCore: '能量核',
    };
    return names[resource];
  }

  static exchangeResourceForBitcoin(resource: ExchangeResource, amount: number, quoteMul: number = 1): {
    ok: boolean;
    btc: number;
    message: string;
  } {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return { ok: false, btc: 0, message: '请输入有效数量' };
    const own = gameState.data.resources[resource] || 0;
    if (own < safeAmount) return { ok: false, btc: 0, message: `${this.getResourceShortName(resource)}不足` };

    const rates = this.getDailyExchangeRates(gameState.data.currentDay, quoteMul);
    const rate = rates[resource] || 0;
    const btc = Math.round(rate * safeAmount * 1000) / 1000;
    if (btc <= 0) return { ok: false, btc: 0, message: '今日行情过低，无法成交' };

    gameState.spendResource(resource, safeAmount);
    gameState.addResource('bitcoin', btc);
    events.emit('update-resources', gameState.data.resources);

    return {
      ok: true,
      btc,
      message: `卖出${this.getResourceShortName(resource)} x${safeAmount}，获得 ₿${btc.toFixed(3)}`,
    };
  }

  static computePowerCapacity(buildings: Array<{ id: string; tier: number }>): number {
    const fromBuildings = buildings.reduce((sum, b) => {
      const def = BUILDING_DEFS[b.id];
      if (!def?.powerProvided) return sum;
      return sum + def.powerProvided * (b.tier || 1);
    }, 0);
    const jobPower = this.computeJobPowerBonus();
    return BASE_POWER_CAPACITY + fromBuildings + jobPower;
  }

  static computePowerUsed(buildings: Array<{ id: string }>): number {
    return buildings.reduce((sum, b) => {
      const def = BUILDING_DEFS[b.id];
      if (def?.powerUse) return sum + def.powerUse;
      if (def?.category === 'turret') return sum + BASE_POWER_PER_TURRET;
      return sum;
    }, 0);
  }

  static computeFoodProduction(
    buildings: Array<{ id: string; tier: number }>,
    jobAssigned: Record<BaseJob, number>
  ): number {
    let total = 0;
    buildings.forEach(b => {
      const def = BUILDING_DEFS[b.id];
      if (def?.production?.resource === 'food') {
        total += def.production.amount * (b.tier || 1);
      }
    });
    total += this.computeJobFoodBonus(jobAssigned);
    return total;
  }

  static computeFoodConsumption(): number {
    return gameState.data.companions.reduce((sum, c) => {
      const lvl = Math.max(1, c.level || 1);
      return sum + (1 + Math.floor(lvl * 0.3));
    }, 0);
  }

  static getPopulationCapacity(buildings: Array<{ id: string; tier?: number }> = gameState.data.buildings): number {
    let cap = BaseSystem.BASE_POPULATION_CAPACITY;
    buildings.forEach((b) => {
      const tier = Math.max(1, b.tier || 1);
      if (b.id === 'room_quarters') {
        cap += BaseSystem.ROOM_QUARTERS_CAPACITY + (tier - 1) * BaseSystem.ROOM_QUARTERS_PER_TIER;
        return;
      }
      if (b.id === 'bunk_bed') {
        cap += BaseSystem.BUNK_BED_CAPACITY + (tier - 1) * BaseSystem.BUNK_BED_PER_TIER;
      }
    });
    return Math.max(BaseSystem.BASE_POPULATION_CAPACITY, cap);
  }

  static getPopulationUsage(): number {
    return gameState.data.companions.length;
  }

  static canRecruitCompanion(extra: number = 1): boolean {
    const safeExtra = Math.max(0, Math.floor(extra));
    return this.getPopulationUsage() + safeExtra <= this.getPopulationCapacity();
  }

  static computeJobSlotsAndAssignments(
    buildings: Array<{ id: string; tier: number }>
  ): { jobSlots: Record<BaseJob, number>; jobAssigned: Record<BaseJob, number> } {
    const jobSlots: Record<BaseJob, number> = {
      idle: 0,
      kitchen: 0,
      farm: 0,
      power: 0,
      medical: 0,
      workshop: 0,
    };

    buildings.forEach(b => {
      const def = BUILDING_DEFS[b.id];
      if (!def?.jobType || !def.jobSlots) return;
      jobSlots[def.jobType] += def.jobSlots * (b.tier || 1);
    });

    const jobAssigned: Record<BaseJob, number> = {
      idle: 0,
      kitchen: 0,
      farm: 0,
      power: 0,
      medical: 0,
      workshop: 0,
    };

    gameState.data.companions.forEach(c => {
      if (c.status !== 'base') return;
      const job = c.job || 'idle';
      jobAssigned[job] = (jobAssigned[job] || 0) + 1;
    });

    // Enforce slots: overflow -> idle
    BASE_JOB_ORDER.forEach(job => {
      if (job === 'idle') return;
      const over = jobAssigned[job] - jobSlots[job];
      if (over > 0) {
        let toDemote = over;
        gameState.data.companions.forEach(c => {
          if (toDemote <= 0) return;
          if (c.status === 'base' && c.job === job) {
            c.job = 'idle';
            toDemote--;
          }
        });
        jobAssigned[job] = Math.max(0, jobAssigned[job] - over);
        jobAssigned.idle += over;
      }
    });

    return { jobSlots, jobAssigned };
  }

  static canAssignJob(job: BaseJob): boolean {
    if (job === 'idle') return true;
    const { jobSlots, jobAssigned } = this.computeJobSlotsAndAssignments(gameState.data.buildings);
    return jobAssigned[job] < jobSlots[job];
  }

  static getAvailableJobs(): BaseJob[] {
    const { jobSlots } = this.computeJobSlotsAndAssignments(gameState.data.buildings);
    return BASE_JOB_ORDER.filter(job => job === 'idle' || jobSlots[job] > 0);
  }

  private static getDiagnosticNodeByCoord(x: number, y: number, tolerance: number = 2): BaseNodeDiagnostic | null {
    const nodes = Array.isArray(gameState.data.base.nodeDiagnostics)
      ? gameState.data.base.nodeDiagnostics
      : [];
    const hit = nodes.find((node) => Math.abs(node.x - x) <= tolerance && Math.abs(node.y - y) <= tolerance);
    return hit || null;
  }

  private static buildRepairJobPriority(node: BaseNodeDiagnostic): BaseJob[] {
    const jobs: BaseJob[] = [];
    const has = (issue: BaseNodeIssue): boolean => node.issues.includes(issue);
    const shortage = new Set(node.shortageResources || []);
    if (has('power')) jobs.push('power');
    if (has('upkeep')) jobs.push('workshop');
    if (has('input')) {
      if (shortage.has('food') || shortage.has('water')) jobs.push('farm', 'kitchen');
      if (shortage.has('medical')) jobs.push('medical');
      if (shortage.has('ammo') || shortage.has('metal') || shortage.has('scrap') || shortage.has('wood') || shortage.has('energyCore')) {
        jobs.push('workshop');
      }
    }
    jobs.push('workshop', 'power', 'farm', 'kitchen', 'medical');
    return Array.from(new Set(jobs)).filter((job) => job !== 'idle');
  }

  static quickRepairDiagnosticNodeByCoord(x: number, y: number): {
    ok: boolean;
    message: string;
    btcCost: number;
    injected: Partial<Record<ResourceKey, number>>;
  } {
    this.refreshBaseState();
    const node = this.getDiagnosticNodeByCoord(x, y);
    if (!node) {
      return { ok: false, message: '未找到该故障节点', btcCost: 0, injected: {} };
    }
    const shortages = node.shortageAmounts || {};
    const injected: Partial<Record<ResourceKey, number>> = {};
    const entries = Object.entries(shortages) as Array<[ResourceKey, number]>;
    let btcCostRaw = 0;
    entries.forEach(([res, amount]) => {
      const safeAmount = Math.max(0, Math.ceil(amount || 0));
      if (safeAmount <= 0) return;
      injected[res] = safeAmount;
      btcCostRaw += (this.EXCHANGE_BASE[res as ExchangeResource] || 0.02) * safeAmount * 1.65;
    });
    const btcCost = Math.round(btcCostRaw * 1000) / 1000;
    if (btcCost > 0 && (gameState.data.resources.bitcoin || 0) < btcCost) {
      return {
        ok: false,
        message: `应急维修需 ₿${btcCost.toFixed(3)}，当前不足`,
        btcCost,
        injected,
      };
    }
    if (btcCost > 0) {
      gameState.spendResource('bitcoin', btcCost);
    }
    (Object.entries(injected) as Array<[ResourceKey, number]>).forEach(([res, amount]) => {
      if (!amount || amount <= 0) return;
      gameState.addResource(res, amount);
    });
    this.refreshBaseState();
    const afterNode = this.getDiagnosticNodeByCoord(x, y);
    const resolved = !afterNode || afterNode.issues.length < node.issues.length;
    events.emit('update-resources', gameState.data.resources);
    return {
      ok: true,
      message: resolved
        ? `${node.nameCN} 应急维修完成`
        : `${node.nameCN} 已补给，但仍需更多产能/派工`,
      btcCost,
      injected,
    };
  }

  static dispatchCrewToDiagnosticNodeByCoord(x: number, y: number): {
    ok: boolean;
    message: string;
    assigned: number;
    jobs: BaseJob[];
  } {
    this.refreshBaseState();
    const node = this.getDiagnosticNodeByCoord(x, y);
    if (!node) {
      return { ok: false, message: '未找到该故障节点', assigned: 0, jobs: [] };
    }
    const roster = gameState.data.companions.filter((c) => c.status === 'base');
    if (roster.length <= 0) {
      return { ok: false, message: '基地暂无可派工伙伴', assigned: 0, jobs: [] };
    }
    const targetJobs = this.buildRepairJobPriority(node);
    const targetCount = node.issues.length >= 2 ? 2 : 1;
    const assignedJobs: BaseJob[] = [];
    let assigned = 0;
    for (let i = 0; i < targetCount; i += 1) {
      const preferred = targetJobs.find((job) => this.canAssignJob(job));
      if (!preferred) break;
      const candidate = roster.find((c) => c.job === 'idle');
      if (!candidate) break;
      candidate.job = preferred;
      assignedJobs.push(preferred);
      assigned += 1;
      this.refreshBaseState();
    }
    if (assigned <= 0) {
      return {
        ok: false,
        message: '无空闲伙伴或岗位已满，无法派工（可扩建岗位后重试）',
        assigned: 0,
        jobs: [],
      };
    }
    this.refreshBaseState();
    return {
      ok: true,
      message: `已派工 ${assigned} 人：${assignedJobs.map((j) => BASE_JOB_LABELS[j]).join(' / ')}`,
      assigned,
      jobs: assignedJobs,
    };
  }

  private static computeJobFoodBonus(jobAssigned: Record<BaseJob, number>): number {
    void jobAssigned;
    const roster = this.getBaseRoster();
    let food = 0;
    const kitchenBonus = BASE_JOB_BONUS.kitchen?.food || 0;
    const farmBonus = BASE_JOB_BONUS.farm?.food || 0;
    roster.forEach((companion) => {
      const mul = this.getCompanionDayMultiplier(companion, roster);
      if (companion.job === 'kitchen') food += kitchenBonus * mul;
      if (companion.job === 'farm') food += farmBonus * mul;
    });
    return Math.max(0, Math.round(food));
  }

  private static computeJobPowerBonus(): number {
    const powerBonus = BASE_JOB_BONUS.power?.power || 0;
    const assigned = gameState.data.companions.filter(c => c.status === 'base' && c.job === 'power').length;
    return assigned * powerBonus;
  }

  private static computeJobResourceBonus(jobAssigned: Record<BaseJob, number>): { medical: number; scrap: number } {
    void jobAssigned;
    const roster = this.getBaseRoster();
    const medicalBonus = BASE_JOB_BONUS.medical?.medical || 0;
    const scrapBonus = BASE_JOB_BONUS.workshop?.scrap || 0;
    let medical = 0;
    let scrap = 0;
    roster.forEach((companion) => {
      const mul = this.getCompanionDayMultiplier(companion, roster);
      if (companion.job === 'medical') medical += medicalBonus * mul;
      if (companion.job === 'workshop') scrap += scrapBonus * mul;
    });
    return {
      medical: Math.max(0, Math.round(medical)),
      scrap: Math.max(0, Math.round(scrap))
    };
  }

  static getCompanionProfession(name: string): string {
    const match = name.match(/\(([^·)]+)/);
    return match?.[1] || '觉醒者';
  }

  static getCompanionProfessionBonus(companion: CompanionData): ProfessionBonus {
    const profession = this.getCompanionProfession(companion.name);
    const hit = this.PROFESSION_BONUS_TABLE.find(row =>
      row.keywords.some(key => profession.includes(key))
    );
    return hit?.bonus || { food: 1 };
  }

  static getCompanionTraitSummary(companion: CompanionData): string {
    const roleLabel = companion.role === 'tank' ? '前锋护卫'
      : companion.role === 'sniper' ? '远程狙击'
      : '医疗支援';
    const profile = CompanionPersonalitySystem.ensureProfile(companion);
    const profession = profile.profession || this.getCompanionProfession(companion.name);
    const hit = this.PROFESSION_BONUS_TABLE.find(row =>
      row.keywords.some(key => profession.includes(key))
    );
    const duty = companion.autoDuty || this.getCompanionAutoDuty(companion);
    return `${roleLabel} · ${profile.gender}${profile.age}岁·${profile.personality} · 职责:${this.getCompanionAutoDutyLabel(duty)} · 驻守:${hit?.label || '食物+1/日'} · 推荐:${BASE_JOB_LABELS[this.recommendJobForCompanion(companion)]}`;
  }

  static getCompanionCombatSummary(companion: CompanionData): string {
    const level = Math.max(1, companion.level || 1);
    const role = companion.role || 'tank';
    const roleBase = role === 'tank'
      ? { damage: 14, fireRate: 1.1, range: 180, hp: 190 }
      : role === 'sniper'
        ? { damage: 24, fireRate: 0.65, range: 520, hp: 100 }
        : { damage: 12, fireRate: 0.95, range: 280, hp: 130 };
    const damage = Math.round(roleBase.damage + level * 2.5);
    const hp = Math.round(roleBase.hp + level * 10);
    const range = Math.round(roleBase.range + level * 12);
    const fireRateMul = roleBase.fireRate;
    return `战斗: 伤害${damage} · 生命${hp} · 射程${range} · 频率x${fireRateMul.toFixed(2)}`;
  }

  static getCompanionAutoDuty(companion: CompanionData): CompanionAutoDuty {
    const profile = CompanionPersonalitySystem.ensureProfile(companion);
    const profession = profile.profession || this.getCompanionProfession(companion.name);
    const hasAny = (keywords: string[]): boolean => keywords.some((keyword) => profession.includes(keyword));
    if (hasAny(['工程师', '工程師', '建筑工', '建築工', '建筑工人', '建造工', '电工', '電工', '维修', '維修'])) return 'builder';
    if (hasAny(['拾荒', '猎人', '獵人', '快递员', '快遞員', '快递', '快遞', '商人', '回收', '搜集', '搜集者', '勘探'])) return 'scavenger';
    if (hasAny(['退伍', '武术', '武術', '消防', '保安', '警', '守卫', '守衛', '防御', '防禦'])) return 'defender';
    if (companion.role === 'tank') return 'defender';
    if (companion.role === 'sniper') return 'scavenger';
    if (companion.role === 'medic') return 'support';
    return 'support';
  }

  static getCompanionAutoDutyLabel(duty: CompanionAutoDuty): string {
    if (duty === 'builder') return '建筑工';
    if (duty === 'scavenger') return '拾荒者';
    if (duty === 'defender') return '防御者';
    return '后勤';
  }

  static getBaseDutyCounts(): Record<CompanionAutoDuty, number> {
    const counts: Record<CompanionAutoDuty, number> = {
      builder: 0,
      scavenger: 0,
      defender: 0,
      support: 0,
    };
    this.getBaseRoster().forEach((companion) => {
      const duty = companion.autoDuty || this.getCompanionAutoDuty(companion);
      counts[duty] += 1;
    });
    return counts;
  }

  static getAutoDutyBehaviorSummary(): string[] {
    return [
      '建筑工：优先进入工坊，参与自动施工与升级',
      '拾荒者：驻守时自动吸附周边掉落资源',
      '防御者：优先补充工坊，抬升围墙/炮塔建设目标',
      '后勤：补位厨房/农场/医疗/供电岗位',
    ];
  }

  private static getDutyAffinity(companion: CompanionData, duty: CompanionAutoDuty): number {
    const profile = CompanionPersonalitySystem.ensureProfile(companion);
    const profession = profile.profession || this.getCompanionProfession(companion.name);
    const level = Math.max(1, Number(companion.level || 1));
    let score = duty === 'support' ? 1.2 : 1.0;

    if (duty === 'builder') {
      if (profession.includes('工程师') || profession.includes('工程師') || profession.includes('建筑工') || profession.includes('建築工') || profession.includes('电工') || profession.includes('電工')) score += 3.2;
      if (profession.includes('程序员') || profession.includes('会计')) score += 0.8;
      if (companion.role === 'tank') score += 1.0;
      if (companion.role === 'sniper') score -= 0.6;
      score += level * 0.03;
    } else if (duty === 'scavenger') {
      if (profession.includes('拾荒') || profession.includes('猎人') || profession.includes('獵人') || profession.includes('快递员') || profession.includes('快遞員') || profession.includes('商人') || profession.includes('搜集') || profession.includes('回收')) score += 3.2;
      if (profession.includes('摄影') || profession.includes('画家')) score += 0.7;
      if (companion.role === 'sniper') score += 1.3;
      if (companion.role === 'medic') score -= 0.3;
      score += level * 0.02;
    } else if (duty === 'defender') {
      if (profession.includes('退伍') || profession.includes('武术') || profession.includes('武術') || profession.includes('消防') || profession.includes('保安') || profession.includes('警') || profession.includes('守卫') || profession.includes('守衛') || profession.includes('防御') || profession.includes('防禦')) score += 3.4;
      if (companion.role === 'tank') score += 2.0;
      if (companion.role === 'sniper') score += 0.3;
      score += level * 0.04;
    } else {
      if (profession.includes('医生') || profession.includes('护士') || profession.includes('心理医生')) score += 2.8;
      if (profession.includes('厨师') || profession.includes('农')) score += 1.2;
      if (companion.role === 'medic') score += 1.6;
      score += level * 0.02;
    }

    if ((companion.autoDuty || this.getCompanionAutoDuty(companion)) === duty) score += 0.45;
    return score;
  }

  private static computeAutoDutyTargets(baseCompanions: CompanionData[]): Record<CompanionAutoDuty, number> {
    const total = baseCompanions.length;
    const targets: Record<CompanionAutoDuty, number> = {
      builder: 0,
      scavenger: 0,
      defender: 0,
      support: 0,
    };
    if (total <= 0) return targets;

    const autoBuild = gameState.data.autoBuild;
    const resources = gameState.data.resources;
    const tasks = gameState.data.constructionTasks || [];
    const activeTasks = tasks.filter((task) => task.status === 'active').length;
    const queuedTasks = tasks.filter((task) => task.status === 'queued').length;
    const hasConstructionPressure = autoBuild.enabled && (activeTasks > 0 || queuedTasks > 0);
    const activeBuildRules = (autoBuild.rules || []).filter((rule) => rule.enabled && (rule.targetCount || 0) > 0).length;
    const builderDemandSignal = Math.max(
      activeBuildRules > 0 ? 1 : 0,
      Math.floor(autoBuild.desiredBuilderCount || 0)
    );

    const base = gameState.data.base;
    const defenseStress = (base.structureBreachOpen ? 1.4 : 0)
      + (base.structureCoverage < 0.78 ? 0.8 : 0)
      + (base.structureIntegrity < 0.72 ? 0.6 : 0)
      + (gameState.data.isNight ? 0.45 : 0);
    const scavengerStress = (
      (resources.wood < 18 ? 1 : 0)
      + (resources.metal < 16 ? 1 : 0)
      + (resources.food < 14 ? 1 : 0)
      + (resources.water < 12 ? 1 : 0)
    );

    const minBuilder = (hasConstructionPressure || builderDemandSignal > 0 || (autoBuild.enabled && total >= 2))
      ? 1
      : (total >= 4 ? 1 : 0);
    const desiredBuilder = Math.max(
      autoBuild.autoAssignBuilders ? Math.floor(autoBuild.desiredBuilderCount || 0) : 0,
      hasConstructionPressure ? Math.max(1, Math.ceil(activeTasks * 1.4)) : 0,
      activeBuildRules > 0 ? 1 : 0
    );
    targets.builder = Phaser.Math.Clamp(desiredBuilder, minBuilder, Math.max(minBuilder, Math.floor(total * 0.5)));

    const minDefender = total >= 2 ? 1 : 0;
    const defenderDemand = minDefender + Math.floor(defenseStress);
    targets.defender = Phaser.Math.Clamp(defenderDemand, minDefender, Math.max(minDefender, Math.floor(total * 0.45)));

    const minScavenger = total >= 3 ? 1 : 0;
    const scavengerDemand = minScavenger + (scavengerStress >= 2 ? 1 : 0) + (scavengerStress >= 4 ? 1 : 0);
    targets.scavenger = Phaser.Math.Clamp(scavengerDemand, minScavenger, Math.max(minScavenger, Math.floor(total * 0.5)));

    let allocated = targets.builder + targets.defender + targets.scavenger;
    if (allocated > total) {
      const reduceOrder: CompanionAutoDuty[] = ['scavenger', 'defender', 'builder'];
      for (const duty of reduceOrder) {
        if (allocated <= total) break;
        const minKeep = duty === 'builder'
          ? minBuilder
          : duty === 'defender'
            ? minDefender
            : minScavenger;
        while (targets[duty] > minKeep && allocated > total) {
          targets[duty] -= 1;
          allocated -= 1;
        }
      }
    }

    if (allocated < total) targets.support = total - allocated;
    return targets;
  }

  private static rebalanceAutoDutyAssignments(baseCompanions: CompanionData[]): {
    changed: number;
    targets: Record<CompanionAutoDuty, number>;
  } {
    const targets = this.computeAutoDutyTargets(baseCompanions);
    const assignments = new Map<string, CompanionAutoDuty>();
    const unassigned = new Set(baseCompanions.map((companion) => companion.id));
    const dutyOrder: CompanionAutoDuty[] = ['builder', 'defender', 'scavenger', 'support'];

    dutyOrder.forEach((duty) => {
      const need = Math.max(0, Math.floor(targets[duty] || 0));
      if (need <= 0) return;
      const candidates = baseCompanions
        .filter((companion) => unassigned.has(companion.id))
        .map((companion) => ({ companion, score: this.getDutyAffinity(companion, duty) }))
        .sort((a, b) => b.score - a.score);
      for (let i = 0; i < need && i < candidates.length; i += 1) {
        assignments.set(candidates[i].companion.id, duty);
        unassigned.delete(candidates[i].companion.id);
      }
    });

    unassigned.forEach((id) => assignments.set(id, 'support'));
    let changed = 0;
    baseCompanions.forEach((companion) => {
      const prev = companion.autoDuty || this.getCompanionAutoDuty(companion);
      const next = assignments.get(companion.id) || 'support';
      companion.autoDuty = next;
      if (prev !== next) changed += 1;
    });
    return { changed, targets };
  }

  static recommendJobForCompanion(companion: CompanionData): BaseJob {
    const duty = companion.autoDuty || this.getCompanionAutoDuty(companion);
    if (duty === 'builder') return 'workshop';
    if (duty === 'defender') return 'workshop';
    if (duty === 'scavenger') return 'idle';

    const profile = CompanionPersonalitySystem.ensureProfile(companion);
    const profession = profile.profession || this.getCompanionProfession(companion.name);
    if (profession.includes('厨师') || profession.includes('廚師')) return 'kitchen';
    if (profession.includes('医生') || profession.includes('醫生') || profession.includes('护士') || profession.includes('護士') || profession.includes('心理医生') || profession.includes('心理醫生')) return 'medical';
    if (profession.includes('工程师') || profession.includes('工程師') || profession.includes('建筑工人') || profession.includes('建築工人') || profession.includes('建築工') || profession.includes('建筑工')) return 'workshop';
    if (profession.includes('电工') || profession.includes('電工')) return 'power';
    if (profession.includes('农') || profession.includes('農')) return 'farm';
    if (profession.includes('商人') || profession.includes('快递员') || profession.includes('快遞員') || profession.includes('会计') || profession.includes('會計')) return 'workshop';
    if (profession.includes('程序员') || profession.includes('黑客') || profession.includes('摄影师') || profession.includes('画家')) return 'workshop';
    if (companion.role === 'medic') return 'medical';
    if (companion.role === 'tank') return 'power';
    if (companion.role === 'sniper') return 'workshop';
    return 'farm';
  }

  private static getAutoDutyPreferredJobs(companion: CompanionData, duty: CompanionAutoDuty): BaseJob[] {
    const recommended = this.recommendJobForCompanion(companion);
    const dutyPreferred: BaseJob[] = duty === 'builder'
      ? ['workshop', 'power', 'idle', 'farm', 'medical']
      : duty === 'defender'
        ? ['workshop', 'power', 'idle', 'farm', 'medical']
        : duty === 'scavenger'
          ? ['idle', 'farm', 'workshop', 'power', 'medical']
          : [recommended, 'medical', 'farm', 'power', 'workshop', 'idle'];
    const ordered = [recommended, ...dutyPreferred, ...BASE_JOB_ORDER, 'idle'];
    const unique: BaseJob[] = [];
    ordered.forEach((job) => {
      if (!unique.includes(job as BaseJob)) unique.push(job as BaseJob);
    });
    return unique;
  }

  static autoAssignBaseCompanions(): { assigned: number; message: string } {
    this.refreshBaseState();
    const baseCompanions = gameState.data.companions.filter(c => c.status === 'base');
    if (baseCompanions.length === 0) {
      return { assigned: 0, message: '暂无驻守伙伴可分配（先把伙伴切到“驻守”）' };
    }

    const { jobSlots } = this.computeJobSlotsAndAssignments(gameState.data.buildings);
    const capacity: Record<BaseJob, number> = { ...jobSlots, idle: 999 };
    const used: Record<BaseJob, number> = {
      idle: 0, kitchen: 0, farm: 0, power: 0, medical: 0, workshop: 0,
    };
    const dutyCounts: Record<CompanionAutoDuty, number> = {
      builder: 0,
      scavenger: 0,
      defender: 0,
      support: 0,
    };
    const dutyRebalance = this.rebalanceAutoDutyAssignments(baseCompanions);
    let changed = dutyRebalance.changed;

    const canUseSlot = (job: BaseJob): boolean => (
      job === 'idle' || (used[job] < (capacity[job] || 0))
    );

    const assignJob = (companion: CompanionData, job: BaseJob): void => {
      const prev = companion.job;
      if (job !== 'idle' && (used[job] >= (capacity[job] || 0))) return;
      companion.job = job;
      used[job] += 1;
      if (prev !== job) changed += 1;
    };

    const dutyPriority = (duty: CompanionAutoDuty): number => {
      if (duty === 'builder') return 4;
      if (duty === 'defender') return 3;
      if (duty === 'scavenger') return 2;
      return 1;
    };

    const sorted = [...baseCompanions].sort((a, b) => {
      const da = dutyPriority(a.autoDuty || this.getCompanionAutoDuty(a));
      const db = dutyPriority(b.autoDuty || this.getCompanionAutoDuty(b));
      if (da !== db) return db - da;
      return Number(b.level || 1) - Number(a.level || 1);
    });

    sorted.forEach((c) => {
      c.autoDuty = c.autoDuty || this.getCompanionAutoDuty(c);
      dutyCounts[c.autoDuty] += 1;
      const preferredJobs = this.getAutoDutyPreferredJobs(c, c.autoDuty);
      const picked = preferredJobs.find((job) => canUseSlot(job)) || 'idle';
      assignJob(c, picked);
    });

    this.refreshBaseState();
    const workshopAssigned = sorted.filter((companion) => companion.job === 'workshop').length;
    const scavengerAssigned = sorted.filter((companion) => companion.autoDuty === 'scavenger' && companion.job === 'idle').length;
    const supportAssigned = sorted.filter((companion) => companion.autoDuty === 'support').length;
    return {
      assigned: changed,
      message: `自动派职完成 · 调整${changed}人(含转职${dutyRebalance.changed}) · 建筑工${dutyCounts.builder} / 拾荒者${dutyCounts.scavenger} / 防御者${dutyCounts.defender} / 后勤${supportAssigned} · 工坊${workshopAssigned} / 拾取岗${scavengerAssigned}`,
    };
  }

  private static computeProfessionResourceBonus(): ProfessionBonus {
    const roster = this.getBaseRoster();
    const totals: ProfessionBonus = {};
    roster.forEach(c => {
      const bonus = this.getCompanionProfessionBonus(c);
      const dayMul = this.getCompanionDayMultiplier(c, roster);
      const teamwork = CompanionPersonalitySystem.getProfileModifiers(c).teamwork;
      const combinedMul = Phaser.Math.Clamp(dayMul * (0.9 + teamwork * 0.1), 0.72, 1.8);
      (Object.keys(bonus) as Array<keyof ProfessionBonus>).forEach(key => {
        const value = bonus[key] || 0;
        totals[key] = (totals[key] || 0) + value * combinedMul;
      });
    });
    (Object.keys(totals) as Array<keyof ProfessionBonus>).forEach((key) => {
      const current = totals[key];
      if (!current) return;
      totals[key] = Math.max(0, Math.round(current));
    });
    return totals;
  }

  private static getBaseRoster(): CompanionData[] {
    return gameState.data.companions.filter((c) => c.status === 'base');
  }

  private static getCompanionDayMultiplier(companion: CompanionData, roster: CompanionData[]): number {
    const base = CompanionPersonalitySystem.getDayEfficiencyMultiplier(companion, roster);
    const permanent = gameState.getPermanentTalentBonuses();
    const talentMul = permanent.companionDayGainMul * permanent.economyDayGainMul;
    return Phaser.Math.Clamp(base * talentMul, 0.62, 2.8);
  }

  static canPlayLeisureToday(): boolean {
    const day = gameState.data.currentDay;
    return !gameState.data.isNight && !gameState.data.storyFlags[this.getLeisureFlag(day)];
  }

  static playLeisureActivity(activityId: 'card' | 'music' | 'ar_duel', performance: LeisurePerformance = 'good'): {
    ok: boolean;
    message: string;
    rewards: Partial<Resources>;
    bonusExp: number;
    performance: LeisurePerformance;
    dayBuff?: DayBuffKind;
  } {
    if (!this.canPlayLeisureToday()) {
      return {
        ok: false,
        message: gameState.data.isNight ? '夜晚无法进行休闲活动' : '今天已进行过活动',
        rewards: {},
        bonusExp: 0,
        performance,
        dayBuff: undefined,
      };
    }

    const stationed = gameState.data.companions.filter(c => c.status === 'base').length;
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const teamBonus = stationed >= 2 ? 1 : 0;
    const weekScale = 1 + Math.min(0.6, (week - 1) * 0.08);
    const rewards: Partial<Resources> = {};
    let bonusExp = 0;
    let dayBuff: DayBuffKind | undefined;

    if (activityId === 'card') {
      rewards.scrap = Math.max(1, Math.round((Phaser.Math.Between(2, 5) + teamBonus) * weekScale));
      rewards.food = Math.max(1, Math.round(Phaser.Math.Between(1, 2) * weekScale));
      bonusExp = Phaser.Math.Between(10, 20) + Math.floor(week * 1.4);
      dayBuff = 'trade';
    } else if (activityId === 'music') {
      rewards.medical = Math.max(1, Math.round(Phaser.Math.Between(1, 2) * weekScale));
      rewards.water = Math.max(1, Math.round(Phaser.Math.Between(1, 3) * weekScale));
      bonusExp = Phaser.Math.Between(8, 16) + Math.floor(week * 1.2);
      dayBuff = 'morale';
    } else {
      rewards.metal = Math.max(1, Math.round((Phaser.Math.Between(1, 3) + teamBonus) * weekScale));
      rewards.ammo = Math.max(1, Math.round(Phaser.Math.Between(2, 5) * weekScale));
      if (Math.random() < 0.18) rewards.energyCore = 1;
      bonusExp = Phaser.Math.Between(12, 24) + Math.floor(week * 1.8);
      dayBuff = 'training';
    }

    const perfMult = performance === 'perfect' ? 1.55 : performance === 'good' ? 1.0 : 0.7;
    Object.keys(rewards).forEach((key) => {
      const k = key as keyof Resources;
      const val = rewards[k] || 0;
      if (val > 0) rewards[k] = Math.max(1, Math.round(val * perfMult));
    });
    bonusExp = Math.max(4, Math.round(bonusExp * (performance === 'perfect' ? 1.5 : performance === 'good' ? 1 : 0.72)));

    Object.entries(rewards).forEach(([k, v]) => {
      if (v && v > 0) gameState.addResource(k as keyof Resources, v);
    });
    if (performance === 'perfect' && Math.random() < 0.58) {
      const btc = Math.round((0.08 + Math.random() * 0.22) * 1000) / 1000;
      gameState.addResource('bitcoin', btc);
      rewards.bitcoin = Number((rewards.bitcoin || 0)) + btc;
    }
    if (bonusExp > 0) gameState.addExperience(bonusExp);

    gameState.data.storyFlags[this.getLeisureFlag()] = true;
    if (dayBuff) {
      gameState.data.storyFlags[this.getDayBuffFlag(dayBuff)] = performance !== 'poor';
    }
    events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });

    const buffText = dayBuff === 'trade'
      ? '今日交易行情加成'
      : dayBuff === 'morale'
        ? '今日基地产出加成'
        : dayBuff === 'training'
          ? '今晚战斗训练加成'
          : '';

    return {
      ok: true,
      message:
        `${performance === 'perfect' ? '完美发挥' : performance === 'good' ? '稳定发挥' : '勉强完成'} · ` +
        (activityId === 'card'
          ? '基地牌局结束，大家心情不错'
          : activityId === 'music'
            ? '篝火音乐会让基地更温暖'
            : 'AR眼镜对练提升了战术反应')
        + (buffText ? ` · ${buffText}` : ''),
      rewards,
      bonusExp,
      performance,
      dayBuff,
    };
  }
}
