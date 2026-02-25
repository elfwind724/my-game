/**
 * Slide-in panels for Inventory, Crafting, Quest Log
 * Each panel slides from the edge with smooth animation
 */
import Phaser from 'phaser';
import { gameState, type CompanionData, type CompanionProfile } from '../state/GameState';
import { QuestSystem } from '../systems/QuestSystem';
import { BaseSystem, type BuildChainStatus } from '../systems/BaseSystem';
import { CompanionPersonalitySystem } from '../systems/CompanionPersonalitySystem';
import { BUILDING_DEFS, BUILD_CATEGORIES, getBuildingUpgradeHint } from '../data/buildings';
import type { BuildingFilterCategory } from '../data/buildings';
import type { BuildingDef } from '../data/buildings';
import { events, GameEvents } from '../utils/EventBus';
import { BASE_JOB_LABELS, BASE_JOB_ORDER } from '../data/base';

// ============================================================
// BASE PANEL
// ============================================================
class SlidePanel {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container | null = null;
  protected isOpen: boolean = false;
  protected panelWidth: number;
  protected side: 'left' | 'right';

  constructor(scene: Phaser.Scene, width: number, side: 'left' | 'right' = 'right') {
    this.scene = scene;
    this.panelWidth = width;
    this.side = side;
  }

  protected createBase(): Phaser.GameObjects.Container {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const startX = this.side === 'right' ? w : -this.panelWidth;

    this.container = this.scene.add.container(startX, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2800);

    // Background
    const bg = this.scene.add.rectangle(this.panelWidth / 2, h / 2, this.panelWidth, h, 0x0f172a, 0.95);
    bg.setStrokeStyle(2, 0x0ea5e9);
    bg.setInteractive(); // Block clicks
    if (bg.input) (bg.input as any).priorityID = 0;
    this.container.add(bg);

    // Slide in
    const targetX = this.side === 'right' ? w - this.panelWidth : 0;
    this.scene.tweens.add({
      targets: this.container, x: targetX, duration: 300, ease: 'Quad.easeOut',
    });

    this.isOpen = true;
    return this.container;
  }

  hide(): void {
    if (!this.isOpen && !this.container) return;
    this.isOpen = false;
    const w = this.scene.cameras.main.width;
    const targetX = this.side === 'right' ? w + 10 : -this.panelWidth - 10;
    const closingContainer = this.container;
    if (!closingContainer) {
      this.container = null;
      return;
    }
    this.scene.tweens.add({
      targets: closingContainer, x: targetX, duration: 250, ease: 'Quad.easeIn',
      onComplete: () => {
        closingContainer.destroy();
        if (this.container === closingContainer) {
          this.container = null;
        }
      },
    });
  }

  toggle(): void {
    // Recover from stale states caused by async tween callbacks.
    if (this.isOpen && !this.container) this.isOpen = false;
    if (!this.isOpen && this.container) {
      this.container.destroy();
      this.container = null;
    }
    if (this.isOpen) this.hide();
    else this.show();
  }

  show(): void { /* Override in subclass */ }

  getIsOpen(): boolean { return this.isOpen; }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.isOpen = false;
  }
}

