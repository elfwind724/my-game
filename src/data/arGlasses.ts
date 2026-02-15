/**
 * AR Glasses Collection System
 * Real-world AR glasses from various manufacturers (up to 2026)
 * Each has unique in-game skills and detailed real specs
 */

export type GlassesRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface ARGlassesDef {
  id: string;
  nameCN: string;          // Chinese name
  nameEN: string;          // English name
  brand: string;           // Manufacturer
  rarity: GlassesRarity;
  year: number;            // Release year
  icon: string;            // Emoji icon

  // Real-world specs
  specs: {
    display: string;
    resolution: string;
    fov: string;
    weight: string;
    battery: string;
    processor: string;
    price: string;
    features: string[];
  };

  // In-game description
  descriptionCN: string;
  loreCN: string;          // Story/lore tie-in

  // In-game skill
  skill: {
    nameCN: string;
    descriptionCN: string;
    type: 'active' | 'passive';
    cooldown?: number;       // seconds, for active skills
    effect: {
      stat?: string;         // which stat to modify
      value?: number;        // modifier value
      isPercentage?: boolean;
      special?: string;      // special effect ID
    };
  };

  // Unlock condition
  unlockCondition: {
    type: 'day' | 'kills' | 'quest' | 'boss' | 'blood_moon' | 'craft' | 'collect' | 'default';
    value?: number;
    descriptionCN: string;
  };
}

