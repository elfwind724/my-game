import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { BaseSystem } from '../systems/BaseSystem';
import type { Resources } from '../state/GameState';

type ExchangeResource = Exclude<keyof Resources, 'bitcoin'>;

const PACK_SIZE: Record<ExchangeResource, number> = {
  wood: 30,
  metal: 15,
  food: 20,
  water: 20,
  scrap: 20,
  medical: 8,
  ammo: 18,
  energyCore: 1,
};

export class ExchangePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  toggle(): void {
    if (this.isOpen) this.hide();
    else this.show();
  }

  private rebuild(): void {
    this.hide(true);
    this.show();
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
    const boost = this.isMobileViewport() ? (portrait ? 1.24 : 1.12) : 1;
    return `${Math.max(min, Math.round(base * boost))}px`;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = Math.min(520, w - 40);
    const panelH = Math.min(470, h - 40);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const uiFont = this.getUIFontFamily();

    this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(4200);

    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    const bg = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0f172a, 0.96);
    bg.setStrokeStyle(2, 0xfbbf24, 0.7);
    this.container.add(bg);

    this.container.add(this.scene.add.text(panelX + 16, panelY + 12, '📈 数据交易所', {
      fontSize: this.fs(24, 19),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }));

    const close = this.scene.add.text(panelX + panelW - 14, panelY + 8, '✕', {
      fontSize: this.fs(24, 20),
      color: '#ef4444',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    this.container.add(close);

    const day = gameState.data.currentDay;
    const rates = BaseSystem.getDailyExchangeRates(day);
    const market = BaseSystem.getDailyGlassesPriceMultiplier(day);

    this.container.add(this.scene.add.text(panelX + 16, panelY + 46,
      `第${day}天行情  |  眼镜指数 x${market.toFixed(2)}  |  当前₿ ${gameState.data.resources.bitcoin.toFixed(3)}`, {
      fontSize: this.fs(12, 11),
      color: '#93c5fd',
      fontFamily: uiFont,
    }));

    const keys = Object.keys(rates) as ExchangeResource[];
    let y = panelY + 74;
    keys.forEach((resource, idx) => {
      const rowH = 42;
      const row = this.scene.add.rectangle(panelX + panelW / 2, y + rowH / 2, panelW - 24, rowH, 0x111827, 0.9);
      row.setStrokeStyle(1, 0x334155, 0.8);
      this.container!.add(row);

      const own = gameState.data.resources[resource] || 0;
      const rate = rates[resource] || 0;
      const unit = resource === 'energyCore' ? 1 : PACK_SIZE[resource];
      const gain = rate * unit;
      const name = BaseSystem.getResourceShortName(resource);

      this.container!.add(this.scene.add.text(panelX + 20, y + 11,
        `${name}  持有:${own}  价:${rate.toFixed(3)}₿`, {
        fontSize: this.fs(12, 11),
        color: '#cbd5e1',
        fontFamily: uiFont,
      }));

      const sellBtn = this.scene.add.text(panelX + panelW - 20, y + 9,
        `卖出x${unit} (+₿${gain.toFixed(3)})`, {
          fontSize: this.fs(12, 11),
          color: own >= unit ? '#22c55e' : '#6b7280',
          fontFamily: uiFont,
          backgroundColor: own >= unit ? '#13251a' : '#1f2937',
          padding: { x: 8, y: 4 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: own >= unit });
      if (own >= unit) {
        sellBtn.on('pointerdown', () => {
          const result = BaseSystem.exchangeResourceForBitcoin(resource, unit);
          this.flashMessage(result.ok ? result.message : '交易失败', result.ok ? '#4ade80' : '#ef4444');
          this.rebuild();
        });
      }
      this.container!.add(sellBtn);
      y += rowH + (idx === keys.length - 1 ? 0 : 8);
    });

    this.container.add(this.scene.add.text(panelX + 16, panelY + panelH - 26,
      '说明：每日汇率浮动，优先卖出富余资源换取比特币', {
      fontSize: this.fs(11, 10),
      color: '#64748b',
      fontFamily: uiFont,
    }));
  }

  hide(skipAnim: boolean = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (!this.container) return;
    const target = this.container;
    this.container = null;
    if (skipAnim) {
      target.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: 140,
      onComplete: () => target.destroy(),
    });
  }

  destroy(): void {
    this.hide(true);
  }

  private flashMessage(message: string, color: string): void {
    const w = this.scene.cameras.main.width;
    const text = this.scene.add.text(w / 2, 120, message, {
      fontSize: this.fs(18, 16),
      color,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(4300).setScrollFactor(0);

    this.scene.tweens.add({
      targets: text,
      y: 90,
      alpha: 0,
      duration: 1100,
      onComplete: () => text.destroy(),
    });
  }
}
