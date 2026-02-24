import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import type { Resources } from '../state/GameState';
import type { CompanionData } from '../state/GameState';
import { BUILDING_DEFS } from '../data/buildings';
import { BASE_JOB_BONUS, BASE_JOB_LABELS, BASE_JOB_ORDER, BASE_POWER_CAPACITY, BASE_POWER_PER_TURRET, BaseJob } from '../data/base';
import { events, GameEvents } from '../utils/EventBus';
import { CompanionPersonalitySystem } from './CompanionPersonalitySystem';

type ExchangeResource = Exclude<keyof Resources, 'bitcoin'>;
type ProfessionBonus = Partial<Pick<Resources, 'food' | 'wood' | 'metal' | 'scrap' | 'medical' | 'water' | 'ammo'>>;
type LeisurePerformance = 'poor' | 'good' | 'perfect';
type DayBuffKind = 'trade' | 'morale' | 'training';

export class BaseSystem {
  private static readonly BASE_POPULATION_CAPACITY = 2;
  private static readonly ROOM_QUARTERS_CAPACITY = 4;
  private static readonly ROOM_QUARTERS_PER_TIER = 2;
  private static readonly BUNK_BED_CAPACITY = 2;
  private static readonly BUNK_BED_PER_TIER = 1;

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

  static refreshBaseState(): void {
    gameState.data.companions.forEach(c => {
      if (!c.status) c.status = 'party';
      if (!c.job) c.job = 'idle';
      CompanionPersonalitySystem.ensureProfile(c);
    });
    const buildings = gameState.data.buildings;
    const powerCapacity = this.computePowerCapacity(buildings);
    const powerUsed = this.computePowerUsed(buildings);
    const { jobSlots, jobAssigned } = this.computeJobSlotsAndAssignments(buildings);
    const foodProduction = this.computeFoodProduction(buildings, jobAssigned);
    const foodConsumption = this.computeFoodConsumption();

    gameState.data.base.powerCapacity = powerCapacity;
    gameState.data.base.powerUsed = powerUsed;
    gameState.data.base.jobSlots = jobSlots;
    gameState.data.base.jobAssigned = jobAssigned;
    gameState.data.base.foodProduction = foodProduction;
    gameState.data.base.foodConsumption = foodConsumption;

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
    const buildings = gameState.data.buildings;

    // Production from buildings
    const productionTotals: Record<string, number> = {};
    buildings.forEach(b => {
      const def = BUILDING_DEFS[b.id];
      if (!def?.production) return;
      const key = def.production.resource;
      const amount = def.production.amount * (b.tier || 1);
      productionTotals[key] = (productionTotals[key] || 0) + amount;
    });

    Object.entries(productionTotals).forEach(([res, amount]) => {
      gameState.addResource(res as any, amount);
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
    return `${roleLabel} · ${profile.gender}${profile.age}岁·${profile.personality} · 驻守:${hit?.label || '食物+1/日'} · 推荐:${BASE_JOB_LABELS[this.recommendJobForCompanion(companion)]}`;
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

  static recommendJobForCompanion(companion: CompanionData): BaseJob {
    const profile = CompanionPersonalitySystem.ensureProfile(companion);
    const profession = profile.profession || this.getCompanionProfession(companion.name);
    if (profession.includes('厨师')) return 'kitchen';
    if (profession.includes('医生') || profession.includes('护士') || profession.includes('心理医生')) return 'medical';
    if (profession.includes('工程师') || profession.includes('建筑工人')) return 'workshop';
    if (profession.includes('电工')) return 'power';
    if (profession.includes('农')) return 'farm';
    if (profession.includes('商人') || profession.includes('快递员') || profession.includes('会计')) return 'workshop';
    if (profession.includes('程序员') || profession.includes('黑客') || profession.includes('摄影师') || profession.includes('画家')) return 'workshop';
    if (companion.role === 'medic') return 'medical';
    if (companion.role === 'tank') return 'power';
    if (companion.role === 'sniper') return 'workshop';
    return 'farm';
  }

  static autoAssignBaseCompanions(): { assigned: number; message: string } {
    this.refreshBaseState();
    const baseCompanions = gameState.data.companions.filter(c => c.status === 'base');
    if (baseCompanions.length === 0) {
      return { assigned: 0, message: '暂无驻守伙伴可分配' };
    }

    const { jobSlots } = this.computeJobSlotsAndAssignments(gameState.data.buildings);
    const capacity: Record<BaseJob, number> = { ...jobSlots, idle: 999 };
    const used: Record<BaseJob, number> = {
      idle: 0, kitchen: 0, farm: 0, power: 0, medical: 0, workshop: 0,
    };
    let assigned = 0;

    const assignIfPossible = (companion: CompanionData, job: BaseJob): boolean => {
      if (job !== 'idle' && (used[job] >= (capacity[job] || 0))) return false;
      companion.job = job;
      used[job] += 1;
      assigned += 1;
      return true;
    };

    baseCompanions.forEach(c => {
      const recommended = this.recommendJobForCompanion(c);
      if (!assignIfPossible(c, recommended)) {
        const fallback = BASE_JOB_ORDER.find(job => job !== 'idle' && used[job] < (capacity[job] || 0)) || 'idle';
        assignIfPossible(c, fallback);
      }
    });

    this.refreshBaseState();
    return { assigned, message: `已自动分配 ${assigned} 名驻守伙伴岗位` };
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
