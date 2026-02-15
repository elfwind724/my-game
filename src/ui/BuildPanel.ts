/**
 * BuildPanel - Building menu (slide from bottom)
 * Category tabs, building cards with preview
 */
import Phaser from 'phaser';
import { BUILD_CATEGORIES, getBuildingsForCategory } from '../data/buildings';
import type { BuildingCategory } from '../data/buildings';
import { gameState } from '../state/GameState';

export class BuildPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen: boolean = false;
  private panelHeight: number = 260;
  private fontBoost: number = 1;
  private layoutBoost: number = 1;
  private uiFont = 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  private selectedCategory: BuildingCategory = 'defense';
  private onBuildingSelect: ((buildingId: string) => void) | null = null;
  private onClose: (() => void) | null = null;
  private buildingCards: Phaser.GameObjects.Container[] = [];
  private tabs: Phaser.GameObjects.Text[] = [];
  private tabHotzones: Array<{ id: BuildingCategory; x: number; y: number; w: number; h: number }> = [];
  private cardHotzones: Array<{ id: string; canAfford: boolean; x: number; y: number; w: number; h: number }> = [];
  private selectedBuildingId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private computeBoosts(panelW: number): void {
    const gameW = this.scene.cameras.main.width || 1;
    const displayW = this.scene.game.canvas?.getBoundingClientRect().width || gameW;
    const ratio = gameW / Math.max(1, displayW);
    const portrait = this.scene.cameras.main.height > this.scene.cameras.main.width;
    const mobile = this.isMobileViewport();
    let fontBoost = ratio * Phaser.Math.Clamp(panelW / 900, 0.86, 1.2) * 1.08;
    if (mobile && portrait) fontBoost = Math.max(fontBoost, 1.85);
    this.fontBoost = Phaser.Math.Clamp(fontBoost, 1.05, 2.5);
    this.layoutBoost = Phaser.Math.Clamp(this.fontBoost * 0.72, 1, 1.55);
  }

  private fs(base: number, min: number = 11): string {
    return `${Math.max(min, Math.round(base * this.fontBoost))}px`;
  }

  private unit(value: number): number {
    return Math.round(value * this.layoutBoost);
  }

  toggle(onSelect: (buildingId: string) => void, onClose?: () => void): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show(onSelect, onClose);
    }
  }

  show(onSelect: (buildingId: string) => void, onClose?: () => void): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.onBuildingSelect = onSelect;
    this.onClose = onClose || null;
    this.tabHotzones = [];
    this.cardHotzones = [];

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const mobile = this.isMobileViewport();
    this.panelHeight = mobile ? Math.min(420, Math.round(h * 0.42)) : 260;
    const panelH = this.panelHeight;
    this.computeBoosts(w);

    this.container = this.scene.add.container(0, h);
    this.container.setScrollFactor(0);
    this.container.setDepth(2500);
    this.container.setSize(w, panelH);

    // Background
    const bg = this.scene.add.rectangle(w / 2, -panelH / 2, w, panelH, 0x0f172a, 0.95);
    bg.setStrokeStyle(2, 0x0ea5e9);
    bg.setInteractive();
    bg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(this.unit(20), -panelH + this.unit(12), '🏗 AR建造系统', {
      fontSize: this.fs(20, 14), color: '#0ea5e9', fontFamily: this.uiFont, fontStyle: 'bold',
    });
    this.container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(w - this.unit(20), -panelH + this.unit(12), '✕ 关闭', {
      fontSize: this.fs(16, 12), color: '#ef4444', fontFamily: this.uiFont,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.hide();
    });
    this.container.add(closeBtn);

    // Category tabs
    this.tabs.forEach(t => t.destroy());
    this.tabs = [];
    BUILD_CATEGORIES.forEach((cat, i) => {
      const tabX = this.unit(20) + i * this.unit(104);
      const tabY = -panelH + this.unit(45);
      this.tabHotzones.push({ id: cat.id as BuildingCategory, x: tabX - this.unit(6), y: tabY - this.unit(6), w: this.unit(96), h: this.unit(32) });
      const tabHit = this.scene.add.rectangle(tabX - this.unit(6), tabY - this.unit(6), this.unit(96), this.unit(32), 0xffffff, 0.001)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      tabHit.setData('catId', cat.id);
      tabHit.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.switchCategory(cat.id as BuildingCategory);
      });
      this.container!.add(tabHit);

      const tab = this.scene.add.text(tabX, tabY, `${cat.icon} ${cat.nameCN}`, {
        fontSize: this.fs(14, 11),
        color: '#64748b',
        fontFamily: this.uiFont,
        fontStyle: 'normal',
        backgroundColor: undefined,
        padding: { x: this.unit(6), y: this.unit(4) },
      }).setInteractive({ useHandCursor: true });

      tab.setData('catId', cat.id);
      tab.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.switchCategory(cat.id as BuildingCategory);
      });

      this.container!.add(tab);
      this.tabs.push(tab);
    });

    this.updateTabStyles();

    // Build cards
    this.refreshCards();

    // Slide up animation
    this.scene.tweens.add({
      targets: this.container,
      y: h - panelH,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Fallback click handling in case scene layering causes object hit-test misses.
    this.scene.input.off('pointerdown', this.handlePanelPointerDown, this);
    this.scene.input.on('pointerdown', this.handlePanelPointerDown, this);
  }

  private switchCategory(category: BuildingCategory): void {
    this.selectedCategory = category;
    this.updateTabStyles();
    this.refreshCards();
  }

  private updateTabStyles(): void {
    this.tabs.forEach(tab => {
      const catId = tab.getData('catId') as BuildingCategory | undefined;
      const isSelected = catId === this.selectedCategory;
      tab.setStyle({
        color: isSelected ? '#0ea5e9' : '#64748b',
        fontStyle: isSelected ? 'bold' : 'normal',
      });
      tab.setBackgroundColor(isSelected ? '#1e3a5f' : '');
    });
  }

  private refreshCards(): void {
    // Remove old cards
    this.buildingCards.forEach(c => c.destroy());
    this.buildingCards = [];
    this.cardHotzones = [];

    if (!this.container) return;

    const buildings = getBuildingsForCategory(this.selectedCategory);
    const startX = this.unit(20);
    const cardY = -this.unit(140);
    const cardW = this.unit(160);
    const cardH = this.unit(132);
    const gap = this.unit(12);

    buildings.forEach((bDef, i) => {
      const card = this.scene.add.container(startX + i * (cardW + gap), cardY);

      // Card bg
      const canAfford = gameState.canAfford(bDef.cost as any);
      this.cardHotzones.push({
        id: bDef.id,
        canAfford,
        x: startX + i * (cardW + gap),
        y: cardY,
        w: cardW,
        h: cardH,
      });
      const isSelected = this.selectedBuildingId === bDef.id;
      const bg = this.scene.add.rectangle(cardW / 2, cardH / 2, cardW, cardH,
        canAfford ? 0x1e293b : 0x1a1a2e, 0.9);
      bg.setStrokeStyle(2, isSelected ? 0x22d3ee : (canAfford ? 0x334155 : 0x333333));
      card.add(bg);

      // Building icon (colored square)
      const icon = this.scene.add.rectangle(this.unit(25), this.unit(25), this.unit(30), this.unit(30), bDef.color);
      icon.setStrokeStyle(1, bDef.secondaryColor);
      card.add(icon);

      // Name
      const name = this.scene.add.text(this.unit(55), this.unit(12), bDef.nameCN, {
        fontSize: this.fs(14, 11), color: '#ffffff', fontFamily: this.uiFont, fontStyle: 'bold',
      });
      card.add(name);

      // Tier
      const tierText = this.scene.add.text(this.unit(55), this.unit(30), `T${bDef.tier} · HP:${bDef.health}`, {
        fontSize: this.fs(11, 10), color: '#64748b', fontFamily: this.uiFont,
      });
      card.add(tierText);

      // Cost
      const costParts: string[] = [];
      for (const [res, amt] of Object.entries(bDef.cost)) {
        const names: Record<string, string> = {
          wood: '木', metal: '金', scrap: '件', food: '食',
          water: '水', medical: '医', ammo: '弹', energyCore: '核',
        };
        costParts.push(`${names[res] || res}${amt}`);
      }
      const costText = this.scene.add.text(this.unit(10), this.unit(55), costParts.join(' '), {
        fontSize: this.fs(12, 11), color: canAfford ? '#4ade80' : '#ef4444', fontFamily: this.uiFont,
      });
      card.add(costText);

      // Description
      const desc = this.scene.add.text(this.unit(10), this.unit(75), bDef.descriptionCN, {
        fontSize: this.fs(10, 10), color: '#94a3b8', fontFamily: this.uiFont,
        wordWrap: { width: cardW - this.unit(20) },
      });
      card.add(desc);

      // Interactive
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x0ea5e9));
      bg.on('pointerout', () => {
        const selected = this.selectedBuildingId === bDef.id;
        bg.setStrokeStyle(2, selected ? 0x22d3ee : (canAfford ? 0x334155 : 0x333333));
      });
      bg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectBuilding(bDef.id, canAfford);
      });

      this.container!.add(card);
      this.buildingCards.push(card);
    });

    // Keep preview in sync when switching categories.
    if (buildings.length > 0) {
      const hasSelected = !!this.selectedBuildingId && buildings.some(b => b.id === this.selectedBuildingId);
      if (!hasSelected) {
        this.selectBuilding(buildings[0].id, true);
      }
    } else {
      this.selectedBuildingId = null;
    }
  }

  private selectBuilding(buildingId: string, canAfford: boolean): void {
    if (!canAfford) return;
    this.selectedBuildingId = buildingId;
    this.onBuildingSelect?.(buildingId);
    this.refreshCards();
  }

  hide(): void {
    if (!this.isOpen || !this.container) return;
    this.isOpen = false;
    this.scene.input.off('pointerdown', this.handlePanelPointerDown, this);

    const h = this.scene.cameras.main.height;
    this.scene.tweens.add({
      targets: this.container,
      y: h + 50,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container?.destroy();
        this.container = null;
        this.buildingCards = [];
        this.tabHotzones = [];
        this.cardHotzones = [];
        const callback = this.onClose;
        this.onClose = null;
        callback?.();
      },
    });
  }

  private handlePanelPointerDown(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    event: Phaser.Types.Input.EventData
  ): void {
    if (!this.container || !this.isOpen) return;
    if (!this.containsScreenPoint(pointer.x, pointer.y)) return;

    const localX = pointer.x;
    const localY = pointer.y - this.container.y;
    event?.stopPropagation();

    // close area
    if (localX >= this.scene.cameras.main.width - 100 && localX <= this.scene.cameras.main.width &&
      localY >= -this.panelHeight && localY <= -this.panelHeight + 52) {
      this.hide();
      return;
    }

    // tabs
    for (const zone of this.tabHotzones) {
      if (localX >= zone.x && localX <= zone.x + zone.w && localY >= zone.y && localY <= zone.y + zone.h) {
        if (this.selectedCategory !== zone.id) this.switchCategory(zone.id);
        return;
      }
    }

    // cards
    for (const zone of this.cardHotzones) {
      if (localX >= zone.x && localX <= zone.x + zone.w && localY >= zone.y && localY <= zone.y + zone.h) {
        this.selectBuilding(zone.id, zone.canAfford);
        return;
      }
    }
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  containsScreenPoint(x: number, y: number): boolean {
    if (!this.container || !this.isOpen) return false;
    const top = this.container.y - this.panelHeight;
    const bottom = this.container.y;
    return x >= 0 && x <= this.scene.cameras.main.width && y >= top && y <= bottom;
  }

  getSelectedCategory(): BuildingCategory {
    return this.selectedCategory;
  }

  getSelectedBuildingId(): string | null {
    return this.selectedBuildingId;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePanelPointerDown, this);
    this.container?.destroy();
    this.container = null;
    this.buildingCards = [];
    this.tabHotzones = [];
    this.cardHotzones = [];
    this.selectedBuildingId = null;
    this.onClose = null;
    this.isOpen = false;
  }
}
