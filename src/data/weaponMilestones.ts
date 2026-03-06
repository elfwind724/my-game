export interface WeaponMilestoneDef {
  level: number;
  titleCN: string;
  detailCN: string;
  damageMul?: number;
  fireRateMul?: number;
  projectileBonus?: number;
  speedMul?: number;
  rangeMul?: number;
  signaturePower?: number;
  signatureRateMul?: number;
  dpsWeight?: number;
}

export interface WeaponMilestoneBonuses {
  count: number;
  damageMul: number;
  fireRateMul: number;
  projectileBonus: number;
  speedMul: number;
  rangeMul: number;
  signaturePower: number;
  signatureRateMul: number;
  dpsWeight: number;
}

const DEFAULT_BONUSES: WeaponMilestoneBonuses = {
  count: 0,
  damageMul: 1,
  fireRateMul: 1,
  projectileBonus: 0,
  speedMul: 1,
  rangeMul: 1,
  signaturePower: 0,
  signatureRateMul: 1,
  dpsWeight: 1,
};

export const WEAPON_MILESTONES: Record<string, WeaponMilestoneDef[]> = {
  ar_basic: [
    { level: 3, titleCN: '侧向补射', detailCN: '基础射线追加双侧补射', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.14 },
    { level: 5, titleCN: '连锁脉冲', detailCN: '签名弹幕触发更频繁', damageMul: 1.12, fireRateMul: 0.9, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.2 },
    { level: 8, titleCN: '过载临界', detailCN: '弹幕成型，满足被动可进化', damageMul: 1.16, fireRateMul: 0.88, speedMul: 1.08, signaturePower: 1, signatureRateMul: 1.16, dpsWeight: 1.25 },
  ],
  scatter: [
    { level: 3, titleCN: '扩散幕墙', detailCN: '散射锥面更宽并追加弹片', damageMul: 1.06, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.12 },
    { level: 5, titleCN: '灼烧扇面', detailCN: '扇形压制更密，近距离更凶', damageMul: 1.12, fireRateMul: 0.92, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.2 },
    { level: 8, titleCN: '暴风临界', detailCN: '爆发扇面成型，满足被动可进化', damageMul: 1.15, fireRateMul: 0.88, speedMul: 1.06, signaturePower: 1, signatureRateMul: 1.18, dpsWeight: 1.26 },
  ],
  pulse: [
    { level: 3, titleCN: '双脉冲', detailCN: '连射补出第二条脉冲线', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.13 },
    { level: 5, titleCN: '压制格栅', detailCN: '高频补射形成弹幕格栅', damageMul: 1.1, fireRateMul: 0.9, signaturePower: 2, signatureRateMul: 1.16, dpsWeight: 1.22 },
    { level: 8, titleCN: '弹幕临界', detailCN: '连射形态完成，满足被动可进化', damageMul: 1.14, fireRateMul: 0.86, speedMul: 1.08, signaturePower: 1, signatureRateMul: 1.18, dpsWeight: 1.28 },
  ],
  flame: [
    { level: 3, titleCN: '裂焰余烬', detailCN: '火焰射线分裂出灼烧余烬', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.14 },
    { level: 5, titleCN: '焚风环', detailCN: '周身扩散火环，持续灼烧更强', damageMul: 1.12, fireRateMul: 0.9, signaturePower: 2, dpsWeight: 1.23 },
    { level: 8, titleCN: '地狱火临界', detailCN: '火焰铺场完成，满足被动可进化', damageMul: 1.16, fireRateMul: 0.86, rangeMul: 1.08, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.28 },
  ],
  pierce: [
    { level: 3, titleCN: '双重穿矛', detailCN: '穿透光束追加副束', damageMul: 1.08, projectileBonus: 1, speedMul: 1.06, signaturePower: 1, dpsWeight: 1.15 },
    { level: 5, titleCN: '十字裂束', detailCN: '穿刺补射形成交叉切割', damageMul: 1.12, fireRateMul: 0.92, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.22 },
    { level: 8, titleCN: '湮灭临界', detailCN: '远程切割完成，满足被动可进化', damageMul: 1.16, fireRateMul: 0.88, speedMul: 1.1, rangeMul: 1.08, signaturePower: 1, dpsWeight: 1.29 },
  ],
  cannon: [
    { level: 3, titleCN: '双核爆片', detailCN: '能量炮开始裂变出爆片', damageMul: 1.1, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.15 },
    { level: 5, titleCN: '震荡集束', detailCN: '爆炸后追加二次震荡', damageMul: 1.14, fireRateMul: 0.92, signaturePower: 1, signatureRateMul: 1.12, dpsWeight: 1.23 },
    { level: 8, titleCN: '反射临界', detailCN: '重炮形态完成，满足被动可进化', damageMul: 1.18, fireRateMul: 0.88, speedMul: 1.06, signaturePower: 1, dpsWeight: 1.3 },
  ],
  orbit: [
    { level: 3, titleCN: '增幅环刃', detailCN: '环绕刀刃数量增加', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.13 },
    { level: 5, titleCN: '连锁光环', detailCN: '环绕期间追加连锁电弧', damageMul: 1.1, fireRateMul: 0.92, signaturePower: 2, signatureRateMul: 1.14, dpsWeight: 1.2 },
    { level: 8, titleCN: '涡旋临界', detailCN: '环绕压制完成，满足被动可进化', damageMul: 1.14, fireRateMul: 0.88, speedMul: 1.08, signaturePower: 1, dpsWeight: 1.26 },
  ],
  holy_water: [
    { level: 3, titleCN: '双瓶投掷', detailCN: '圣水追加第二瓶', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.14 },
    { level: 5, titleCN: '圣域铺场', detailCN: '地面持续区域更密更久', damageMul: 1.12, fireRateMul: 0.9, rangeMul: 1.08, signaturePower: 1, dpsWeight: 1.22 },
    { level: 8, titleCN: '洗礼临界', detailCN: '圣域形态完成，满足被动可进化', damageMul: 1.16, fireRateMul: 0.88, speedMul: 1.05, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.28 },
  ],
  lightning_ring: [
    { level: 3, titleCN: '扩圈放电', detailCN: '闪电环追加额外电弧', damageMul: 1.08, projectileBonus: 2, signaturePower: 1, dpsWeight: 1.16 },
    { level: 5, titleCN: '雷网扩散', detailCN: '环形闪电触发更频繁', damageMul: 1.1, fireRateMul: 0.9, signaturePower: 2, signatureRateMul: 1.16, dpsWeight: 1.24 },
    { level: 8, titleCN: '风暴临界', detailCN: '雷暴压制完成，满足被动可进化', damageMul: 1.14, fireRateMul: 0.86, speedMul: 1.08, signaturePower: 1, dpsWeight: 1.3 },
  ],
  boomerang: [
    { level: 3, titleCN: '双回旋', detailCN: '回旋镖追加返程副镖', damageMul: 1.08, projectileBonus: 1, speedMul: 1.06, signaturePower: 1, dpsWeight: 1.14 },
    { level: 5, titleCN: '扇返切割', detailCN: '回旋角度更宽，回返更快', damageMul: 1.12, fireRateMul: 0.92, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.22 },
    { level: 8, titleCN: '裂空临界', detailCN: '回旋压制完成，满足被动可进化', damageMul: 1.16, fireRateMul: 0.88, speedMul: 1.08, signaturePower: 1, dpsWeight: 1.28 },
  ],
  frost: [
    { level: 3, titleCN: '寒流分裂', detailCN: '冰冻射线追加侧向寒流', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.14 },
    { level: 5, titleCN: '冻结领域', detailCN: '冻结波更密，控场更强', damageMul: 1.12, fireRateMul: 0.9, signaturePower: 2, dpsWeight: 1.22 },
    { level: 8, titleCN: '绝对零度临界', detailCN: '冻结形态完成，满足被动可进化', damageMul: 1.16, fireRateMul: 0.88, speedMul: 1.05, signaturePower: 1, signatureRateMul: 1.14, dpsWeight: 1.28 },
  ],
  chain: [
    { level: 3, titleCN: '跳链增幅', detailCN: '闪电链追加分叉', damageMul: 1.08, projectileBonus: 1, signaturePower: 1, dpsWeight: 1.15 },
    { level: 5, titleCN: '电弧风暴', detailCN: '连锁触发更频繁更密集', damageMul: 1.1, fireRateMul: 0.9, signaturePower: 2, signatureRateMul: 1.16, dpsWeight: 1.24 },
    { level: 8, titleCN: 'EMP临界', detailCN: '电网成型，满足被动可进化', damageMul: 1.14, fireRateMul: 0.86, speedMul: 1.08, signaturePower: 1, dpsWeight: 1.3 },
  ],
};

