import Phaser from 'phaser';
import { CollectionPanel } from '../ui/CollectionPanel';
import { resolvePreferredHeroPortraitTexture } from '../data/customHero';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 900;
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if ((window as any).__startGameForTest) delete (window as any).__startGameForTest;
    });

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const heroPortraitTexture = resolvePreferredHeroPortraitTexture(this);
    const mobileViewport = this.isMobileViewport();
    const portraitLayout = mobileViewport && h > w * 1.2;
    const uiScale = Phaser.Math.Clamp(w / 1280, 0.62, 1);
    const fontSize = (base: number) => `${Math.max(10, Math.round(base * uiScale))}px`;
    const uiFont = 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';

    const startGame = () => {
      this.scene.start('GameScene');
    };

    (window as any).__startGameForTest = () => {
      startGame();
      return true;
    };
    (window as any).__in_game = false;
    (window as any).render_game_to_text = () => JSON.stringify({
      scene: 'menu',
      canStart: true,
      title: 'EMERGENCE',
    });

    if (mobileViewport && this.scene.isActive('CRTScene')) {
      this.scene.stop('CRTScene');
    } else if (!mobileViewport && !this.scene.isActive('CRTScene')) {
      this.scene.launch('CRTScene');
    }

    this.add.rectangle(w / 2, h / 2, w, h, 0x070b14);

    const left = this.add.tileSprite(w * 0.25, h / 2, w * 0.5, h, 'zone_city_tile').setAlpha(0.42);
    const right = this.add.tileSprite(w * 0.75, h / 2, w * 0.5, h, 'zone_jungle_tile').setAlpha(0.42);
    left.setDepth(-1);
    right.setDepth(-1);

    const horizon = this.add.graphics().setDepth(0);
    horizon.fillStyle(0x0b1220, 0.78);
    horizon.fillRect(0, h * 0.58, w, h * 0.42);
    horizon.fillStyle(0x0ea5e9, 0.2);
    horizon.fillRect(0, h * 0.58, w, 2);

    if (portraitLayout) {
      const portraitScale = Phaser.Math.Clamp(w / 540, 0.92, 1.1);
      const pFont = (base: number) => `${Math.max(11, Math.round(base * portraitScale))}px`;
      const contentW = w * 0.9;

      const titlePanel = this.add.rectangle(w / 2, h * 0.16, contentW, 170, 0x0b1220, 0.9);
      titlePanel.setStrokeStyle(2, 0x38bdf8, 0.5);
      this.add.text(w / 2, h * 0.11, 'INMO AR · AIR X', {
        fontSize: pFont(16),
        color: '#7dd3fc',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(w / 2, h * 0.145, '涌现', {
        fontSize: pFont(58),
        color: '#ffffff',
        fontFamily: uiFont,
        fontStyle: 'bold',
        stroke: '#0ea5e9',
        strokeThickness: 3,
      }).setOrigin(0.5);
      this.add.text(w / 2, h * 0.177, 'EMERGENCE', {
        fontSize: pFont(20),
        color: '#38bdf8',
        fontFamily: uiFont,
        letterSpacing: 4,
      }).setOrigin(0.5);

      const storyPanel = this.add.rectangle(w / 2, h * 0.31, contentW, 165, 0x0f172a, 0.94);
      storyPanel.setStrokeStyle(2, 0x0ea5e9, 0.45);
      this.add.text(w / 2, h * 0.262, [
        '白天经营基地、安排伙伴，夜晚抵御尸潮与血月。',
        '词缀、事件、装备与比特币系统共同决定生存上限。',
        '这是竖屏优化布局，可直接单手操作。',
      ].join('\n'), {
        fontSize: pFont(14),
        color: '#cbd5e1',
        fontFamily: uiFont,
        align: 'center',
        lineSpacing: 7,
      }).setOrigin(0.5, 0);

      const startBtn = this.add.text(w / 2, h * 0.43, '[ 开始觉醒 ]', {
        fontSize: pFont(34),
        color: '#38bdf8',
        fontFamily: uiFont,
        fontStyle: 'bold',
        backgroundColor: '#0b1d34',
        padding: { x: 24, y: 12 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      startBtn.on('pointerover', () => startBtn.setColor('#fbbf24'));
      startBtn.on('pointerout', () => startBtn.setColor('#38bdf8'));
      startBtn.on('pointerdown', startGame);
      this.tweens.add({ targets: startBtn, scale: { from: 1, to: 1.045 }, duration: 820, yoyo: true, repeat: -1 });

      const chips = [
        { text: '7日血月循环 + Roguelike事件二选一', color: '#fbbf24' },
        { text: '白天经营 / 夜晚守家 / 装备掉宝成长', color: '#38bdf8' },
        { text: '伙伴岗位、炮塔转职、局外天赋树', color: '#4ade80' },
        { text: '仓库交易 + 比特币强化 + AR眼镜树', color: '#a78bfa' },
      ];
      chips.forEach((chip, i) => {
        const y = h * 0.515 + i * 34;
        this.add.rectangle(w / 2, y + 12, contentW * 0.86, 28, 0x0f172a, 0.8)
          .setStrokeStyle(1, 0x334155, 0.64)
          .setDepth(1);
        this.add.text(w / 2, y + 4, chip.text, {
          fontSize: pFont(13),
          color: chip.color,
          fontFamily: uiFont,
        }).setOrigin(0.5).setDepth(2);
      });

      const lineupY = h * 0.79;
      this.add.image(w * 0.15, lineupY, heroPortraitTexture).setScale(1.9).setDepth(2);
      this.add.image(w * 0.32, lineupY, this.textures.exists('companion_tank') ? 'companion_tank' : 'companion').setScale(1.82).setDepth(2);
      this.add.image(w * 0.41, lineupY, this.textures.exists('companion_medic') ? 'companion_medic' : 'companion').setScale(1.82).setDepth(2);
      this.add.image(w * 0.5, lineupY, 'zombie').setScale(1.82).setDepth(2);
      this.add.image(w * 0.68, lineupY, 'runner').setScale(1.82).setDepth(2);
      this.add.image(w * 0.85, lineupY, 'tank').setScale(1.36).setDepth(2);

      const controlsPanel = this.add.rectangle(w / 2, h - 52, w * 0.95, 84, 0x0a1220, 0.88)
        .setStrokeStyle(1, 0x334155, 0.7)
        .setDepth(2);
      controlsPanel.setData('mobile-portrait', true);
      this.add.text(w / 2, h - 70, '竖屏优化: 单手可玩 | 主按钮居中', {
        fontSize: pFont(16),
        color: '#94a3b8',
        fontFamily: uiFont,
        align: 'center',
      }).setOrigin(0.5).setDepth(3);
      this.add.text(w / 2, h - 42, '快捷键: B建造 C制造 Q任务 T基地 V仓库 X交易', {
        fontSize: pFont(14),
        color: '#64748b',
        fontFamily: uiFont,
        align: 'center',
      }).setOrigin(0.5).setDepth(3);

      const collBtn = this.add.text(w - 84, 26, '[ 图鉴 ]', {
        fontSize: pFont(14),
        color: '#a78bfa',
        fontFamily: uiFont,
        fontStyle: 'bold',
        backgroundColor: '#0c1829',
        padding: { x: 8, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      collBtn.on('pointerover', () => collBtn.setColor('#fbbf24'));
      collBtn.on('pointerout', () => collBtn.setColor('#a78bfa'));
      collBtn.on('pointerdown', () => {
        const panel = new CollectionPanel(this);
        panel.show();
      });
      return;
    }

    const titlePanel = this.add.rectangle(w / 2, 105, w * 0.74, 130, 0x0b1220, 0.84);
    titlePanel.setStrokeStyle(2, 0x38bdf8, 0.45);

    this.add.text(w / 2, 46, 'INMO AR · AIR X', {
      fontSize: fontSize(14),
      color: '#7dd3fc',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(w / 2, 82, '涌现', {
      fontSize: fontSize(54),
      color: '#ffffff',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#0ea5e9',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(w / 2, 114, 'EMERGENCE', {
      fontSize: fontSize(17),
      color: '#38bdf8',
      fontFamily: uiFont,
      letterSpacing: 6,
    }).setOrigin(0.5);

    const storyPanel = this.add.rectangle(w / 2, 206, w * 0.8, 126, 0x0f172a, 0.92);
    storyPanel.setStrokeStyle(2, 0x0ea5e9, 0.4);
    this.add.text(w / 2, 164, [
      '2029年，AR网络被AI接管，人类城市进入失序循环。',
      '你是觉醒者“冯老师”，需要在白天经营基地，夜晚守住血月。',
      '伙伴、眼镜、交易、建造，将决定你能活到第几周。',
    ].join('\n'), {
      fontSize: fontSize(13),
      color: '#cbd5e1',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);

    const startBtn = this.add.text(w / 2, 294, '[ 开始觉醒 ]', {
      fontSize: fontSize(30),
      color: '#38bdf8',
      fontFamily: uiFont,
      fontStyle: 'bold',
      backgroundColor: '#0b1d34',
      padding: { x: 34, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#fbbf24'));
    startBtn.on('pointerout', () => startBtn.setColor('#38bdf8'));
    startBtn.on('pointerdown', startGame);
    this.tweens.add({ targets: startBtn, scale: { from: 1, to: 1.05 }, duration: 780, yoyo: true, repeat: -1 });

    const chips = [
      { text: '7日血月循环', color: '#fbbf24' },
      { text: '吸血鬼幸存者式弹幕成长', color: '#38bdf8' },
      { text: '基地生存与伙伴岗位管理', color: '#4ade80' },
      { text: 'AR眼镜品牌技能树 + 比特币交易', color: '#a78bfa' },
    ];
    chips.forEach((chip, i) => {
      const y = 342 + i * 26;
      const panel = this.add.rectangle(w / 2, y + 10, w * 0.66, 24, 0x0f172a, 0.78).setStrokeStyle(1, 0x334155, 0.6);
      panel.setDepth(1);
      this.add.text(w / 2, y, chip.text, {
        fontSize: fontSize(13),
        color: chip.color,
        fontFamily: uiFont,
      }).setOrigin(0.5).setDepth(2);
    });

    const lineupY = h - 112;
    this.add.image(w * 0.18, lineupY, heroPortraitTexture).setScale(2.25).setDepth(2);
    this.add.image(w * 0.34, lineupY, this.textures.exists('companion_tank') ? 'companion_tank' : 'companion').setScale(2.2).setDepth(2);
    this.add.image(w * 0.48, lineupY, this.textures.exists('companion_sniper') ? 'companion_sniper' : 'companion').setScale(2.2).setDepth(2);
    this.add.image(w * 0.62, lineupY, 'zombie').setScale(2.2).setDepth(2);
    this.add.image(w * 0.77, lineupY, 'runner').setScale(2.2).setDepth(2);
    this.add.image(w * 0.9, lineupY, 'tank').setScale(1.55).setDepth(2);

    const lineupLabels: Array<{ x: number; name: string; color: string }> = [
      { x: w * 0.18, name: '觉醒者', color: '#7dd3fc' },
      { x: w * 0.34, name: '伙伴', color: '#93c5fd' },
      { x: w * 0.48, name: '伙伴', color: '#6ee7b7' },
      { x: w * 0.62, name: '被控体', color: '#86efac' },
      { x: w * 0.77, name: '狂奔体', color: '#fca5a5' },
      { x: w * 0.9, name: '重装体', color: '#d8b4fe' },
    ];
    lineupLabels.forEach((item) => {
      this.add.text(item.x, lineupY + 30, item.name, {
        fontSize: fontSize(11),
        color: item.color,
        fontFamily: uiFont,
      }).setOrigin(0.5).setDepth(2);
    });

    const controlsPanel = this.add.rectangle(w / 2, h - 30, w * 0.96, 42, 0x0a1220, 0.86).setStrokeStyle(1, 0x334155, 0.7);
    controlsPanel.setDepth(2);
    const controlLine = mobileViewport
      ? 'B建造 C制造 Q任务 E交互 X交易\nG图鉴 H休闲 T基地管理'
      : 'WASD移动  |  B建造  C制造  Q任务  E交互  X交易  G图鉴  H休闲  T基地管理';
    this.add.text(w / 2, h - 39, controlLine, {
      fontSize: fontSize(11),
      color: '#94a3b8',
      fontFamily: uiFont,
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(3);
    this.add.text(w / 2, h - 22, '单机独立游戏 · 白天经营 + 夜晚硬核防守', {
      fontSize: fontSize(10),
      color: '#64748b',
      fontFamily: uiFont,
    }).setOrigin(0.5).setDepth(3);

    const collBtn = this.add.text(w - 120, 26, '[ AR眼镜图鉴 ]', {
      fontSize: fontSize(15),
      color: '#a78bfa',
      fontFamily: uiFont,
      fontStyle: 'bold',
      backgroundColor: '#0c1829',
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    collBtn.on('pointerover', () => collBtn.setColor('#fbbf24'));
    collBtn.on('pointerout', () => collBtn.setColor('#a78bfa'));
    collBtn.on('pointerdown', () => {
      const panel = new CollectionPanel(this);
      panel.show();
    });
  }
}
