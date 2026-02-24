import type { Resources } from '../state/GameState';

export type RunEventPeriod = 'day' | 'night';
export type RunEventArc =
  | 'caravan'
  | 'outbreak'
  | 'signal'
  | 'defense'
  | 'faction'
  | 'origin'
  | 'truth'
  | 'logistics';
export type RunEventFaction = 'survivorUnion' | 'tradeRing' | 'citadelAI' | 'labRemnant' | 'mutantSwarm';
export type RunEventChainStageId = 'prelude' | 'branch' | 'ending';

export interface RunEventLoreSnippet {
  id: string;
  titleCN: string;
  textCN: string;
}

export interface RunEventChoiceDef {
  id: string;
  titleCN: string;
  detailCN: string;
  resources?: Partial<Record<keyof Resources, [number, number]>>;
  xp?: [number, number];
  heal?: [number, number];
  selfDamage?: [number, number];
  spawnEnemies?: [number, number];
  bitcoin?: [number, number];
  setFlags?: string[];
}

export interface RunEventDef {
  id: string;
  period: RunEventPeriod;
  arc: RunEventArc;
  titleCN: string;
  descCN: string;
  loreKey: string;
  loreTextCN: string;
  weight?: number;
  minDay?: number;
  maxDay?: number;
  cooldownDays?: number;
  unique?: boolean;
  requiresFlags?: string[];
  setFlags?: string[];
  choices: [RunEventChoiceDef, RunEventChoiceDef];
}

export interface RunEventChainStageDef {
  id: RunEventChainStageId;
  labelCN: string;
  descCN: string;
  flags: string[];
  target: number;
}

export const RUN_EVENT_ARC_LABELS: Record<RunEventArc, string> = {
  caravan: '商路余烬',
  outbreak: '感染真相',
  signal: '讯号残卷',
  defense: '周界战报',
  faction: '阵营暗流',
  origin: '地下源头',
  truth: '终局拼图',
  logistics: '物流残网',
};

export const RUN_EVENT_FACTION_LABELS: Record<RunEventFaction, string> = {
  survivorUnion: '幸存者同盟',
  tradeRing: '影市商环',
  citadelAI: '堡垒中枢',
  labRemnant: '实验余脉',
  mutantSwarm: '畸变群落',
};

export const RUN_EVENT_CHAPTER_LABELS: Record<number, string> = {
  1: '余烬初燃',
  2: '扩散回路',
  3: '暗流交错',
  4: '终局回波',
};

export const RUN_EVENT_CHAIN_STAGES: RunEventChainStageDef[] = [
  {
    id: 'prelude',
    labelCN: '前置',
    descCN: '建立情报入口与关键钥匙',
    flags: ['signal_access', 'archive_key_alpha', 'smuggler_contact'],
    target: 2,
  },
  {
    id: 'branch',
    labelCN: '分支',
    descCN: '推进多线行动并形成阵营立场',
    flags: ['quarantine_map', 'lab_fragment', 'refugee_trust', 'refugee_resentment', 'market_codes', 'vault_key_beta'],
    target: 3,
  },
  {
    id: 'ending',
    labelCN: '结局',
    descCN: '汇聚真相并触发终局反应',
    flags: ['truth_fragment_obtained', 'truth_broadcast', 'citadel_counterstrike'],
    target: 2,
  },
];