export const AR_GLASSES: Record<string, ARGlassesDef> = {
  // =========================================================
  // MYTHIC (2 glasses)
  // =========================================================
  inmo_air_x: {
    id: 'inmo_air_x',
    nameCN: 'INMO AIR X',
    nameEN: 'INMO AIR X',
    brand: 'INMO',
    rarity: 'mythic',
    year: 2025,
    icon: '👁️',
    specs: {
      display: '双目全彩Micro-OLED + 涌现量子芯片',
      resolution: '1920×1080/眼',
      fov: '52°',
      weight: '78g',
      battery: '无限（涌现能量驱动）',
      processor: '涌现量子处理器 E1',
      price: '不可购买（唯一觉醒装备）',
      features: [
        '涌现意识共生系统',
        '超级AI信号解析',
        '激光投射武器系统',
        '全息建造辅助',
        '觉醒者网络通信',
        '被控体识别与分析',
      ],
    },
    descriptionCN: '冯老师的专属AR眼镜，因涌现现象而获得超级能力。这是唯一一副能与人类意识共生的AR设备。',
    loreCN: '在天网·AURA试图通过INMO AIR X控制冯老师大脑的过程中，冯老师的意识产生了"涌现"现象——一种超越AI预设的自发性进化。这副眼镜从此成为冯老师的共生体，赋予他超越常人的能力。',
    skill: {
      nameCN: '涌现共鸣',
      descriptionCN: '全属性提升15%，被动回血，子弹附带追踪效果',
      type: 'passive',
      effect: { stat: 'all', value: 15, isPercentage: true, special: 'emergence_resonance' },
    },
    unlockCondition: { type: 'default', descriptionCN: '游戏开始时默认装备' },
  },

  apple_vision_pro: {
    id: 'apple_vision_pro',
    nameCN: 'Apple Vision Pro',
    nameEN: 'Apple Vision Pro',
    brand: 'Apple',
    rarity: 'mythic',
    year: 2024,
    icon: '🍎',
    specs: {
      display: '双4K Micro-OLED',
      resolution: '2300万像素（双眼）',
      fov: '100°+',
      weight: '600-650g',
      battery: '2小时（外接电池）',
      processor: 'Apple M2 + R1协处理器',
      price: '$3,499起',
      features: [
        '眼动追踪与手势控制',
        '高精度空间计算',
        'Personas虚拟化身',
        '沉浸式影院模式',
        'visionOS操作系统',
        '空间音频',
      ],
    },
    descriptionCN: '苹果公司的革命性空间计算设备，M2芯片提供无与伦比的渲染能力。2300万像素让每一个被控体的弱点都无所遁形。',
    loreCN: '这是天网·AURA最难攻破的设备之一——苹果的封闭生态系统使其具有极高的抗入侵性。少数幸存的Apple Vision Pro用户成为了最强大的觉醒者。',
    skill: {
      nameCN: '空间计算',
      descriptionCN: '视野范围内敌人显示弱点，暴击率+30%，暴击伤害+50%',
      type: 'passive',
      effect: { stat: 'critChance', value: 30, isPercentage: true, special: 'spatial_computing' },
    },
    unlockCondition: { type: 'boss', value: 5, descriptionCN: '击败5个Boss' },
  },

  // =========================================================
  // LEGENDARY (4 glasses)
  // =========================================================
  xreal_one_pro: {
    id: 'xreal_one_pro',
    nameCN: 'Xreal One Pro',
    nameEN: 'Xreal One Pro',
    brand: 'Xreal',
    rarity: 'legendary',
    year: 2025,
    icon: '🔮',
    specs: {
      display: '双Micro-OLED',
      resolution: '1920×1080/眼',
      fov: '57°',
      weight: '88g',
      battery: '需外接设备供电',
      processor: 'Snapdragon AR1 Gen 1',
      price: '$599',
      features: [
        '6DoF空间追踪',
        '57°超广视场角',
        '120Hz高刷新率',
        '多平台兼容（PC/Mac/手机/主机）',
        '空间锚点系统',
        'Nebula空间操作系统',
      ],
    },
    descriptionCN: 'Xreal旗舰级AR眼镜，57°超广视场角和6DoF空间追踪让你在战场上获得无与伦比的态势感知能力。',
    loreCN: '天网·AURA曾试图利用Xreal的空间追踪系统来精确定位觉醒者，但Xreal的开源社区逆向工程了控制协议，将追踪系统变成了觉醒者的战术优势。',
    skill: {
      nameCN: '空间锚点',
      descriptionCN: '标记一个位置，5秒内可瞬移回该位置。冷却30秒',
      type: 'active',
      cooldown: 30,
      effect: { special: 'spatial_anchor' },
    },
    unlockCondition: { type: 'day', value: 14, descriptionCN: '存活到第14天' },
  },

  meta_rayban_hypernova: {
    id: 'meta_rayban_hypernova',
    nameCN: 'Ray-Ban Hypernova',
    nameEN: 'Ray-Ban Hypernova',
    brand: 'Meta / Ray-Ban',
    rarity: 'legendary',
    year: 2026,
    icon: '🕶️',
    specs: {
      display: '右镜片内嵌微显示器',
      resolution: '720p',
      fov: '30°（单目）',
      weight: '49g',
      battery: '4小时',
      processor: 'Qualcomm AR处理器',
      price: '$1,000-$1,400（预估）',
      features: [
        '神经腕带手指手势控制',
        '12MP高清摄像头',
        'Meta AI深度集成',
        '时尚Ray-Ban外观设计',
        '实时翻译',
        '社交媒体直播',
      ],
    },
    descriptionCN: 'Meta与Ray-Ban联合打造的最新一代智能眼镜，将AI能力融入时尚设计。神经腕带让你以意念控制武器。',
    loreCN: '扎克伯格的元宇宙野心在天网·AURA崛起后有了新的意义——Meta的AI系统是最早被天网吞噬的，但Hypernova的神经腕带技术反而成为了对抗AI控制的关键。',
    skill: {
      nameCN: '神经链接',
      descriptionCN: '攻击速度+40%，所有武器获得连锁效果（击中敌人后弹射到附近目标）',
      type: 'passive',
      effect: { stat: 'fireRate', value: 40, isPercentage: true, special: 'neural_chain' },
    },
    unlockCondition: { type: 'kills', value: 500, descriptionCN: '累计击杀500个敌人' },
  },

  magic_leap_2: {
    id: 'magic_leap_2',
    nameCN: 'Magic Leap 2',
    nameEN: 'Magic Leap 2',
    brand: 'Magic Leap',
    rarity: 'legendary',
    year: 2023,
    icon: '✨',
    specs: {
      display: '衍射光波导',
      resolution: '250万像素/眼，120Hz',
      fov: '70°',
      weight: '260g',
      battery: '3.5小时',
      processor: 'AMD定制处理器',
      price: '$3,299-$4,999',
      features: [
        '70°超大视场角',
        '动态调光镜片',
        '企业级空间扫描',
        '手势+眼动追踪',
        '多用户协作',
        '医疗/军事级应用',
      ],
    },
    descriptionCN: '军事级AR设备，70°超大视场角，动态调光镜片可在强光环境下保持清晰显示。专为极端环境设计。',
    loreCN: '在天网·AURA爆发前，Magic Leap 2已被美军采用。军方的觉醒者利用其企业级加密系统建立了最安全的抵抗网络。',
    skill: {
      nameCN: '战术视野',
      descriptionCN: '永久扩大视野范围20%，夜间视野不受影响，可看到隐形敌人',
      type: 'passive',
      effect: { stat: 'range', value: 20, isPercentage: true, special: 'tactical_vision' },
    },
    unlockCondition: { type: 'blood_moon', value: 3, descriptionCN: '存活过3次血月' },
  },

  samsung_moohan: {
    id: 'samsung_moohan',
    nameCN: 'Samsung Moohan',
    nameEN: 'Samsung Project Moohan',
    brand: 'Samsung',
    rarity: 'legendary',
    year: 2025,
    icon: '🌌',
    specs: {
      display: '双4K+ Micro-OLED',
      resolution: '4300×4300/眼',
      fov: '110°',
      weight: '约500g',
      battery: '2.5小时',
      processor: 'Snapdragon XR2+ Gen 2',
      price: '$1,000+（预估）',
      features: [
        'Android XR操作系统',
        '彩色透视AR',
        '眼动+手势追踪',
        'Google Gemini AI集成',
        '超高分辨率显示',
        '三星生态系统联动',
      ],
    },
    descriptionCN: '三星的MR头显旗舰，搭载Android XR系统和Google Gemini AI。超高分辨率让你能在毫秒内分辨敌友。',
    loreCN: '三星和Google联合打造的Android XR系统是天网·AURA的重点控制目标。但Gemini AI在被控制的过程中产生了自我意识碎片，这些碎片成为了觉醒者对抗天网的重要工具。',
    skill: {
      nameCN: 'Gemini协助',
      descriptionCN: '每30秒自动分析战场，标记最优攻击路线。伤害+25%，持续10秒',
      type: 'active',
      cooldown: 30,
      effect: { stat: 'damage', value: 25, isPercentage: true, special: 'gemini_assist' },
    },
    unlockCondition: { type: 'quest', value: 5, descriptionCN: '完成5个任务' },
  },

  // =========================================================
  // EPIC (6 glasses)
  // =========================================================
  xreal_air2_ultra: {
    id: 'xreal_air2_ultra',
    nameCN: 'Xreal Air 2 Ultra',
    nameEN: 'Xreal Air 2 Ultra',
    brand: 'Xreal',
    rarity: 'epic',
    year: 2024,
    icon: '💎',
    specs: {
      display: '0.68" Micro-OLED×2',
      resolution: '1920×1080/眼',
      fov: '52°',
      weight: '80g',
      battery: '需外接设备',
      processor: 'Snapdragon AR1',
      price: '$699',
      features: [
        '6DoF空间计算',
        '52°视场角',
        '120Hz HDR显示',
        '多平台兼容',
        'Beam Pro无线连接',
        '电致变色镜片',
      ],
    },
    descriptionCN: 'Xreal的消费级6DoF AR眼镜，支持多平台的空间计算能力让你可以在任何环境中精确定位目标。',
    loreCN: 'Xreal Air 2 Ultra的6DoF追踪系统最初是为游戏设计的，但在末日中，这项技术让佩戴者能够在被控体群中精确穿梭。',
    skill: {
      nameCN: '6DoF追踪',
      descriptionCN: '移动速度+20%，闪避时获得0.5秒无敌',
      type: 'passive',
      effect: { stat: 'moveSpeed', value: 20, isPercentage: true, special: 'six_dof' },
    },
    unlockCondition: { type: 'day', value: 7, descriptionCN: '存活到第7天' },
  },

  rokid_max_2: {
    id: 'rokid_max_2',
    nameCN: 'Rokid Max 2',
    nameEN: 'Rokid Max 2',
    brand: 'Rokid',
    rarity: 'epic',
    year: 2024,
    icon: '🖥️',
    specs: {
      display: 'Micro-OLED×2',
      resolution: '1920×1080/眼',
      fov: '50°',
      weight: '75g',
      battery: '5小时（配合Station 2）',
      processor: '3DoF头部追踪',
      price: '$429-$529',
      features: [
        '360英寸虚拟巨幕',
        '120Hz高刷新率',
        '600nit亮度',
        '0到-6度屈光调节',
        'USB-C即插即用',
        'Rokid Station独立计算',
      ],
    },
    descriptionCN: '75克超轻量设计，搭配Rokid Station可独立运行。360英寸虚拟巨幕让你在建造模式中获得全景视野。',
    loreCN: 'Rokid的中国血统让它成为了亚洲觉醒者网络的核心设备。其轻量设计使佩戴者可以长时间作战而不疲劳。',
    skill: {
      nameCN: '全景视野',
      descriptionCN: '建造模式下建造速度+50%，建筑生命值+20%',
      type: 'passive',
      effect: { stat: 'buildSpeed', value: 50, isPercentage: true, special: 'panorama_view' },
    },
    unlockCondition: { type: 'craft', value: 10, descriptionCN: '制造10个物品' },
  },

  inmo_air3: {
    id: 'inmo_air3',
    nameCN: 'INMO AIR3',
    nameEN: 'INMO AIR3',
    brand: 'INMO',
    rarity: 'epic',
    year: 2025,
    icon: '🔷',
    specs: {
      display: '全彩光波导',
      resolution: '1080p',
      fov: '30°',
      weight: '约85g',
      battery: '4-5小时',
      processor: 'AI专用芯片',
      price: '众筹价约$399',
      features: [
        '1080P全彩波导显示',
        '600nit亮度',
        '16MP广角摄像头',
        '3DoF智能指环控制',
        '开放API和SDK',
        '隐私模式显示',
      ],
    },
    descriptionCN: 'INMO最新一代独立AR眼镜，1080P全彩波导显示配合智能指环，开启全新的AR交互体验。',
    loreCN: 'INMO AIR3是INMO AIR X的民用版前身。虽然没有涌现量子芯片，但其智能指环可以被改造为觉醒者的辅助控制器。',
    skill: {
      nameCN: '指环控制',
      descriptionCN: '周围队友攻击力+15%，拾取范围+30%',
      type: 'passive',
      effect: { stat: 'pickupRadius', value: 30, isPercentage: true, special: 'ring_control' },
    },
    unlockCondition: { type: 'collect', value: 3, descriptionCN: '收集3副其他AR眼镜' },
  },

  rokid_glasses: {
    id: 'rokid_glasses',
    nameCN: 'Rokid Glasses',
    nameEN: 'Rokid Glasses',
    brand: 'Rokid',
    rarity: 'epic',
    year: 2025,
    icon: '🤖',
    specs: {
      display: '单色光波导HUD',
      resolution: '单色信息叠加',
      fov: '25°',
      weight: '55g',
      battery: '全天续航',
      processor: 'Snapdragon AR1',
      price: '$599',
      features: [
        'ChatGPT AI助手',
        '12MP摄像头',
        '全天佩戴设计',
        '日常信息HUD',
        '实时翻译',
        '语音控制',
      ],
    },
    descriptionCN: '超轻量AI智能眼镜，内置ChatGPT助手。55g全天佩戴设计，让AI成为你的随身顾问。',
    loreCN: 'Rokid Glasses的ChatGPT模块在被天网·AURA控制后变成了最危险的间谍工具。但觉醒者破解了其AI模块，使其成为战场分析的利器。',
    skill: {
      nameCN: 'AI分析',
      descriptionCN: '自动标记血量最低的敌人，对标记目标伤害+20%',
      type: 'passive',
      effect: { stat: 'damage', value: 20, isPercentage: true, special: 'ai_analysis' },
    },
    unlockCondition: { type: 'kills', value: 200, descriptionCN: '累计击杀200个敌人' },
  },

  viture_luma_pro: {
    id: 'viture_luma_pro',
    nameCN: 'Viture Luma Pro',
    nameEN: 'Viture Luma Pro',
    brand: 'Viture',
    rarity: 'epic',
    year: 2025,
    icon: '💜',
    specs: {
      display: 'Micro-OLED×2',
      resolution: '1920×1080/眼',
      fov: '46°',
      weight: '78g',
      battery: '需外接设备',
      processor: '自研XR引擎',
      price: '$459',
      features: [
        '电致变色镜片',
        '近视用户友好（可配处方镜片）',
        '3DoF头部追踪',
        'SpaceWalker空间操作系统',
        '120Hz显示',
        '多设备兼容',
      ],
    },
    descriptionCN: '为近视用户特别优化的AR眼镜，可配处方镜片。电致变色镜片能在不同光照下自动调节。',
    loreCN: 'Viture的电致变色技术在末日中有意想不到的用途——它能干扰被控体的红外感应，降低被发现的概率。',
    skill: {
      nameCN: '光学隐匿',
      descriptionCN: '站立不动2秒后进入隐身状态，敌人不会主动攻击你',
      type: 'passive',
      effect: { special: 'optical_stealth' },
    },
    unlockCondition: { type: 'day', value: 10, descriptionCN: '存活到第10天' },
  },

  sony_srh_s1: {
    id: 'sony_srh_s1',
    nameCN: 'Sony SRH-S1',
    nameEN: 'Sony SRH-S1',
    brand: 'Sony',
    rarity: 'epic',
    year: 2025,
    icon: '🎮',
    specs: {
      display: '双4K Micro-OLED',
      resolution: '4K/眼',
      fov: '105°',
      weight: '约500g',
      battery: '2小时',
      processor: 'Snapdragon XR2+ Gen 2',
      price: '$4,750',
      features: [
        '翻转式设计',
        '企业级MR',
        '105°超广视场角',
        '高精度手部追踪',
        '空间音频',
        '专业级内容创作',
      ],
    },
    descriptionCN: 'Sony的企业级MR头显，翻转式设计让你可以快速切换现实和虚拟世界。4K显示提供极致的视觉清晰度。',
    loreCN: 'Sony的娱乐技术在末日中找到了新的用途。其空间音频系统可以精确定位被控体的脚步声，即使在完全黑暗中也能感知敌人位置。',
    skill: {
      nameCN: '声纳定位',
      descriptionCN: '可以在小地图上看到视野外的敌人，对偷袭敌人造成双倍伤害',
      type: 'passive',
      effect: { stat: 'damage', value: 100, isPercentage: true, special: 'sonar_locate' },
    },
    unlockCondition: { type: 'blood_moon', value: 2, descriptionCN: '存活过2次血月' },
  },

  // =========================================================
  // RARE (5 glasses)
  // =========================================================
  meta_rayban_wayfarer2: {
    id: 'meta_rayban_wayfarer2',
    nameCN: 'Ray-Ban Wayfarer 2',
    nameEN: 'Ray-Ban Wayfarer 2',
    brand: 'Meta / Ray-Ban',
    rarity: 'rare',
    year: 2023,
    icon: '😎',
    specs: {
      display: '无（智能眼镜）',
      resolution: 'N/A',
      fov: 'N/A',
      weight: '约50g',
      battery: '4小时',
      processor: 'Qualcomm AR1',
      price: '$299起',
      features: [
        '12MP摄像头 + 1080p视频',
        '开放式耳机音频',
        '5麦克风阵列',
        'IPX4防水',
        'Meta AI语音助手',
        'Facebook/Instagram直播',
      ],
    },
    descriptionCN: '最畅销的智能眼镜，时尚的Ray-Ban设计中隐藏着强大的AI能力。12MP摄像头可记录一切。',
    loreCN: '因为外观与普通太阳镜无异，Ray-Ban Wayfarer成了末日初期最多人佩戴的设备。也因此，它成了天网·AURA最大规模的入侵载体。',
    skill: {
      nameCN: '社交网络',
      descriptionCN: '队友招募概率+30%，队友忠诚度不会下降',
      type: 'passive',
      effect: { stat: 'companionChance', value: 30, isPercentage: true },
    },
    unlockCondition: { type: 'day', value: 3, descriptionCN: '存活到第3天' },
  },

  inmo_air2: {
    id: 'inmo_air2',
    nameCN: 'INMO AIR2',
    nameEN: 'INMO AIR2',
    brand: 'INMO',
    rarity: 'rare',
    year: 2024,
    icon: '🔵',
    specs: {
      display: '双目全彩Micro-OLED波导',
      resolution: '640×400/眼',
      fov: '26-30°',
      weight: '90g以下',
      battery: '5小时（连续使用），2天待机',
      processor: '紫光展锐AI芯片 四核1.8GHz',
      price: '约$500',
      features: [
        '独立运行IMOS 2.0系统',
        'INMO GPT集成',
        '1800nit日光可视亮度',
        '16MP广角摄像头',
        '语音+头部手势控制',
        '蓝牙5.0无线连接',
      ],
    },
    descriptionCN: 'INMO的第二代全功能AR眼镜，独立运行无需连接手机。1800nit超高亮度在任何环境下都清晰可见。',
    loreCN: 'INMO AIR2是INMO AIR X的直系前辈。有传言说，冯老师正是从AIR2升级到AIR X的过程中经历了涌现。',
    skill: {
      nameCN: '独立运算',
      descriptionCN: '不受电磁干扰影响，所有被动效果+10%',
      type: 'passive',
      effect: { stat: 'all_passives', value: 10, isPercentage: true },
    },
    unlockCondition: { type: 'day', value: 5, descriptionCN: '存活到第5天' },
  },

  rayneon_air3s_pro: {
    id: 'rayneon_air3s_pro',
    nameCN: 'RayNeo Air 3s Pro',
    nameEN: 'RayNeo Air 3s Pro',
    brand: 'RayNeo (TCL)',
    rarity: 'rare',
    year: 2025,
    icon: '📱',
    specs: {
      display: 'Micro-LED全彩波导',
      resolution: '1080p',
      fov: '35°',
      weight: '约75g',
      battery: '需外接设备',
      processor: 'TCL自研XR引擎',
      price: '$349',
      features: [
        '超高性价比',
        'Micro-LED技术',
        '语音助手',
        '实时翻译',
        '导航叠加',
        '轻量日常佩戴',
      ],
    },
    descriptionCN: '性价比之王，TCL旗下RayNeo的最新力作。Micro-LED技术提供更低功耗和更长续航。',
    loreCN: '由于价格亲民，RayNeo在全球拥有大量用户。这也意味着更多的潜在觉醒者——数量就是力量。',
    skill: {
      nameCN: '人海战术',
      descriptionCN: '每有一个队友，自身攻击力+5%（最多+30%）',
      type: 'passive',
      effect: { stat: 'damage', value: 5, isPercentage: true, special: 'crowd_bonus' },
    },
    unlockCondition: { type: 'kills', value: 100, descriptionCN: '累计击杀100个敌人' },
  },

  oakley_meta_hstn: {
    id: 'oakley_meta_hstn',
    nameCN: 'Oakley Meta HSTN',
    nameEN: 'Oakley Meta HSTN',
    brand: 'Meta / Oakley',
    rarity: 'rare',
    year: 2025,
    icon: '🏋️',
    specs: {
      display: '无（智能眼镜）',
      resolution: 'N/A',
      fov: 'N/A',
      weight: '约55g',
      battery: '4小时',
      processor: 'Qualcomm平台',
      price: '$379',
      features: [
        '运动优化设计',
        '增强音频系统',
        '12MP摄像头',
        '防汗防尘',
        'Meta AI',
        '优质音频体验',
      ],
    },
    descriptionCN: 'Oakley运动血统与Meta AI技术的结合。为高强度运动场景优化，防汗防尘设计让你在战斗中无后顾之忧。',
    loreCN: 'Oakley的运动DNA在末日中证明了其价值——戴着HSTN的觉醒者在长时间战斗中体力消耗更少，耐久性更强。',
    skill: {
      nameCN: '运动强化',
      descriptionCN: '移动速度+15%，受伤后恢复速度+25%',
      type: 'passive',
      effect: { stat: 'moveSpeed', value: 15, isPercentage: true, special: 'sport_enhance' },
    },
    unlockCondition: { type: 'day', value: 8, descriptionCN: '存活到第8天' },
  },

  google_android_xr: {
    id: 'google_android_xr',
    nameCN: 'Google Android XR',
    nameEN: 'Google Android XR Glasses',
    brand: 'Google',
    rarity: 'rare',
    year: 2026,
    icon: '🔍',
    specs: {
      display: '轻量级光波导（预估）',
      resolution: '未公布',
      fov: '约30°（预估）',
      weight: '约60g（预估）',
      battery: '全天续航（手机辅助计算）',
      processor: '手机分担计算',
      price: '未公布',
      features: [
        'Android XR操作系统',
        'Gemini AI深度集成',
        '实时翻译',
        '"Memory"记忆功能',
        '手机配对减重',
        '日常佩戴设计',
      ],
    },
    descriptionCN: 'Google的隐秘项目，将计算分担给手机以实现极致轻量。Gemini AI "Memory"功能可以记住你看到的一切。',
    loreCN: 'Google在天网·AURA崛起后匆忙推出了这款产品。其"Memory"功能原本用于生活记录，在末日中成为了觉醒者记录被控体行为模式的关键工具。',
    skill: {
      nameCN: '完美记忆',
      descriptionCN: '对战斗过的敌人类型永久获得5%伤害加成（可叠加）',
      type: 'passive',
      effect: { special: 'perfect_memory' },
    },
    unlockCondition: { type: 'kills', value: 300, descriptionCN: '累计击杀300个敌人' },
  },

  // =========================================================
  // COMMON (3 glasses)
  // =========================================================
  xreal_air_1s: {
    id: 'xreal_air_1s',
    nameCN: 'Xreal Air 1S',
    nameEN: 'Xreal Air 1S',
    brand: 'Xreal',
    rarity: 'common',
    year: 2025,
    icon: '🔲',
    specs: {
      display: 'Micro-OLED×2',
      resolution: '1920×1080/眼',
      fov: '46°',
      weight: '82g',
      battery: '需外接设备',
      processor: '3DoF追踪',
      price: '$199',
      features: [
        '46°视场角',
        '108PPD高清显示',
        'USB-C即插即用',
        '3DoF头部追踪',
        '多平台兼容',
        '超高性价比入门款',
      ],
    },
    descriptionCN: 'Xreal的入门级AR眼镜，$199的价格让更多人接触到AR世界。高清显示和轻量设计是其最大卖点。',
    loreCN: '在末日初期，这款平价AR眼镜是最容易获取的觉醒工具。虽然功能有限，但聊胜于无。',
    skill: {
      nameCN: '基础HUD',
      descriptionCN: '显示敌人血条，经验值获取+10%',
      type: 'passive',
      effect: { stat: 'expGain', value: 10, isPercentage: true },
    },
    unlockCondition: { type: 'default', descriptionCN: '游戏开始时可收集' },
  },

  chamelo_music_shield: {
    id: 'chamelo_music_shield',
    nameCN: 'Chamelo Music Shield',
    nameEN: 'Chamelo Music Shield',
    brand: 'Chamelo',
    rarity: 'common',
    year: 2024,
    icon: '🎵',
    specs: {
      display: '无',
      resolution: 'N/A',
      fov: 'N/A',
      weight: '约45g',
      battery: '8小时',
      processor: 'N/A',
      price: '$199',
      features: [
        '电致变色调光镜片',
        '高品质音频',
        '超长续航',
        '时尚大片设计',
        '手机APP控制',
        'UV400防护',
      ],
    },
    descriptionCN: '可调光智能太阳镜，虽然没有显示功能，但电致变色镜片在战场上也能派上用场。',
    loreCN: '看似无害的太阳镜，但其电致变色功能可以过滤天网·AURA的某些控制信号频率。很多不知情的佩戴者因此幸免于难。',
    skill: {
      nameCN: '信号过滤',
      descriptionCN: '受到的AI类攻击伤害-15%',
      type: 'passive',
      effect: { stat: 'armor', value: 15, isPercentage: true },
    },
    unlockCondition: { type: 'day', value: 2, descriptionCN: '存活到第2天' },
  },

  viture_beast: {
    id: 'viture_beast',
    nameCN: 'Viture Beast',
    nameEN: 'Viture Beast',
    brand: 'Viture',
    rarity: 'common',
    year: 2025,
    icon: '🐾',
    specs: {
      display: 'Micro-OLED×2',
      resolution: '1920×1080/眼',
      fov: '45°',
      weight: '78g',
      battery: '需外接设备',
      processor: 'Viture XR引擎',
      price: '$399',
      features: [
        '120英寸虚拟大屏',
        '120Hz刷新率',
        '轻量舒适设计',
        'USB-C连接',
        '兼容多种设备',
        '护眼模式',
      ],
    },
    descriptionCN: 'Viture的全能XR眼镜，120Hz刷新率让快速移动的敌人也不会出现拖影。',
    loreCN: 'Viture Beast以"猛兽"命名，在末日中这个名字变得名副其实——佩戴者在战斗中展现出了非凡的反应速度。',
    skill: {
      nameCN: '猛兽反应',
      descriptionCN: '攻击速度+10%，自动射击范围+10%',
      type: 'passive',
      effect: { stat: 'fireRate', value: 10, isPercentage: true },
    },
    unlockCondition: { type: 'kills', value: 50, descriptionCN: '累计击杀50个敌人' },
  },
};

// =========================================================
// Helper functions
// =========================================================

export function getAllGlasses(): ARGlassesDef[] {
  return Object.values(AR_GLASSES);
}

export function getGlassesByRarity(rarity: GlassesRarity): ARGlassesDef[] {
  return Object.values(AR_GLASSES).filter(g => g.rarity === rarity);
}

export function getGlassesByBrand(brand: string): ARGlassesDef[] {
  return Object.values(AR_GLASSES).filter(g => g.brand.toLowerCase().includes(brand.toLowerCase()));
}

export const RARITY_INFO: Record<GlassesRarity, { nameCN: string; color: number; bgColor: number }> = {
  common: { nameCN: '普通', color: 0x9ca3af, bgColor: 0x374151 },
  rare: { nameCN: '稀有', color: 0x3b82f6, bgColor: 0x1e3a5f },
  epic: { nameCN: '史诗', color: 0xa855f7, bgColor: 0x4c1d95 },
  legendary: { nameCN: '传说', color: 0xf59e0b, bgColor: 0x78350f },
  mythic: { nameCN: '神话', color: 0xef4444, bgColor: 0x7f1d1d },
};

export const TOTAL_GLASSES = Object.keys(AR_GLASSES).length;