export function getWeaponMilestones(weaponId: string): WeaponMilestoneDef[] {
  return WEAPON_MILESTONES[weaponId] || [];
}

export function getReachedWeaponMilestone(weaponId: string, previousLevel: number, nextLevel: number): WeaponMilestoneDef | null {
  return getWeaponMilestones(weaponId).find((milestone) => previousLevel < milestone.level && nextLevel >= milestone.level) || null;
}

export function getWeaponMilestoneBonuses(weaponId: string, level: number): WeaponMilestoneBonuses {
  const reached = getWeaponMilestones(weaponId).filter((milestone) => level >= milestone.level);
  if (reached.length <= 0) return { ...DEFAULT_BONUSES };

  return reached.reduce<WeaponMilestoneBonuses>((acc, milestone) => {
    acc.count += 1;
    acc.damageMul *= milestone.damageMul || 1;
    acc.fireRateMul *= milestone.fireRateMul || 1;
    acc.projectileBonus += milestone.projectileBonus || 0;
    acc.speedMul *= milestone.speedMul || 1;
    acc.rangeMul *= milestone.rangeMul || 1;
    acc.signaturePower += milestone.signaturePower || 0;
    acc.signatureRateMul *= milestone.signatureRateMul || 1;
    acc.dpsWeight *= milestone.dpsWeight || 1;
    return acc;
  }, { ...DEFAULT_BONUSES });
}

export function getWeaponMilestoneStage(weaponId: string, level: number): number {
  return getWeaponMilestoneBonuses(weaponId, level).count;
}