export const RUN_EVENT_META_BY_ID: Record<string, { chapter: 1 | 2 | 3 | 4; factions: RunEventFaction[] }> = {
  day_caravan_signal: { chapter: 1, factions: ['tradeRing', 'survivorUnion'] },
  day_abandoned_clinic: { chapter: 1, factions: ['survivorUnion', 'labRemnant'] },
  day_river_cache: { chapter: 2, factions: ['tradeRing', 'survivorUnion'] },
  day_subway_relay: { chapter: 2, factions: ['citadelAI', 'survivorUnion'] },
  day_archive_terminal: { chapter: 2, factions: ['citadelAI', 'labRemnant'] },
  day_smuggler_corridor: { chapter: 3, factions: ['tradeRing', 'survivorUnion'] },
  day_quarantine_wall: { chapter: 3, factions: ['labRemnant', 'mutantSwarm'] },
  day_sunken_laboratory: { chapter: 4, factions: ['labRemnant', 'citadelAI'] },
  day_refugee_convoy: { chapter: 3, factions: ['survivorUnion', 'tradeRing'] },
  night_perimeter_breach: { chapter: 1, factions: ['mutantSwarm', 'survivorUnion'] },
  night_signal_hunt: { chapter: 2, factions: ['citadelAI', 'tradeRing'] },
  night_blackout_patrol: { chapter: 2, factions: ['citadelAI', 'mutantSwarm'] },
  night_tunnel_whispers: { chapter: 3, factions: ['labRemnant', 'mutantSwarm'] },
  night_mutant_stampede: { chapter: 3, factions: ['mutantSwarm'] },
  night_shadow_market: { chapter: 3, factions: ['tradeRing', 'survivorUnion'] },
  night_vault_door: { chapter: 3, factions: ['citadelAI', 'labRemnant'] },
  night_truth_fragment: { chapter: 4, factions: ['citadelAI', 'labRemnant'] },
  night_citadel_response: { chapter: 4, factions: ['citadelAI', 'mutantSwarm'] },
};

export const RUN_EVENT_CHOICE_FACTION_DELTA: Record<string, Partial<Record<RunEventFaction, number>>> = {
  trade_safe: { tradeRing: 2, survivorUnion: 1 },
  raid_risky: { tradeRing: -3, mutantSwarm: 1 },
  careful_search: { survivorUnion: 1, labRemnant: 1 },
  force_entry: { survivorUnion: -1, mutantSwarm: 1 },
  line_salvage: { tradeRing: 1, survivorUnion: 1 },
  dive_cargo: { tradeRing: -1, mutantSwarm: 1 },
  patch_relay: { citadelAI: 1, survivorUnion: 1 },
  overclock_relay: { citadelAI: -1, mutantSwarm: 1 },
  safe_decode: { citadelAI: 1, labRemnant: 1 },
  hard_extract: { citadelAI: -2, labRemnant: -1 },
  barter_route: { tradeRing: 2, survivorUnion: 1 },
  hijack_route: { tradeRing: -3, survivorUnion: -1 },
  mark_safe_lane: { survivorUnion: 2, labRemnant: 1 },
  breach_gate: { labRemnant: -2, mutantSwarm: 2 },
  retrieve_samples: { labRemnant: 2, citadelAI: -1 },
  extract_all: { labRemnant: -3, citadelAI: -2 },
  escort_convoy: { survivorUnion: 3, tradeRing: 1 },
  seize_payload: { survivorUnion: -3, tradeRing: -1 },
  seal_breach: { survivorUnion: 2, mutantSwarm: -1 },
  counter_push: { mutantSwarm: 2, survivorUnion: -1 },
  jam_signal: { citadelAI: -1, survivorUnion: 1 },
  trace_source: { citadelAI: -2, tradeRing: -1 },
  repair_grid: { survivorUnion: 1, citadelAI: 1 },
  ambush_dark: { mutantSwarm: 1, survivorUnion: -1 },
  listen_and_map: { labRemnant: 1, survivorUnion: 1 },
  descend_blindly: { mutantSwarm: 2, labRemnant: -1 },
  hold_choke: { survivorUnion: 1, mutantSwarm: -1 },
  lure_to_mines: { mutantSwarm: 2, survivorUnion: -1 },
  silent_trade: { tradeRing: 2, survivorUnion: 1 },
  blackmail_brokers: { tradeRing: -3, citadelAI: -1 },
  slow_decrypt: { citadelAI: 1, labRemnant: 1 },
  forced_crack: { citadelAI: -3, labRemnant: -2 },
  secure_evidence: { survivorUnion: 1, citadelAI: -1, labRemnant: 1 },
  broadcast_now: { survivorUnion: 2, citadelAI: -3 },
  fortify_testimony: { survivorUnion: 2, citadelAI: -1 },
  strike_relay_tower: { citadelAI: -4, mutantSwarm: 1 },
};

