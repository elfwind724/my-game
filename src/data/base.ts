export type BaseJob = 'idle' | 'kitchen' | 'farm' | 'power' | 'medical' | 'workshop';

export const BASE_JOB_ORDER: BaseJob[] = ['idle', 'kitchen', 'farm', 'power', 'medical', 'workshop'];

export const BASE_JOB_LABELS: Record<BaseJob, string> = {
  idle: '空闲',
  kitchen: '厨房',
  farm: '农场',
  power: '供电',
  medical: '医疗',
  workshop: '工坊',
};

export const BASE_JOB_BONUS: Partial<Record<BaseJob, { food?: number; power?: number; medical?: number; scrap?: number }>> = {
  kitchen: { food: 3 },
  farm: { food: 2 },
  power: { power: 2 },
  medical: { medical: 1 },
  workshop: { scrap: 1 },
};

export const BASE_POWER_CAPACITY = 6;
export const BASE_POWER_PER_TURRET = 2;
