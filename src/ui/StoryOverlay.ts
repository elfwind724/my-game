/**
 * StoryOverlay - Typewriter-style story dialogue that appears during day transitions
 * Shows story text one character at a time with a semi-transparent background
 */
import Phaser from 'phaser';

export class StoryOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isShowing: boolean = false;

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

  private fs(base: number, min: number = 11): string {
    const w = this.scene.cameras.main.width || 1;
    const h = this.scene.cameras.main.height || 1;
    const portrait = h > w;
    const boost = this.isMobileViewport() ? (portrait ? 1.2 : 1.1) : 1;
    return `${Math.max(min, Math.round(base * boost))}px`;
  }

  show(title: string, lines: string[], duration: number = 5000): void {
    if (this.isShowing) return;
    this.isShowing = true;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;

    this.container = this.scene.add.container(0, 0).setDepth(3000).setScrollFactor(0);

    // Semi-transparent overlay at bottom
    const panelH = Math.min(200, 50 + lines.length * 28);
    const panelY = h - panelH - 20;
    const panelW = Math.max(360, Math.min(w - 360, 900));
    const panelX = (w - panelW) / 2;

    const bg = this.scene.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x0f172a, 0.92);
    bg.setStrokeStyle(2, 0x0ea5e9, 0.6);
    this.container.add(bg);

    // Title
    const titleText = this.scene.add.text(panelX + 20, panelY + 12, title, {
      fontSize: this.fs(20, 16), color: '#0ea5e9', fontFamily: this.getUIFontFamily(), fontStyle: 'bold',
    });
    this.container.add(titleText);

    // Decorative line under title
    const line = this.scene.add.rectangle(panelX + panelW / 2, panelY + 38, panelW - 40, 1, 0x0ea5e9, 0.4);
    this.container.add(line);

    // Story lines with typewriter effect
    const textObjects: Phaser.GameObjects.Text[] = [];
    lines.forEach((lineStr, i) => {
      if (!lineStr) return; // skip empty lines
      const t = this.scene.add.text(panelX + 20, panelY + 46 + i * 26, '', {
        fontSize: this.fs(16, 13), color: '#e2e8f0', fontFamily: this.getUIFontFamily(),
        wordWrap: { width: panelW - 40 },
      });
      textObjects.push(t);
      this.container!.add(t);

      // Typewriter delay per line
      const delay = i * 600;
      this.scene.time.delayedCall(delay, () => {
        this.typewriterEffect(t, lineStr, 30);
      });
    });

    // Slide-in from bottom
    this.container.setAlpha(0);
    this.container.setY(30);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, y: 0, duration: 400, ease: 'Quad.easeOut',
    });

    // Skip hint
    const skipHint = this.scene.add.text(w - 40, panelY + panelH - 16, '[空格跳过]', {
      fontSize: this.fs(11, 10), color: '#475569', fontFamily: this.getUIFontFamily(),
    }).setOrigin(1, 1);
    this.container.add(skipHint);

    // Auto-dismiss
    const dismissTime = Math.max(duration, lines.length * 800 + 2000);
    this.scene.time.delayedCall(dismissTime, () => this.hide());

    // Skip on space
    const spaceKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const skipHandler = () => {
      this.hide();
      spaceKey?.off('down', skipHandler);
    };
    spaceKey?.on('down', skipHandler);

    // Clean up listener after auto-dismiss
    this.scene.time.delayedCall(dismissTime + 1000, () => {
      spaceKey?.off('down', skipHandler);
    });
  }

  private typewriterEffect(textObj: Phaser.GameObjects.Text, fullText: string, charDelay: number): void {
    let index = 0;
    const timer = this.scene.time.addEvent({
      delay: charDelay,
      repeat: fullText.length - 1,
      callback: () => {
        index++;
        textObj.setText(fullText.substring(0, index));
      },
    });
    // Store for cleanup
    (textObj as any)._typeTimer = timer;
  }

  hide(): void {
    if (!this.isShowing || !this.container) return;
    this.isShowing = false;

    this.scene.tweens.add({
      targets: this.container, alpha: 0, y: 30, duration: 300,
      onComplete: () => {
        this.container?.destroy();
        this.container = null;
      },
    });
  }

  getIsShowing(): boolean {
    return this.isShowing;
  }

  destroy(): void {
    this.hide();
  }
}
