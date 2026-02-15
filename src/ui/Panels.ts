/**
 * Slide-in panels for Inventory, Crafting, Quest Log
 * Each panel slides from the edge with smooth animation
 */
import Phaser from 'phaser';
import { gameState, type CompanionData, type CompanionProfile } from '../state/GameState';
import { QuestSystem } from '../systems/QuestSystem';
import { BaseSystem } from '../systems/BaseSystem';
import { CompanionPersonalitySystem } from '../systems/CompanionPersonalitySystem';
import { BUILDING_DEFS, BUILD_CATEGORIES } from '../data/buildings';
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
    const fs = (base: number, min: number = mobilePortrait ? 14 : 12) => `${Math.max(min, Math.round(base * fontBoost))}px`;
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
        this.rebuild();
      });
      container.add(tab);
    });

    const defs = Object.values(BUILDING_DEFS).filter(def =>
      this.selectedBuildCategory === 'all' ? true : def.category === this.selectedBuildCategory
    );
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

    const cardH = mobilePortrait ? unit(108) : unit(90);
    let y = unit(138);
    for (const def of defs) {
      if (y > h - unit(120)) break;
      const canBuild = gameState.canAfford(def.cost as any);

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

      const btn = this.scene.add.text(this.panelWidth - unit(20), y + unit(24), canBuild ? '选中建造' : '缺资源', {
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
      y += cardH + unit(8);
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

  show(): void {
    if (this.isOpen) { this.hide(); return; }
    const container = this.createBase();
    const h = this.scene.cameras.main.height;

    // Title
    container.add(this.scene.add.text(20, 15, '📋 任务日志', {
      fontSize: '22px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
    }));

    // Close
    const close = this.scene.add.text(this.panelWidth - 15, 15, '✕', {
      fontSize: '20px', color: '#ef4444', fontFamily: 'Courier New',
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
      fontSize: '13px', color: '#94a3b8', fontFamily: 'Courier New',
    }));
    y += 20;

    if (activeQuests.length === 0) {
      container.add(this.scene.add.text(20, y, '暂无进行中的任务\n与NPC对话接受任务', {
        fontSize: '14px', color: '#64748b', fontFamily: 'Courier New',
      }));
      y += 50;
    } else {
      activeQuests.forEach(quest => {
        // Quest name
        container.add(this.scene.add.text(20, y, quest.def.nameCN, {
          fontSize: '16px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
        }));
        y += 22;

        // Objectives
        quest.objectives.forEach(obj => {
          const done = obj.current >= obj.target;
          container.add(this.scene.add.text(30, y,
            `${done ? '✅' : '⬜'} ${obj.obj.descriptionCN} (${obj.current}/${obj.target})`, {
            fontSize: '13px', color: done ? '#4ade80' : '#94a3b8', fontFamily: 'Courier New',
          }));
          y += 18;
        });
        y += 10;
      });
    }

    // Available quests
    y += 10;
    container.add(this.scene.add.text(20, y, '可接受的任务:', {
      fontSize: '16px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
    }));
    y += 25;

    const available = QuestSystem.getAvailable().filter(
      q => !gameState.data.activeQuests.some(aq => aq.questId === q.id)
    );

    if (activeQuests.length >= maxQuests) {
      container.add(this.scene.add.text(20, y, `任务已满（最多${maxQuests}个），先完成一个再接新任务`, {
        fontSize: '12px', color: '#ef4444', fontFamily: 'Courier New',
      }));
      return;
    }

    available.slice(0, 5).forEach(quest => {
      const card = this.scene.add.rectangle(this.panelWidth / 2, y + 20, this.panelWidth - 30, 40, 0x1e293b, 0.8);
      card.setStrokeStyle(1, 0x334155);
      container.add(card);

      container.add(this.scene.add.text(25, y + 8, quest.nameCN, {
        fontSize: '14px', color: '#e2e8f0', fontFamily: 'Courier New',
      }));

      const acceptBtn = this.scene.add.text(this.panelWidth - 25, y + 12, '接受', {
        fontSize: '13px', color: '#0ea5e9', fontFamily: 'Courier New', fontStyle: 'bold',
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
      boost = Math.max(boost, 2.25);
    }
    return Phaser.Math.Clamp(boost, 1.2, 2.85);
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
      ? Math.min(w - 6, Math.max(520, Math.round(w * 0.95)))
      : 440;
    const fontBoost = this.getFontBoost();
    const layoutBoost = Phaser.Math.Clamp(fontBoost * 0.78, 1, 1.72);
    const fs = (base: number, min: number = mobilePortrait ? 14 : 12) => `${Math.max(min, Math.round(base * fontBoost))}px`;
    const unit = (value: number) => Math.round(value * layoutBoost);

    BaseSystem.refreshBaseState();
    const container = this.createBase();

    // ─── Title ─────────────────────────────────────────────
    container.add(this.scene.add.text(unit(20), unit(12), '🏠 基地管理', {
      fontSize: fs(20), color: '#38bdf8', fontFamily: uiFont, fontStyle: 'bold',
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
    const compCount = companions.length;
    const popCap = BaseSystem.getPopulationCapacity();
    const partyCount = companions.filter(c => c.status === 'party').length;
    const baseCount = compCount - partyCount;

    let sy = unit(38);
    const foodColor = base.foodDeficit > 0 ? '#ef4444' : '#e2e8f0';
    container.add(this.scene.add.text(unit(16), sy,
      `🍖 ${res.food}(+${base.foodProduction}/-${base.foodConsumption}/日)  ⚡ ${base.powerUsed}/${base.powerCapacity}`, {
      fontSize: fs(11), color: foodColor, fontFamily: uiFont,
    }));
    sy += unit(16);
    const popColor = compCount >= popCap ? '#ef4444' : '#94a3b8';
    container.add(this.scene.add.text(unit(16), sy,
      `👥 ${compCount}/${popCap}人  出战${partyCount} · 驻守${baseCount}`, {
      fontSize: fs(11), color: popColor, fontFamily: uiFont,
    }));

    // ─── Action buttons ────────────────────────────────────
    const btnY = unit(38);
    const assignBtn = this.scene.add.text(this.panelWidth - unit(14), btnY, '分配岗位', {
      fontSize: fs(11), color: '#38bdf8', fontFamily: uiFont, fontStyle: 'bold',
      backgroundColor: '#0f1d32', padding: { x: unit(6), y: unit(3) },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    if (assignBtn.input) (assignBtn.input as any).priorityID = 3;
    assignBtn.on('pointerdown', () => {
      BaseSystem.autoAssignBaseCompanions();
      events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
      events.emit('update-resources', gameState.data.resources);
      this.refresh();
    });
    container.add(assignBtn);

    const garrisonBtn = this.scene.add.text(this.panelWidth - unit(14), btnY + unit(24), '一键驻守', {
      fontSize: fs(11), color: '#fbbf24', fontFamily: uiFont, fontStyle: 'bold',
      backgroundColor: '#0f1d32', padding: { x: unit(6), y: unit(3) },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    if (garrisonBtn.input) (garrisonBtn.input as any).priorityID = 3;
    garrisonBtn.on('pointerdown', () => {
      events.emit('companion-bulk-status-changed', { status: 'base' as const });
      events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
      this.refresh();
    });
    container.add(garrisonBtn);

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
        fontSize: fs(10), color: '#64748b', fontFamily: uiFont,
      }));
      sy += unit(14);
    }

    sy += unit(4);
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

    const CARD_H = mobilePortrait ? unit(188) : unit(148);
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
        fontSize: fs(mobilePortrait ? 18 : 15), color: '#f1f5f9', fontFamily: uiFont, fontStyle: 'bold',
      }));

      const classTag = c.advancedClass ? ` · ${c.advancedClass}` : '';
      row.add(this.scene.add.text(infoX, unit(31), `${profile.profession}${classTag}`, {
        fontSize: fs(mobilePortrait ? 12 : 11), color: '#94a3b8', fontFamily: uiFont,
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
        row.add(this.scene.add.text(infoX, mobilePortrait ? unit(104) : 74, `岗位: ${BASE_JOB_LABELS[c.job]}  推荐: ${BASE_JOB_LABELS[recJob]}`, {
          fontSize: fs(mobilePortrait ? 11 : 10), color: '#4ade80', fontFamily: uiFont,
        }));
      } else {
        row.add(this.scene.add.text(infoX, mobilePortrait ? unit(104) : 74, `签名: ${profile.signatureSkill}${c.advancedClass ? ` · ${c.advancedClass}` : ''}`, {
          fontSize: fs(mobilePortrait ? 11 : 10), color: '#93c5fd', fontFamily: uiFont,
        }));
      }
      const combatSummary = BaseSystem.getCompanionCombatSummary(c)
        .replace('战斗: ', '')
        .replace('伤害', '攻')
        .replace('生命', '血')
        .replace('射程', '程')
        .replace('频率', '速');
      row.add(this.scene.add.text(infoX, mobilePortrait ? unit(124) : 89, combatSummary, {
        fontSize: fs(mobilePortrait ? 11 : 9), color: '#67e8f9', fontFamily: uiFont,
      }));

      const btnX = this.panelWidth - (mobilePortrait ? unit(20) : unit(18));
      const statusColor = c.status === 'party' ? '#0ea5e9' : '#eab308';
      const statusBgColor = c.status === 'party' ? '#0c2d48' : '#2d2506';
      const statusLabel = c.status === 'party' ? '⚔ 出战' : '🏠 驻守';
      const statusBtn = this.scene.add.text(btnX, mobilePortrait ? unit(14) : 12, statusLabel, {
        fontSize: fs(mobilePortrait ? 12 : 11), color: statusColor, fontFamily: uiFont, fontStyle: 'bold',
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
          fontSize: fs(mobilePortrait ? 11 : 10), color: '#a78bfa', fontFamily: uiFont,
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
          fontSize: fs(mobilePortrait ? 11 : 10),
          color: genderColor,
          fontFamily: uiFont,
          backgroundColor: '#1a1a2e',
          padding: { x: unit(4), y: unit(2) },
        }
      ).setOrigin(1, 0));

      const arrow = this.scene.add.text(btnX, CARD_H - unit(22), '▸ 详情', {
        fontSize: fs(mobilePortrait ? 11 : 10), color: '#94a3b8', fontFamily: uiFont,
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
        fontSize: fs(10), color: '#64748b', fontFamily: uiFont,
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
