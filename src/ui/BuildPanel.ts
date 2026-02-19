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
  private tabBgs: Phaser.GameObjects.Rectangle[] = [];
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

  private getCategoryColor(category: BuildingCategory): number {
    if (category === 'defense') return 0x38bdf8;
    if (category === 'turret') return 0xa78bfa;
    if (category === 'production') return 0x22c55e;
    if (category === 'utility') return 0xf59e0b;
    return 0xf43f5e;
  }

  private getCategoryIconTexture(category: BuildingCategory): string | null {
    if (category === 'defense' && this.scene.textures.exists('wall')) return 'wall';
    if (category === 'turret' && this.scene.textures.exists('turret')) return 'turret';
    if (category === 'production' && this.scene.textures.exists('farm_plot')) return 'farm_plot';
    if (category === 'utility' && this.scene.textures.exists('workbench')) return 'workbench';
    if (category === 'special' && this.scene.textures.exists('energy_core')) return 'energy_core';
    return null;
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
    this.panelHeight = mobile ? Math.min(460, Math.round(h * 0.48)) : 320;
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
    const bgBand = this.scene.add.rectangle(w / 2, -panelH + this.unit(32), w, this.unit(48), 0x0b223b, 0.72);
    this.container.add(bgBand);
    const divider = this.scene.add.rectangle(w / 2, -panelH + this.unit(58), w, 2, 0x22d3ee, 0.52);
    this.container.add(divider);

    // Title
    const title = this.scene.add.text(this.unit(18), -panelH + this.unit(10), '🏗 基地建造总控', {
      fontSize: this.fs(20, 14), color: '#38bdf8', fontFamily: this.uiFont, fontStyle: 'bold',
    });
    this.container.add(title);
    this.container.add(this.scene.add.text(this.unit(18), -panelH + this.unit(32), '选择分类 -> 选中建筑 -> 回到地图放置', {
      fontSize: this.fs(11, 10),
      color: '#93c5fd',
      fontFamily: this.uiFont,
    }));

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
    this.tabBgs.forEach(t => t.destroy());
    this.tabs = [];
    this.tabBgs = [];
    const tabCount = BUILD_CATEGORIES.length;
    const tabGap = this.unit(8);
    const tabStartX = this.unit(14);
    const tabTotalW = w - this.unit(28);
    const tabW = Math.floor((tabTotalW - tabGap * (tabCount - 1)) / tabCount);
    const tabY = -panelH + this.unit(66);
    BUILD_CATEGORIES.forEach((cat, i) => {
      const tabX = tabStartX + i * (tabW + tabGap);
      const tabH = this.unit(28);
      this.tabHotzones.push({ id: cat.id as BuildingCategory, x: tabX, y: tabY, w: tabW, h: tabH });

      const tabBg = this.scene.add.rectangle(tabX + tabW / 2, tabY + tabH / 2, tabW, tabH, 0x111827, 0.9)
        .setStrokeStyle(1, 0x334155, 0.95);
      this.container!.add(tabBg);
      this.tabBgs.push(tabBg);

      const tabHit = this.scene.add.rectangle(tabX, tabY, tabW, tabH, 0xffffff, 0.001)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      tabHit.setData('catId', cat.id);
      tabHit.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.switchCategory(cat.id as BuildingCategory);
      });
      this.container!.add(tabHit);

      const tab = this.scene.add.text(tabX + tabW / 2, tabY + tabH / 2, `${cat.icon} ${cat.nameCN}`, {
        fontSize: this.fs(12, 11),
        color: '#64748b',
        fontFamily: this.uiFont,
        fontStyle: 'normal',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

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
    this.tabs.forEach((tab, idx) => {
      const catId = tab.getData('catId') as BuildingCategory | undefined;
      const isSelected = catId === this.selectedCategory;
      tab.setStyle({
        color: isSelected ? '#e2e8f0' : '#64748b',
        fontStyle: isSelected ? 'bold' : 'normal',
      });
      tab.setBackgroundColor('');
      const bg = this.tabBgs[idx];
      if (!bg || !catId) return;
      const accent = this.getCategoryColor(catId);
      if (isSelected) {
        bg.setFillStyle(0x0b223b, 0.95);
        bg.setStrokeStyle(2, accent, 0.95);
      } else {
        bg.setFillStyle(0x111827, 0.88);
        bg.setStrokeStyle(1, 0x334155, 0.95);
      }
    });
  }

  private refreshCards(): void {
    // Remove old cards
    this.buildingCards.forEach(c => c.destroy());
    this.buildingCards = [];
    this.cardHotzones = [];

    if (!this.container) return;

    const buildings = getBuildingsForCategory(this.selectedCategory);
    const panelW = this.scene.cameras.main.width;
    const cardTop = -this.panelHeight + this.unit(102);
    const cardBottom = -this.unit(8);
    const gapX = this.unit(10);
    const gapY = this.unit(10);
    const availableW = panelW - this.unit(24);
    const preferredW = this.unit(this.isMobileViewport() ? 168 : 190);
    let columns = Math.floor((availableW + gapX) / Math.max(1, preferredW + gapX));
    columns = Phaser.Math.Clamp(columns, 2, 4);
    const cardW = Math.floor((availableW - gapX * (columns - 1)) / columns);
    const cardH = this.unit(this.isMobileViewport() ? 146 : 138);
    const availableH = Math.max(1, Math.abs(cardBottom - cardTop));
    const maxRows = Math.max(1, Math.floor((availableH + gapY) / (cardH + gapY)));
    const maxCards = Math.max(columns, columns * maxRows);
    const shownBuildings = buildings.slice(0, maxCards);

    shownBuildings.forEach((bDef, i) => {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const cardX = this.unit(12) + col * (cardW + gapX);
      const cardY = cardTop + row * (cardH + gapY);
      const card = this.scene.add.container(cardX, cardY);

      const canAfford = gameState.canAfford(bDef.cost as any);
      this.cardHotzones.push({
        id: bDef.id,
        canAfford,
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
      });

      const isSelected = this.selectedBuildingId === bDef.id;
      const accent = this.getCategoryColor(bDef.category);
      const bg = this.scene.add.rectangle(cardW / 2, cardH / 2, cardW, cardH,
        canAfford ? 0x1e293b : 0x111827, 0.96);
      bg.setStrokeStyle(2, isSelected ? 0x22d3ee : (canAfford ? 0x334155 : 0x1f2937), 0.96);
      card.add(bg);
      card.add(this.scene.add.rectangle(cardW / 2, this.unit(10), cardW - 2, this.unit(18), accent, 0.24));

      const iconBox = this.scene.add.rectangle(this.unit(26), this.unit(30), this.unit(36), this.unit(36), 0x0b1220, 0.95)
        .setStrokeStyle(1, bDef.secondaryColor, 0.95);
      card.add(iconBox);
      const iconTexture = this.getCategoryIconTexture(bDef.category);
      if (iconTexture) {
        card.add(this.scene.add.image(this.unit(26), this.unit(30), iconTexture).setScale(0.46));
      } else {
        const icon = this.scene.add.rectangle(this.unit(26), this.unit(30), this.unit(18), this.unit(18), bDef.color);
        icon.setStrokeStyle(1, bDef.secondaryColor);
        card.add(icon);
      }

      const descText = bDef.descriptionCN.length > 20 ? `${bDef.descriptionCN.slice(0, 20)}…` : bDef.descriptionCN;
      card.add(this.scene.add.text(this.unit(50), this.unit(14), bDef.nameCN, {
        fontSize: this.fs(13, 11), color: '#f8fafc', fontFamily: this.uiFont, fontStyle: 'bold',
      }));
      card.add(this.scene.add.text(this.unit(50), this.unit(30), `T${bDef.tier} · HP${bDef.health}`, {
        fontSize: this.fs(10, 10), color: '#94a3b8', fontFamily: this.uiFont,
      }));

      const costParts: string[] = [];
      for (const [res, amt] of Object.entries(bDef.cost)) {
        const names: Record<string, string> = {
          wood: '木', metal: '金', scrap: '件', food: '食',
          water: '水', medical: '医', ammo: '弹', energyCore: '核',
        };
        costParts.push(`${names[res] || res}${amt}`);
      }
      card.add(this.scene.add.text(this.unit(10), this.unit(58), `耗材: ${costParts.join(' ')}`, {
        fontSize: this.fs(10, 10), color: canAfford ? '#4ade80' : '#ef4444', fontFamily: this.uiFont,
      }));
      card.add(this.scene.add.text(this.unit(10), this.unit(76), descText, {
        fontSize: this.fs(10, 10), color: '#cbd5e1', fontFamily: this.uiFont,
        wordWrap: { width: cardW - this.unit(20) },
      }));

      const categoryTag = this.scene.add.text(this.unit(10), cardH - this.unit(26), `${bDef.category.toUpperCase()}`, {
        fontSize: this.fs(9, 9),
        color: '#7dd3fc',
        fontFamily: this.uiFont,
        backgroundColor: '#0b1220',
        padding: { x: this.unit(4), y: this.unit(2) },
      });
      card.add(categoryTag);
      const actionLabel = isSelected ? '已选中' : (canAfford ? '点击建造' : '资源不足');
      card.add(this.scene.add.text(cardW - this.unit(10), cardH - this.unit(26), actionLabel, {
        fontSize: this.fs(10, 10),
        color: isSelected ? '#22d3ee' : (canAfford ? '#38bdf8' : '#64748b'),
        fontFamily: this.uiFont,
        fontStyle: 'bold',
        backgroundColor: '#0b1220',
        padding: { x: this.unit(6), y: this.unit(2) },
      }).setOrigin(1, 0));

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x38bdf8, 0.98));
      bg.on('pointerout', () => {
        const selected = this.selectedBuildingId === bDef.id;
        bg.setStrokeStyle(2, selected ? 0x22d3ee : (canAfford ? 0x334155 : 0x1f2937), 0.96);
      });
      bg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.selectBuilding(bDef.id, canAfford);
      });

      this.container!.add(card);
      this.buildingCards.push(card);
    });

    if (buildings.length > shownBuildings.length) {
      this.container.add(this.scene.add.text(panelW - this.unit(14), cardBottom - this.unit(14), `+${buildings.length - shownBuildings.length} 项未显示`, {
        fontSize: this.fs(10, 10),
        color: '#94a3b8',
        fontFamily: this.uiFont,
      }).setOrigin(1, 1));
    }

    // Keep preview in sync when switching categories.
    if (shownBuildings.length > 0) {
      const hasSelected = !!this.selectedBuildingId && shownBuildings.some(b => b.id === this.selectedBuildingId);
      if (!hasSelected) {
        this.selectBuilding(shownBuildings[0].id, true);
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
        this.tabBgs = [];
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
    this.tabBgs = [];
    this.tabHotzones = [];
    this.cardHotzones = [];
    this.selectedBuildingId = null;
    this.onClose = null;
    this.isOpen = false;
  }
}
