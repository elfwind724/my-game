import type { CompanionData, CompanionProfile } from '../state/GameState';

type ResidentBehavior = 'fishing' | 'cooking' | 'guard' | 'sleep' | 'forage' | 'adventure' | 'stroll' | 'idle';

interface CompanionChatterContext {
  behavior?: ResidentBehavior;
  isNight: boolean;
  day: number;
  week: number;
  mood?: 'normal' | 'hungry' | 'power_low';
}

interface CompanionCombatContext {
  type: 'engage' | 'kill' | 'rescue' | 'defend';
  isNight: boolean;
  day: number;
  week: number;
  partnerName?: string;
}

export interface CompanionProfileModifiers {
  dayEfficiency: number;
  nightAccuracy: number;
  combatDamage: number;
  teamwork: number;
}

export interface CompanionRelationship {
  score: number;
  label: string;
  kind: 'ally' | 'neutral' | 'conflict';
}

interface PresetProfile extends CompanionProfile {
  aliases?: string[];
}

const FEMALE_NAME_HINTS = [
  '小雅', '慧心', '刘芳', '杨静', '孙丽', '宋雨', '唐心怡', '小影', '林', '丽', '芳', '怡', '静', '雨',
];

const PROFESSIONS = [
  'AR眼镜测评博主', 'AR产品经理', '无人机飞手', '网络安全工程师', '社区医生', '厨师', '建筑工程师', '电工',
  '摄影师', '机械维修师', '户外教练', '护士', '老师', '快递员', '数据分析师', '仓储调度员',
];

const PERSONALITIES = ['理性冷静', '嘴硬心软', '毒舌热心', '细致耐心', '乐观开朗', '沉默可靠', '碎碎念', '行动派'];

const HOBBIES = [
  '调参数', '拍短视频', '钓鱼', '夜跑', '做饭', '拆解硬件', '收集旧电路板', '听老歌', '看武侠小说', '做手账',
];

const TRAITS = [
  '危机判断强', '手速快', '记忆力好', '抗压强', '讲义气', '方向感好', '动手能力强', '谈判能力强',
];

const SIGNATURE_SKILLS = [
  '弱点标记', '速射节拍', '战场急救', '冷静瞄准', '弹道修正', '热能追踪', '资源嗅觉', '应急修复',
];

const PERSONALITY_MODIFIERS: Record<string, CompanionProfileModifiers> = {
  行动派: { dayEfficiency: 1.2, nightAccuracy: 1.04, combatDamage: 1.08, teamwork: 1.03 },
  理性冷静: { dayEfficiency: 1.1, nightAccuracy: 1.17, combatDamage: 1.12, teamwork: 1.05 },
  嘴硬心软: { dayEfficiency: 1.08, nightAccuracy: 1.07, combatDamage: 1.08, teamwork: 1.12 },
  毒舌热心: { dayEfficiency: 1.06, nightAccuracy: 1.08, combatDamage: 1.09, teamwork: 1.04 },
  细致耐心: { dayEfficiency: 1.16, nightAccuracy: 1.12, combatDamage: 1.06, teamwork: 1.08 },
  乐观开朗: { dayEfficiency: 1.15, nightAccuracy: 1.04, combatDamage: 1.05, teamwork: 1.15 },
  沉默可靠: { dayEfficiency: 1.1, nightAccuracy: 1.1, combatDamage: 1.11, teamwork: 1.1 },
  碎碎念: { dayEfficiency: 1.04, nightAccuracy: 1.02, combatDamage: 1.03, teamwork: 1.06 },
};

const TRAIT_MODIFIERS: Record<string, Partial<CompanionProfileModifiers>> = {
  危机判断强: { nightAccuracy: 1.05, combatDamage: 1.04 },
  手速快: { dayEfficiency: 1.04, combatDamage: 1.03 },
  记忆力好: { dayEfficiency: 1.05 },
  抗压强: { nightAccuracy: 1.04, teamwork: 1.03 },
  讲义气: { teamwork: 1.08 },
  方向感好: { dayEfficiency: 1.04 },
  动手能力强: { dayEfficiency: 1.06 },
  谈判能力强: { teamwork: 1.05 },
};