export const RUN_EVENT_LORE_SNIPPETS: Record<RunEventArc, RunEventLoreSnippet[]> = {
  caravan: [
    { id: 'cv_01', titleCN: '破译手册', textCN: '旧商队的旗语表里，新增了代表“安全水源失效”的暗号。' },
    { id: 'cv_02', titleCN: '缺货名单', textCN: '药品和滤芯被反复划掉，说明外围据点正在慢性崩溃。' },
    { id: 'cv_03', titleCN: '赎买条款', textCN: '某些商路由“守夜人”收税，支付方式是电池和情报。' },
    { id: 'cv_04', titleCN: '残页签名', textCN: '多份货单由同一代号签署：R-17，疑似旧物流调度员。' },
  ],
  outbreak: [
    { id: 'ob_01', titleCN: '病例缺口', textCN: '感染曲线在第12天出现人工平滑，原始数据被篡改。' },
    { id: 'ob_02', titleCN: '二次变异', textCN: '隔离区样本显示“迟发突变”，潜伏期可超过一周。' },
    { id: 'ob_03', titleCN: '误判通报', textCN: '早期把“应激症状”误判为康复，导致整区复燃。' },
    { id: 'ob_04', titleCN: '封锁指令', textCN: '一份未执行的封锁令提到：真正源头并不在地表。' },
  ],
  signal: [
    { id: 'sg_01', titleCN: '回波校验', textCN: '夜间高频噪声并非干扰，而是被调制过的求援编码。' },
    { id: 'sg_02', titleCN: '失联中继', textCN: '第三中继站持续发送空包，像在等待特定回复。' },
    { id: 'sg_03', titleCN: '伪装信标', textCN: '部分民用广播被改成诱导信号，用于聚集流民。' },
    { id: 'sg_04', titleCN: '链路图', textCN: '信号链路最终汇入“堡垒塔群”，仍有供电。' },
  ],
  defense: [
    { id: 'df_01', titleCN: '周界日志', textCN: '北墙在凌晨前后承压最高，疑似存在固定迁徙通道。' },
    { id: 'df_02', titleCN: '阵地备注', textCN: '旧守军建议“分层火网”，而不是集中在主门。' },
    { id: 'df_03', titleCN: '灯塔协议', textCN: '低亮度诱导灯可显著分流尸潮，但会暴露营地。' },
    { id: 'df_04', titleCN: '反击窗口', textCN: '每次暴雨后30分钟，敌群感知会短暂失灵。' },
  ],
  faction: [
    { id: 'fc_01', titleCN: '中立名单', textCN: '城内至少三支武装保持脆弱停火，靠交易维持边界。' },
    { id: 'fc_02', titleCN: '黑市条款', textCN: '“夜集协议”要求交易后销毁通信记录，违者失踪。' },
    { id: 'fc_03', titleCN: '雇佣广播', textCN: '一支流动队伍长期招募工程兵，目标直指地铁深段。' },
    { id: 'fc_04', titleCN: '泄密指控', textCN: '多个阵营都在追查同一名“档案搬运者”。' },
  ],
  origin: [
    { id: 'og_01', titleCN: '井道剖面', textCN: '地下井道出现非常规保温层，明显是后期加装。' },
    { id: 'og_02', titleCN: '实验代号', textCN: '深层实验记录反复提及“回声体”样本。' },
    { id: 'og_03', titleCN: '供能痕迹', textCN: '即使城区断电，地下区仍保持稳定低压供电。' },
    { id: 'og_04', titleCN: '封门日期', textCN: '源头区在灾变前48小时就完成了全封闭。' },
  ],
  truth: [
    { id: 'tr_01', titleCN: '终局口令', textCN: '最终广播的口令并非求援，而是“协议接管”。' },
    { id: 'tr_02', titleCN: '证词冲突', textCN: '多份幸存者证词时间线矛盾，说明记忆被引导过。' },
    { id: 'tr_03', titleCN: '塔群权限', textCN: '堡垒塔群仍在执行旧权限表，但最高权限已失踪。' },
    { id: 'tr_04', titleCN: '真相边界', textCN: '你掌握的线索越多，敌方响应速度就越快。' },
  ],
  logistics: [
    { id: 'lg_01', titleCN: '冷链标签', textCN: '河道冷链箱上的目的地是“内城医疗穹顶”。' },
    { id: 'lg_02', titleCN: '断桥调度', textCN: '多条物资路线在旧桥节点汇总后统一改道。' },
    { id: 'lg_03', titleCN: '仓储异常', textCN: '旧仓库库存长期对不上账，疑似内鬼持续搬运。' },
    { id: 'lg_04', titleCN: '补给优先级', textCN: '弹药和净水优先级被同时上调，预示长期围困。' },
  ],
};

