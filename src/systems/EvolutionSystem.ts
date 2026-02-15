/**
 * EvolutionSystem - Weapon evolution logic (VS style)
 * Checks for evolution conditions: max level weapon + matching passive
 * Also computes effective player stats from base + passives
 */
import Phaser from 'phaser';
import { gameState, PlayerStats, type PassiveSlot, type WeaponSlot } from '../state/GameState';
import { WEAPON_DEFS, getWeaponAtLevel } from '../data/weapons';
import { PASSIVE_DEFS } from '../data/passives';
import { AR_GLASSES, type ARGlassesDef } from '../data/arGlasses';

export interface BrandCombatModifiers {
  fireRateMul: number;      // >1 means faster
  damageMul: number;        // >1 means more damage
  projectileBonus: number;  // extra projectiles for VS weapons
  speedMul: number;         // projectile speed multiplier
  spreadMul: number;        // spread multiplier
  pierceBonus: number;      // extra pierce count
  forceSpecial?: 'chain' | 'burn' | 'pierce';
  tintColor?: number;       // brand visual identity for projectiles
  homing: boolean;
}

export interface BrandSkillTree {
  key: string;
  treeNameCN: string;
  summaryCN: string;
  modifiers: BrandCombatModifiers;
}

const DEFAULT_BRAND_TREE: BrandSkillTree = {
  key: 'default',
  treeNameCN: '基础弹道树',
  summaryCN: '稳定射击，均衡成长',
  modifiers: {
    fireRateMul: 1,
    damageMul: 1,
    projectileBonus: 0,
    speedMul: 1,
    spreadMul: 1,
    pierceBonus: 0,
    tintColor: 0x0ea5e9,
    homing: false,
  },
};

const BRAND_SKILL_TREES: Record<string, BrandSkillTree> = {
  inmo: {
    key: 'inmo',
    treeNameCN: '涌现追踪树',
    summaryCN: '弹道追踪 + 高频输出，适合持续压制',
    modifiers: {
      fireRateMul: 1.14,
      damageMul: 1.05,
      projectileBonus: 0,
      speedMul: 1.05,
      spreadMul: 0.95,
      pierceBonus: 0,
      tintColor: 0x22d3ee,
      homing: true,
    },
  },
  xreal: {
    key: 'xreal',
    treeNameCN: '空间穿透树',
    summaryCN: '高速直线、穿透强化，适合切割密集怪群',
    modifiers: {
      fireRateMul: 1.02,
      damageMul: 1.12,
      projectileBonus: 0,
      speedMul: 1.18,
      spreadMul: 0.88,
      pierceBonus: 1,
      forceSpecial: 'pierce',
      tintColor: 0x67e8f9,
      homing: false,
    },
  },
  apple: {
    key: 'apple',
    treeNameCN: '精确暴击树',
    summaryCN: '高精度收束，爆发伤害更稳定',
    modifiers: {
      fireRateMul: 0.95,
      damageMul: 1.2,
      projectileBonus: 0,
      speedMul: 1.1,
      spreadMul: 0.72,
      pierceBonus: 0,
      tintColor: 0xf8fafc,
      homing: false,
    },
  },
  meta: {
    key: 'meta',
    treeNameCN: '神经连锁树',
    summaryCN: '分裂弹 + 连锁扩散，擅长清场',
    modifiers: {
      fireRateMul: 1.08,
      damageMul: 0.96,
      projectileBonus: 1,
      speedMul: 1,
      spreadMul: 1.2,
      pierceBonus: 0,
      forceSpecial: 'chain',
      tintColor: 0xa78bfa,
      homing: false,
    },
  },
  samsung: {
    key: 'samsung',
    treeNameCN: 'AI火控树',
    summaryCN: '高攻速补偿 + 自适应弹幕，稳定输出',
    modifiers: {
      fireRateMul: 1.2,
      damageMul: 0.92,
      projectileBonus: 1,
      speedMul: 1.06,
      spreadMul: 1.05,
      pierceBonus: 0,
      tintColor: 0x60a5fa,
      homing: true,
    },
  },
  rokid: {
    key: 'rokid',
    treeNameCN: '灼烧扩散树',
    summaryCN: '燃烧持续伤害，夜战续航优秀',
    modifiers: {
      fireRateMul: 1.04,
      damageMul: 1.03,
      projectileBonus: 0,
      speedMul: 1,
      spreadMul: 1.1,
      pierceBonus: 0,
      forceSpecial: 'burn',
      tintColor: 0xfb923c,
      homing: false,
    },
  },
  'magic leap': {
    key: 'magic leap',
    treeNameCN: '战术压制树',
    summaryCN: '中速高伤，兼顾控制与推进',
    modifiers: {
      fireRateMul: 0.96,
      damageMul: 1.15,
      projectileBonus: 0,
      speedMul: 1,
      spreadMul: 0.9,
      pierceBonus: 1,
      tintColor: 0xe9d5ff,
      homing: false,
    },
  },
};