// ============================================================
// CRAFTING PANEL
// ============================================================
export class CraftingPanel extends SlidePanel {
  private selectedBuildCategory: BuildingFilterCategory = 'all';
  private buildOnlyMode: boolean = true;
  private buildCardPage: number = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 350, 'right');
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private getFontBoost(): number {
    const gameW = this.scene.cameras.main.width || 1;
    const scaleDisplayW = this.scene.scale.displaySize.width || gameW;
    const canvasDisplayW = this.scene.game.canvas?.getBoundingClientRect().width || scaleDisplayW;
    const displayW = Math.max(1, Math.min(scaleDisplayW, canvasDisplayW));
    const mobile = this.isMobileViewport();
    const portrait = this.scene.cameras.main.height > this.scene.cameras.main.width;
    let boost = gameW / displayW;
    if (mobile && portrait) boost = Math.max(boost, 2.15);
    return Phaser.Math.Clamp(boost, 1.15, 2.75);
  }

  openCategory(category: string, options?: { buildOnly?: boolean }): void {
    if (options?.buildOnly != null) this.buildOnlyMode = !!options.buildOnly;
    if (category && BUILD_CATEGORIES.some(c => c.id === category)) {
      if (this.selectedBuildCategory !== (category as BuildingFilterCategory)) {
        this.buildCardPage = 0;
      }
      this.selectedBuildCategory = category as BuildingFilterCategory;
    }
    if (!this.isOpen) {
      this.show();
      return;
    }
    this.rebuild();
  }

  togglePanel(options?: { buildOnly?: boolean; category?: string }): void {
    if (options?.buildOnly != null) this.buildOnlyMode = !!options.buildOnly;
    if (options?.category && BUILD_CATEGORIES.some(c => c.id === options.category)) {
      if (this.selectedBuildCategory !== (options.category as BuildingFilterCategory)) {
        this.buildCardPage = 0;
      }
      this.selectedBuildCategory = options.category as BuildingFilterCategory;
    }
    this.toggle();
  }

  hide(): void {
    const wasOpen = this.isOpen;
    super.hide();
    if (wasOpen) events.emit('crafting-panel-state', { open: false });
  }

  private rebuild(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.isOpen = false;
    this.show();
  }

  show(): void {
    if (this.isOpen) { this.hide(); return; }
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const mobileViewport = this.isMobileViewport();
    const mobilePortrait = mobileViewport && h > w;
    this.panelWidth = mobileViewport
      ? Math.min(w - 8, Math.max(560, Math.round(w * 0.9)))
      : Math.max(350, Math.min(520, Math.round(w * 0.36)));
    const container = this.createBase();
    const fontBoost = this.getFontBoost();
    const layoutBoost = Phaser.Math.Clamp(fontBoost * 0.72, 1, 1.6);
    const fs = (base: number, min: number = mobilePortrait ? 16 : 13) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const unit = (value: number) => Math.round(value * layoutBoost);
    const uiFont = this.getUIFontFamily();

    // Title
    container.add(this.scene.add.text(unit(20), unit(15), '⚙ 制造工坊', {
      fontSize: fs(22), color: '#0ea5e9', fontFamily: uiFont, fontStyle: 'bold',
    }));

    // Close
    const close = this.scene.add.text(this.panelWidth - unit(15), unit(15), '✕', {
      fontSize: fs(20), color: '#ef4444', fontFamily: uiFont,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.setDepth(1);
    if (close.input) (close.input as any).priorityID = 2;
    close.on('pointerdown', () => this.hide());
    container.add(close);

    // Larger close hit area
    const closeHit = this.scene.add.rectangle(this.panelWidth - unit(8), unit(28), unit(48), unit(36), 0xffffff, 0.001)
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeHit.setDepth(2);
    if (closeHit.input) (closeHit.input as any).priorityID = 3;
    closeHit.on('pointerdown', () => this.hide());
    container.add(closeHit);

    // Single category bar only (build filters). Top duplicate category row removed.
    const modeLabel = this.buildOnlyMode ? '制造页  ·  单栏分类（防重复）' : '制造页';
    container.add(this.scene.add.text(unit(16), unit(52), modeLabel, {
      fontSize: fs(11), color: '#93c5fd', fontFamily: uiFont,
    }));
    this.renderBuildingCards(container, h, {
      fs,
      unit,
      uiFont,
      mobilePortrait,
    });

    events.emit('crafting-panel-state', { open: true });
  }

  private renderBuildingCards(
    container: Phaser.GameObjects.Container,
    h: number,
    ui: {
      fs: (base: number, min?: number) => string;
      unit: (value: number) => number;
      uiFont: string;
      mobilePortrait: boolean;
    }
  ): void {
    const { fs, unit, uiFont, mobilePortrait } = ui;
    container.add(this.scene.add.text(unit(18), unit(86), '选建筑 -> 进入放置模式（左键放置，B退出）', {
      fontSize: fs(11), color: '#93c5fd', fontFamily: uiFont,
    }));

    const tabStartX = unit(14);
    const tabY = unit(108);
    const tabStep = Math.max(unit(52), Math.floor((this.panelWidth - unit(30)) / BUILD_CATEGORIES.length));
    BUILD_CATEGORIES.forEach((cat, i) => {
      const tab = this.scene.add.text(tabStartX + i * tabStep, tabY, `${cat.icon}${cat.nameCN}`, {
        fontSize: fs(12),
        color: cat.id === this.selectedBuildCategory ? '#fbbf24' : '#64748b',
        fontFamily: uiFont,
        backgroundColor: cat.id === this.selectedBuildCategory ? '#1e3a5f' : undefined,
        padding: { x: unit(4), y: unit(2) },
      }).setInteractive({ useHandCursor: true });
      if (tab.input) (tab.input as any).priorityID = 4;
      tab.on('pointerdown', () => {
        this.selectedBuildCategory = cat.id;
        this.buildCardPage = 0;
        this.rebuild();
      });
      container.add(tab);
    });

    const defs = Object.values(BUILDING_DEFS).filter(def =>
      this.selectedBuildCategory === 'all' ? true : def.category === this.selectedBuildCategory
    );
    const housingPinnedOrder = ['room_quarters', 'bunk_bed'];
    defs.sort((a, b) => {
      const ai = housingPinnedOrder.indexOf(a.id);
      const bi = housingPinnedOrder.indexOf(b.id);
      const aPinned = ai >= 0;
      const bPinned = bi >= 0;
      if (aPinned && bPinned) return ai - bi;
      if (aPinned) return -1;
      if (bPinned) return 1;
      return 0;
    });
    const resMap: Record<string, string> = {
      wood: '木',
      metal: '金',
      scrap: '件',
      food: '食',
      water: '水',
      medical: '医',
      ammo: '弹',
      energyCore: '核',
    };

    const popUsage = BaseSystem.getPopulationUsage();
    const popCap = BaseSystem.getPopulationCapacity();
    const housingChain = BaseSystem.getBuildChainStatus('room_quarters');
    const housingHint = housingChain.canConstruct
      ? '人口扩容已解锁：可建宿舍房间'
      : `人口扩容未解锁：${(housingChain.blockedReasons || []).slice(0, 1).join('；') || '需前置建筑'}`;
    container.add(this.scene.add.text(unit(18), unit(124), `人口 ${popUsage}/${popCap} · ${housingHint}`, {
      fontSize: fs(11),
      color: housingChain.canConstruct ? '#67e8f9' : '#fbbf24',
      fontFamily: uiFont,
      wordWrap: { width: this.panelWidth - unit(36) },
    }));

    const cardH = mobilePortrait ? unit(152) : unit(126);
    const cardGap = unit(8);
    const listTop = unit(160);
    const listBottom = h - unit(120);
    const availableHeight = Math.max(cardH, listBottom - listTop);
    const cardsPerPage = Math.max(1, Math.floor((availableHeight + cardGap) / (cardH + cardGap)));
    const totalPages = Math.max(1, Math.ceil(defs.length / cardsPerPage));
    this.buildCardPage = Phaser.Math.Clamp(this.buildCardPage, 0, totalPages - 1);
    const startIndex = this.buildCardPage * cardsPerPage;
    const endIndex = Math.min(defs.length, startIndex + cardsPerPage);
    const shownDefs = defs.slice(startIndex, endIndex);

    let y = listTop;
    for (const def of shownDefs) {
      const canAfford = gameState.canAfford(def.cost as any);
      const chainStatus = BaseSystem.getBuildChainStatus(def.id);
      const canBuild = canAfford && chainStatus.canConstruct;

      const card = this.scene.add.rectangle(this.panelWidth / 2, y + cardH / 2, this.panelWidth - unit(20), cardH,
        canBuild ? 0x1e293b : 0x0b1220, 0.92);
      card.setStrokeStyle(1, canBuild ? 0x334155 : 0x1e293b);
      container.add(card);

      const iconKey = def.category === 'turret' ? 'turret_icon_kenney' : 'build_icon_kenney';
      if (this.scene.textures.exists(iconKey)) {
        container.add(this.scene.add.image(unit(28), y + unit(26), iconKey).setScale(mobilePortrait ? 1.4 : 1.25));
      } else {
        container.add(this.scene.add.rectangle(unit(28), y + unit(26), unit(20), unit(20), def.color, 1).setStrokeStyle(1, def.secondaryColor));
      }
      container.add(this.scene.add.text(unit(42), y + unit(10), `${def.nameCN}  T${def.tier}  HP${def.health}`, {
        fontSize: fs(14), color: '#ffffff', fontFamily: uiFont, fontStyle: 'bold',
      }));

      const costs = Object.entries(def.cost).map(([k, v]) => `${resMap[k] || k}${v}`).join(' ');
      container.add(this.scene.add.text(unit(42), y + unit(32), costs, {
        fontSize: fs(11), color: canBuild ? '#4ade80' : '#ef4444', fontFamily: uiFont,
      }));
      container.add(this.scene.add.text(unit(42), y + unit(48), this.getBuildingEffectSummary(def), {
        fontSize: fs(11), color: '#93c5fd', fontFamily: uiFont,
        wordWrap: { width: this.panelWidth - unit(190) },
      }));
      container.add(this.scene.add.text(unit(42), y + unit(64), this.getBuildingPurposeLine(def), {
        fontSize: fs(11), color: '#cbd5e1', fontFamily: uiFont,
      }));
      container.add(this.scene.add.text(unit(42), y + unit(78), this.getBuildChainLine(chainStatus), {
        fontSize: fs(10), color: chainStatus.canConstruct ? '#67e8f9' : '#fb7185', fontFamily: uiFont,
        wordWrap: { width: this.panelWidth - unit(190) },
      }));
      container.add(this.scene.add.text(unit(42), y + unit(92), getBuildingUpgradeHint(def.id), {
        fontSize: fs(10), color: '#93c5fd', fontFamily: uiFont,
        wordWrap: { width: this.panelWidth - unit(190) },
      }));

      const btnLabel = canBuild
        ? '选中建造'
        : (!chainStatus.canConstruct ? '链路未解锁' : '缺资源');
      const btn = this.scene.add.text(this.panelWidth - unit(20), y + unit(24), btnLabel, {
        fontSize: fs(12),
        color: canBuild ? '#0ea5e9' : '#64748b',
        fontFamily: uiFont,
        fontStyle: 'bold',
        backgroundColor: '#0b1220',
        padding: { x: unit(6), y: unit(3) },
      }).setOrigin(1, 0);
      if (canBuild) {
        btn.setInteractive({ useHandCursor: true });
        if (btn.input) (btn.input as any).priorityID = 5;
        btn.on('pointerdown', () => {
          events.emit('select-build-item', { buildingId: def.id });
          this.hide();
        });
      }
      container.add(btn);
      y += cardH + cardGap;
    }

    const pagerY = h - unit(84);
    const pagerHint = `${startIndex + 1}-${endIndex}/${defs.length}`;
    const pagerText = this.scene.add.text(this.panelWidth / 2, pagerY, `第 ${this.buildCardPage + 1}/${totalPages} 页  ·  ${pagerHint}`, {
      fontSize: fs(11),
      color: '#93c5fd',
      fontFamily: uiFont,
    }).setOrigin(0.5, 0);
    container.add(pagerText);

    if (totalPages > 1) {
      const prevBtn = this.scene.add.text(unit(18), pagerY, '◀ 上一页', {
        fontSize: fs(11),
        color: this.buildCardPage > 0 ? '#0ea5e9' : '#475569',
        fontFamily: uiFont,
        backgroundColor: '#0b1220',
        padding: { x: unit(4), y: unit(2) },
      }).setInteractive({ useHandCursor: this.buildCardPage > 0 });
      if (prevBtn.input) (prevBtn.input as any).priorityID = 5;
      if (this.buildCardPage > 0) {
        prevBtn.on('pointerdown', () => {
          this.buildCardPage -= 1;
          this.rebuild();
        });
      }
      container.add(prevBtn);

      const nextBtn = this.scene.add.text(this.panelWidth - unit(18), pagerY, '下一页 ▶', {
        fontSize: fs(11),
        color: this.buildCardPage < totalPages - 1 ? '#0ea5e9' : '#475569',
        fontFamily: uiFont,
        backgroundColor: '#0b1220',
        padding: { x: unit(4), y: unit(2) },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: this.buildCardPage < totalPages - 1 });
      if (nextBtn.input) (nextBtn.input as any).priorityID = 5;
      if (this.buildCardPage < totalPages - 1) {
        nextBtn.on('pointerdown', () => {
          this.buildCardPage += 1;
          this.rebuild();
        });
      }
      container.add(nextBtn);
    }
  }

  private getBuildingPurposeLine(def: BuildingDef): string {
    const purposeBySpecial: Record<string, string> = {
      auto_fire: '用途: 自动防线火力点',
      laser_fire: '用途: 直线穿透压制',
      slow_aura: '用途: 减速拖延推进',
      missile_fire: '用途: 大范围爆炸清场',
      crafting: '用途: 解锁制造配方',
      housing: '用途: 扩容伙伴住宿',
      rest: '用途: 白天恢复状态',
      watch: '用途: 哨岗预警巡防',
      storage: '用途: 提升资源上限',
      heal_aura: '用途: 医疗恢复区域',
      radar: '用途: 夜晚来袭预警',
      shield_aura: '用途: 提升周边耐久',
      light: '用途: 夜间视野照明',
      mine: '用途: 触发爆炸陷阱',
      damage_aura: '用途: 接触伤害阻滞',
      slow_damage: '用途: 减速+持续伤害',
    };
    if (def.special && purposeBySpecial[def.special]) {
      return purposeBySpecial[def.special];
    }
    const byCategory: Record<string, string> = {
      defense: '用途: 构建防御边界',
      turret: '用途: 自动火力输出',
      production: '用途: 提供日常产出',
      utility: '用途: 支撑基地运营',
      special: '用途: 战术特殊功能',
    };
    return byCategory[def.category] || '用途: 基础建造';
  }

  private getBuildChainLine(chainStatus: BuildChainStatus): string {
    if (!chainStatus.canConstruct) {
      return `链路阻塞: ${(chainStatus.blockedReasons || []).slice(0, 1).join('；') || '需前置建筑'}`;
    }
    return `链路: ${chainStatus.roleCN} · 分区:${chainStatus.zoneLabelCN}`;
  }

  private getBuildingEffectSummary(def: BuildingDef): string {
    const lines: string[] = [];
    if (def.production) {
      const names: Record<string, string> = {
        food: '食物',
        water: '净水',
        ammo: '弹药',
        metal: '金属',
        scrap: '零件',
        medical: '医疗',
      };
      lines.push(`产出: ${names[def.production.resource] || def.production.resource}+${def.production.amount}/日`);
    }
    if (def.powerProvided && def.powerProvided > 0) {
      lines.push(`供电: +${def.powerProvided}`);
    }
    if (def.powerUse && def.powerUse > 0) {
      lines.push(`耗电: -${def.powerUse}`);
    }
    if (def.jobSlots && def.jobSlots > 0) {
      lines.push(`岗位: ${def.jobSlots}`);
    }
    if (def.special) {
      const specialMap: Record<string, string> = {
        damage_aura: '效果: 接触伤害',
        slow_damage: '效果: 减速伤害',
        mine: '效果: 触发爆炸',
        auto_fire: '效果: 自动攻击',
        laser_fire: '效果: 激光穿透',
        slow_aura: '效果: 范围减速',
        missile_fire: '效果: 爆炸导弹',
        heal_aura: '效果: 范围治疗',
        radar: '效果: 预警侦测',
        storage: '效果: 增加仓储',
        crafting: '效果: 解锁制造',
        housing: '效果: 提供住宿',
        rest: '效果: 休息回血',
        watch: '效果: 防线加成',
        teleport: '效果: 快速位移',
        shield_aura: '效果: 护盾覆盖',
        light: '效果: 夜间照明',
      };
      lines.push(specialMap[def.special] || `效果: ${def.special}`);
    }
    if (lines.length === 0) {
      lines.push(def.descriptionCN || '基础建筑');
    }
    return lines.join(' | ');
  }
}

// ============================================================
// QUEST PANEL
// ============================================================
export class QuestPanel extends SlidePanel {
  constructor(scene: Phaser.Scene) {
    super(scene, 380, 'left');
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
    const boost = this.isMobileViewport() ? (portrait ? 1.22 : 1.1) : 1;
    return `${Math.max(min, Math.round(base * boost))}px`;
  }

  show(): void {
    if (this.isOpen) { this.hide(); return; }
    const container = this.createBase();
    const h = this.scene.cameras.main.height;
    const uiFont = this.getUIFontFamily();

    // Title
    container.add(this.scene.add.text(20, 15, '📋 任务日志', {
      fontSize: this.fs(22, 18), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
    }));

    // Close
    const close = this.scene.add.text(this.panelWidth - 15, 15, '✕', {
      fontSize: this.fs(20, 18), color: '#ef4444', fontFamily: uiFont,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.setDepth(1);
    if (close.input) (close.input as any).priorityID = 2;
    close.on('pointerdown', () => this.hide());
    container.add(close);

    // Active quests
    const activeQuests = QuestSystem.getActiveQuests();
    const maxQuests = QuestSystem.getMaxActiveQuests();
    let y = 55;

    container.add(this.scene.add.text(20, y, `进行中任务: ${activeQuests.length}/${maxQuests}`, {
      fontSize: this.fs(13, 11), color: '#94a3b8', fontFamily: uiFont,
    }));
    y += 20;

    if (activeQuests.length === 0) {
      container.add(this.scene.add.text(20, y, '暂无进行中的任务\n与NPC对话接受任务', {
        fontSize: this.fs(14, 12), color: '#64748b', fontFamily: uiFont,
      }));
      y += 50;
    } else {
      activeQuests.forEach(quest => {
        // Quest name
        container.add(this.scene.add.text(20, y, quest.def.nameCN, {
          fontSize: this.fs(16, 13), color: '#ffffff', fontFamily: uiFont, fontStyle: 'bold',
        }));
        y += 22;

        // Objectives
        quest.objectives.forEach(obj => {
          const done = obj.current >= obj.target;
          container.add(this.scene.add.text(30, y,
            `${done ? '✅' : '⬜'} ${obj.obj.descriptionCN} (${obj.current}/${obj.target})`, {
            fontSize: this.fs(13, 11), color: done ? '#4ade80' : '#94a3b8', fontFamily: uiFont,
          }));
          y += 18;
        });
        y += 10;
      });
    }

    // Available quests
    y += 10;
    container.add(this.scene.add.text(20, y, '可接受的任务:', {
      fontSize: this.fs(16, 13), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
    }));
    y += 25;

    const available = QuestSystem.getAvailable().filter(
      q => !gameState.data.activeQuests.some(aq => aq.questId === q.id)
    );

    if (activeQuests.length >= maxQuests) {
      container.add(this.scene.add.text(20, y, `任务已满（最多${maxQuests}个），先完成一个再接新任务`, {
        fontSize: this.fs(12, 11), color: '#ef4444', fontFamily: uiFont,
      }));
      return;
    }

    available.slice(0, 5).forEach(quest => {
      const card = this.scene.add.rectangle(this.panelWidth / 2, y + 20, this.panelWidth - 30, 40, 0x1e293b, 0.8);
      card.setStrokeStyle(1, 0x334155);
      container.add(card);

      container.add(this.scene.add.text(25, y + 8, quest.nameCN, {
        fontSize: this.fs(14, 12), color: '#e2e8f0', fontFamily: uiFont,
      }));

      const acceptBtn = this.scene.add.text(this.panelWidth - 25, y + 12, '接受', {
        fontSize: this.fs(13, 11), color: '#0ea5e9', fontFamily: uiFont, fontStyle: 'bold',
        backgroundColor: '#0c1829', padding: { x: 6, y: 3 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      acceptBtn.on('pointerdown', () => {
        QuestSystem.acceptQuest(quest.id);
        this.hide();
        this.show();
      });
      container.add(acceptBtn);

      y += 48;
      if (y > h - 50) return;
    });
  }
}

// ============================================================
// BASE PANEL  (scrollable companion cards + detailed profile)
// ============================================================

const ROLE_COLORS: Record<string, number> = {
  tank: 0x3b82f6,
  sniper: 0xef4444,
  medic: 0x22c55e,
};
const ROLE_LABELS: Record<string, string> = {
  tank: '坦',
  sniper: '狙',
  medic: '医',
};

export class BasePanel extends SlidePanel {
  private profileCard: Phaser.GameObjects.Container | null = null;
  private scrollContent: Phaser.GameObjects.Container | null = null;
  private scrollZone: Phaser.GameObjects.Rectangle | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private scrollAreaTop = 0;
  private scrollAreaHeight = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private pointerUpHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 440, 'right');
  }

  public refresh(): void {
    if (!this.isOpen) return;
    this.cleanupScroll();
    this.profileCard = null;
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.isOpen = false;
    this.show();
  }

  hide(): void {
    this.cleanupScroll();
    super.hide();
  }

  destroy(): void {
    this.cleanupScroll();
    super.destroy();
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private isPortraitViewport(): boolean {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    return h > w;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private getFontBoost(): number {
    const gameW = this.scene.cameras.main.width || 1;
    const scaleDisplayW = this.scene.scale.displaySize.width || gameW;
    const canvasDisplayW = this.scene.game.canvas?.getBoundingClientRect().width || scaleDisplayW;
    const displayW = Math.max(1, Math.min(scaleDisplayW, canvasDisplayW));
    let boost = gameW / displayW;
    if (this.isMobileViewport() && this.isPortraitViewport()) {
      boost = Math.max(boost, 2.75);
    }
    return Phaser.Math.Clamp(boost, 1.85, 3.8);
  }

  private cleanupScroll(): void {
    if (this.wheelHandler) {
      this.scene.game.canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.pointerMoveHandler) {
      this.scene.input.off('pointermove', this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }
    if (this.pointerUpHandler) {
      this.scene.input.off('pointerup', this.pointerUpHandler);
      this.pointerUpHandler = null;
    }
    this.scrollZone?.destroy();
    this.scrollZone = null;
    this.scrollContent = null;
    this.isDragging = false;
  }

  private getSafeCompanionName(companion: CompanionData): string {
    const name = typeof companion.name === 'string' ? companion.name.trim() : '';
    return name.length > 0 ? name : '未命名伙伴';
  }

  private normalizeProfile(profile: Partial<CompanionProfile> | undefined): CompanionProfile {
    const safeTraits = Array.isArray(profile?.traits)
      ? profile!.traits.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const safeHobbies = Array.isArray(profile?.hobbies)
      ? profile!.hobbies.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    return {
      gender: profile?.gender === '女' ? '女' : '男',
      age: Number.isFinite(profile?.age) ? Phaser.Math.Clamp(Math.floor(profile!.age as number), 16, 90) : 28,
      profession: typeof profile?.profession === 'string' && profile.profession.trim().length > 0
        ? profile.profession
        : '幸存者',
      background: typeof profile?.background === 'string' && profile.background.trim().length > 0
        ? profile.background
        : '在灾变中存活下来，选择加入基地共同求生。',
      personality: typeof profile?.personality === 'string' && profile.personality.trim().length > 0
        ? profile.personality
        : '稳健',
      hobbies: safeHobbies.length > 0 ? safeHobbies : ['整理装备'],
      traits: safeTraits.length > 0 ? safeTraits : ['可靠'],
      signatureSkill: typeof profile?.signatureSkill === 'string' && profile.signatureSkill.trim().length > 0
        ? profile.signatureSkill
        : '战术支援',
      chatterSeed: Number.isFinite(profile?.chatterSeed) ? Number(profile!.chatterSeed) : 10007,
    };
  }

  private ensureRenderableProfile(companion: CompanionData): CompanionProfile {
    const rawProfile = CompanionPersonalitySystem.ensureProfile(companion);
    const normalized = this.normalizeProfile(rawProfile);
    companion.profile = normalized;
    return normalized;
  }

  show(): void {
    if (this.isOpen) { this.hide(); return; }
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const mobileViewport = this.isMobileViewport();
    const mobilePortrait = mobileViewport && this.isPortraitViewport();
    const uiFont = this.getUIFontFamily();
    this.panelWidth = mobileViewport
      ? Math.min(w - 6, Math.max(600, Math.round(w * 0.98)))
      : Math.min(760, Math.max(620, Math.round(w * 0.52)));
    const fontBoost = this.getFontBoost();
    const layoutBoost = Phaser.Math.Clamp(fontBoost * 0.92, 1.15, 2.1);
    const fs = (base: number, min: number = mobilePortrait ? 23 : 19) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const fsMeta = (base: number, min: number = mobilePortrait ? 20 : 16) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const fsTiny = (base: number, min: number = mobilePortrait ? 18 : 14) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const unit = (value: number) => Math.round(value * layoutBoost);

    BaseSystem.refreshBaseState();
    if (gameState.data.autoBuild.autoAssignDuties) {
      BaseSystem.autoAssignBaseCompanions();
      BaseSystem.refreshBaseState();
    }
    const container = this.createBase();

    // ─── Title ─────────────────────────────────────────────
    container.add(this.scene.add.text(unit(20), unit(12), '🏠 基地管理', {
      fontSize: fs(22), color: '#38bdf8', fontFamily: uiFont, fontStyle: 'bold',
    }));

    // Close button
    const close = this.scene.add.text(this.panelWidth - unit(15), unit(12), '✕', {
      fontSize: fs(18), color: '#ef4444', fontFamily: uiFont,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.setDepth(2);
    if (close.input) (close.input as any).priorityID = 4;
    close.on('pointerdown', () => this.hide());
    container.add(close);
    const closeHit = this.scene.add.rectangle(this.panelWidth - unit(8), unit(24), unit(56), unit(40), 0xffffff, 0.001)
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeHit.setDepth(3);
    if (closeHit.input) (closeHit.input as any).priorityID = 5;
    closeHit.on('pointerdown', () => this.hide());
    container.add(closeHit);

    // ─── Summary ───────────────────────────────────────────
    const base = gameState.data.base;
    const res = gameState.data.resources;
    const companions = gameState.data.companions;
    const autoBuild = gameState.data.autoBuild;
    const compCount = companions.length;
    const popCap = BaseSystem.getPopulationCapacity();
    const partyCount = companions.filter(c => c.status === 'party').length;
    const baseCount = compCount - partyCount;

    let sy = unit(38);
    const foodColor = base.foodDeficit > 0 ? '#ef4444' : '#e2e8f0';
    container.add(this.scene.add.text(unit(16), sy,
      `🍖 ${res.food}(+${base.foodProduction}/-${base.foodConsumption}/日)  ⚡ ${base.powerUsed}/${base.powerCapacity}`, {
      fontSize: fsMeta(13), color: foodColor, fontFamily: uiFont,
    }));
    sy += unit(18);
    const popColor = compCount >= popCap ? '#ef4444' : '#94a3b8';
    container.add(this.scene.add.text(unit(16), sy,
      `👥 ${compCount}/${popCap}人  出战${partyCount} · 驻守${baseCount}`, {
      fontSize: fsMeta(13), color: popColor, fontFamily: uiFont,
    }));
    sy += unit(18);
    const ecoPct = Math.round((base.ecologyIntegrity || 0) * 100);
    const upkeepPct = Math.round((base.ecologyUpkeepRatio || 0) * 100);
    const prodPct = Math.round((base.ecologyProductionRatio || 0) * 100);
    const ecoColor = ecoPct >= 80 ? '#4ade80' : ecoPct >= 60 ? '#fbbf24' : '#fb7185';
    container.add(this.scene.add.text(unit(16), sy,
      `生态链${ecoPct}% · 维护${upkeepPct}% · 产能${prodPct}% · 评分${base.ecologyTotalScore || 0}`, {
      fontSize: fsMeta(13), color: ecoColor, fontFamily: uiFont,
    }));
    if ((base.ecologyWarnings || []).length > 0) {
      sy += unit(16);
      container.add(this.scene.add.text(unit(16), sy, `⚠ ${(base.ecologyWarnings || []).slice(0, 1).join('')}`, {
        fontSize: fsMeta(12), color: '#fca5a5', fontFamily: uiFont,
        wordWrap: { width: this.panelWidth - unit(180) },
      }));
    }
    sy += unit(16);
    const defensePct = Math.round((base.structureIntegrity || 0) * 100);
    const coveragePct = Math.round((base.structureCoverage || 0) * 100);
    const defenseColor = base.structureBreachOpen ? '#fb7185' : defensePct >= 80 ? '#4ade80' : '#fbbf24';
    container.add(this.scene.add.text(
      unit(16),
      sy,
      `防线闭环${coveragePct}% · 完整度${defensePct}%${base.structureBreachOpen ? ' · 破口打开' : ''}`,
      {
        fontSize: fsMeta(13),
        color: defenseColor,
        fontFamily: uiFont,
      }
    ));
    sy += unit(18);
    const dutyCounts = BaseSystem.getBaseDutyCounts();
    const dutyPanelH = unit(mobilePortrait ? 76 : 64);
    const dutyPanel = this.scene.add.rectangle(
      this.panelWidth / 2,
      sy + dutyPanelH / 2 - unit(5),
      this.panelWidth - unit(24),
      dutyPanelH,
      0x0c1628,
      0.85
    ).setStrokeStyle(1, 0x1f3a5f, 0.9);
    container.add(dutyPanel);
    container.add(this.scene.add.text(
      unit(16),
      sy,
      `自动分工: 建筑工${dutyCounts.builder} / 拾荒者${dutyCounts.scavenger} / 防御者${dutyCounts.defender} / 后勤${dutyCounts.support}`,
      {
        fontSize: fsMeta(13),
        color: '#67e8f9',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }
    ));
    sy += unit(18);
    const dutyBehaviors = BaseSystem.getAutoDutyBehaviorSummary();
    dutyBehaviors.slice(0, 2).forEach((line) => {
      container.add(this.scene.add.text(unit(16), sy, line, {
        fontSize: fsTiny(11),
        color: '#93c5fd',
        fontFamily: uiFont,
      }));
      sy += unit(15);
    });
    container.add(this.scene.add.text(unit(16), sy, '自动派职开启后：空闲伙伴会自动分配职责并参与基地作业', {
      fontSize: fsTiny(11),
      color: '#a5f3fc',
      fontFamily: uiFont,
    }));
    sy += unit(14);
    container.add(this.scene.add.text(unit(16), sy, '金来源：河流淘金 / 山洞挖矿 / 城区搜刮 / 夜战掉落', {
      fontSize: fsTiny(11),
      color: '#fbbf24',
      fontFamily: uiFont,
    }));
    sy += unit(5);

    // ─── Action buttons ────────────────────────────────────
    const btnY = sy + unit(2);
    const assignBtn = this.scene.add.text(this.panelWidth - unit(14), btnY, '分配岗位', {
      fontSize: fsMeta(11), color: '#38bdf8', fontFamily: uiFont, fontStyle: 'bold',
      backgroundColor: '#0f1d32', padding: { x: unit(6), y: unit(3) },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    if (assignBtn.input) (assignBtn.input as any).priorityID = 3;
    assignBtn.on('pointerdown', () => {
      const assignedResult = BaseSystem.autoAssignBaseCompanions();
      events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
      events.emit('update-resources', gameState.data.resources);
      this.scene.time.delayedCall(20, () => {
        const tip = this.scene.add.text(this.scene.cameras.main.width - this.panelWidth + unit(16), unit(170), assignedResult.message, {
          fontSize: fs(11),
          color: '#67e8f9',
          fontFamily: uiFont,
          backgroundColor: '#0b1220',
          padding: { x: unit(6), y: unit(3) },
        }).setDepth(3000);
        this.scene.tweens.add({
          targets: tip,
          alpha: 0,
          y: tip.y - 14,
          duration: 680,
          onComplete: () => tip.destroy(),
        });
      });
      this.refresh();
    });
    container.add(assignBtn);

    const garrisonBtn = this.scene.add.text(this.panelWidth - unit(14), btnY + unit(24), '一键驻守', {
      fontSize: fsMeta(11), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
      backgroundColor: '#0f1d32', padding: { x: unit(6), y: unit(3) },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    if (garrisonBtn.input) (garrisonBtn.input as any).priorityID = 3;
    garrisonBtn.on('pointerdown', () => {
      events.emit('companion-bulk-status-changed', { status: 'base' as const });
      events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
      this.refresh();
    });
    container.add(garrisonBtn);

    const dutyAutoBtn = this.scene.add.text(
      this.panelWidth - unit(14),
      btnY + unit(48),
      autoBuild.autoAssignDuties ? '自动派职: 开' : '自动派职: 关',
      {
        fontSize: fsMeta(11),
        color: autoBuild.autoAssignDuties ? '#4ade80' : '#94a3b8',
        fontFamily: uiFont,
        fontStyle: 'bold',
        backgroundColor: '#0f1d32',
        padding: { x: unit(6), y: unit(3) },
      }
    ).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    if (dutyAutoBtn.input) (dutyAutoBtn.input as any).priorityID = 3;
    dutyAutoBtn.on('pointerdown', () => {
      gameState.data.autoBuild.autoAssignDuties = !gameState.data.autoBuild.autoAssignDuties;
      if (gameState.data.autoBuild.autoAssignDuties) {
        gameState.data.autoBuild.enabled = true;
        gameState.data.autoBuild.autoAssignBuilders = true;
        const assignedResult = BaseSystem.autoAssignBaseCompanions();
        events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
        events.emit('update-resources', gameState.data.resources);
        events.emit('base-autobuild-updated', {
          enabled: gameState.data.autoBuild.enabled,
          ruleCount: gameState.data.autoBuild.rules.filter((rule) => rule.enabled && rule.targetCount > 0).length,
          builders: Math.max(0, Math.floor(gameState.data.autoBuild.desiredBuilderCount || 0)),
        });
        this.scene.time.delayedCall(20, () => {
          const tip = this.scene.add.text(this.scene.cameras.main.width - this.panelWidth + unit(16), unit(170), assignedResult.message, {
            fontSize: fs(11),
            color: '#67e8f9',
            fontFamily: uiFont,
            backgroundColor: '#0b1220',
            padding: { x: unit(6), y: unit(3) },
          }).setDepth(3000);
          this.scene.tweens.add({
            targets: tip,
            alpha: 0,
            y: tip.y - 14,
            duration: 680,
            onComplete: () => tip.destroy(),
          });
        });
      }
      this.refresh();
    });
    container.add(dutyAutoBtn);

    // ─── Job slot summary bar ──────────────────────────────
    sy += unit(18);
    const slotParts: string[] = [];
    BASE_JOB_ORDER.forEach(job => {
      if (job === 'idle') return;
      const slots = base.jobSlots[job] || 0;
      if (slots <= 0) return;
      const used = base.jobAssigned[job] || 0;
      slotParts.push(`${BASE_JOB_LABELS[job]}${used}/${slots}`);
    });
    if (slotParts.length > 0) {
      container.add(this.scene.add.text(unit(16), sy, slotParts.join(' · '), {
        fontSize: fsMeta(11), color: '#64748b', fontFamily: uiFont,
      }));
      sy += unit(16);
    }

    const constructionTasks = (gameState.data.constructionTasks || []).filter(
      (task) => task && task.status !== 'done' && task.status !== 'failed'
    );
    const commitAutoBuildConfig = (tip?: string) => {
      events.emit('base-autobuild-updated', {
        enabled: gameState.data.autoBuild.enabled,
        ruleCount: gameState.data.autoBuild.rules.filter((rule) => rule.enabled && rule.targetCount > 0).length,
        builders: Math.max(0, Math.floor(gameState.data.autoBuild.desiredBuilderCount || 0)),
      });
      if (tip) {
        this.scene.time.delayedCall(20, () => {
          const posX = this.scene.cameras.main.width - this.panelWidth + unit(160);
          const posY = unit(170);
          const text = this.scene.add.text(posX, posY, tip, {
            fontSize: fs(10),
            color: '#38bdf8',
            fontFamily: uiFont,
            backgroundColor: '#0b1220',
            padding: { x: unit(6), y: unit(3) },
          }).setDepth(3000);
          this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: posY - 16,
            duration: 520,
            onComplete: () => text.destroy(),
          });
        });
      }
      this.refresh();
    };

    sy += unit(6);
    container.add(this.scene.add.text(unit(16), sy, '自动建造策略', {
      fontSize: fs(12), color: '#67e8f9', fontFamily: uiFont, fontStyle: 'bold',
    }));
    const activeTasks = constructionTasks.filter((task) => task.status === 'active').length;
    const queueTasks = Math.max(0, constructionTasks.length - activeTasks);
    container.add(this.scene.add.text(unit(136), sy + unit(1), `施工 ${activeTasks}/${autoBuild.maxConcurrent}  队列${queueTasks}`, {
      fontSize: fsMeta(11), color: '#94a3b8', fontFamily: uiFont,
    }));
    sy += unit(17);
    container.add(this.scene.add.text(unit(16), sy, `工坊岗位 ${base.jobAssigned.workshop || 0}/${base.jobSlots.workshop || 0} · 施工目标 ${autoBuild.desiredBuilderCount}`, {
      fontSize: fsMeta(11), color: '#64748b', fontFamily: uiFont,
    }));
    sy += unit(13);

    const autoMainBtn = this.scene.add.text(unit(16), sy, autoBuild.enabled ? '自动建造: 开' : '自动建造: 关', {
      fontSize: fsTiny(10),
      color: autoBuild.enabled ? '#4ade80' : '#94a3b8',
      fontFamily: uiFont,
      backgroundColor: '#0b1a2f',
      padding: { x: unit(6), y: unit(3) },
    }).setInteractive({ useHandCursor: true });
    if (autoMainBtn.input) (autoMainBtn.input as any).priorityID = 3;
    autoMainBtn.on('pointerdown', () => {
      gameState.data.autoBuild.enabled = !gameState.data.autoBuild.enabled;
      commitAutoBuildConfig(gameState.data.autoBuild.enabled ? '自动建造已开启' : '自动建造已关闭');
    });
    container.add(autoMainBtn);

    const nightBtn = this.scene.add.text(unit(120), sy, autoBuild.pauseAtNight ? '夜晚暂停' : '夜晚施工', {
      fontSize: fsTiny(10),
      color: autoBuild.pauseAtNight ? '#fbbf24' : '#38bdf8',
      fontFamily: uiFont,
      backgroundColor: '#0b1a2f',
      padding: { x: unit(6), y: unit(3) },
    }).setInteractive({ useHandCursor: true });
    if (nightBtn.input) (nightBtn.input as any).priorityID = 3;
    nightBtn.on('pointerdown', () => {
      gameState.data.autoBuild.pauseAtNight = !gameState.data.autoBuild.pauseAtNight;
      commitAutoBuildConfig(gameState.data.autoBuild.pauseAtNight ? '夜晚自动施工已暂停' : '夜晚自动施工已启用');
    });
    container.add(nightBtn);

    const minusConcurrent = this.scene.add.text(unit(206), sy, '－', {
      fontSize: fsMeta(11), color: '#94a3b8', fontFamily: uiFont,
      backgroundColor: '#10223d', padding: { x: unit(6), y: unit(3) },
    }).setInteractive({ useHandCursor: true });
    const plusConcurrent = this.scene.add.text(unit(236), sy, '＋', {
      fontSize: fsMeta(11), color: '#94a3b8', fontFamily: uiFont,
      backgroundColor: '#10223d', padding: { x: unit(6), y: unit(3) },
    }).setInteractive({ useHandCursor: true });
    if (minusConcurrent.input) (minusConcurrent.input as any).priorityID = 3;
    if (plusConcurrent.input) (plusConcurrent.input as any).priorityID = 3;
    minusConcurrent.on('pointerdown', () => {
      gameState.data.autoBuild.maxConcurrent = Math.max(1, gameState.data.autoBuild.maxConcurrent - 1);
      commitAutoBuildConfig(`并发施工 ${gameState.data.autoBuild.maxConcurrent}`);
    });
    plusConcurrent.on('pointerdown', () => {
      gameState.data.autoBuild.maxConcurrent = Math.min(4, gameState.data.autoBuild.maxConcurrent + 1);
      commitAutoBuildConfig(`并发施工 ${gameState.data.autoBuild.maxConcurrent}`);
    });
    container.add(minusConcurrent);
    container.add(plusConcurrent);
    sy += unit(20);

    const queueLabel = this.scene.add.text(unit(16), sy, `队列上限 ${autoBuild.queueCap}`, {
      fontSize: fsMeta(11), color: '#94a3b8', fontFamily: uiFont,
    });
    container.add(queueLabel);
    const queueMinus = this.scene.add.text(unit(84), sy - unit(1), '－', {
      fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
    }).setInteractive({ useHandCursor: true });
    const queuePlus = this.scene.add.text(unit(102), sy - unit(1), '＋', {
      fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
    }).setInteractive({ useHandCursor: true });
    if (queueMinus.input) (queueMinus.input as any).priorityID = 3;
    if (queuePlus.input) (queuePlus.input as any).priorityID = 3;
    queueMinus.on('pointerdown', () => {
      gameState.data.autoBuild.queueCap = Math.max(2, gameState.data.autoBuild.queueCap - 1);
      commitAutoBuildConfig(`施工队列上限 ${gameState.data.autoBuild.queueCap}`);
    });
    queuePlus.on('pointerdown', () => {
      gameState.data.autoBuild.queueCap = Math.min(24, gameState.data.autoBuild.queueCap + 1);
      commitAutoBuildConfig(`施工队列上限 ${gameState.data.autoBuild.queueCap}`);
    });
    container.add(queueMinus);
    container.add(queuePlus);

    const assignCrewBtn = this.scene.add.text(unit(136), sy, autoBuild.autoAssignBuilders ? '自动派工' : '手动派工', {
      fontSize: fsTiny(10),
      color: autoBuild.autoAssignBuilders ? '#4ade80' : '#94a3b8',
      fontFamily: uiFont,
      backgroundColor: '#0b1a2f',
      padding: { x: unit(5), y: unit(2) },
    }).setInteractive({ useHandCursor: true });
    if (assignCrewBtn.input) (assignCrewBtn.input as any).priorityID = 3;
    assignCrewBtn.on('pointerdown', () => {
      gameState.data.autoBuild.autoAssignBuilders = !gameState.data.autoBuild.autoAssignBuilders;
      commitAutoBuildConfig(gameState.data.autoBuild.autoAssignBuilders ? '施工自动派工已开启' : '施工自动派工已关闭');
    });
    container.add(assignCrewBtn);
    sy += unit(16);

    const crewModeBtn = this.scene.add.text(unit(16), sy, autoBuild.crewMode === 'workshop_only' ? '施工来源: 工坊专职' : '施工来源: 工坊+空闲', {
      fontSize: fsTiny(10),
      color: '#67e8f9',
      fontFamily: uiFont,
      backgroundColor: '#0b1a2f',
      padding: { x: unit(5), y: unit(2) },
    }).setInteractive({ useHandCursor: true });
    if (crewModeBtn.input) (crewModeBtn.input as any).priorityID = 3;
    crewModeBtn.on('pointerdown', () => {
      gameState.data.autoBuild.crewMode = gameState.data.autoBuild.crewMode === 'workshop_only' ? 'workshop_idle' : 'workshop_only';
      commitAutoBuildConfig(gameState.data.autoBuild.crewMode === 'workshop_only' ? '施工仅工坊岗位参与' : '施工允许空闲伙伴参与');
    });
    container.add(crewModeBtn);
    const desiredCrewText = this.scene.add.text(unit(156), sy, `目标施工 ${autoBuild.desiredBuilderCount}`, {
      fontSize: fsMeta(11), color: '#cbd5e1', fontFamily: uiFont,
    });
    container.add(desiredCrewText);
    const crewMinus = this.scene.add.text(unit(224), sy - unit(1), '－', {
      fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
    }).setInteractive({ useHandCursor: true });
    const crewPlus = this.scene.add.text(unit(240), sy - unit(1), '＋', {
      fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
    }).setInteractive({ useHandCursor: true });
    if (crewMinus.input) (crewMinus.input as any).priorityID = 3;
    if (crewPlus.input) (crewPlus.input as any).priorityID = 3;
    crewMinus.on('pointerdown', () => {
      gameState.data.autoBuild.desiredBuilderCount = Math.max(0, gameState.data.autoBuild.desiredBuilderCount - 1);
      commitAutoBuildConfig(`施工岗位目标 ${gameState.data.autoBuild.desiredBuilderCount}`);
    });
    crewPlus.on('pointerdown', () => {
      gameState.data.autoBuild.desiredBuilderCount = Math.min(12, gameState.data.autoBuild.desiredBuilderCount + 1);
      commitAutoBuildConfig(`施工岗位目标 ${gameState.data.autoBuild.desiredBuilderCount}`);
    });
    container.add(crewMinus);
    container.add(crewPlus);
    sy += unit(20);

    const focusRuleIds = ['wall', 'turret', 'generator', 'farm', 'storage', 'medical_station', 'room_quarters'];
    const displayedRules = autoBuild.rules
      .filter((rule) => focusRuleIds.includes(rule.buildingId))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, mobilePortrait ? 4 : 6);
    displayedRules.forEach((rule) => {
      const ruleBuilding = BUILDING_DEFS[rule.buildingId];
      if (!ruleBuilding) return;
      const currentCount = gameState.data.buildings.filter((b) => b.id === rule.buildingId).length;
      const pendingCount = constructionTasks.filter((task) => task.buildingId === rule.buildingId).length;
      const rowY = sy;
        const enabledFlag = rule.enabled ? '✓' : '□';
        const rowColor = rule.enabled ? '#38bdf8' : '#64748b';
        const toggleBtn = this.scene.add.text(unit(16), rowY, enabledFlag, {
        fontSize: fsMeta(11), color: rowColor, fontFamily: uiFont,
      }).setInteractive({ useHandCursor: true });
      if (toggleBtn.input) (toggleBtn.input as any).priorityID = 3;
      toggleBtn.on('pointerdown', () => {
        rule.enabled = !rule.enabled;
        commitAutoBuildConfig(`${ruleBuilding.nameCN}${rule.enabled ? '启用' : '停用'}自动建造`);
      });
      container.add(toggleBtn);

      container.add(this.scene.add.text(unit(30), rowY, `${ruleBuilding.nameCN} ${currentCount}/${rule.targetCount}`, {
        fontSize: fsMeta(11), color: rowColor, fontFamily: uiFont,
      }));
      if (pendingCount > 0) {
        container.add(this.scene.add.text(unit(128), rowY, `在建${pendingCount}`, {
          fontSize: fsTiny(10), color: '#fbbf24', fontFamily: uiFont,
        }));
      }
      container.add(this.scene.add.text(unit(164), rowY, `T${rule.maxTier}`, {
        fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
      }));

      const minusBtn = this.scene.add.text(unit(188), rowY - unit(1), '－', {
        fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
      }).setInteractive({ useHandCursor: true });
      const plusBtn = this.scene.add.text(unit(204), rowY - unit(1), '＋', {
        fontSize: fsTiny(10), color: '#94a3b8', fontFamily: uiFont,
      }).setInteractive({ useHandCursor: true });
      if (minusBtn.input) (minusBtn.input as any).priorityID = 3;
      if (plusBtn.input) (plusBtn.input as any).priorityID = 3;
      minusBtn.on('pointerdown', () => {
        rule.targetCount = Math.max(0, rule.targetCount - 1);
        commitAutoBuildConfig(`${ruleBuilding.nameCN}目标 ${rule.targetCount}`);
      });
      plusBtn.on('pointerdown', () => {
        rule.targetCount = Math.min(40, rule.targetCount + 1);
        commitAutoBuildConfig(`${ruleBuilding.nameCN}目标 ${rule.targetCount}`);
      });
      container.add(minusBtn);
      container.add(plusBtn);
      sy += unit(14);
    });

    sy += unit(3);
    container.add(this.scene.add.text(unit(16), sy, '施工队列', {
      fontSize: fsTiny(10),
      color: '#67e8f9',
      fontFamily: uiFont,
    }));
    sy += unit(12);
    const taskPreviewList = [...constructionTasks]
      .sort((a, b) => {
        if (a.status === b.status) return (a.queuedAt || 0) - (b.queuedAt || 0);
        return a.status === 'active' ? -1 : 1;
      })
      .slice(0, mobilePortrait ? 2 : 3);
    if (taskPreviewList.length <= 0) {
      container.add(this.scene.add.text(unit(16), sy, '暂无施工任务', {
        fontSize: fsTiny(9),
        color: '#64748b',
        fontFamily: uiFont,
      }));
      sy += unit(12);
    } else {
      taskPreviewList.forEach((task) => {
        const buildingName = BUILDING_DEFS[task.buildingId]?.nameCN || task.buildingId;
        const remainMs = Math.max(0, Number(task.durationMs || 0) - Number(task.progressMs || 0));
        const remainSec = Math.ceil(remainMs / 1000);
        const statusLabel = task.status === 'active' ? '施工中' : '排队中';
        const statusColor = task.status === 'active' ? '#4ade80' : '#94a3b8';
        container.add(this.scene.add.text(unit(16), sy, `${buildingName} · ${statusLabel}`, {
          fontSize: fsTiny(9),
          color: statusColor,
          fontFamily: uiFont,
        }));
        container.add(this.scene.add.text(unit(156), sy, `剩余${remainSec}s`, {
          fontSize: fsTiny(9),
          color: '#cbd5e1',
          fontFamily: uiFont,
        }));
        sy += unit(11);
      });
    }

    sy += unit(2);
    container.add(this.scene.add.rectangle(this.panelWidth / 2, sy, this.panelWidth - unit(24), 1, 0x1e3a5f, 0.8));
    sy += unit(6);

    container.add(this.scene.add.text(unit(16), sy, `伙伴名单 (${compCount})`, {
      fontSize: fs(13), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
    }));
    sy += unit(22);

    // ─── Scrollable companion list ─────────────────────────
    this.scrollAreaTop = sy;
    this.scrollAreaHeight = Math.max(unit(120), h - sy - unit(10));
    this.scrollY = 0;
    this.maxScrollY = 0;

    if (companions.length === 0) {
      container.add(this.scene.add.text(unit(20), sy + unit(10), '暂无伙伴\n夜晚击退敌人有机会招募', {
        fontSize: fs(12), color: '#64748b', fontFamily: uiFont, lineSpacing: unit(4),
      }));
      return;
    }

    const viewportBg = this.scene.add.rectangle(
      this.panelWidth / 2,
      this.scrollAreaTop + this.scrollAreaHeight / 2,
      this.panelWidth - 14,
      this.scrollAreaHeight,
      0x0b1220,
      0.35
    ).setStrokeStyle(1, 0x1e293b, 0.9);
    container.add(viewportBg);

    const scrollZone = this.scene.add.rectangle(
      this.panelWidth / 2,
      this.scrollAreaTop + this.scrollAreaHeight / 2,
      this.panelWidth - 14,
      this.scrollAreaHeight,
      0xffffff,
      0.001
    ).setInteractive({ useHandCursor: false });
    if (scrollZone.input) (scrollZone.input as any).priorityID = 0;
    container.add(scrollZone);
    this.scrollZone = scrollZone;

    const scrollCont = this.scene.add.container(0, this.scrollAreaTop);
    container.add(scrollCont);
    this.scrollContent = scrollCont;

    const CARD_H = mobilePortrait ? unit(220) : unit(176);
    const CARD_GAP = unit(10);
    const CARD_W = this.panelWidth - unit(26);
    const rows: Phaser.GameObjects.Container[] = [];
    let cy = 0;

    companions.forEach((c) => {
      const companionName = this.getSafeCompanionName(c);
      const profile = this.ensureRenderableProfile(c);
      const roleColor = ROLE_COLORS[c.role] || 0x6366f1;
      const roleLabel = ROLE_LABELS[c.role] || '?';
      const row = this.scene.add.container(0, cy);
      scrollCont.add(row);
      rows.push(row);

      const cardBg = this.scene.add.rectangle(this.panelWidth / 2, CARD_H / 2, CARD_W, CARD_H, 0x111827, 0.9);
      cardBg.setStrokeStyle(1, c.status === 'party' ? 0x0ea5e9 : 0x334155, 0.95);
      cardBg.setInteractive({ useHandCursor: true });
      if (cardBg.input) (cardBg.input as any).priorityID = 2;
      cardBg.on('pointerdown', () => this.showProfileCard(c, companions));
      row.add(cardBg);

      const avatarX = unit(36);
      const avatarY = CARD_H / 2 - 2;
      const avatarR = mobilePortrait ? unit(27) : unit(24);
      const avatarCircle = this.scene.add.graphics();
      avatarCircle.fillStyle(roleColor, 0.25);
      avatarCircle.fillCircle(avatarX, avatarY, avatarR);
      avatarCircle.lineStyle(2, roleColor, 0.8);
      avatarCircle.strokeCircle(avatarX, avatarY, avatarR);
      row.add(avatarCircle);

      row.add(this.scene.add.text(avatarX, avatarY - (mobilePortrait ? unit(14) : 8), roleLabel, {
        fontSize: fs(mobilePortrait ? 19 : 16), color: '#ffffff', fontFamily: uiFont, fontStyle: 'bold',
      }).setOrigin(0.5, 0));
      row.add(this.scene.add.text(avatarX, avatarY + avatarR + unit(4), `Lv.${c.level}`, {
        fontSize: fs(mobilePortrait ? 11 : 10), color: '#fbbf24', fontFamily: uiFont,
        backgroundColor: '#1a1a2e', padding: { x: unit(3), y: unit(1) },
      }).setOrigin(0.5, 0));

      const infoX = mobilePortrait ? unit(78) : unit(72);
      const genderIcon = profile.gender === '女' ? '♀' : '♂';
      const genderColor = profile.gender === '女' ? '#f472b6' : '#60a5fa';
      row.add(this.scene.add.text(infoX, unit(8), companionName, {
        fontSize: fs(mobilePortrait ? 20 : 17), color: '#f1f5f9', fontFamily: uiFont, fontStyle: 'bold',
      }));

      const classTag = c.advancedClass ? ` · ${c.advancedClass}` : '';
      row.add(this.scene.add.text(infoX, unit(31), `${profile.profession}${classTag}`, {
        fontSize: fs(mobilePortrait ? 13 : 12), color: '#94a3b8', fontFamily: uiFont,
      }));

      const barX = infoX;
      const barY = mobilePortrait ? unit(57) : unit(48);
      const barW = mobilePortrait ? unit(124) : unit(138);
      const barH = unit(7);
      const lvProgress = Math.min(1, c.level / 40);
      row.add(this.scene.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x1e293b, 1));
      if (lvProgress > 0) {
        const fillW = barW * lvProgress;
        row.add(this.scene.add.rectangle(barX + fillW / 2, barY + barH / 2, fillW, barH, roleColor, 0.7));
      }
      row.add(this.scene.add.text(barX + barW + unit(4), barY - unit(2), `${c.level}/40`, {
        fontSize: fs(mobilePortrait ? 11 : 10), color: '#94a3b8', fontFamily: uiFont,
      }));

      const tagY = mobilePortrait ? unit(76) : unit(64);
      const tags = [profile.personality, ...(profile.traits || []).slice(0, 2)]
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      if (tags.length <= 0) tags.push('可靠');
      let tagX = infoX;
      tags.slice(0, mobilePortrait ? 2 : 3).forEach(t => {
        const width = t.length * unit(10) + unit(12);
        if (tagX + width > this.panelWidth - (mobilePortrait ? unit(160) : unit(130))) return;
        const tagBg = this.scene.add.rectangle(tagX + width / 2, tagY + 7, width, 16, 0x1e3a5f, 0.7);
        tagBg.setStrokeStyle(1, 0x334155);
        row.add(tagBg);
        row.add(this.scene.add.text(tagX + 6, tagY + 1, t, {
          fontSize: fs(mobilePortrait ? 11 : 10), color: '#a5b4fc', fontFamily: uiFont,
        }));
        tagX += width + unit(6);
      });

      if (c.status === 'base') {
        const recJob = BaseSystem.recommendJobForCompanion(c);
        const duty = c.autoDuty || BaseSystem.getCompanionAutoDuty(c);
        const dutyLabel = BaseSystem.getCompanionAutoDutyLabel(duty);
        const jobLineY = mobilePortrait ? unit(118) : unit(94);
        row.add(this.scene.add.text(infoX, jobLineY, `岗位: ${BASE_JOB_LABELS[c.job]}  推荐: ${BASE_JOB_LABELS[recJob]}`, {
          fontSize: fs(mobilePortrait ? 12 : 11), color: '#4ade80', fontFamily: uiFont,
        }));
        row.add(this.scene.add.text(infoX, jobLineY + unit(12), `职责: ${dutyLabel}`, {
          fontSize: fs(mobilePortrait ? 12 : 11), color: '#67e8f9', fontFamily: uiFont,
        }));
      } else {
        row.add(this.scene.add.text(infoX, mobilePortrait ? unit(118) : unit(94), `签名: ${profile.signatureSkill}${c.advancedClass ? ` · ${c.advancedClass}` : ''}`, {
          fontSize: fs(mobilePortrait ? 12 : 11), color: '#93c5fd', fontFamily: uiFont,
        }));
      }
      const combatSummary = BaseSystem.getCompanionCombatSummary(c)
        .replace('战斗: ', '')
        .replace('伤害', '攻')
        .replace('生命', '血')
        .replace('射程', '程')
        .replace('频率', '速');
      row.add(this.scene.add.text(infoX, mobilePortrait ? unit(142) : unit(122), combatSummary, {
        fontSize: fs(mobilePortrait ? 12 : 10), color: '#67e8f9', fontFamily: uiFont,
      }));

      const btnX = this.panelWidth - (mobilePortrait ? unit(20) : unit(18));
      const statusColor = c.status === 'party' ? '#0ea5e9' : '#eab308';
      const statusBgColor = c.status === 'party' ? '#0c2d48' : '#2d2506';
      const statusLabel = c.status === 'party' ? '⚔ 出战' : '🏠 驻守';
      const statusBtn = this.scene.add.text(btnX, mobilePortrait ? unit(14) : 12, statusLabel, {
        fontSize: fs(mobilePortrait ? 13 : 12), color: statusColor, fontFamily: uiFont, fontStyle: 'bold',
        backgroundColor: statusBgColor, padding: { x: unit(6), y: unit(mobilePortrait ? 4 : 3) },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      if (statusBtn.input) (statusBtn.input as any).priorityID = 4;
      statusBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        const next = c.status === 'party' ? 'base' : 'party';
        events.emit('companion-status-changed', { id: c.id, status: next });
        this.refresh();
      });
      row.add(statusBtn);

      if (c.status === 'base') {
        const jobBtn = this.scene.add.text(btnX, mobilePortrait ? unit(44) : 36, `📋 ${BASE_JOB_LABELS[c.job]}`, {
          fontSize: fs(mobilePortrait ? 12 : 11), color: '#a78bfa', fontFamily: uiFont,
          backgroundColor: '#1a1a2e', padding: { x: unit(5), y: unit(mobilePortrait ? 3 : 2) },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        if (jobBtn.input) (jobBtn.input as any).priorityID = 4;
        jobBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          const available = BaseSystem.getAvailableJobs();
          let idx = available.indexOf(c.job);
          if (idx === -1) idx = 0;
          let next = c.job;
          let guard = 0;
          do {
            idx = (idx + 1) % available.length;
            next = available[idx];
            guard++;
          } while (guard < available.length && next !== 'idle' && !BaseSystem.canAssignJob(next));
          if (next !== 'idle' && !BaseSystem.canAssignJob(next)) next = 'idle';
          events.emit('companion-job-changed', { id: c.id, job: next });
          this.refresh();
        });
        row.add(jobBtn);
      }

      row.add(this.scene.add.text(
        btnX - unit(2),
        mobilePortrait ? unit(76) : 11,
          `${genderIcon}${profile.age}`,
          {
            fontSize: fs(mobilePortrait ? 12 : 11),
            color: genderColor,
            fontFamily: uiFont,
            backgroundColor: '#1a1a2e',
          padding: { x: unit(4), y: unit(2) },
        }
      ).setOrigin(1, 0));

      const arrow = this.scene.add.text(btnX, CARD_H - unit(22), '▸ 详情', {
        fontSize: fs(mobilePortrait ? 12 : 11), color: '#94a3b8', fontFamily: uiFont,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      if (arrow.input) (arrow.input as any).priorityID = 4;
      arrow.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.showProfileCard(c, companions);
      });
      row.add(arrow);

      cy += CARD_H + CARD_GAP;
    });

    const totalContentH = cy;
    this.maxScrollY = Math.max(0, totalContentH - this.scrollAreaHeight);
    (scrollCont as any)._rows = rows;
    (scrollCont as any)._cardHeight = CARD_H;

    this.wheelHandler = (event: WheelEvent) => {
      if (!this.isOpen || !this.container || this.maxScrollY <= 0) return;
      const rect = this.scene.game.canvas.getBoundingClientRect();
      const mx = (event.clientX - rect.left) * (this.scene.cameras.main.width / rect.width);
      const my = (event.clientY - rect.top) * (this.scene.cameras.main.height / rect.height);
      const panelLeft = this.container.x;
      const panelRight = panelLeft + this.panelWidth;
      if (mx < panelLeft || mx > panelRight) return;
      if (my < this.scrollAreaTop || my > this.scrollAreaTop + this.scrollAreaHeight) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + event.deltaY * 0.55, 0, this.maxScrollY);
      this.applyScroll();
      event.preventDefault();
    };
    this.scene.game.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });

    scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.maxScrollY <= 0) return;
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollY;
    });

    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dy = this.dragStartY - pointer.y;
      this.scrollY = Phaser.Math.Clamp(this.dragStartScroll + dy, 0, this.maxScrollY);
      this.applyScroll();
    };
    this.pointerUpHandler = () => {
      this.isDragging = false;
    };
    this.scene.input.on('pointermove', this.pointerMoveHandler);
    this.scene.input.on('pointerup', this.pointerUpHandler);

    const sbX = this.panelWidth - unit(7);
    const trackTop = this.scrollAreaTop + unit(2);
    const trackH = Math.max(unit(26), this.scrollAreaHeight - unit(4));
    const track = this.scene.add.rectangle(sbX, trackTop + trackH / 2, unit(4), trackH, 0x1e293b, 0.95)
      .setOrigin(0.5, 0.5);
    container.add(track);
    const sbH = this.maxScrollY > 0
      ? Math.min(trackH, Math.max(28, trackH * (this.scrollAreaHeight / Math.max(this.scrollAreaHeight, totalContentH))))
      : trackH;
    const thumb = this.scene.add.rectangle(sbX, trackTop, unit(4), sbH, this.maxScrollY > 0 ? 0x38bdf8 : 0x334155, 0.95)
      .setOrigin(0.5, 0);
    container.add(thumb);
    (scrollCont as any)._scrollbar = thumb;
    (scrollCont as any)._scrollTrackTop = trackTop;
    (scrollCont as any)._scrollTrackH = trackH;
    (scrollCont as any)._scrollbarH = sbH;

    container.add(this.scene.add.text(this.panelWidth - unit(16), this.scrollAreaTop - unit(14),
      this.maxScrollY > 0 ? '滚轮/拖动滚动' : '名单已完整显示', {
        fontSize: fsTiny(10), color: '#64748b', fontFamily: uiFont,
      }).setOrigin(1, 0));

    this.applyScroll();
  }

  private applyScroll(): void {
    if (!this.scrollContent) return;
    this.scrollContent.y = this.scrollAreaTop - this.scrollY;
    const rows = (this.scrollContent as any)._rows as Phaser.GameObjects.Container[] | undefined;
    const cardH = (this.scrollContent as any)._cardHeight as number | undefined;
    if (rows && cardH) {
      rows.forEach((row) => {
        const relativeTop = row.y - this.scrollY;
        const visible = relativeTop + cardH >= -2 && relativeTop <= this.scrollAreaHeight + 2;
        row.setVisible(visible);
      });
    }

    // Update scrollbar position
    const sb = (this.scrollContent as any)._scrollbar as Phaser.GameObjects.Rectangle | undefined;
    if (sb) {
      const trackTop = (this.scrollContent as any)._scrollTrackTop as number;
      const trackH = (this.scrollContent as any)._scrollTrackH as number;
      const sbH = (this.scrollContent as any)._scrollbarH as number;
      if (this.maxScrollY > 0) {
        const travel = Math.max(0, trackH - sbH);
        sb.y = trackTop + travel * (this.scrollY / this.maxScrollY);
      } else {
        sb.y = trackTop;
      }
    }
  }

  private destroyProfileCard(): void {
    this.profileCard?.destroy();
    this.profileCard = null;
  }

  private showProfileCard(companion: CompanionData, roster: CompanionData[]): void {
    if (!this.container) return;
    this.destroyProfileCard();
    const uiFont = this.getUIFontFamily();
    const fontBoost = this.getFontBoost();
    const layoutBoost = Phaser.Math.Clamp(fontBoost * 0.92, 1, 2);
    const fs = (base: number, min: number = this.isPortraitViewport() && this.isMobileViewport() ? 14 : 12) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const unit = (value: number) => Math.round(value * layoutBoost);
    const companionName = this.getSafeCompanionName(companion);
    const profile = this.ensureRenderableProfile(companion);
    const safeRoster = roster.filter((item) => item && typeof item.id === 'string' && item.id.length > 0);
    let relationLines: string[] = [];
    try {
      relationLines = CompanionPersonalitySystem.getRelationshipSummary(companion, safeRoster, 4);
    } catch (_e) {
      relationLines = [];
    }
    let mods = CompanionPersonalitySystem.getProfileModifiers(companion);
    if (!mods || !Number.isFinite(mods.dayEfficiency)) {
      mods = { dayEfficiency: 1, nightAccuracy: 1, combatDamage: 1, teamwork: 1 };
    }

    const h = this.scene.cameras.main.height;
    const cardW = this.panelWidth - unit(16);
    const cardH = h - unit(56);
    const cardX = this.panelWidth / 2;
    const cardY = unit(28) + cardH / 2;
    const roleColor = ROLE_COLORS[companion.role] || 0x6366f1;

    const card = this.scene.add.container(0, 0);

    // Full-panel background
    const bg = this.scene.add.rectangle(cardX, cardY, cardW, cardH, 0x0b1220, 0.98);
    bg.setStrokeStyle(2, 0x1e3a5f);
    bg.setInteractive(); // block clicks to list behind
    card.add(bg);

    const left = cardX - cardW / 2 + unit(14);
    let py = cardY - cardH / 2 + unit(12);

    // ── Header: back arrow + name ──────────────────────────
    const back = this.scene.add.text(left, py, '← 返回列表', {
      fontSize: fs(11), color: '#64748b', fontFamily: uiFont,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.destroyProfileCard());
    card.add(back);

    card.add(this.scene.add.text(left + 90, py, `${companionName} · 详细档案`, {
      fontSize: fs(14), color: '#38bdf8', fontFamily: uiFont, fontStyle: 'bold',
    }));
    py += unit(28);

    // ── Avatar area ────────────────────────────────────────
    const avX = left + unit(28);
    const avY = py + unit(28);
    const avR = unit(28);
    const avGfx = this.scene.add.graphics();
    avGfx.fillStyle(roleColor, 0.2);
    avGfx.fillCircle(avX, avY, avR);
    avGfx.lineStyle(2, roleColor, 0.9);
    avGfx.strokeCircle(avX, avY, avR);
    card.add(avGfx);

    const roleChar = ROLE_LABELS[companion.role] || '?';
    card.add(this.scene.add.text(avX, avY - 10, roleChar, {
      fontSize: fs(22), color: '#ffffff', fontFamily: uiFont, fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    card.add(this.scene.add.text(avX, avY + avR + 6, `Lv.${companion.level}`, {
      fontSize: fs(11), color: '#fbbf24', fontFamily: uiFont,
      backgroundColor: '#1a1a2e', padding: { x: unit(4), y: unit(2) },
    }).setOrigin(0.5, 0));

    // ── Basic info (right of avatar) ───────────────────────
    const infoX = left + unit(72);
    card.add(this.scene.add.text(infoX, py + 4, `${profile.gender} · ${profile.age}岁`, {
      fontSize: fs(12), color: '#e2e8f0', fontFamily: uiFont,
    }));
    card.add(this.scene.add.text(infoX, py + 20, profile.profession, {
      fontSize: fs(11), color: '#94a3b8', fontFamily: uiFont,
    }));
    card.add(this.scene.add.text(infoX, py + 36, companion.advancedClass ? `进阶职业 · ${companion.advancedClass}` : `性格 · ${profile.personality}`, {
      fontSize: fs(11), color: '#a5b4fc', fontFamily: uiFont,
    }));
    card.add(this.scene.add.text(infoX, py + 52, companion.advancedClass ? `性格 · ${profile.personality}` : `技能 · ${profile.signatureSkill}`, {
      fontSize: fs(11), color: '#4ade80', fontFamily: uiFont,
    }));
    card.add(this.scene.add.text(
      infoX,
      py + 68,
      companion.status === 'base' ? `驻守岗位 · ${BASE_JOB_LABELS[companion.job]}` : '当前状态 · 出战',
      {
        fontSize: fs(11),
        color: '#38bdf8',
        fontFamily: uiFont,
      }
    ));

    py += unit(92);

    // ── Divider ────────────────────────────────────────────
    const div1 = this.scene.add.rectangle(cardX, py, cardW - unit(28), 1, 0x1e3a5f, 0.6);
    card.add(div1);
    py += unit(10);

    // ── Stats bars ─────────────────────────────────────────
    card.add(this.scene.add.text(left, py, '属性加成', {
      fontSize: fs(12), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
    }));
    py += unit(20);

    const statBarW = cardW - unit(80);
    const stats = [
      { label: '白天效率', value: mods.dayEfficiency, color: 0x22c55e },
      { label: '夜间命中', value: mods.nightAccuracy, color: 0x3b82f6 },
      { label: '战斗伤害', value: mods.combatDamage, color: 0xef4444 },
      { label: '协作系数', value: mods.teamwork, color: 0xa855f7 },
    ];

    stats.forEach(s => {
      card.add(this.scene.add.text(left, py, s.label, {
        fontSize: fs(10), color: '#94a3b8', fontFamily: uiFont,
      }));
      // bar background
      const bx = left + unit(62);
      card.add(this.scene.add.rectangle(bx + statBarW / 2, py + unit(5), statBarW, unit(8), 0x1e293b, 1));
      // bar fill (value 0.8 ~ 1.4 mapped to 0~1)
      const norm = Phaser.Math.Clamp((s.value - 0.8) / 0.6, 0, 1);
      if (norm > 0) {
        const fw = statBarW * norm;
        card.add(this.scene.add.rectangle(bx + fw / 2, py + unit(5), fw, unit(8), s.color, 0.6));
      }
      // value text
      card.add(this.scene.add.text(bx + statBarW + 6, py, `x${s.value.toFixed(2)}`, {
        fontSize: fs(10), color: '#cbd5e1', fontFamily: uiFont,
      }));
      py += unit(20);
    });

    // ── Divider ────────────────────────────────────────────
    card.add(this.scene.add.rectangle(cardX, py, cardW - unit(28), 1, 0x1e3a5f, 0.6));
    py += unit(10);

    // ── Traits & hobbies ───────────────────────────────────
    card.add(this.scene.add.text(left, py, '特质', {
      fontSize: fs(12), color: '#a5b4fc', fontFamily: uiFont, fontStyle: 'bold',
    }));
    py += unit(18);

    // Render trait tags
    let tx = left;
    (profile.traits || []).forEach(t => {
      const tw = t.length * unit(10) + unit(14);
      if (tx + tw > left + cardW - unit(40)) { tx = left; py += unit(20); }
      card.add(this.scene.add.rectangle(tx + tw / 2, py + unit(8), tw, unit(18), 0x1e3a5f, 0.8)
        .setStrokeStyle(1, 0x334155));
      card.add(this.scene.add.text(tx + 7, py + 1, t, {
        fontSize: fs(10), color: '#c4b5fd', fontFamily: uiFont,
      }));
      tx += tw + unit(6);
    });
    py += unit(28);

    card.add(this.scene.add.text(left, py, `爱好: ${profile.hobbies.join('、')}`, {
      fontSize: fs(10), color: '#94a3b8', fontFamily: uiFont,
      wordWrap: { width: cardW - unit(28) },
    }));
    py += unit(18);

    // ── Background ─────────────────────────────────────────
    card.add(this.scene.add.text(left, py, `背景: ${profile.background}`, {
      fontSize: fs(10), color: '#cbd5e1', fontFamily: uiFont,
      wordWrap: { width: cardW - unit(28) }, lineSpacing: unit(2),
    }));
    py += unit(34);

    // ── Divider ────────────────────────────────────────────
    card.add(this.scene.add.rectangle(cardX, py, cardW - unit(28), 1, 0x1e3a5f, 0.6));
    py += unit(10);

    // ── Relationships ──────────────────────────────────────
    card.add(this.scene.add.text(left, py, '关系网', {
      fontSize: fs(12), color: '#a7f3d0', fontFamily: uiFont, fontStyle: 'bold',
    }));
    py += unit(18);

    if (relationLines.length === 0) {
      card.add(this.scene.add.text(left, py, '尚无关系数据', {
        fontSize: fs(10), color: '#475569', fontFamily: uiFont,
      }));
    } else {
      relationLines.forEach(line => {
        card.add(this.scene.add.text(left, py, `· ${line}`, {
          fontSize: fs(10), color: '#6ee7b7', fontFamily: uiFont,
          wordWrap: { width: cardW - unit(28) },
        }));
        py += unit(16);
      });
    }

    this.profileCard = card;
    this.container.add(card);
  }
}
