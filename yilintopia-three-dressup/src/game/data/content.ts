export type Outfit = { id: string; name: string; body: string; skirt: string; desc: string };
export type Accessory = { id: string; name: string; color: string; kind: 'hat' | 'shoes' | 'wings' };
export type Npc = { id: string; name: string; role: string; x: number; z: number; lines: string[] };
export type Collectible = { id: string; name: string; x: number; z: number; hint: string };
export type Quest = { id: string; title: string; description: string; target: number };
export type Achievement = { id: string; title: string; description: string; target: number };

export const outfits: Outfit[] = [
  { id: 'pink', name: '草莓粉裙', body: '#ffd5ec', skirt: '#ff7fc8', desc: '柔软可爱的粉色小裙子。' },
  { id: 'star', name: '星星蓝裙', body: '#dff3ff', skirt: '#73a7ff', desc: '适合在夜光小岛冒险。' },
  { id: 'forest', name: '森林绿裙', body: '#e6ffe6', skirt: '#67c77a', desc: '适合找隐藏宝物。' },
  { id: 'sunny', name: '阳光黄裙', body: '#fff3bd', skirt: '#ffcf5a', desc: '像一束小太阳。' }
];

export const accessories: Accessory[] = [
  { id: 'none-hat', name: '不戴帽子', color: '#ffffff', kind: 'hat' },
  { id: 'crown', name: '小星星皇冠', color: '#ffd84d', kind: 'hat' },
  { id: 'bunny', name: '兔耳发箍', color: '#ffe6f7', kind: 'hat' },
  { id: 'none-shoes', name: '白色小鞋', color: '#ffffff', kind: 'shoes' },
  { id: 'red-shoes', name: '红宝石鞋', color: '#ff6767', kind: 'shoes' },
  { id: 'blue-shoes', name: '天空蓝鞋', color: '#74c7ff', kind: 'shoes' },
  { id: 'none-wings', name: '不戴翅膀', color: '#ffffff', kind: 'wings' },
  { id: 'butterfly', name: '蝴蝶小翅膀', color: '#f4b6ff', kind: 'wings' }
];

export const npcs: Npc[] = [
  { id: 'mimi', name: '米米', role: '猫咪向导', x: 4, z: -5, lines: ['以琳，欢迎来到你的换装小岛！', '树林后面常常藏着发光星星。靠近后按 E 可以互动。'] },
  { id: 'bobo', name: '波波', role: '气球商人', x: -7, z: -2, lines: ['我看见三颗星星落在岛上。', '收集它们，你会解锁一个小小成就。'] },
  { id: 'lulu', name: '露露', role: '花园朋友', x: 8, z: 6, lines: ['换一套森林绿裙试试看，找东西会更有冒险感。', '真正的公主不是站着等人夸奖，而是勇敢探索。'] }
];

export const collectibles: Collectible[] = [
  { id: 'star-1', name: '粉色星星', x: -4, z: 5, hint: '藏在糖果树旁边。' },
  { id: 'star-2', name: '蓝色星星', x: 9, z: -6, hint: '在小桥附近闪闪发光。' },
  { id: 'star-3', name: '金色星星', x: -10, z: -8, hint: '靠近大蘑菇才能看见。' },
  { id: 'heart-1', name: '爱心宝石', x: 2, z: 9, hint: '花园小路尽头。' }
];

export const quests: Quest[] = [
  { id: 'first-talk', title: '认识小岛朋友', description: '和任意 1 位 NPC 对话。', target: 1 },
  { id: 'star-hunt', title: '寻找落下的星星', description: '收集 3 颗隐藏星星。', target: 3 },
  { id: 'fashion-day', title: '今日换装秀', description: '试穿 3 套不同服饰。', target: 3 }
];

export const achievements: Achievement[] = [
  { id: 'collector', title: '小小收藏家', description: '收集 4 个隐藏道具。', target: 4 },
  { id: 'social', title: '礼貌问候', description: '和 3 位 NPC 都聊过天。', target: 3 },
  { id: 'stylist', title: '小小造型师', description: '完成 3 次换装。', target: 3 }
];