const SUPPORTIVE_PERSONALITY_PAIRS = new Set<string>([
  '理性冷静|细致耐心',
  '行动派|乐观开朗',
  '沉默可靠|嘴硬心软',
  '毒舌热心|理性冷静',
]);

const CONFLICT_PERSONALITY_PAIRS = new Set<string>([
  '行动派|理性冷静',
  '碎碎念|沉默可靠',
  '毒舌热心|细致耐心',
]);

const PRESETS: PresetProfile[] = [
  {
    gender: '男',
    age: 45,
    profession: 'AR眼镜视频博主',
    background: '末日前是头部AR测评UP主，灾变后靠旧设备改装成侦查镜片继续直播求生教程。',
    personality: '嘴硬心软',
    hobbies: ['拍短视频', '调参数'],
    traits: ['危机判断强', '讲义气'],
    signatureSkill: '弱点标记',
    chatterSeed: 45001,
    aliases: ['周云飞'],
  },
  {
    gender: '女',
    age: 30,
    profession: '影目AR产品经理',
    background: '负责过多代消费级AR眼镜，熟悉交互链路，灾变后把产品思维用在基地流程优化上。',
    personality: '细致耐心',
    hobbies: ['做手账', '拆解硬件'],
    traits: ['记忆力好', '动手能力强'],
    signatureSkill: '弹道修正',
    chatterSeed: 30017,
    aliases: ['小影', '陈小影'],
  },
];

export class CompanionPersonalitySystem {
  private static readonly relationshipDelta: Map<string, number> = new Map();

  static ensureProfile(companion: CompanionData): CompanionProfile {
    if (companion.profile) return companion.profile;
    const profile = this.generateProfile(companion);
    companion.profile = profile;
    return profile;
  }

  static ensureProfiles(companions: CompanionData[]): void {
    companions.forEach((companion) => this.ensureProfile(companion));
  }

  static getProfileSummary(companion: CompanionData): string {
    const profile = this.ensureProfile(companion);
    return `${profile.gender}${profile.age}岁 · ${profile.profession} · ${profile.personality} · 技能:${profile.signatureSkill}`;
  }

  static getProfileModifiers(companion: CompanionData): CompanionProfileModifiers {
    const profile = this.ensureProfile(companion);
    const base = PERSONALITY_MODIFIERS[profile.personality] || {
      dayEfficiency: 1.0,
      nightAccuracy: 1.0,
      combatDamage: 1.0,
      teamwork: 1.0,
    };
    const out: CompanionProfileModifiers = { ...base };
    profile.traits.forEach((trait) => {
      const t = TRAIT_MODIFIERS[trait];
      if (!t) return;
      if (t.dayEfficiency) out.dayEfficiency *= t.dayEfficiency;
      if (t.nightAccuracy) out.nightAccuracy *= t.nightAccuracy;
      if (t.combatDamage) out.combatDamage *= t.combatDamage;
      if (t.teamwork) out.teamwork *= t.teamwork;
    });
    return {
      dayEfficiency: Phaser.Math.Clamp(out.dayEfficiency, 0.78, 1.48),
      nightAccuracy: Phaser.Math.Clamp(out.nightAccuracy, 0.82, 1.42),
      combatDamage: Phaser.Math.Clamp(out.combatDamage, 0.82, 1.42),
      teamwork: Phaser.Math.Clamp(out.teamwork, 0.82, 1.38),
    };
  }