export interface LevelUpChoice {
  type: 'new_weapon' | 'upgrade_weapon' | 'new_passive' | 'upgrade_passive';
  id: string;
  nameCN: string;
  descriptionCN: string;
  icon: string;
  rarity: string;
  currentLevel?: number;
  color: number;
  previewDpsBefore?: number;
  previewDpsAfter?: number;
  previewDpsDelta?: number;
  previewTextCN?: string;
}

export class EvolutionSystem {
  static getEquippedGlasses(): ARGlassesDef | null {
    const id = gameState.data.equippedGlasses;
    if (!id) return null;
    if (!gameState.data.collectedGlasses.includes(id)) return null;
    return AR_GLASSES[id] || null;
  }

  static getGlassesSpecials(): Set<string> {
    const specials = new Set<string>();
    const glasses = this.getEquippedGlasses();
    const special = glasses?.skill.effect.special;
    if (special) specials.add(special);
    return specials;
  }

  static getBrandSkillTreeByBrand(brand: string): BrandSkillTree {
    const key = brand.trim().toLowerCase();
    const direct = BRAND_SKILL_TREES[key];
    if (direct) return direct;
    const matched = Object.keys(BRAND_SKILL_TREES).find(k => key.includes(k));
    if (matched) return BRAND_SKILL_TREES[matched];
    return DEFAULT_BRAND_TREE;
  }

  static getEquippedBrandSkillTree(): BrandSkillTree {
    const glasses = this.getEquippedGlasses();
    if (!glasses) return DEFAULT_BRAND_TREE;
    return this.getBrandSkillTreeByBrand(glasses.brand);
  }

  static getEquippedBrandCombatModifiers(): BrandCombatModifiers {
    return this.getEquippedBrandSkillTree().modifiers;
  }

  /**
   * Get computed player stats (base + all passive effects)
   */
  static getComputedStats(): PlayerStats {
    const base = { ...gameState.data.baseStats };
    const passives = gameState.data.passives;

    for (const slot of passives) {
      const def = PASSIVE_DEFS[slot.id];
      if (!def) continue;

      for (const effect of def.effects) {
        const totalValue = effect.valuePerLevel * slot.level;
        if (effect.isPercentage) {
          (base as any)[effect.stat] *= (1 + totalValue / 100);
        } else {
          (base as any)[effect.stat] += totalValue;
        }
      }
    }

    const glasses = this.getEquippedGlasses();
    if (glasses && glasses.skill.type === 'passive') {
      const effect = glasses.skill.effect;
      const value = effect.value || 0;
      if (effect.stat === 'all') {
        const allStats: Array<keyof PlayerStats> = [
          'maxHealth', 'damage', 'fireRate', 'moveSpeed', 'armor',
          'critChance', 'critDamage', 'xpMultiplier', 'pickupRadius', 'regen',
        ];
        allStats.forEach(stat => {
          if (effect.isPercentage) (base as any)[stat] *= (1 + value / 100);
          else (base as any)[stat] += value;
        });
      } else if (effect.stat && (base as any)[effect.stat] != null) {
        if (effect.isPercentage) (base as any)[effect.stat] *= (1 + value / 100);
        else (base as any)[effect.stat] += value;
      }

      const special = effect.special;
      if (special === 'emergence_resonance') {
        base.regen += 1;
        base.pickupRadius += 20;
      }
      if (special === 'spatial_computing') {
        base.critDamage += 50;
      }
    }

    return base;
  }

  /**
   * Check if any weapon can evolve (max level + matching passive)
   */
  static checkEvolutions(): Array<{ weaponId: string; evolvedId: string }> {
    const results: Array<{ weaponId: string; evolvedId: string }> = [];

    for (const weapon of gameState.data.weapons) {
      if (weapon.evolved) continue;
      if (weapon.level < 8) continue;

      const def = WEAPON_DEFS[weapon.id];
      if (!def || !def.evolvesWith || !def.evolvesInto) continue;

      if (gameState.hasPassive(def.evolvesWith)) {
        results.push({ weaponId: weapon.id, evolvedId: def.evolvesInto });
      }
    }

    return results;
  }

  /**
   * Execute weapon evolution
   */
  static evolveWeapon(weaponId: string, evolvedId: string): boolean {
    return gameState.evolveWeapon(weaponId, evolvedId);
  }

