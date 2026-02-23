/**
 * LevelUpPanel - Vampire Survivors style level-up card selection
 * Full-screen overlay with 3-4 animated cards
 */
import Phaser from 'phaser';
import { EvolutionSystem, LevelUpChoice, type LevelUpProtocolId } from '../systems/EvolutionSystem';
import { RARITY_COLORS } from '../data/weapons';

export class LevelUpPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;
  private onChoice: ((choice: LevelUpChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private fs(base: number, min: number = 12): string {
    const w = this.scene.cameras.main.width || 1;
    const h = this.scene.cameras.main.height || 1;
    const portrait = h > w;
    const boost = this.isMobileViewport() ? (portrait ? 1.2 : 1.08) : 1;
    return `${Math.max(min, Math.round(base * boost))}px`;
  }

  private getProtocolTextureKey(choice: LevelUpChoice): string | null {
    if (choice.type !== 'upgrade_protocol') return null;
    const protocolId = (choice.protocolId || choice.id) as LevelUpProtocolId | undefined;
    if (!protocolId) return null;
    return `protocol_icon_${protocolId}`;
  }

  show(onChoice: (choice: LevelUpChoice) => void): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.onChoice = onChoice;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000);

    // Overlay
    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7);
    overlay.setInteractive(); // Block clicks through
    this.container.add(overlay);

    // Title
    const title = this.scene.add.text(w / 2, 40, '⬆ 等级提升 ⬆', {
      fontSize: this.fs(36, 24), color: '#fbbf24', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add(title);

    const subtitle = this.scene.add.text(w / 2, 78, '选择一项强化', {
      fontSize: this.fs(18, 14), color: '#94a3b8', fontFamily: this.getUIFontFamily(),
    }).setOrigin(0.5);
    this.container.add(subtitle);

    // Generate choices
    const choices = EvolutionSystem.generateLevelUpChoices(3);
    const mobile = this.isMobileViewport();
    const portrait = h > w;
    const cardWidth = mobile ? (portrait ? 198 : 212) : 220;
    const cardHeight = mobile ? (portrait ? 320 : 326) : 328;
    const gap = mobile ? (portrait ? 18 : 24) : 30;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (w - totalWidth) / 2 + cardWidth / 2;

    choices.forEach((choice, i) => {
      this.createCard(choice, startX + i * (cardWidth + gap), h / 2 + 20, cardWidth, cardHeight, i);
    });

    // Animate title
    this.scene.tweens.add({
      targets: title, scale: { from: 0.5, to: 1 }, alpha: { from: 0, to: 1 },
      duration: 400, ease: 'Back.easeOut',
    });
  }

  private createCard(choice: LevelUpChoice, x: number, y: number, w: number, h: number, index: number): void {
    if (!this.container) return;

    const rarityColor = RARITY_COLORS[choice.rarity] || 0x9ca3af;

    // Card background
    const bg = this.scene.add.rectangle(x, y, w, h, 0x1e293b, 0.95);
    bg.setStrokeStyle(3, rarityColor);
    this.container.add(bg);

    // Rarity glow
    const glow = this.scene.add.rectangle(x, y, w + 4, h + 4, rarityColor, 0.15);
    this.container.add(glow);
    const isProtocolChoice = choice.type === 'upgrade_protocol';
    const protocolColor = choice.color || rarityColor;
    const protocolFrame = isProtocolChoice
      ? this.scene.add.rectangle(x, y, w + 16, h + 16, protocolColor, 0)
          .setStrokeStyle(2, protocolColor, 0.88)
      : null;
    const protocolHalo = isProtocolChoice
      ? this.scene.add.circle(x, y - 40, 34, protocolColor, 0.16).setStrokeStyle(2, protocolColor, 0.8)
      : null;
    if (protocolFrame) this.container.add(protocolFrame);
    if (protocolHalo) this.container.add(protocolHalo);

    // Type badge
    const typeLabels: Record<string, string> = {
      new_weapon: '新武器', upgrade_weapon: '武器升级',
      new_passive: '新被动', upgrade_passive: '被动升级',
      upgrade_protocol: '战斗协议',
    };
    const badge = this.scene.add.text(x, y - h / 2 + 20, typeLabels[choice.type] || '', {
      fontSize: this.fs(12, 11), color: '#000000', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
      backgroundColor: `#${rarityColor.toString(16).padStart(6, '0')}`,
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5);
    this.container.add(badge);

    // Icon
    const protocolTextureKey = this.getProtocolTextureKey(choice);
    const icon = protocolTextureKey && this.scene.textures.exists(protocolTextureKey)
      ? this.scene.add.image(x, y - 40, protocolTextureKey).setScale(2.1)
      : this.scene.add.text(x, y - 40, choice.icon, {
          fontSize: isProtocolChoice ? this.fs(40, 34) : '48px',
          fontFamily: this.getUIFontFamily(),
          color: isProtocolChoice ? `#${protocolColor.toString(16).padStart(6, '0')}` : '#ffffff',
          stroke: '#020617',
          strokeThickness: 2,
        });
    icon.setOrigin(0.5);
    this.container.add(icon);

    // Name
    const name = this.scene.add.text(x, y + 20, choice.nameCN, {
      fontSize: this.fs(20, 16), color: '#ffffff', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(name);

    // Level indicator
    let levelText: Phaser.GameObjects.Text | null = null;
    if (choice.currentLevel != null) {
      const maxLevel = choice.maxLevel ?? Math.max(choice.currentLevel + 1, 1);
      const nextLevel = Math.min(maxLevel, choice.currentLevel + 1);
      levelText = this.scene.add.text(x, y + 48, `Lv.${choice.currentLevel} → Lv.${nextLevel}${choice.maxLevel ? ` / ${maxLevel}` : ''}`, {
        fontSize: this.fs(14, 12), color: '#fbbf24', fontFamily: this.getUIFontFamily(),
      }).setOrigin(0.5);
      this.container.add(levelText);
    }

    // Description
    const desc = this.scene.add.text(x, y + 75, choice.descriptionCN, {
      fontSize: this.fs(13, 11), color: '#94a3b8', fontFamily: this.getUIFontFamily(),
      wordWrap: { width: w - 24 }, align: 'center',
    }).setOrigin(0.5);
    this.container.add(desc);

    let preview: Phaser.GameObjects.Text | null = null;
    if (choice.previewTextCN) {
      preview = this.scene.add.text(x, y + h / 2 - 34, choice.previewTextCN, {
        fontSize: this.fs(11, 10),
        color: choice.previewDpsDelta && choice.previewDpsDelta >= 0 ? '#22c55e' : '#f87171',
        fontFamily: this.getUIFontFamily(),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: w - 16 },
      }).setOrigin(0.5);
      this.container.add(preview);
    }

    // Make card interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setFillStyle(0x334155, 1);
      bg.setStrokeStyle(4, 0xfbbf24);
      this.scene.tweens.add({ targets: [bg, glow], scaleX: 1.05, scaleY: 1.05, duration: 100 });
      if (protocolFrame) protocolFrame.setStrokeStyle(3, 0xfbbf24, 1);
      if (protocolHalo) protocolHalo.setFillStyle(protocolColor, 0.22);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1e293b, 0.95);
      bg.setStrokeStyle(3, rarityColor);
      this.scene.tweens.add({ targets: [bg, glow], scaleX: 1, scaleY: 1, duration: 100 });
      if (protocolFrame) protocolFrame.setStrokeStyle(2, protocolColor, 0.88);
      if (protocolHalo) protocolHalo.setFillStyle(protocolColor, 0.16);
    });
    bg.on('pointerdown', () => {
      this.selectChoice(choice);
    });

    // Staggered entrance animation
    const allElements: Array<Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any }> = [
      bg as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
      glow as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
      badge as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
      icon as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
      name as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
      desc as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any },
    ];
    if (protocolFrame) allElements.push(protocolFrame as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any });
    if (protocolHalo) allElements.push(protocolHalo as Phaser.GameObjects.GameObject & { y: number; setAlpha: (value: number) => any });
    if (levelText) allElements.push(levelText);
    if (preview) allElements.push(preview);
    allElements.forEach(el => {
      el.setAlpha(0);
      el.y += 50;
    });

    this.scene.tweens.add({
      targets: allElements,
      alpha: 1, y: '-=50',
      duration: 400, delay: 200 + index * 150,
      ease: 'Back.easeOut',
    });

    if (protocolFrame) {
      this.scene.tweens.add({
        targets: protocolFrame,
        alpha: { from: 0.35, to: 0.78 },
        scaleX: { from: 1, to: 1.02 },
        scaleY: { from: 1, to: 1.02 },
        duration: 760,
        yoyo: true,
        repeat: -1,
      });
    }
    if (protocolHalo) {
      this.scene.tweens.add({
        targets: protocolHalo,
        alpha: { from: 0.26, to: 0.52 },
        scaleX: { from: 0.95, to: 1.08 },
        scaleY: { from: 0.95, to: 1.08 },
        duration: 680,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private selectChoice(choice: LevelUpChoice): void {
    if (!this.isOpen) return;

    // Apply the choice
    EvolutionSystem.applyChoice(choice);

    // Close panel
    this.hide();

    // Callback
    if (this.onChoice) {
      this.onChoice(choice);
    }
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.container) {
      this.scene.tweens.add({
        targets: this.container, alpha: 0, duration: 300,
        onComplete: () => {
          this.container?.destroy();
          this.container = null;
        },
      });
    }
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    this.hide();
  }
}