  static getRelationship(companionA: CompanionData, companionB: CompanionData): CompanionRelationship {
    const baseScore = this.computeRelationshipScore(companionA, companionB);
    const key = this.getPairKey(companionA.id, companionB.id);
    const runtimeDelta = this.relationshipDelta.get(key) || 0;
    const score = Phaser.Math.Clamp(baseScore + runtimeDelta, -95, 98);
    return {
      score,
      label: this.relationshipLabel(score),
      kind: score >= 25 ? 'ally' : score <= -20 ? 'conflict' : 'neutral',
    };
  }

  static recordInteraction(
    companionA: CompanionData,
    companionB: CompanionData,
    event: 'day_collab' | 'day_conflict' | 'night_rescue' | 'night_cover' | 'night_friendly_fire'
  ): CompanionRelationship {
    const key = this.getPairKey(companionA.id, companionB.id);
    const current = this.relationshipDelta.get(key) || 0;
    const eventDelta: Record<typeof event, number> = {
      day_collab: 2,
      day_conflict: -3,
      night_rescue: 4,
      night_cover: 2,
      night_friendly_fire: -4,
    };
    const next = Phaser.Math.Clamp(current + eventDelta[event], -45, 45);
    this.relationshipDelta.set(key, next);
    return this.getRelationship(companionA, companionB);
  }

  static applyDailyDrift(companions: CompanionData[]): void {
    if (companions.length <= 1) {
      this.relationshipDelta.clear();
      return;
    }

    const keys = Array.from(this.relationshipDelta.keys());
    keys.forEach((key) => {
      const value = this.relationshipDelta.get(key) || 0;
      const damped = Math.abs(value) < 1 ? 0 : value * 0.88;
      if (Math.abs(damped) < 0.5) this.relationshipDelta.delete(key);
      else this.relationshipDelta.set(key, Math.round(damped));
    });
  }

  static getPreferredPartnerName(companion: CompanionData, roster: CompanionData[]): string | undefined {
    const peers = roster.filter((item) => item.id !== companion.id);
    if (peers.length <= 0) return undefined;
    let bestName: string | undefined;
    let bestScore = -999;
    peers.forEach((peer) => {
      const rel = this.getRelationship(companion, peer);
      if (rel.score > bestScore) {
        bestName = peer.name;
        bestScore = rel.score;
      }
    });
    return bestName ? this.baseName(bestName) : undefined;
  }

  static getRelationshipSummary(
    companion: CompanionData,
    roster: CompanionData[],
    maxLines: number = 3
  ): string[] {
    const relations = roster
      .filter((other) => other.id !== companion.id)
      .map((other) => ({ other, relation: this.getRelationship(companion, other) }))
      .sort((a, b) => b.relation.score - a.relation.score);
    const lines: string[] = [];
    const best = relations.find((r) => r.relation.kind === 'ally');
    const worst = [...relations].reverse().find((r) => r.relation.kind === 'conflict');
    if (best) lines.push(`默契：${this.baseName(best.other.name)}（${best.relation.label} ${best.relation.score > 0 ? `+${best.relation.score}` : best.relation.score}）`);
    if (worst) lines.push(`冲突：${this.baseName(worst.other.name)}（${worst.relation.label} ${worst.relation.score}）`);
    for (const item of relations) {
      if (lines.length >= maxLines) break;
      const scoreText = item.relation.score > 0 ? `+${item.relation.score}` : `${item.relation.score}`;
      const text = `${this.baseName(item.other.name)}：${item.relation.label} ${scoreText}`;
      if (!lines.includes(text)) lines.push(text);
    }
    return lines.slice(0, maxLines);
  }

  static getDayEfficiencyMultiplier(companion: CompanionData, roster: CompanionData[]): number {
    const mods = this.getProfileModifiers(companion);
    const relationMul = this.getCollaborationMultiplier(companion, roster);
    return Phaser.Math.Clamp(mods.dayEfficiency * relationMul, 0.74, 1.65);
  }

  static getNightAccuracyMultiplier(companion: CompanionData, roster: CompanionData[]): number {
    const mods = this.getProfileModifiers(companion);
    const relationMul = this.getCollaborationMultiplier(companion, roster);
    return Phaser.Math.Clamp(mods.nightAccuracy * (0.92 + relationMul * 0.08), 0.78, 1.55);
  }

