/**
 * LevelUpPanel - Vampire Survivors style level-up card selection
 * Full-screen overlay with 3-4 animated cards
 */
import Phaser from 'phaser';
import { EvolutionSystem, LevelUpChoice } from '../systems/EvolutionSystem';
import { RARITY_COLORS } from '../data/weapons';

export class LevelUpPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;
  private onChoice: ((choice: LevelUpChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
      fontSize: '36px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add(title);

    const subtitle = this.scene.add.text(w / 2, 78, '选择一项强化', {
      fontSize: '18px', color: '#94a3b8', fontFamily: 'Courier New',
    }).setOrigin(0.5);
    this.container.add(subtitle);

    // Generate choices
    const choices = EvolutionSystem.generateLevelUpChoices(3);
    const cardWidth = 220;
    const cardHeight = 328;
    const gap = 30;
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

    // Type badge
    const typeLabels: Record<string, string> = {
      new_weapon: '新武器', upgrade_weapon: '武器升级',
      new_passive: '新被动', upgrade_passive: '被动升级',
    };
    const badge = this.scene.add.text(x, y - h / 2 + 20, typeLabels[choice.type] || '', {
      fontSize: '12px', color: '#000000', fontFamily: 'Courier New', fontStyle: 'bold',
      backgroundColor: `#${rarityColor.toString(16).padStart(6, '0')}`,
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5);
    this.container.add(badge);

    // Icon
    const icon = this.scene.add.text(x, y - 40, choice.icon, {
      fontSize: '48px',
    }).setOrigin(0.5);
    this.container.add(icon);

    // Name
    const name = this.scene.add.text(x, y + 20, choice.nameCN, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(name);

    // Level indicator
    let levelText: Phaser.GameObjects.Text | null = null;
    if (choice.currentLevel) {
      levelText = this.scene.add.text(x, y + 48, `Lv.${choice.currentLevel} → Lv.${choice.currentLevel + 1}`, {
        fontSize: '14px', color: '#fbbf24', fontFamily: 'Courier New',
      }).setOrigin(0.5);
      this.container.add(levelText);
    }

    // Description
    const desc = this.scene.add.text(x, y + 75, choice.descriptionCN, {
      fontSize: '13px', color: '#94a3b8', fontFamily: 'Courier New',
      wordWrap: { width: w - 24 }, align: 'center',
    }).setOrigin(0.5);
    this.container.add(desc);

    let preview: Phaser.GameObjects.Text | null = null;
    if (choice.previewTextCN) {
      preview = this.scene.add.text(x, y + h / 2 - 34, choice.previewTextCN, {
        fontSize: '11px',
        color: choice.previewDpsDelta && choice.previewDpsDelta >= 0 ? '#22c55e' : '#f87171',
        fontFamily: 'Courier New',
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
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1e293b, 0.95);
      bg.setStrokeStyle(3, rarityColor);
      this.scene.tweens.add({ targets: [bg, glow], scaleX: 1, scaleY: 1, duration: 100 });
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