export const RUN_EVENT_DEFS: RunEventDef[] = [
  {
    id: 'day_caravan_signal',
    period: 'day',
    arc: 'caravan',
    titleCN: '白天事件：流动商队信号',
    descCN: '北侧废路出现旧商队旗语，可能是交易窗口，也可能是诱饵。',
    loreKey: 'caravan_band',
    loreTextCN: '旧商队仍在绕城流通，说明城市外围仍有低烈度据点。',
    weight: 1.3,
    cooldownDays: 2,
    choices: [
      {
        id: 'trade_safe',
        titleCN: '稳妥交易',
        detailCN: '交换库存，换取稳定补给。',
        resources: { food: [2, 5], water: [2, 4], scrap: [1, 3] },
        xp: [10, 16],
        setFlags: ['caravan_contact'],
      },
      {
        id: 'raid_risky',
        titleCN: '强夺车队',
        detailCN: '高收益，但会抬高敌对度。',
        resources: { metal: [4, 8], scrap: [4, 8], ammo: [2, 5], medical: [1, 2] },
        xp: [16, 26],
        selfDamage: [5, 11],
        spawnEnemies: [2, 5],
        setFlags: ['caravan_contact', 'caravan_raided'],
      },
    ],
  },
  {
    id: 'day_abandoned_clinic',
    period: 'day',
    arc: 'outbreak',
    titleCN: '白天事件：废弃诊所',
    descCN: '城区边缘发现半坍塌诊所，药械仍在，但有二次感染痕迹。',
    loreKey: 'outbreak_clinic',
    loreTextCN: '早期隔离点在第3周失守，医护记录显示感染源并非单一。',
    weight: 1.18,
    cooldownDays: 2,
    choices: [
      {
        id: 'careful_search',
        titleCN: '谨慎搜集',
        detailCN: '逐房清点，收益稳定。',
        resources: { medical: [2, 4], water: [1, 2] },
        xp: [8, 14],
      },
      {
        id: 'force_entry',
        titleCN: '暴力破门',
        detailCN: '抢时间，噪音显著。',
        resources: { medical: [4, 8], scrap: [3, 6], energyCore: [0, 1] },
        xp: [14, 23],
        selfDamage: [4, 10],
        spawnEnemies: [3, 6],
      },
    ],
  },
  {
    id: 'day_river_cache',
    period: 'day',
    arc: 'logistics',
    titleCN: '白天事件：河道货栈',
    descCN: '浅滩露出旧货栈浮标，水下可能有冷链箱。',
    loreKey: 'river_logistics',
    loreTextCN: '灾变前的物资调度依赖河道冷链，说明内城仍有供电残区。',
    minDay: 2,
    weight: 1.1,
    cooldownDays: 2,
    choices: [
      {
        id: 'line_salvage',
        titleCN: '系绳回收',
        detailCN: '慢速拖拽，风险较低。',
        resources: { food: [2, 4], water: [2, 4], scrap: [2, 4] },
        xp: [10, 16],
        setFlags: ['river_chart'],
      },
      {
        id: 'dive_cargo',
        titleCN: '潜水开箱',
        detailCN: '高产出，可能惊动水下感染体。',
        resources: { metal: [4, 7], water: [3, 5], ammo: [2, 4] },
        xp: [16, 26],
        bitcoin: [0.02, 0.08],
        selfDamage: [4, 9],
        spawnEnemies: [2, 5],
        setFlags: ['river_chart'],
      },
    ],
  },
  {
    id: 'day_subway_relay',
    period: 'day',
    arc: 'signal',
    titleCN: '白天事件：地铁中继井',
    descCN: '旧地铁控制井仍有弱电信号，可能连接主城区广播网。',
    loreKey: 'relay_wakeup',
    loreTextCN: '地铁井信号与夜间高频噪声同源，说明有人在维护链路。',
    minDay: 2,
    weight: 1.2,
    cooldownDays: 2,
    choices: [
      {
        id: 'patch_relay',
        titleCN: '修补中继',
        detailCN: '稳定恢复，慢慢拉起信号。',
        resources: { scrap: [3, 6], metal: [2, 4] },
        xp: [12, 20],
        setFlags: ['signal_access'],
      },
      {
        id: 'overclock_relay',
        titleCN: '过载拉起',
        detailCN: '立刻见效，但会暴露位置。',
        resources: { energyCore: [1, 2], metal: [3, 6], ammo: [1, 3] },
        xp: [18, 30],
        selfDamage: [5, 10],
        spawnEnemies: [3, 6],
        setFlags: ['signal_access', 'relay_noise'],
      },
    ],
  },
  {
    id: 'day_archive_terminal',
    period: 'day',
    arc: 'signal',
    titleCN: '白天事件：档案终端',
    descCN: '中继恢复后，出现可解密的旧行政档案终端。',
    loreKey: 'archive_terminal',
    loreTextCN: '档案指向“深层避难协议”，同时提到一处失联的总控机房。',
    minDay: 3,
    weight: 0.95,
    cooldownDays: 3,
    requiresFlags: ['signal_access'],
    choices: [
      {
        id: 'safe_decode',
        titleCN: '低速解密',
        detailCN: '慢但稳，尽量不触发警报。',
        resources: { scrap: [2, 4], medical: [1, 3] },
        xp: [14, 22],
        setFlags: ['archive_key_alpha'],
      },
      {
        id: 'hard_extract',
        titleCN: '强制导出',
        detailCN: '高收益，触发监控回流。',
        resources: { energyCore: [1, 2], metal: [4, 7], scrap: [4, 8] },
        xp: [22, 34],
        bitcoin: [0.04, 0.11],
        selfDamage: [6, 11],
        spawnEnemies: [4, 7],
        setFlags: ['archive_key_alpha', 'archive_alarm'],
      },
    ],
  },
  {
    id: 'day_smuggler_corridor',
    period: 'day',
    arc: 'faction',
    titleCN: '白天事件：走私走廊',
    descCN: '废城高架下发现走私线，疑似由多个幸存势力共同维护。',
    loreKey: 'smuggler_corridor',
    loreTextCN: '幸存者并非单一阵营，至少有三股力量在争夺物资线路。',
    minDay: 4,
    weight: 1,
    cooldownDays: 3,
    choices: [
      {
        id: 'barter_route',
        titleCN: '低调换货',
        detailCN: '建立关系，换取稀缺补给。',
        resources: { ammo: [2, 4], medical: [2, 4], water: [2, 3] },
        xp: [14, 20],
        bitcoin: [0.03, 0.09],
        setFlags: ['smuggler_contact'],
      },
      {
        id: 'hijack_route',
        titleCN: '劫掠货道',
        detailCN: '短期暴利，但后续敌意上升。',
        resources: { metal: [4, 8], scrap: [5, 9], ammo: [3, 5], food: [2, 4] },
        xp: [22, 34],
        selfDamage: [6, 12],
        spawnEnemies: [4, 7],
        setFlags: ['smuggler_contact', 'smuggler_hostile'],
      },
    ],
  },
  {
    id: 'day_quarantine_wall',
    period: 'day',
    arc: 'outbreak',
    titleCN: '白天事件：封锁墙缺口',
    descCN: '旧隔离墙出现新裂口，墙体涂层残留有编号化感染记录。',
    loreKey: 'quarantine_wall',
    loreTextCN: '隔离墙从未真正封住核心污染区，官方数据曾被多次回写。',
    minDay: 5,
    weight: 0.9,
    cooldownDays: 3,
    requiresFlags: ['archive_key_alpha'],
    choices: [
      {
        id: 'mark_safe_lane',
        titleCN: '标记安全通道',
        detailCN: '保住行动路线，收益偏稳。',
        resources: { medical: [2, 4], water: [2, 4], food: [2, 4] },
        xp: [16, 24],
        heal: [4, 9],
        setFlags: ['quarantine_map'],
      },
      {
        id: 'breach_gate',
        titleCN: '强开封门',
        detailCN: '深入隔离区，强收益高风险。',
        resources: { energyCore: [1, 2], metal: [4, 7], medical: [2, 4] },
        xp: [24, 36],
        selfDamage: [7, 13],
        spawnEnemies: [5, 8],
        setFlags: ['quarantine_map', 'quarantine_breach'],
      },
    ],
  },
  {
    id: 'day_sunken_laboratory',
    period: 'day',
    arc: 'origin',
    titleCN: '白天事件：沉陷实验室',
    descCN: '河谷地下室裸露，内有实验日志与封存样本。',
    loreKey: 'sunken_lab',
    loreTextCN: '感染体可能源于失控试验，而非自然扩散，且仍有样本被追踪。',
    minDay: 7,
    weight: 0.82,
    cooldownDays: 4,
    requiresFlags: ['signal_access'],
    choices: [
      {
        id: 'retrieve_samples',
        titleCN: '回收样本',
        detailCN: '优先科研材料，降低暴露。',
        resources: { medical: [3, 6], energyCore: [1, 2], water: [2, 3] },
        xp: [22, 34],
        setFlags: ['lab_fragment'],
      },
      {
        id: 'extract_all',
        titleCN: '整库搬空',
        detailCN: '收益最高，触发追踪。',
        resources: { energyCore: [2, 3], metal: [5, 9], scrap: [5, 9] },
        xp: [30, 44],
        bitcoin: [0.06, 0.16],
        selfDamage: [8, 15],
        spawnEnemies: [6, 10],
        setFlags: ['lab_fragment', 'lab_alarm'],
      },
    ],
  },
  {
    id: 'day_refugee_convoy',
    period: 'day',
    arc: 'faction',
    titleCN: '白天事件：难民车队',
    descCN: '一支小型难民车队请求借道与补给。',
    loreKey: 'refugee_routes',
    loreTextCN: '外环道路并未完全断开，仍有逃亡路线连接各个营地。',
    minDay: 6,
    weight: 0.9,
    cooldownDays: 3,
    choices: [
      {
        id: 'escort_convoy',
        titleCN: '护送借道',
        detailCN: '建立声望，回收较慢。',
        resources: { food: [3, 6], water: [2, 4], medical: [1, 3] },
        xp: [18, 26],
        heal: [5, 10],
        setFlags: ['refugee_trust'],
      },
      {
        id: 'seize_payload',
        titleCN: '截留货箱',
        detailCN: '短期补给暴涨，长期关系恶化。',
        resources: { ammo: [3, 6], scrap: [4, 8], metal: [3, 6] },
        xp: [24, 36],
        bitcoin: [0.04, 0.12],
        selfDamage: [6, 11],
        spawnEnemies: [4, 8],
        setFlags: ['refugee_resentment'],
      },
    ],
  },
  {
    id: 'night_perimeter_breach',
    period: 'night',
    arc: 'defense',
    titleCN: '夜间事件：周界破口',
    descCN: '基地东侧围栏出现破口，必须快速决策。',
    loreKey: 'perimeter_failures',
    loreTextCN: '旧防线多为临时改造，夜间连锁失效已成常态。',
    weight: 1.25,
    cooldownDays: 2,
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
        detailCN: '收益高，夜压更大。',
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
    arc: 'signal',
    titleCN: '夜间事件：异常讯号追踪',
    descCN: '探测到高能信号源，可能是补给缓存，也可能是诱饵。',
    loreKey: 'signal_bait',
    loreTextCN: '讯号源会在整点切换频道，像是人为引导幸存者移动。',
    minDay: 2,
    weight: 1.1,
    cooldownDays: 2,
    choices: [
      {
        id: 'jam_signal',
        titleCN: '干扰屏蔽',
        detailCN: '保守处理，降低暴露。',
        resources: { scrap: [2, 4], medical: [1, 2] },
        xp: [10, 18],
        setFlags: ['signal_trace'],
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
        setFlags: ['signal_trace'],
      },
    ],
  },
  {
    id: 'night_blackout_patrol',
    period: 'night',
    arc: 'defense',
    titleCN: '夜间事件：停电巡逻',
    descCN: '外圈照明断续熄灭，需决定是修电还是借暗突袭。',
    loreKey: 'power_grid_fragile',
    loreTextCN: '主干电网只剩片段供电，夜间负载会导致区域级熄灯。',
    minDay: 2,
    weight: 1,
    cooldownDays: 2,
    choices: [
      {
        id: 'repair_grid',
        titleCN: '抢修回路',
        detailCN: '稳住夜防，额外战利较少。',
        resources: { wood: [2, 4], metal: [2, 4] },
        xp: [12, 20],
      },
      {
        id: 'ambush_dark',
        titleCN: '借暗反袭',
        detailCN: '高收益，敌压上升。',
        resources: { ammo: [3, 5], scrap: [3, 6], energyCore: [0, 1] },
        xp: [20, 32],
        selfDamage: [6, 12],
        spawnEnemies: [4, 8],
      },
    ],
  },
  {
    id: 'night_tunnel_whispers',
    period: 'night',
    arc: 'origin',
    titleCN: '夜间事件：隧道低语',
    descCN: '山洞方向传来周期性金属回响，疑似地下设施在运作。',
    loreKey: 'tunnel_whispers',
    loreTextCN: '地下并非死寂，仍有自动系统按旧指令运行。',
    minDay: 3,
    weight: 0.92,
    cooldownDays: 3,
    choices: [
      {
        id: 'listen_and_map',
        titleCN: '监听绘图',
        detailCN: '先摸清路径，风险低。',
        resources: { medical: [1, 3], scrap: [2, 5] },
        xp: [14, 22],
        setFlags: ['tunnel_map'],
      },
      {
        id: 'descend_blindly',
        titleCN: '盲降侦查',
        detailCN: '可能直达核心，也可能撞上群体感染。',
        resources: { energyCore: [1, 2], metal: [3, 6], ammo: [2, 4] },
        xp: [22, 34],
        selfDamage: [7, 14],
        spawnEnemies: [5, 9],
        setFlags: ['tunnel_map', 'tunnel_depth'],
      },
    ],
  },
  {
    id: 'night_mutant_stampede',
    period: 'night',
    arc: 'outbreak',
    titleCN: '夜间事件：畸变群冲线',
    descCN: '监测到一批高移动畸变体向基地扇形逼近。',
    loreKey: 'mutant_migration',
    loreTextCN: '畸变体会沿固定迁移带移动，像被某种频率牵引。',
    minDay: 4,
    weight: 0.95,
    cooldownDays: 3,
    choices: [
      {
        id: 'hold_choke',
        titleCN: '守住瓶颈',
        detailCN: '稳防路线，适中收益。',
        resources: { wood: [2, 4], ammo: [2, 4] },
        xp: [16, 24],
      },
      {
        id: 'lure_to_mines',
        titleCN: '诱导爆破',
        detailCN: '回报高，且会引来残余敌群。',
        resources: { metal: [4, 7], scrap: [4, 8], ammo: [3, 6] },
        xp: [24, 38],
        bitcoin: [0.04, 0.12],
        selfDamage: [7, 14],
        spawnEnemies: [5, 9],
      },
    ],
  },
  {
    id: 'night_shadow_market',
    period: 'night',
    arc: 'faction',
    titleCN: '夜间事件：影市交换',
    descCN: '走私联系发来夜间影市坐标，可交易也可强控。',
    loreKey: 'shadow_market',
    loreTextCN: '影市由多个武装小队轮值，不受单一营地控制。',
    minDay: 5,
    weight: 0.88,
    cooldownDays: 3,
    requiresFlags: ['smuggler_contact'],
    choices: [
      {
        id: 'silent_trade',
        titleCN: '静默交易',
        detailCN: '风险较低，收益偏稳。',
        resources: { medical: [2, 4], ammo: [2, 4], water: [2, 3] },
        xp: [18, 26],
        bitcoin: [0.05, 0.12],
      },
      {
        id: 'blackmail_brokers',
        titleCN: '威压控场',
        detailCN: '高收益，但敌意上涨。',
        resources: { metal: [4, 8], scrap: [4, 8], energyCore: [1, 2] },
        xp: [26, 40],
        bitcoin: [0.08, 0.18],
        selfDamage: [8, 15],
        spawnEnemies: [6, 10],
        setFlags: ['market_codes'],
      },
    ],
  },
  {
    id: 'night_vault_door',
    period: 'night',
    arc: 'signal',
    titleCN: '夜间事件：避难库门',
    descCN: '档案密钥匹配到一扇地下库门，可尝试安全解锁。',
    loreKey: 'vault_access',
    loreTextCN: '所谓“避难库”更像指挥备份站，记录了最后通告的原稿。',
    minDay: 6,
    weight: 0.86,
    cooldownDays: 4,
    requiresFlags: ['archive_key_alpha'],
    choices: [
      {
        id: 'slow_decrypt',
        titleCN: '稳态解锁',
        detailCN: '慢开门，尽量不触发防御程序。',
        resources: { energyCore: [1, 2], scrap: [3, 5], medical: [1, 3] },
        xp: [20, 30],
        setFlags: ['vault_key_beta'],
      },
      {
        id: 'forced_crack',
        titleCN: '强拆爆破',
        detailCN: '高收益但会触发反制。',
        resources: { energyCore: [2, 3], metal: [5, 9], ammo: [3, 6] },
        xp: [30, 44],
        bitcoin: [0.08, 0.2],
        selfDamage: [9, 16],
        spawnEnemies: [7, 11],
        setFlags: ['vault_key_beta', 'vault_alarm'],
      },
    ],
  },
  {
    id: 'night_truth_fragment',
    period: 'night',
    arc: 'truth',
    titleCN: '夜间事件：真相碎片',
    descCN: '多条线索交汇，出现一段“最终广播”残片。',
    loreKey: 'truth_fragment',
    loreTextCN: '广播残片指出：灾变初期有人主动切断了主避难网络。',
    minDay: 8,
    weight: 0.62,
    cooldownDays: 6,
    unique: true,
    requiresFlags: ['vault_key_beta', 'signal_trace'],
    setFlags: ['truth_fragment_obtained'],
    choices: [
      {
        id: 'secure_evidence',
        titleCN: '封存证据',
        detailCN: '保守推进，为后续行动蓄力。',
        resources: { energyCore: [2, 3], medical: [2, 4], water: [2, 4] },
        xp: [30, 42],
        bitcoin: [0.08, 0.18],
        heal: [8, 16],
      },
      {
        id: 'broadcast_now',
        titleCN: '立即公开',
        detailCN: '短期收益更高，同时引发大规模追击。',
        resources: { energyCore: [2, 3], metal: [4, 8], ammo: [4, 8] },
        xp: [38, 56],
        bitcoin: [0.12, 0.26],
        selfDamage: [10, 18],
        spawnEnemies: [8, 12],
        setFlags: ['truth_broadcast'],
      },
    ],
  },
  {
    id: 'night_citadel_response',
    period: 'night',
    arc: 'truth',
    titleCN: '夜间事件：堡垒回波',
    descCN: '真相碎片触发“堡垒回波”，敌方开始定向压制。',
    loreKey: 'citadel_response',
    loreTextCN: '敌方并非失控群体，至少存在一个能够组织调度的核心节点。',
    minDay: 10,
    weight: 0.54,
    cooldownDays: 8,
    unique: true,
    requiresFlags: ['truth_fragment_obtained'],
    choices: [
      {
        id: 'fortify_testimony',
        titleCN: '固守证据链',
        detailCN: '强化据点，拖住追兵。',
        resources: { wood: [4, 8], metal: [4, 7], medical: [2, 4] },
        xp: [34, 48],
      },
      {
        id: 'strike_relay_tower',
        titleCN: '突袭中继塔',
        detailCN: '高风险斩首行动。',
        resources: { energyCore: [2, 3], ammo: [4, 8], scrap: [5, 9] },
        xp: [42, 60],
        bitcoin: [0.14, 0.3],
        selfDamage: [11, 20],
        spawnEnemies: [9, 14],
        setFlags: ['citadel_counterstrike'],
      },
    ],
  },
];