  static getCombatDamageMultiplier(companion: CompanionData, roster: CompanionData[] = []): number {
    const mods = this.getProfileModifiers(companion);
    const relationMul = roster.length > 1 ? this.getCollaborationMultiplier(companion, roster) : 1;
    return Phaser.Math.Clamp(mods.combatDamage * (0.94 + relationMul * 0.06), 0.8, 1.6);
  }

  static generateCombatChatter(
    companion: CompanionData,
    context: CompanionCombatContext,
    recentLines: string[] = []
  ): string {
    const profile = this.ensureProfile(companion);
    const name = this.baseName(companion.name);
    const partner = context.partnerName || '队友';
    const typeLines: Record<CompanionCombatContext['type'], string[]> = {
      engage: [
        `${name}：接敌，${profile.signatureSkill}链路已开。`,
        `${name}：我先压火力，你们跟进。`,
        `${name}：目标进入扇区，开始点名。`,
      ],
      kill: [
        `${name}：清掉一个，继续推线。`,
        `${name}：击杀确认，火力不减。`,
        `${name}：目标倒地，下一个。`,
      ],
      rescue: [
        `${name}：${partner}，我掩护你撤。`,
        `${name}：别倒，这边有我顶着。`,
        `${name}：救援到位，队形别散。`,
      ],
      defend: [
        `${name}：岗哨就位，防线稳定。`,
        `${name}：我在这守口子，别怕。`,
        `${name}：防区内目标交给我。`,
      ],
    };
    const extras = [
      `${name}：我这人${profile.personality}，但战斗从不含糊。`,
      `${name}：末日前做${profile.profession}，现在做前线。`,
      `${name}：${profile.traits[0]}就是我能活到今天的底牌。`,
      `${name}：夜战就按我的节奏打。`,
    ];
    const pool = [
      ...typeLines[context.type],
      ...(context.isNight ? extras : extras.slice(0, 2)),
    ];
    const unique = pool.filter((line) => !recentLines.includes(line));
    const candidates = unique.length > 0 ? unique : pool;
    const seed = profile.chatterSeed + context.day * 41 + context.week * 67 + context.type.length * 13 + (context.isNight ? 113 : 0);
    return candidates[this.indexBySeed(seed, candidates.length)];
  }