  /**
   * Generate random level-up choices (VS style)
   * Returns 3-4 choices from available weapons and passives
   */
  static generateLevelUpChoices(count: number = 3): LevelUpChoice[] {
    const choices: LevelUpChoice[] = [];
    const state = gameState.data;

    // Pool of possible choices
    const pool: LevelUpChoice[] = [];

    // 1. New weapons (if slots available)
    if (state.weapons.length < state.maxWeaponSlots) {
      const ownedIds = new Set(state.weapons.map(w => w.id));
      for (const [id, def] of Object.entries(WEAPON_DEFS)) {
        if (def.isEvolved) continue;
        if (ownedIds.has(id)) continue;
        pool.push({
          type: 'new_weapon',
          id, nameCN: def.nameCN,
          descriptionCN: `新武器: ${def.descriptionCN}`,
          icon: '🔫',
          rarity: def.rarity,
          color: def.color,
        });
      }
    }

    // 2. Upgrade owned weapons (if not max level)
    for (const weapon of state.weapons) {
      if (weapon.level >= 8 || weapon.evolved) continue;
      const def = WEAPON_DEFS[weapon.id] || WEAPON_DEFS[weapon.evolvedId || ''];
      if (!def) continue;
      pool.push({
        type: 'upgrade_weapon',
        id: weapon.id,
        nameCN: def.nameCN,
        descriptionCN: `升级到 Lv.${weapon.level + 1}`,
        icon: '⬆',
        rarity: def.rarity,
        currentLevel: weapon.level,
        color: def.color,
      });
    }

    // 3. New passives (if slots available)
    if (state.passives.length < state.maxPassiveSlots) {
      const ownedIds = new Set(state.passives.map(p => p.id));
      for (const [id, def] of Object.entries(PASSIVE_DEFS)) {
        if (ownedIds.has(id)) continue;
        pool.push({
          type: 'new_passive',
          id, nameCN: def.nameCN,
          descriptionCN: def.descriptionCN,
          icon: def.icon,
          rarity: def.rarity,
          color: def.color,
        });
      }
    }

    // 4. Upgrade owned passives (if not max level)
    for (const passive of state.passives) {
      if (passive.level >= 5) continue;
      const def = PASSIVE_DEFS[passive.id];
      if (!def) continue;
      pool.push({
        type: 'upgrade_passive',
        id: passive.id,
        nameCN: def.nameCN,
        descriptionCN: `升级到 Lv.${passive.level + 1}`,
        icon: def.icon,
        rarity: def.rarity,
        currentLevel: passive.level,
        color: def.color,
      });
    }

    // Shuffle and pick
    Phaser.Utils.Array.Shuffle(pool);

    // Prioritize: at least one weapon option and one passive option if available
    const weaponChoices = pool.filter(c => c.type === 'new_weapon' || c.type === 'upgrade_weapon');
    const passiveChoices = pool.filter(c => c.type === 'new_passive' || c.type === 'upgrade_passive');

    if (weaponChoices.length > 0) choices.push(weaponChoices[0]);
    if (passiveChoices.length > 0 && choices.length < count) choices.push(passiveChoices[0]);

    // Fill remaining from shuffled pool
    for (const choice of pool) {
      if (choices.length >= count) break;
      if (!choices.some(c => c.id === choice.id && c.type === choice.type)) {
        choices.push(choice);
      }
    }

    return this.attachPowerPreviews(choices.slice(0, count));
  }

  private static attachPowerPreviews(choices: LevelUpChoice[]): LevelUpChoice[] {
    const before = this.estimateLoadoutDps(gameState.data.weapons, gameState.data.passives);
    return choices.map(choice => {
      const simulated = this.simulateChoiceResult(choice, gameState.data.weapons, gameState.data.passives);
      const after = this.estimateLoadoutDps(simulated.weapons, simulated.passives);
      const delta = after - before;
      const roundedBefore = Number(before.toFixed(1));
      const roundedAfter = Number(after.toFixed(1));
      const roundedDelta = Number(delta.toFixed(1));
      const sign = roundedDelta >= 0 ? '+' : '';
      return {
        ...choice,
        previewDpsBefore: roundedBefore,
        previewDpsAfter: roundedAfter,
        previewDpsDelta: roundedDelta,
        previewTextCN: `强度预览  DPS ${roundedBefore} → ${roundedAfter} (${sign}${roundedDelta})`,
      };
    });
  }

  private static simulateChoiceResult(
    choice: LevelUpChoice,
    baseWeapons: WeaponSlot[],
    basePassives: PassiveSlot[]
  ): { weapons: WeaponSlot[]; passives: PassiveSlot[] } {
    const weapons = baseWeapons.map(w => ({ ...w }));
    const passives = basePassives.map(p => ({ ...p }));

    switch (choice.type) {
      case 'new_weapon':
        if (!weapons.some(w => w.id === choice.id)) {
          weapons.push({ id: choice.id, level: 1, evolved: false });
        }
        break;
      case 'upgrade_weapon': {
        const target = weapons.find(w => w.id === choice.id);
        if (target && !target.evolved) {
          target.level = Math.min(8, target.level + 1);
        }
        break;
      }
      case 'new_passive':
        if (!passives.some(p => p.id === choice.id)) {
          passives.push({ id: choice.id, level: 1 });
        }
        break;
      case 'upgrade_passive': {
        const target = passives.find(p => p.id === choice.id);
        if (target) target.level = Math.min(5, target.level + 1);
        break;
      }
    }

    this.applySimulatedEvolutions(weapons, passives);
    return { weapons, passives };
  }

