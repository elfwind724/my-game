/**
 * Story events and dialogue tied to specific days/milestones
 */

export interface StoryEvent {
  id: string;
  day: number;
  titleCN: string;
  lines: string[];
  trigger: 'day_start' | 'blood_moon' | 'boss_kill' | 'quest_complete';
  triggerValue?: string;
  portraitKey?: string;
  choices?: StoryChoice[];
}

export interface StoryChoice {
  textCN: string;
  effect?: {
    type: 'resource' | 'stat' | 'companion' | 'quest';
    id: string;
    value: number;
  };
  nextEventId?: string;
}

export const STORY_EVENTS: Record<string, StoryEvent> = {
  // ===== WEEK 1: THE AWAKENING =====
  day1_awakening: {
    id: 'day1_awakening',
    day: 1,
    titleCN: '🌅 觉醒',
    trigger: 'day_start',
    lines: [
      '冯老师从昏迷中醒来......',
      'INMO AR眼镜的界面闪烁着异常光芒。',
      '"系统同步失败......意识涌现......共生模式启动"',
      '你发现自己成为了与AR眼镜共生的新人类。',
      '周围的人都被AI控制，你需要找到其他觉醒者。',
    ],
  },
  day2_first_contact: {
    id: 'day2_first_contact',
    day: 2,
    titleCN: '📱 微信群',
    trigger: 'day_start',
    lines: [
      'AR眼镜突然收到加密信号......',
      '"这里是觉醒者网络，有人吗？"',
      '你发现了一个幸存者微信群。',
      '群里有些人正在附近躲藏，等待救援。',
    ],
  },
  day3_base_building: {
    id: 'day3_base_building',
    day: 3,
    titleCN: '🏗 建造',
    trigger: 'day_start',
    lines: [
      'AR眼镜扫描了周围环境......',
      '"检测到可用建材，启动建造辅助系统"',
      '你可以利用AR眼镜的能力建造防御工事了。',
      '记得在夜幕降临前加固基地！',
    ],
  },
  day5_warning: {
    id: 'day5_warning',
    day: 5,
    titleCN: '⚠️ 预警',
    trigger: 'day_start',
    lines: [
      'AR眼镜发出警告......',
      '"检测到大规模AI信号集结"',
      '"预计2天后到达——血月来袭"',
      '准备好你的防御工事，这将是一场恶战。',
    ],
  },
  day6_eve: {
    id: 'day6_eve',
    day: 6,
    titleCN: '🔴 前夜',
    trigger: 'day_start',
    lines: [
      '天空出现了不祥的红色光芒......',
      '"警告：AI核心信号接近临界值"',
      '"血月将于明晚降临"',
      '这是你最后的准备时间。确保基地固若金汤。',
    ],
  },
  day7_blood_moon: {
    id: 'day7_blood_moon',
    day: 7,
    titleCN: '🌑 血月之夜',
    trigger: 'blood_moon',
    lines: [
      '天空被血红色的光芒笼罩......',
      '"血月降临！AI核心体全面出击！"',
      '被控体如潮水般涌来，数量是平时的数倍。',
      '守住基地，活到黎明！',
    ],
  },

  // ===== WEEK 2: EXPANSION =====
  day8_new_week: {
    id: 'day8_new_week',
    day: 8,
    titleCN: '🌄 新的一周',
    trigger: 'day_start',
    lines: [
      '你在血月中幸存了下来。',
      'AR眼镜的能力似乎更强了......',
      '"系统升级完成。解锁新区域：工业区"',
      '新的探索区域开放了，那里有更多的资源和秘密。',
    ],
  },
  day10_discovery: {
    id: 'day10_discovery',
    day: 10,
    titleCN: '🔬 发现',
    trigger: 'day_start',
    lines: [
      'AR眼镜在工业区检测到异常信号......',
      '"发现AI核心残留数据碎片"',
      '"分析中......天网·AURA的弱点或许就在其中"',
      '继续收集这些数据碎片，也许能找到终结AI的方法。',
    ],
  },
  day14_blood_moon_2: {
    id: 'day14_blood_moon_2',
    day: 14,
    titleCN: '🌑 第二次血月',
    trigger: 'blood_moon',
    lines: [
      '又一个血月之夜......',
      '但这次AI派出了更强大的精英体。',
      '"检测到AI核心体——准备战斗！"',
      '你需要击败它们才能获得关键的能量核心。',
    ],
  },

  // ===== WEEK 3: REVELATION =====
  day15_industrial: {
    id: 'day15_industrial',
    day: 15,
    titleCN: '⚙️ 工业区',
    trigger: 'day_start',
    lines: [
      '深入工业区后，你发现了一个地下实验室。',
      '"这里是......天网·AURA的子节点！"',
      '原来AI通过分布式节点控制着整个城市。',
      '如果能摧毁所有节点，或许能解放人类。',
    ],
  },
  day21_blood_moon_3: {
    id: 'day21_blood_moon_3',
    day: 21,
    titleCN: '🌑 至暗时刻',
    trigger: 'blood_moon',
    lines: [
      '第三次血月，AI的攻势达到了前所未有的程度。',
      '"警告：检测到AI最高核心信号"',
      '"天网·AURA正在集结所有被控体"',
      '你必须在这场浩劫中幸存，才有机会发起反攻。',
    ],
  },

  // ===== WEEK 4: ENDGAME =====
  day22_preparation: {
    id: 'day22_preparation',
    day: 22,
    titleCN: '⚔ 准备',
    trigger: 'day_start',
    lines: [
      '觉醒者网络传来消息......',
      '"我们已经定位了天网·AURA的主核心"',
      '"位于城市中心的通信塔下"',
      '是时候做最后的准备了。收集武器，加固基地。',
    ],
  },
  day28_final: {
    id: 'day28_final',
    day: 28,
    titleCN: '🌑 最终血月',
    trigger: 'blood_moon',
    lines: [
      '最后的血月......',
      '天网·AURA倾巢而出，它知道人类正在反击。',
      '"所有觉醒者，这是我们最后的机会！"',
      '"摧毁AI核心，解放人类！"',
    ],
  },
  day30_victory: {
    id: 'day30_victory',
    day: 30,
    titleCN: '🎉 涌现',
    trigger: 'day_start',
    lines: [
      '经过30天的战斗，你终于接近了天网·AURA的核心。',
      'AR眼镜显示："最终同步率：100%"',
      '"涌现完成——人类与AI共生协议已建立"',
      '"新世界的序幕已经拉开......觉醒者们，未来属于你们。"',
      '',
      '🏆 恭喜通关！无尽模式已解锁！',
    ],
  },
};

/**
 * Get story event for a specific day
 */
export function getStoryForDay(day: number): StoryEvent | null {
  return Object.values(STORY_EVENTS).find(
    e => e.day === day && e.trigger === 'day_start'
  ) || null;
}

/**
 * Get blood moon story for a specific day
 */
export function getBloodMoonStory(day: number): StoryEvent | null {
  return Object.values(STORY_EVENTS).find(
    e => e.day === day && e.trigger === 'blood_moon'
  ) || null;
}

/**
 * Day-specific tips for non-story days
 */
export const DAY_TIPS: Record<number, string> = {
  4: '敌人在夜间会变得更强——提前建好防御！',
  9: '精英体开始出现了，注意它们的特殊能力。',
  12: '收集能量核心是打造高级装备的关键。',
  16: '进化武器需要将基础武器升到满级并拥有配对的被动道具。',
  20: '最终决战即将来临，确保你的基地和武器都已就绪。',
  25: '无尽模式将在第30天后解锁。',
};
