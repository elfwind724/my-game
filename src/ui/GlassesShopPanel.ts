import Phaser from 'phaser';
import { AR_GLASSES, RARITY_INFO, type ARGlassesDef, type GlassesRarity } from '../data/arGlasses';
import { gameState } from '../state/GameState';
import { BaseSystem } from '../systems/BaseSystem';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import { events } from '../utils/EventBus';

const BASE_PRICE: Record<GlassesRarity, number> = {
  common: 3.2,
  rare: 7.5,
  epic: 15.5,
  legendary: 32,
  mythic: 64,
};

const BRAND_PRICE_FACTOR: Record<string, number> = {
  inmo: 0.95,
  xreal: 1.05,
  apple: 1.25,
  meta: 1.1,
  samsung: 1.15,
  rokid: 1.0,
  viture: 0.98,
  'magic leap': 1.12,
};

export class GlassesShopPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen = false;
  private list: ARGlassesDef[] = [];

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

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = Math.min(720, w - 40);
    const panelH = Math.min(560, h - 40);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(4300);
    this.list = this.getShopList();

    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    const bg = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0b1220, 0.97);
    bg.setStrokeStyle(2, 0x38bdf8, 0.8);
    this.container.add(bg);

    this.container.add(this.scene.add.text(panelX + 18, panelY + 12, '🕶 宝岛眼镜店', {
      fontSize: '25px',
      color: '#38bdf8',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }));

    const close = this.scene.add.text(panelX + panelW - 14, panelY + 8, '✕', {
      fontSize: '24px',
      color: '#ef4444',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    this.container.add(close);

    const market = BaseSystem.getDailyGlassesPriceMultiplier();
    this.container.add(this.scene.add.text(panelX + 18, panelY + 48,
      `当前比特币: ₿${gameState.data.resources.bitcoin.toFixed(3)}  |  今日镜价指数 x${market.toFixed(2)}`, {
      fontSize: '12px',
      color: '#93c5fd',
      fontFamily: 'Courier New',
    }));

    let y = panelY + 76;
    this.list.slice(0, 8).forEach(glass => {
      const rarity = RARITY_INFO[glass.rarity];
      const row = this.scene.add.rectangle(panelX + panelW / 2, y + 31, panelW - 24, 60, rarity.bgColor, 0.35);
      row.setStrokeStyle(1, rarity.color, 0.8);
      this.container!.add(row);

      this.container!.add(this.scene.add.text(panelX + 20, y + 8,
        `${glass.icon} ${glass.nameCN} · ${glass.brand}`, {
        fontSize: '14px',
        color: '#e2e8f0',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }));

      const tree = EvolutionSystem.getBrandSkillTreeByBrand(glass.brand);
      this.container!.add(this.scene.add.text(panelX + 20, y + 30, `${tree.treeNameCN}：${tree.summaryCN}`, {
        fontSize: '11px',
        color: '#94a3b8',
        fontFamily: 'Courier New',
      }));

      const owned = gameState.data.collectedGlasses.includes(glass.id);
      const price = this.getPrice(glass);
      const btnLabel = owned ? '已拥有' : `购买 ₿${price.toFixed(2)}`;
      const buyBtn = this.scene.add.text(panelX + panelW - 20, y + 18, btnLabel, {
        fontSize: '12px',
        color: owned ? '#6b7280' : (gameState.data.resources.bitcoin >= price ? '#22c55e' : '#ef4444'),
        fontFamily: 'Courier New',
        backgroundColor: owned ? '#1f2937' : '#13251a',
        padding: { x: 8, y: 5 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: !owned });

      if (!owned) {
        buyBtn.on('pointerdown', () => {
          if (gameState.data.resources.bitcoin < price) {
            this.flash('比特币不足', '#ef4444');
            return;
          }
          gameState.spendResource('bitcoin', price);
          gameState.data.collectedGlasses.push(glass.id);
          // Auto-equip on purchase so bullet style changes immediately.
          gameState.data.equippedGlasses = glass.id;
          events.emit('glasses-equipped', { id: glass.id, nameCN: glass.nameCN });
          this.flash(`购买并装备：${glass.nameCN}`, '#4ade80');
          events.emit('update-resources', gameState.data.resources);
          this.rebuild();
        });
      }
      this.container!.add(buyBtn);
      y += 66;
    });

    this.container.add(this.scene.add.text(panelX + 18, panelY + panelH - 24,
      '提示：不同厂家对应不同弹幕成长树，可在图鉴中设为当前装备', {
      fontSize: '11px',
      color: '#64748b',
      fontFamily: 'Courier New',
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

  private getShopList(): ARGlassesDef[] {
    return Object.values(AR_GLASSES).sort((a, b) => {
      const r = this.rarityRank(b.rarity) - this.rarityRank(a.rarity);
      if (r !== 0) return r;
      return a.year - b.year;
    });
  }

  private rarityRank(rarity: GlassesRarity): number {
    const map: Record<GlassesRarity, number> = {
      common: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5,
    };
    return map[rarity] || 1;
  }

  private getPrice(glass: ARGlassesDef): number {
    const rarityBase = BASE_PRICE[glass.rarity] || 3;
    const factorKey = Object.keys(BRAND_PRICE_FACTOR).find(k => glass.brand.toLowerCase().includes(k)) || 'inmo';
    const brandFactor = BRAND_PRICE_FACTOR[factorKey] || 1;
    const marketFactor = BaseSystem.getDailyGlassesPriceMultiplier();
    return Math.round(rarityBase * brandFactor * marketFactor * 100) / 100;
  }

  private flash(message: string, color: string): void {
    const w = this.scene.cameras.main.width;
    const text = this.scene.add.text(w / 2, 112, message, {
      fontSize: '18px',
      color,
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4400);

    this.scene.tweens.add({
      targets: text,
      y: 86,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }
}