  static generateChatter(
    companion: CompanionData,
    context: CompanionChatterContext,
    recentLines: string[] = []
  ): string {
    const profile = this.ensureProfile(companion);
    const name = this.baseName(companion.name);
    const behavior = context.behavior || 'stroll';
    const mood = context.mood || 'normal';

    const common = [
      `${name}：我这人${profile.personality}，但今天状态在线。`,
      `${name}：先说好，我是${profile.profession}出身，流程要稳。`,
      `${name}：等这轮忙完，我想去${profile.hobbies[0]}放松一下。`,
      `${name}：我盯着${profile.signatureSkill}参数，谁都别乱改。`,
      `${name}：第${context.day}天了，活着就有下一步。`,
      `${name}：我记下了，周${context.week}的节奏要更紧。`,
      `${name}：今天我负责这块，出了问题先找我。`,
      `${name}：别慌，我有${profile.traits[0]}这个底子。`,
    ];

    const behaviorLines: Record<ResidentBehavior, string[]> = {
      fishing: [
        `${name}：水边信号干净，顺便钓点能吃的。`,
        `${name}：鱼口不错，今晚能多一锅汤。`,
        `${name}：我边钓边听无线电，有异常立刻汇报。`,
      ],
      cooking: [
        `${name}：火候要稳，今天做高热量口粮。`,
        `${name}：先吃饱再谈理想，锅里这锅很关键。`,
        `${name}：我把营养分配按人头重算了一遍。`,
      ],
      guard: [
        `${name}：岗哨视野清楚，东侧路口我盯着。`,
        `${name}：防线没白建，今晚谁来都得先挨打。`,
        `${name}：弹药我已经点过，不够会提前叫人补。`,
      ],
      sleep: [
        `${name}：先眯一会，轮换时叫我。`,
        `${name}：我睡得浅，有动静立刻能起。`,
        `${name}：补觉是战斗力，不是偷懒。`,
      ],
      forage: [
        `${name}：我去外圈捡料，回来给你带能用的。`,
        `${name}：这片废墟还有货，别浪费。`,
        `${name}：我找到的都是能马上转产的材料。`,
      ],
      adventure: [
        `${name}：我去山洞探路，信号弱就按预案回撤。`,
        `${name}：深处可能有旧仓库，赌一把。`,
        `${name}：探险不是冲动，是算过风险的。`,
      ],
      stroll: [
        `${name}：我绕基地一圈，顺手查隐患。`,
        `${name}：散步也是巡检，别小看。`,
        `${name}：我边走边记，晚上开会用得上。`,
      ],
      idle: [
        `${name}：短暂待命，随时可以接活。`,
        `${name}：现在空档，我在整理工具。`,
      ],
    };

    const moodLines: Record<'normal' | 'hungry' | 'power_low', string[]> = {
      normal: [
        `${name}：节奏不错，今天可以多推进一点。`,
        `${name}：状态稳定，继续压进度。`,
      ],
      hungry: [
        `${name}：粮仓压力上来了，再饿下去会掉效率。`,
        `${name}：先把吃的问题解决，不然晚上扛不住。`,
      ],
      power_low: [
        `${name}：电力吃紧，我建议先关低优先设施。`,
        `${name}：供电红线快到了，别再加负载。`,
      ],
    };

    const nightLines = [
      `${name}：夜战模式，别离开我的火力扇区。`,
      `${name}：我会盯住突破口，听我报点。`,
      `${name}：夜里别逞强，按阵地节奏打。`,
    ];

    const pool = [
      ...common,
      ...(context.isNight ? nightLines : behaviorLines[behavior]),
      ...moodLines[mood],
      `${name}：末日前我是${profile.profession}，现在我是这条街的守夜人。`,
      `${name}：我的习惯是${profile.hobbies[1]}，现在改成先活下来。`,
      `${name}：要是今晚挺住了，我教你一手${profile.signatureSkill}。`,
    ];

    const unique = pool.filter((line) => !recentLines.includes(line));
    const candidates = unique.length > 0 ? unique : pool;
    const seed = profile.chatterSeed + context.day * 17 + context.week * 31 + behavior.length * 13 + (context.isNight ? 97 : 0);
    const idx = this.indexBySeed(seed, candidates.length);
    return candidates[idx];
  }

  private static generateProfile(companion: CompanionData): CompanionProfile {
    const name = this.baseName(companion.name);
    const preset = this.findPreset(name);
    if (preset) {
      return {
        gender: preset.gender,
        age: preset.age,
        profession: preset.profession,
        background: preset.background,
        personality: preset.personality,
        hobbies: [...preset.hobbies],
        traits: [...preset.traits],
        signatureSkill: preset.signatureSkill,
        chatterSeed: preset.chatterSeed,
      };
    }

    const seed = this.hashString(`${companion.id}|${companion.name}|${companion.role}|${companion.bulletEffect}`);
    const rnd = this.rng(seed);
    const profession = this.extractProfession(companion.name) || this.pick(PROFESSIONS, rnd);
    const gender: '男' | '女' = this.guessGender(name, rnd);
    const age = 22 + Math.floor(rnd() * 27);
    const personality = this.pick(PERSONALITIES, rnd);
    const hobbies = this.pickDistinct(HOBBIES, rnd, 2);
    const traits = this.pickDistinct(TRAITS, rnd, 2);
    const signatureSkill = this.pick(SIGNATURE_SKILLS, rnd);
    const background = `末日前是${profession}，靠${traits[0]}与${hobbies[0]}在灾变后活了下来。`;

    return {
      gender,
      age,
      profession,
      background,
      personality,
      hobbies,
      traits,
      signatureSkill,
      chatterSeed: seed,
    };
  }

