import type { CompanionRole } from '../types/SkillTypes';

export interface CompanionMilestoneBonuses {
  damageMul: number;
  fireRateMul: number;
  rangeMul: number;
  healthMul: number;
  speedFlat: number;
  bonusPierce: number;
  bonusExplosionRadius: number;
  bonusHoming: number;
  dayYieldMul: number;
  constructionSpeedMul: number;
  scavengerYieldMul: number;
  scavengerRadiusBonus: number;
  defenseDamageMul: number;
  supportYieldMul: number;
}

export interface CompanionMilestoneDef {
  level: number;
  titleCN: string;
  detailCN: string;
  bonuses: Partial<CompanionMilestoneBonuses>;
}

const DEFAULT_BONUSES: CompanionMilestoneBonuses = {
  damageMul: 1,
  fireRateMul: 1,
  rangeMul: 1,
  healthMul: 1,
  speedFlat: 0,
  bonusPierce: 0,
  bonusExplosionRadius: 0,
  bonusHoming: 0,
  dayYieldMul: 1,
  constructionSpeedMul: 1,
  scavengerYieldMul: 1,
  scavengerRadiusBonus: 0,
  defenseDamageMul: 1,
  supportYieldMul: 1,
};

export const COMPANION_MILESTONES: Record<CompanionRole, CompanionMilestoneDef[]> = {
  tank: [
    {
      level: 5,
      titleCN: '前线压制',
      detailCN: '爆裂半径扩大，驻守防线更稳，施工效率小幅提升。',
      bonuses: {
        damageMul: 1.1,
        healthMul: 1.08,
        bonusExplosionRadius: 10,
        constructionSpeedMul: 1.08,
        defenseDamageMul: 1.1,
      },
    },
    {
      level: 10,
      titleCN: '堡垒协同',
      detailCN: '火力更密，血量更厚，作为建筑工或防御者时收益明显抬升。',
      bonuses: {
        damageMul: 1.14,
        fireRateMul: 0.95,
        healthMul: 1.14,
        speedFlat: 8,
        bonusExplosionRadius: 18,
        constructionSpeedMul: 1.16,
        defenseDamageMul: 1.18,
        dayYieldMul: 1.04,
      },
    },
    {
      level: 20,
      titleCN: '钢铁先驱',
      detailCN: '进入核心跃迁：重炮压制、夜防强化、基地施工显著提速。',
      bonuses: {
        damageMul: 1.22,
        fireRateMul: 0.9,
        rangeMul: 1.06,
        healthMul: 1.22,
        speedFlat: 14,
        bonusExplosionRadius: 32,
        constructionSpeedMul: 1.28,
        defenseDamageMul: 1.28,
        dayYieldMul: 1.08,
      },
    },
  ],
  sniper: [
    {
      level: 5,
      titleCN: '弱点标记',
      detailCN: '穿透增强，采集半径扩大，搜刮与狩猎效率上升。',
      bonuses: {
        damageMul: 1.12,
        rangeMul: 1.08,
        bonusPierce: 1,
        scavengerRadiusBonus: 20,
        scavengerYieldMul: 1.08,
        dayYieldMul: 1.04,
      },
    },
    {
      level: 10,
      titleCN: '远程校准',
      detailCN: '射速与射程同步跃迁，远征和夜间驻守更有效率。',
      bonuses: {
        damageMul: 1.16,
        fireRateMul: 0.95,
        rangeMul: 1.14,
        speedFlat: 10,
        bonusPierce: 1,
        scavengerYieldMul: 1.14,
        scavengerRadiusBonus: 36,
        defenseDamageMul: 1.12,
      },
    },
    {
      level: 20,
      titleCN: '猎场统御',
      detailCN: '进入核心跃迁：长射程穿透清场，远征收益与夜战狙杀双强化。',
      bonuses: {
        damageMul: 1.26,
        fireRateMul: 0.9,
        rangeMul: 1.2,
        speedFlat: 16,
        bonusPierce: 2,
        scavengerYieldMul: 1.22,
        scavengerRadiusBonus: 56,
        defenseDamageMul: 1.22,
        dayYieldMul: 1.08,
      },
    },
  ],
  medic: [
    {
      level: 5,
      titleCN: '战地回收',
      detailCN: '导引更稳，支援恢复增强，驻守补给更容易触发。',
      bonuses: {
        damageMul: 1.08,
        fireRateMul: 0.97,
        healthMul: 1.06,
        bonusHoming: 0.03,
        supportYieldMul: 1.1,
        dayYieldMul: 1.08,
      },
    },
    {
      level: 10,
      titleCN: '协同增幅',
      detailCN: '治疗与辅助联动更强，团队续航和基地日常产出双提升。',
      bonuses: {
        damageMul: 1.12,
        fireRateMul: 0.94,
        rangeMul: 1.08,
        speedFlat: 10,
        bonusHoming: 0.05,
        supportYieldMul: 1.18,
        dayYieldMul: 1.12,
        defenseDamageMul: 1.06,
      },
    },
    {
      level: 20,
      titleCN: '圣疗枢纽',
      detailCN: '进入核心跃迁：导引弹更强，治疗冷却更短，后勤与驻守全面强化。',
      bonuses: {
        damageMul: 1.18,
        fireRateMul: 0.9,
        rangeMul: 1.14,
        healthMul: 1.14,
        speedFlat: 16,
        bonusHoming: 0.08,
        supportYieldMul: 1.3,
        dayYieldMul: 1.16,
        defenseDamageMul: 1.1,
      },
    },
  ],
};

export function getCompanionMilestones(role: CompanionRole): CompanionMilestoneDef[] {
  return COMPANION_MILESTONES[role] || COMPANION_MILESTONES.tank;
}

export function getCompanionMilestoneBonuses(role: CompanionRole, level: number): CompanionMilestoneBonuses {
  const result: CompanionMilestoneBonuses = { ...DEFAULT_BONUSES };
  getCompanionMilestones(role).forEach((milestone) => {
    if (level < milestone.level) return;
    const bonuses = milestone.bonuses || {};
    Object.entries(bonuses).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const typedKey = key as keyof CompanionMilestoneBonuses;
      if (typedKey === 'speedFlat' || typedKey === 'bonusPierce' || typedKey === 'bonusExplosionRadius' || typedKey === 'bonusHoming' || typedKey === 'scavengerRadiusBonus') {
        result[typedKey] = Number(result[typedKey]) + Number(value);
      } else {
        result[typedKey] = Number(result[typedKey]) * Number(value);
      }
    });
  });
  return result;
}

export function getCurrentCompanionMilestone(role: CompanionRole, level: number): CompanionMilestoneDef | null {
  const reached = getCompanionMilestones(role).filter((item) => level >= item.level);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

export function getNextCompanionMilestone(role: CompanionRole, level: number): CompanionMilestoneDef | null {
  return getCompanionMilestones(role).find((item) => level < item.level) || null;
}

export function getReachedCompanionMilestone(
  role: CompanionRole,
  previousLevel: number,
  nextLevel: number
): CompanionMilestoneDef | null {
  const reached = getCompanionMilestones(role).filter((item) => previousLevel < item.level && nextLevel >= item.level);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}
