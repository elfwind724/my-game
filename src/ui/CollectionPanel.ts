/**
 * CollectionPanel - AR Glasses collection/codex system
 * Shows all glasses with real specs, in-game skills, and unlock status
 */
import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { AR_GLASSES, RARITY_INFO, TOTAL_GLASSES, type ARGlassesDef, type GlassesRarity } from '../data/arGlasses';
import { events } from '../utils/EventBus';

export class CollectionPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;
  private scrollY: number = 0;
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private detailContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  toggle(): void {
    if (this.isOpen) { this.hide(); } else { this.show(); }
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.scrollY = 0;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;

    this.container = this.scene.add.container(0, 0).setDepth(4000).setScrollFactor(0);

    // Overlay
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85);
    overlay.setInteractive();
    this.container.add(overlay);

    // Panel background
    const panelW = Math.min(w - 40, 900);
    const panelH = h - 60;
    const panelX = (w - panelW) / 2;
    const panelY = 30;

    const bg = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0x0ea5e9, 0.6);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(w / 2, panelY + 20, '🔬 AR眼镜图鉴', {
      fontSize: '28px', color: '#0ea5e9', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Collection progress
    const collected = gameState.data.collectedGlasses?.length || 0;
    const equipped = AR_GLASSES[gameState.data.equippedGlasses]?.nameCN || '未装备';
    const progressText = this.scene.add.text(w / 2, panelY + 55, `已收集: ${collected}/${TOTAL_GLASSES}  |  当前装备: ${equipped}`, {
      fontSize: '14px', color: '#94a3b8', fontFamily: 'Courier New',
    }).setOrigin(0.5, 0);
    this.container.add(progressText);

    // Close button
    const closeBtn = this.scene.add.text(panelX + panelW - 20, panelY + 10, '✕', {
      fontSize: '24px', color: '#ef4444', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ef4444'));
    this.container.add(closeBtn);

    // Content area with mask
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // Render glasses grid
    this.renderGlassesList(panelX + 15, panelY + 80, panelW - 30, panelH - 100);

    // Mouse wheel scroll
    this.scene.input.on('wheel', this.onWheel, this);

    // Entrance animation
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 300 });
  }

  private onWheel = (_pointer: any, _gameObjects: any, _dx: number, dy: number): void => {
    if (!this.isOpen || !this.contentContainer) return;
    this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, -1500, 0);
    this.contentContainer.setY(this.scrollY);
  };

  private renderGlassesList(x: number, y: number, areaW: number, _areaH: number): void {
    if (!this.contentContainer) return;
    const collected = gameState.data.collectedGlasses || [];

    // Group by rarity
    const rarities: GlassesRarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];
    let currentY = y;

    for (const rarity of rarities) {
      const glasses = Object.values(AR_GLASSES).filter(g => g.rarity === rarity);
      if (glasses.length === 0) continue;

      const info = RARITY_INFO[rarity];

      // Rarity header
      const header = this.scene.add.text(x + 5, currentY, `${info.nameCN}`, {
        fontSize: '16px', color: `#${info.color.toString(16).padStart(6, '0')}`,
        fontFamily: 'Courier New', fontStyle: 'bold',
      });
      this.contentContainer.add(header);
      currentY += 28;

      // Glasses cards - 2 per row
      const cardW = (areaW - 15) / 2;
      const cardH = 80;

      for (let i = 0; i < glasses.length; i++) {
        const glass = glasses[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = x + col * (cardW + 15);
        const cy = currentY + row * (cardH + 8);

        const isCollected = collected.includes(glass.id);
        this.createGlassCard(glass, cx, cy, cardW, cardH, isCollected);
      }

      currentY += Math.ceil(glasses.length / 2) * (cardH + 8) + 15;
    }
  }

  private createGlassCard(glass: ARGlassesDef, x: number, y: number, w: number, h: number, isCollected: boolean): void {
    if (!this.contentContainer) return;
    const info = RARITY_INFO[glass.rarity];

    // Card bg
    const bgColor = isCollected ? info.bgColor : 0x1e293b;
    const bg = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, bgColor, isCollected ? 0.6 : 0.4);
    bg.setStrokeStyle(1, isCollected ? info.color : 0x334155, isCollected ? 0.8 : 0.3);
    this.contentContainer.add(bg);

    if (!isCollected) {
      // Locked card
      const lockIcon = this.scene.add.text(x + 20, y + h / 2, '🔒', {
        fontSize: '24px',
      }).setOrigin(0.5);
      this.contentContainer.add(lockIcon);

      const lockName = this.scene.add.text(x + 40, y + 12, '???', {
        fontSize: '16px', color: '#475569', fontFamily: 'Courier New', fontStyle: 'bold',
      });
      this.contentContainer.add(lockName);

      const lockCond = this.scene.add.text(x + 40, y + 35, glass.unlockCondition.descriptionCN, {
        fontSize: '11px', color: '#475569', fontFamily: 'Courier New',
        wordWrap: { width: w - 55 },
      });
      this.contentContainer.add(lockCond);

      const lockBrand = this.scene.add.text(x + 40, y + 55, glass.brand, {
        fontSize: '10px', color: '#374151', fontFamily: 'Courier New',
      });
      this.contentContainer.add(lockBrand);
    } else {
      // Collected card - clickable
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.showDetail(glass));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xfbbf24, 1));
      bg.on('pointerout', () => bg.setStrokeStyle(1, info.color, 0.8));

      // Icon
      const icon = this.scene.add.text(x + 20, y + h / 2, glass.icon, {
        fontSize: '28px',
      }).setOrigin(0.5);
      this.contentContainer.add(icon);

      // Name
      const name = this.scene.add.text(x + 42, y + 8, glass.nameCN, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
      });
      this.contentContainer.add(name);

      // Brand + year
      const brandYear = this.scene.add.text(x + 42, y + 28, `${glass.brand} · ${glass.year}`, {
        fontSize: '10px', color: '#94a3b8', fontFamily: 'Courier New',
      });
      this.contentContainer.add(brandYear);

      // Skill name
      const skillName = this.scene.add.text(x + 42, y + 45, `技能: ${glass.skill.nameCN}`, {
        fontSize: '11px', color: `#${info.color.toString(16).padStart(6, '0')}`,
        fontFamily: 'Courier New',
      });
      this.contentContainer.add(skillName);

      // Rarity tag
      const rarityTag = this.scene.add.text(x + w - 8, y + 8, info.nameCN, {
        fontSize: '10px', color: `#${info.color.toString(16).padStart(6, '0')}`,
        fontFamily: 'Courier New', fontStyle: 'bold',
      }).setOrigin(1, 0);
      this.contentContainer.add(rarityTag);
    }
  }

  private showDetail(glass: ARGlassesDef): void {
    // Remove old detail
    if (this.detailContainer) {
      this.detailContainer.destroy();
    }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const info = RARITY_INFO[glass.rarity];

    this.detailContainer = this.scene.add.container(0, 0).setDepth(4500).setScrollFactor(0);

    // Overlay
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7);
    overlay.setInteractive();
    overlay.on('pointerdown', () => {
      this.detailContainer?.destroy();
      this.detailContainer = null;
    });
    this.detailContainer.add(overlay);

    // Detail card
    const cardW = Math.min(600, w - 60);
    const cardH = Math.min(550, h - 60);
    const cx = w / 2;
    const cy = h / 2;

    const bg = this.scene.add.rectangle(cx, cy, cardW, cardH, 0x0f172a, 0.98);
    bg.setStrokeStyle(3, info.color, 0.8);
    this.detailContainer.add(bg);

    // Rarity glow
    const glow = this.scene.add.rectangle(cx, cy, cardW + 6, cardH + 6, info.color, 0.08);
    this.detailContainer.add(glow);

    let textY = cy - cardH / 2 + 20;
    const leftX = cx - cardW / 2 + 20;
    const rightX = cx + cardW / 2 - 20;

    // Icon + Name
    const iconText = this.scene.add.text(cx, textY, glass.icon, { fontSize: '48px' }).setOrigin(0.5, 0);
    this.detailContainer.add(iconText);
    textY += 55;

    const nameText = this.scene.add.text(cx, textY, glass.nameCN, {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.detailContainer.add(nameText);
    textY += 28;

    const enName = this.scene.add.text(cx, textY, `${glass.nameEN} · ${glass.brand} · ${glass.year}`, {
      fontSize: '12px', color: '#94a3b8', fontFamily: 'Courier New',
    }).setOrigin(0.5, 0);
    this.detailContainer.add(enName);
    textY += 18;

    // Rarity
    const rarityText = this.scene.add.text(cx, textY, `[${info.nameCN}]`, {
      fontSize: '14px', color: `#${info.color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.detailContainer.add(rarityText);
    textY += 28;

    // Description
    const desc = this.scene.add.text(cx, textY, glass.descriptionCN, {
      fontSize: '12px', color: '#e2e8f0', fontFamily: 'Courier New',
      wordWrap: { width: cardW - 50 }, align: 'center',
    }).setOrigin(0.5, 0);
    this.detailContainer.add(desc);
    textY += desc.height + 12;

    // Specs section
    const specLine = this.scene.add.rectangle(cx, textY, cardW - 40, 1, 0x334155);
    this.detailContainer.add(specLine);
    textY += 8;

    const specTitle = this.scene.add.text(leftX, textY, '📋 硬件参数', {
      fontSize: '13px', color: '#0ea5e9', fontFamily: 'Courier New', fontStyle: 'bold',
    });
    this.detailContainer.add(specTitle);
    textY += 20;

    const specEntries = [
      ['显示', glass.specs.display],
      ['分辨率', glass.specs.resolution],
      ['视场角', glass.specs.fov],
      ['重量', glass.specs.weight],
      ['续航', glass.specs.battery],
      ['处理器', glass.specs.processor],
      ['价格', glass.specs.price],
    ];

    // Specs in two columns
    const colW = (cardW - 50) / 2;
    specEntries.forEach((entry, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = leftX + col * colW;
      const sy = textY + row * 16;

      const label = this.scene.add.text(sx, sy, `${entry[0]}:`, {
        fontSize: '10px', color: '#64748b', fontFamily: 'Courier New',
      });
      this.detailContainer!.add(label);

      const val = this.scene.add.text(sx + 50, sy, entry[1], {
        fontSize: '10px', color: '#cbd5e1', fontFamily: 'Courier New',
        wordWrap: { width: colW - 55 },
      });
      this.detailContainer!.add(val);
    });
    textY += Math.ceil(specEntries.length / 2) * 16 + 12;

    // Skill section
    const skillLine = this.scene.add.rectangle(cx, textY, cardW - 40, 1, 0x334155);
    this.detailContainer.add(skillLine);
    textY += 8;

    const skillTitle = this.scene.add.text(leftX, textY, `⚡ 技能: ${glass.skill.nameCN}`, {
      fontSize: '13px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
    });
    this.detailContainer.add(skillTitle);

    const skillType = this.scene.add.text(rightX, textY, glass.skill.type === 'active' ? '主动' : '被动', {
      fontSize: '11px', color: glass.skill.type === 'active' ? '#22c55e' : '#8b5cf6',
      fontFamily: 'Courier New',
    }).setOrigin(1, 0);
    this.detailContainer.add(skillType);
    textY += 20;

    const skillDesc = this.scene.add.text(leftX, textY, glass.skill.descriptionCN, {
      fontSize: '12px', color: '#e2e8f0', fontFamily: 'Courier New',
      wordWrap: { width: cardW - 50 },
    });
    this.detailContainer.add(skillDesc);
    textY += skillDesc.height + 12;

    // Lore section
    if (glass.loreCN) {
      const loreLine = this.scene.add.rectangle(cx, textY, cardW - 40, 1, 0x334155);
      this.detailContainer.add(loreLine);
      textY += 8;

      const loreTitle = this.scene.add.text(leftX, textY, '📖 背景故事', {
        fontSize: '13px', color: '#a78bfa', fontFamily: 'Courier New', fontStyle: 'bold',
      });
      this.detailContainer.add(loreTitle);
      textY += 20;

      const loreText = this.scene.add.text(leftX, textY, glass.loreCN, {
        fontSize: '11px', color: '#94a3b8', fontFamily: 'Courier New',
        wordWrap: { width: cardW - 50 }, lineSpacing: 4,
      });
      this.detailContainer.add(loreText);
    }

    // Close hint
    const closeHint = this.scene.add.text(cx, cy + cardH / 2 - 15, '[ 点击空白处关闭 ]', {
      fontSize: '11px', color: '#475569', fontFamily: 'Courier New',
    }).setOrigin(0.5);
    this.detailContainer.add(closeHint);

    const isEquipped = gameState.data.equippedGlasses === glass.id;
    const equipBtn = this.scene.add.text(cx, cy + cardH / 2 - 44, isEquipped ? '已装备' : '设为当前装备', {
      fontSize: '12px',
      color: isEquipped ? '#0f172a' : '#e2e8f0',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      backgroundColor: isEquipped ? '#4ade80' : '#1e293b',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: !isEquipped });
    if (!isEquipped) {
      equipBtn.on('pointerdown', () => {
        gameState.data.equippedGlasses = glass.id;
        events.emit('glasses-equipped', { id: glass.id, nameCN: glass.nameCN });
        equipBtn.setText('已装备');
        equipBtn.setBackgroundColor('#4ade80');
        equipBtn.setColor('#0f172a');
      });
    }
    this.detailContainer.add(equipBtn);

    // Entrance animation
    this.detailContainer.setAlpha(0);
    bg.setScale(0.8);
    this.scene.tweens.add({ targets: this.detailContainer, alpha: 1, duration: 200 });
    this.scene.tweens.add({ targets: bg, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.scene.input.off('wheel', this.onWheel, this);

    if (this.detailContainer) {
      this.detailContainer.destroy();
      this.detailContainer = null;
    }

    if (this.container) {
      this.scene.tweens.add({
        targets: this.container, alpha: 0, duration: 200,
        onComplete: () => {
          this.container?.destroy();
          this.container = null;
          this.contentContainer = null;
        },
      });
    }
  }

  getIsOpen(): boolean { return this.isOpen; }

  destroy(): void {
    this.hide();
  }
}