  private static findPreset(name: string): PresetProfile | null {
    for (const preset of PRESETS) {
      const aliases = preset.aliases || [];
      if (aliases.includes(name)) return preset;
    }
    return null;
  }

  private static getPairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private static computeRelationshipScore(companionA: CompanionData, companionB: CompanionData): number {
    const pa = this.ensureProfile(companionA);
    const pb = this.ensureProfile(companionB);
    const seed = this.hashString(this.getPairKey(companionA.id, companionB.id));
    const rnd = this.rng(seed);
    let score = Math.round((rnd() - 0.5) * 70); // -35..35

    if (pa.personality === pb.personality) score += 16;
    const pair = this.getPairKey(pa.personality, pb.personality);
    if (SUPPORTIVE_PERSONALITY_PAIRS.has(pair)) score += 18;
    if (CONFLICT_PERSONALITY_PAIRS.has(pair)) score -= 18;

    const sharedTraits = pa.traits.filter((t) => pb.traits.includes(t)).length;
    const sharedHobbies = pa.hobbies.filter((h) => pb.hobbies.includes(h)).length;
    score += sharedTraits * 10;
    score += sharedHobbies * 6;

    const rolePair = this.getPairKey(companionA.role || 'tank', companionB.role || 'tank');
    if (rolePair === 'medic|tank' || rolePair === 'sniper|tank') score += 8;
    if (rolePair === 'medic|sniper') score += 6;

    if (Math.abs((pa.age || 30) - (pb.age || 30)) >= 18) score -= 4;
    return Phaser.Math.Clamp(score, -85, 95);
  }

  private static relationshipLabel(score: number): string {
    if (score >= 70) return '生死搭档';
    if (score >= 45) return '高度默契';
    if (score >= 25) return '协作顺畅';
    if (score > -20) return '普通关系';
    if (score > -45) return '有点别扭';
    return '明显冲突';
  }

  private static getCollaborationMultiplier(companion: CompanionData, roster: CompanionData[]): number {
    const peers = roster.filter((item) => item.id !== companion.id);
    if (peers.length <= 0) return 1;
    const own = this.getProfileModifiers(companion);
    let totalScore = 0;
    peers.forEach((peer) => {
      totalScore += this.getRelationship(companion, peer).score;
    });
    const avg = totalScore / peers.length; // around -85..95
    const base = 1 + avg / 250;
    const teamBonus = 1 + (own.teamwork - 1) * 0.35;
    return Phaser.Math.Clamp(base * teamBonus, 0.82, 1.28);
  }

  private static guessGender(name: string, rnd: () => number): '男' | '女' {
    if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) return '女';
    return rnd() < 0.35 ? '女' : '男';
  }

  private static extractProfession(rawName: string): string | null {
    const match = rawName.match(/\(([^·)]+)/);
    return match?.[1]?.trim() || null;
  }

  private static baseName(rawName: string): string {
    return rawName.split('(')[0]?.trim() || rawName;
  }

  private static hashString(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private static rng(seed: number): () => number {
    let t = seed + 0x6d2b79f5;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  private static pick<T>(arr: T[], rnd: () => number): T {
    return arr[Math.floor(rnd() * arr.length)];
  }

  private static pickDistinct<T>(arr: T[], rnd: () => number, count: number): T[] {
    const source = [...arr];
    const out: T[] = [];
    while (source.length > 0 && out.length < count) {
      const idx = Math.floor(rnd() * source.length);
      const [item] = source.splice(idx, 1);
      out.push(item);
    }
    return out;
  }

  private static indexBySeed(seed: number, length: number): number {
    if (length <= 1) return 0;
    return Math.abs(seed) % length;
  }
}
