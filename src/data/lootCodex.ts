export interface LootCodexEntryDef {
  id: string;
  nameCN: string;
  iconKey: string;
  accentColor: number;
  accentText: string;
  usageCN: string;
  sourceCN: string;
  loreCN: string;
}

export const LOOT_CODEX_ENTRIES: LootCodexEntryDef[] = [
  {
    id: 'wood',
    nameCN: '木材',
    iconKey: 'loot_wood',
    accentColor: 0xb77b45,
    accentText: '#fbbf24',
    usageCN: '建造、修复、封堵防线',
    sourceCN: '荒区残木、白天采集点、夜防奖励',
    loreCN: '旧城市最稳定的结构材料，仍是营地扩张基础。',
  },
  {
    id: 'metal',
    nameCN: '金属',
    iconKey: 'loot_metal',
    accentColor: 0x93c5fd,
    accentText: '#93c5fd',
    usageCN: '炮塔升级、重装建造、协议部件',
    sourceCN: '重装敌、城区搜刮、夜战高压波次',
    loreCN: '工业残骸的核心产物，直接决定防线硬度。',
  },
  {
    id: 'food',
    nameCN: '食物',
    iconKey: 'loot_food',
    accentColor: 0xf59e0b,
    accentText: '#f59e0b',
    usageCN: '人口维持、白天消耗、基地日结算',
    sourceCN: '河流钓获、森林狩猎、补给箱',
    loreCN: '食物短缺会让整支队伍战斗效率快速下降。',
  },
  {
    id: 'water',
    nameCN: '净水',
    iconKey: 'loot_water',
    accentColor: 0x38bdf8,
    accentText: '#38bdf8',
    usageCN: '生活消耗、医疗协作、探索奖励',
    sourceCN: '河道节点、净化设施、商路交换',
    loreCN: '干净水源正在减少，后期贸易价值持续上升。',
  },
  {
    id: 'scrap',
    nameCN: '零件',
    iconKey: 'loot_scrap',
    accentColor: 0x94a3b8,
    accentText: '#cbd5e1',
    usageCN: '制造、维修、任务交付通用材料',
    sourceCN: '常规敌掉落、城区废墟、探索奖励',
    loreCN: '最常见也最通用的战地工业碎片。',
  },
  {
    id: 'medical',
    nameCN: '医疗',
    iconKey: 'loot_medical',
    accentColor: 0xf87171,
    accentText: '#f87171',
    usageCN: '生命恢复、高级委托、紧急维稳',
    sourceCN: '诊所遗址、治愈体、夜间交易',
    loreCN: '药械库存决定营地在高压夜战的容错空间。',
  },
  {
    id: 'ammo',
    nameCN: '弹药',
    iconKey: 'loot_ammo',
    accentColor: 0xfb923c,
    accentText: '#fb923c',
    usageCN: '夜战压制、出击任务、弹幕补给',
    sourceCN: '远程敌、军械点、森林/城区事件',
    loreCN: '弹药不足会直接降低夜战推进能力。',
  },
  {
    id: 'energyCore',
    nameCN: '能量核',
    iconKey: 'loot_core',
    accentColor: 0xc4b5fd,
    accentText: '#c4b5fd',
    usageCN: '稀有强化、终局协议、高阶装备',
    sourceCN: '精英/Boss、洞穴深层、终局事件',
    loreCN: '旧世界核心能源模块，是关键科技的门票。',
  },
];

export const LOOT_CODEX_BY_ID: Record<string, LootCodexEntryDef> = LOOT_CODEX_ENTRIES.reduce((acc, entry) => {
  acc[entry.id] = entry;
  return acc;
}, {} as Record<string, LootCodexEntryDef>);