  private static applySimulatedEvolutions(weapons: WeaponSlot[], passives: PassiveSlot[]): void {
    const ownedPassives = new Set(passives.map(p => p.id));
    weapons.forEach(weapon => {
      if (weapon.evolved || weapon.level < 8) return;
      const def = WEAPON_DEFS[weapon.id];
      if (!def || !def.evolvesWith || !def.evolvesInto) return;
      if (!ownedPassives.has(def.evolvesWith)) return;
      weapon.evolved = true;
      weapon.evolvedId = def.evolvesInto;
    });
  }

  private static estimateLoadoutDps(weapons: WeaponSlot[], passives: PassiveSlot[]): number {
    if (!weapons.length) return 0;
    const stats = this.estimateStatsFromPassives(passives);
    const damageMul = Math.max(0.5, 1 + (Number(stats.damage) || 0) / 100);
    const fireRateMul = Math.max(0.5, 1 + (Number(stats.fireRate) || 0) / 100);
    const critChance = Math.max(0, Number(stats.critChance) || 0);
    const critDamage = Math.max(100, Number(stats.critDamage) || 100);
    const critMul = 1 + (critChance / 100) * ((critDamage - 100) / 100);
    const rangeBonus = Math.max(0, Number((stats as any).range) || 0);
    const uptimeMul = 1 + Math.min(0.2, rangeBonus / 400);

    let total = 0;
    for (const weapon of weapons) {
      const effectiveId = weapon.evolved && weapon.evolvedId ? weapon.evolvedId : weapon.id;
      const def = getWeaponAtLevel(effectiveId, weapon.evolved ? 1 : weapon.level);
      if (!def) continue;
      const shotsPerSec = 1000 / Math.max(30, def.fireRate / fireRateMul);
      let dps = def.damage * def.projectileCount * shotsPerSec * damageMul * critMul;
      if (def.special === 'burn') dps *= 1.12;
      if (def.special === 'chain') dps *= 1.1;
      if (def.special === 'explode') dps *= 1.18;
      if (def.special === 'pierce') dps *= 1.08;
      if (weapon.evolved) dps *= 1.12;
      total += dps;
    }

    return total * uptimeMul;
  }

  private static estimateStatsFromPassives(passives: PassiveSlot[]): PlayerStats & { range: number } {
    const stats: PlayerStats & { range: number } = {
      ...gameState.data.baseStats,
      range: 0,
    };

    passives.forEach(slot => {
      const def = PASSIVE_DEFS[slot.id];
      if (!def) return;
      def.effects.forEach(effect => {
        const totalValue = effect.valuePerLevel * slot.level;
        if (effect.isPercentage) {
          (stats as any)[effect.stat] = ((stats as any)[effect.stat] ?? 0) * (1 + totalValue / 100);
        } else {
          (stats as any)[effect.stat] = ((stats as any)[effect.stat] ?? 0) + totalValue;
        }
      });
    });

    return stats;
  }

  /**
   * Apply a level-up choice
   */
  static applyChoice(choice: LevelUpChoice): void {
    switch (choice.type) {
      case 'new_weapon':
        gameState.addWeapon(choice.id);
        break;
      case 'upgrade_weapon':
        gameState.upgradeWeapon(choice.id);
        break;
      case 'new_passive':
        gameState.addPassive(choice.id);
        break;
      case 'upgrade_passive':
        gameState.upgradePassive(choice.id);
        break;
    }

    // Check for evolution after any change
    const evolutions = EvolutionSystem.checkEvolutions();
    for (const evo of evolutions) {
      EvolutionSystem.evolveWeapon(evo.weaponId, evo.evolvedId);
    }
  }

  /**
   * Get current weapon fire config for the VS-style multi-weapon system
   * Returns all owned weapons with their current stats
   */
  static getActiveWeapons(): Array<{ id: string; slotKey: string; def: any; level: number; evolved: boolean }> {
    return gameState.data.weapons.map((w, idx) => {
      const effectiveId = w.evolved && w.evolvedId ? w.evolvedId : w.id;
      const def = getWeaponAtLevel(effectiveId, w.evolved ? 1 : w.level);
      return {
        id: effectiveId,
        slotKey: `${w.id}#${idx}`,
        def,
        level: w.level,
        evolved: w.evolved,
      };
    }).filter(w => w.def !== null);
  }
}
