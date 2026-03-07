/**
 * UIScene - Complete HUD redesign
 * Minimal gameplay overlay with weapon slots, HP/XP bars, day counter, minimap
 * Slide-in panels for Crafting, Quest Log
 */
import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import { CompanionConfig } from '../types/SkillTypes';
import { WEAPON_DEFS } from '../data/weapons';
import { CraftingPanel, QuestPanel, BasePanel } from '../ui/Panels';
import { BaseSystem } from '../systems/BaseSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { LevelUpPanel } from '../ui/LevelUpPanel';
import { CollectionPanel } from '../ui/CollectionPanel';
import { AR_GLASSES } from '../data/arGlasses';
import { LeisurePanel } from '../ui/LeisurePanel';
import { ExchangePanel } from '../ui/ExchangePanel';
import { GlassesShopPanel } from '../ui/GlassesShopPanel';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import { GearVaultPanel } from '../ui/GearVaultPanel';
import { LootCodexPanel } from '../ui/LootCodexPanel';

export default class UIScene extends Phaser.Scene {
  // Top bar
  private dayText!: Phaser.GameObjects.Text;
  private timeBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private expBar!: Phaser.GameObjects.Graphics;
  private expBarBg!: Phaser.GameObjects.Graphics;

  // Left side
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthBarBg!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  // Bottom center - weapon slots
  private weaponSlots!: Phaser.GameObjects.Container;
  private weaponText!: Phaser.GameObjects.Text;

  // Bottom left - minimap
  private minimapBg!: Phaser.GameObjects.Rectangle;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapWidth: number = 150;
  private minimapHeight: number = 112;
  private minimapDiagText!: Phaser.GameObjects.Text;
  private minimapDiagPanel: Phaser.GameObjects.Container | null = null;
  private minimapSelectedNode: { x: number; y: number } | null = null;

  // Right side
  private companionText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private resourceValueTexts: Record<string, Phaser.GameObjects.Text> = {};
  private rightStatusTexts: {
    glasses?: Phaser.GameObjects.Text;
    tree?: Phaser.GameObjects.Text;
    group?: Phaser.GameObjects.Text;
    protocol?: Phaser.GameObjects.Text;
  } = {};

  // Wave / Blood Moon
  private waveText!: Phaser.GameObjects.Text;
  private bloodMoonIndicator!: Phaser.GameObjects.Text;
  private questHudText!: Phaser.GameObjects.Text;
  private storyChainText!: Phaser.GameObjects.Text;
  private storyChainBarBg!: Phaser.GameObjects.Rectangle;
  private storyChainBarFill!: Phaser.GameObjects.Rectangle;
  private storyChainUpdateAt: number = 0;

  // Grade
  private gradeText!: Phaser.GameObjects.Text;
  private gradeTimer: number = 0;
  private glassesText!: Phaser.GameObjects.Text;
  private leftHudExpanded: boolean = true;
  private leftPanelExpandedBg!: Phaser.GameObjects.Rectangle;
  private leftPanelCollapsedBg!: Phaser.GameObjects.Rectangle;
  private leftPanelDivider!: Phaser.GameObjects.Rectangle;
  private leftHudToggleBg!: Phaser.GameObjects.Rectangle;
  private leftHudToggleText!: Phaser.GameObjects.Text;
  private leftHudCollapsibleObjects: Phaser.GameObjects.GameObject[] = [];
  private leftHudPanelX: number = 12;
  private leftHudExpandedW: number = 352;
  private leftHudCollapsedW: number = 168;
  private durabilityDebuffContainer!: Phaser.GameObjects.Container;
  private durabilityDebuffBg!: Phaser.GameObjects.Rectangle;
  private durabilityDebuffIcon!: Phaser.GameObjects.Text;
  private durabilityDebuffTitle!: Phaser.GameObjects.Text;
  private durabilityDebuffTime!: Phaser.GameObjects.Text;
  private durabilityDebuffBarBg!: Phaser.GameObjects.Rectangle;
  private durabilityDebuffBar!: Phaser.GameObjects.Rectangle;

  // Panels
  private craftingPanel!: CraftingPanel;
  private questPanel!: QuestPanel;
  private levelUpPanel!: LevelUpPanel;
  private collectionPanel!: CollectionPanel;
  private basePanel!: BasePanel;
  private leisurePanel!: LeisurePanel;
  private exchangePanel!: ExchangePanel;
  private glassesShopPanel!: GlassesShopPanel;
  private gearVaultPanel!: GearVaultPanel;
  private lootCodexPanel!: LootCodexPanel;
  private brandTreeText!: Phaser.GameObjects.Text;
  private mobileViewport: boolean = false;
  private mobileControls: Phaser.GameObjects.Container | null = null;
  private mobileCloseButton: Phaser.GameObjects.Text | null = null;
  private mobileCloseHit: Phaser.GameObjects.Rectangle | null = null;
  private mobileButtons: Record<string, {
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
    idleLabel: string;
    activeLabel?: string;
    activeCheck?: () => boolean;
  }> = {};
  private buildModeActive: boolean = false;
  private mobileUiRefreshAt: number = 0;
  private joystickZone: Phaser.GameObjects.Arc | null = null;
  private joystickBase: Phaser.GameObjects.Arc | null = null;
  private joystickKnob: Phaser.GameObjects.Arc | null = null;
  private joystickCenter: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
  private joystickRadius: number = 46;
  private joystickPointerId: number | null = null;
  private joystickMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private joystickUpHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private uiFontFamily: string = 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  private hudFontBoost: number = 1;
  private readonly onHotkeyToggleBase = (event: KeyboardEvent): void => {
    if (event?.repeat) return;
    if (this.levelUpPanel?.getIsOpen()) return;
    this.basePanel.toggle();
  };
  private readonly onHotkeyToggleLeisure = (event: KeyboardEvent): void => {
    if (event?.repeat) return;
    if (this.levelUpPanel?.getIsOpen()) return;
    this.leisurePanel.toggle();
  };
  private readonly onHotkeyToggleGearVault = (event: KeyboardEvent): void => {
    if (event?.repeat) return;
    if (this.levelUpPanel?.getIsOpen()) return;
    this.gearVaultPanel.toggle();
  };
  private readonly onHotkeyToggleLootCodex = (event: KeyboardEvent): void => {
    if (event?.repeat) return;
    if (this.levelUpPanel?.getIsOpen()) return;
    this.lootCodexPanel.toggle();
  };

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.resetRuntimeUiState();
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const portraitLayout = h > w * 1.2;
    const mobileViewport = this.isMobileViewport();
    this.mobileViewport = mobileViewport;
    this.uiFontFamily = this.getUIFontFamily();
    this.hudFontBoost = Phaser.Math.Clamp(
      mobileViewport ? (portraitLayout ? 1.34 : 1.2) : 1.06,
      1,
      1.45
    );

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Panels
    this.craftingPanel = new CraftingPanel(this);
    this.questPanel = new QuestPanel(this);
    this.levelUpPanel = new LevelUpPanel(this);
    this.collectionPanel = new CollectionPanel(this);
    this.basePanel = new BasePanel(this);
    this.leisurePanel = new LeisurePanel(this);
    this.exchangePanel = new ExchangePanel(this);
    this.glassesShopPanel = new GlassesShopPanel(this);
    this.gearVaultPanel = new GearVaultPanel(this);
    this.lootCodexPanel = new LootCodexPanel(this);
    this.input.setTopOnly(true);

    // ========================================
    // TOP BAR
    // ========================================
    this.add.rectangle(w / 2, 0, w, 66, 0x161b24, 0.95)
      .setOrigin(0.5, 0).setDepth(1000);
    this.add.rectangle(w / 2, 64, w, 2, 0xf59e0b, 0.32)
      .setOrigin(0.5, 0).setDepth(1000);

    // Day / Time (top center)
    this.dayText = this.add.text(w / 2, 8, '第1天 · 第1周', {
      fontSize: this.hudFs(21, 18), color: '#fef3c7', fontFamily: this.uiFontFamily, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);

    // Time bar (below day text)
    this.timeBar = this.add.graphics().setDepth(1001);

    // Blood moon indicator
    this.bloodMoonIndicator = this.add.text(w / 2, 56, '', {
      fontSize: this.hudFs(12, 11), color: '#ef4444', fontFamily: this.uiFontFamily, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);
    this.storyChainText = this.add.text(w / 2, 36, '事件链: 前置 0/2', {
      fontSize: this.hudFs(12, 11),
      color: '#67e8f9',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);
    this.storyChainBarBg = this.add.rectangle(w / 2, 50, 248, 4, 0x1e293b, 0.9)
      .setDepth(1001)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0x334155, 0.8);
    this.storyChainBarFill = this.add.rectangle(w / 2 - 124, 50, 2, 4, 0x22d3ee, 0.96)
      .setDepth(1002)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    // Level + XP (top right)
    this.levelText = this.add.text(w - 15, 5, 'Lv.1', {
      fontSize: this.hudFs(21, 18), color: '#f59e0b', fontFamily: this.uiFontFamily, fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(1001);

    this.expBarBg = this.add.graphics().setDepth(1001);
    this.expBar = this.add.graphics().setDepth(1001);
    this.drawExpBar(0, 1);

    // ========================================
    // LEFT SIDE
    // ========================================
    const leftPanelX = 12;
    const leftPanelY = 52;
    const leftPanelExpandedW = portraitLayout ? 332 : 352;
    const leftPanelCollapsedW = portraitLayout ? 164 : 172;
    const leftPanelExpandedH = portraitLayout ? 146 : 156;
    const leftPanelCollapsedH = 92;
    this.leftHudPanelX = leftPanelX;
    this.leftHudExpandedW = leftPanelExpandedW;
    this.leftHudCollapsedW = leftPanelCollapsedW;
    this.leftPanelExpandedBg = this.add.rectangle(
      leftPanelX + leftPanelExpandedW / 2,
      leftPanelY + leftPanelExpandedH / 2,
      leftPanelExpandedW,
      leftPanelExpandedH,
      0x121923,
      0.76
    ).setOrigin(0.5).setStrokeStyle(1, 0x334155, 0.62).setDepth(1000).setScrollFactor(0);
    this.leftPanelCollapsedBg = this.add.rectangle(
      leftPanelX + leftPanelCollapsedW / 2,
      leftPanelY + leftPanelCollapsedH / 2,
      leftPanelCollapsedW,
      leftPanelCollapsedH,
      0x121923,
      0.82
    ).setOrigin(0.5).setStrokeStyle(1, 0x334155, 0.62).setDepth(1000).setVisible(false).setScrollFactor(0);
    this.leftPanelDivider = this.add.rectangle(leftPanelX + leftPanelExpandedW * 0.5, 74, leftPanelExpandedW - 8, 1, 0x334155, 0.8)
      .setDepth(1001).setScrollFactor(0);
    this.leftHudToggleBg = this.add.rectangle(leftPanelX + leftPanelExpandedW - 28, 62, 46, 20, 0x0f172a, 0.82)
      .setStrokeStyle(1, 0x475569, 0.9)
      .setDepth(1002)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.leftHudToggleText = this.add.text(leftPanelX + leftPanelExpandedW - 28, 56, '收起', {
      fontSize: this.hudFs(11, 10),
      color: '#93c5fd',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1003).setScrollFactor(0);
    this.leftHudToggleBg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.setLeftHudExpanded(!this.leftHudExpanded);
    });

    // Health bar
    this.healthBarBg = this.add.graphics().setDepth(1001);
    this.healthBar = this.add.graphics().setDepth(1001);
    this.healthText = this.add.text(15, 58, '100/100', {
      fontSize: this.hudFs(14, 13), color: '#ffffff', fontFamily: this.uiFontFamily, fontStyle: 'bold',
    }).setDepth(1001);
    this.drawHealthBar(100, 100);

    // Kills
    this.killText = this.add.text(15, 80, '击杀: 0', {
      fontSize: this.hudFs(14, 13), color: '#ef4444', fontFamily: this.uiFontFamily,
    }).setDepth(1001);

    // Resources
    this.resourceText = this.add.text(15, 100, '', {
      fontSize: this.hudFs(12, 11), color: '#94a3b8', fontFamily: this.uiFontFamily,
    }).setDepth(1001).setVisible(false);
    this.createResourceHud(15, 98);

    // Wave info
    this.waveText = this.add.text(15, 124, '', {
      fontSize: this.hudFs(16, 14), color: '#fbbf24', fontFamily: this.uiFontFamily, fontStyle: 'bold',
    }).setDepth(1001);

    // Quest HUD (top-left under wave)
    this.questHudText = this.add.text(15, 144, '', {
      fontSize: this.hudFs(12, 11), color: '#e2e8f0', fontFamily: this.uiFontFamily,
    }).setDepth(1001);
    this.leftHudCollapsibleObjects.push(this.waveText, this.questHudText);
    this.createDurabilityDebuffHud();
    this.setLeftHudExpanded(true);

    // ========================================
    // BOTTOM CENTER - WEAPON SLOTS
    // ========================================
    this.weaponSlots = this.add.container(portraitLayout ? (w / 2) : (w - 160), portraitLayout ? (h - 146) : (h - 120)).setDepth(1001);
    this.updateWeaponSlots();

    this.weaponText = this.add.text(portraitLayout ? (w / 2) : (w - 160), portraitLayout ? (h - 176) : (h - 150), '', {
      fontSize: this.hudFs(14, 13), color: '#0ea5e9', fontFamily: this.uiFontFamily,
    }).setOrigin(0.5).setDepth(1001);

    // ========================================
    // BOTTOM LEFT - MINIMAP
    // ========================================
    this.minimapWidth = portraitLayout ? 124 : 166;
    this.minimapHeight = portraitLayout ? 92 : 124;
    this.minimapBg = this.add.rectangle(10, h - 10, this.minimapWidth, this.minimapHeight, 0x121923, 0.92)
      .setOrigin(0, 1).setStrokeStyle(1, 0xf59e0b, 0.5).setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.minimapBg.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.trySelectDiagnosticNodeFromMinimap(pointer.x, pointer.y);
    });
    this.minimapGraphics = this.add.graphics().setDepth(1001);

    this.add.text(10 + this.minimapWidth * 0.5, h - this.minimapHeight - 8, '小地图', {
      fontSize: portraitLayout ? this.hudFs(11, 10) : this.hudFs(12, 11),
      color: '#fcd34d',
      fontFamily: this.uiFontFamily,
    }).setOrigin(0.5).setDepth(1001);
    this.minimapDiagText = this.add.text(10 + this.minimapWidth - 3, h - this.minimapHeight - 8, '维0 输0 电0', {
      fontSize: portraitLayout ? this.hudFs(10, 9) : this.hudFs(11, 10),
      color: '#93c5fd',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(1001);

    // ========================================
    // RIGHT SIDE - COMPANIONS
    // ========================================
    this.add.rectangle(w - 100, 112, 194, 82, 0x121923, 0.76)
      .setStrokeStyle(1, 0x334155, 0.62)
      .setDepth(1000);
    this.companionText = this.add.text(w - 15, 110, '微信群: 0人', {
      fontSize: this.hudFs(14, 13), color: '#38bdf8', fontFamily: this.uiFontFamily,
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);

    // ========================================
    // TOP LEFT - GRADE
    // ========================================
    this.gradeText = this.add.text(w - 15, 50, '', {
      fontSize: this.hudFs(18, 15), color: '#fbbf24', fontFamily: this.uiFontFamily, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(1001);

    const equippedName = AR_GLASSES[gameState.data.equippedGlasses]?.nameCN || '未装备';
    this.glassesText = this.add.text(w - 15, 72, `眼镜: ${equippedName}`, {
      fontSize: this.hudFs(11, 10), color: '#93c5fd', fontFamily: this.uiFontFamily,
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);
    const tree = EvolutionSystem.getEquippedBrandSkillTree();
    this.brandTreeText = this.add.text(w - 15, 86, `弹幕树: ${tree.treeNameCN}`, {
      fontSize: this.hudFs(11, 10), color: '#c4b5fd', fontFamily: this.uiFontFamily,
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);
    this.createRightStatusHud(w - 15, 74);

    // ========================================
    // BOTTOM RIGHT - CONTROLS
    // ========================================
    if (!mobileViewport) {
      const compactHud = w <= 900;
      const controlsText = compactHud
        ? (portraitLayout
          ? '竖屏HUD: B建造 C合成 Q任务 T基地 V仓库\nE交互 X交易 R拆除 G图鉴'
          : 'B建造 C合成 Q任务 T基地 H休闲 V仓库\nE交互 X交易 R拆除 G图鉴')
        : 'WASD:移动 | B:建造 | C:合成 | Q:任务 | T:基地 | H:休闲 | V:仓库 | E:交互 | X:交易 | R:拆除 | G:图鉴';
      const lineCount = controlsText.includes('\n') ? 2 : 1;
      const panelH = lineCount === 2 ? 46 : 26;
      this.add.rectangle(w - 200, h - 15 - panelH * 0.5, 390, panelH, 0x0b1220, 0.72)
        .setStrokeStyle(1, 0x334155, 0.62)
        .setDepth(1000);
      this.add.text(w - 10, h - 10, controlsText, {
        fontSize: compactHud ? this.hudFs(portraitLayout ? 15 : 12, portraitLayout ? 13 : 11) : this.hudFs(11, 10),
        color: '#fcd34d',
        fontFamily: this.uiFontFamily,
        align: 'right',
        lineSpacing: 4,
      }).setOrigin(1, 1).setDepth(1001);
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================
    this.setupEventListeners();
    if (mobileViewport) {
      this.createMobileTouchControls(w, h, portraitLayout);
      this.refreshMobileActionButtons();
    }

    // ESC closes top-most panel
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.levelUpPanel?.getIsOpen()) return;
      if (this.gearVaultPanel?.getIsOpen()) { this.gearVaultPanel.toggle(); return; }
      if (this.lootCodexPanel?.getIsOpen()) { this.lootCodexPanel.toggle(); return; }
      if (this.glassesShopPanel?.getIsOpen()) { this.glassesShopPanel.toggle(); return; }
      if (this.exchangePanel?.getIsOpen()) { this.exchangePanel.toggle(); return; }
      if (this.basePanel?.getIsOpen()) { this.basePanel.toggle(); return; }
      if (this.leisurePanel?.getIsOpen()) { this.leisurePanel.toggle(); return; }
      if (this.craftingPanel?.getIsOpen()) { this.craftingPanel.toggle(); return; }
      if (this.questPanel?.getIsOpen()) { this.questPanel.toggle(); return; }
      if (this.collectionPanel?.getIsOpen()) { this.collectionPanel.toggle(); return; }
    });

    this.registerKeyboardHotkeys();
  }

  private resetRuntimeUiState(): void {
    this.destroyUiArtifacts(this.leftHudCollapsibleObjects);
    this.leftHudCollapsibleObjects = [];
    Object.values(this.resourceValueTexts).forEach((text) => text?.destroy());
    this.resourceValueTexts = {};
    Object.values(this.rightStatusTexts).forEach((text) => text?.destroy());
    this.rightStatusTexts = {};
    this.mobileButtons = {};
  }

  private destroyUiArtifacts(objects: Phaser.GameObjects.GameObject[]): void {
    objects.forEach((obj) => {
      if (!obj || !obj.active) return;
      obj.destroy();
    });
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private hudFs(base: number, min: number = 11): string {
    return `${Math.max(min, Math.round(base * this.hudFontBoost))}px`;
  }

  private setLeftHudExpanded(expanded: boolean): void {
    this.leftHudExpanded = expanded;
    if (this.leftPanelExpandedBg) this.leftPanelExpandedBg.setVisible(expanded);
    if (this.leftPanelCollapsedBg) this.leftPanelCollapsedBg.setVisible(!expanded);
    if (this.leftPanelDivider) this.leftPanelDivider.setVisible(expanded);
    if (this.healthBarBg) this.healthBarBg.setVisible(expanded);
    if (this.healthBar) this.healthBar.setVisible(expanded);
    this.leftHudCollapsibleObjects.forEach((obj) => (obj as any).setVisible(expanded));
    const toggleX = this.leftHudPanelX + (expanded ? this.leftHudExpandedW : this.leftHudCollapsedW) - 28;
    if (this.leftHudToggleBg) this.leftHudToggleBg.setX(toggleX);
    if (this.leftHudToggleText) {
      this.leftHudToggleText.setX(toggleX);
      this.leftHudToggleText.setText(expanded ? '收起' : '展开');
      this.leftHudToggleText.setColor(expanded ? '#93c5fd' : '#67e8f9');
    }
    this.layoutDurabilityDebuffHud();
  }

  private createDurabilityDebuffHud(): void {
    this.durabilityDebuffContainer = this.add.container(0, 0).setDepth(1004).setScrollFactor(0).setVisible(false);
    this.durabilityDebuffBg = this.add.rectangle(0, 0, 120, 44, 0x1f1510, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xf59e0b, 0.92);
    this.durabilityDebuffIcon = this.add.text(8, 4, '🛠', {
      fontSize: this.hudFs(13, 12),
      color: '#fbbf24',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.durabilityDebuffTitle = this.add.text(27, 4, '耐久磨损', {
      fontSize: this.hudFs(11, 10),
      color: '#fdba74',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.durabilityDebuffTime = this.add.text(113, 4, '0s', {
      fontSize: this.hudFs(11, 10),
      color: '#fde68a',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.durabilityDebuffBarBg = this.add.rectangle(8, 27, 104, 8, 0x2b3446, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x475569, 0.9);
    this.durabilityDebuffBar = this.add.rectangle(9, 28, 102, 6, 0xf59e0b, 0.95).setOrigin(0, 0);
    this.durabilityDebuffContainer.add([
      this.durabilityDebuffBg,
      this.durabilityDebuffIcon,
      this.durabilityDebuffTitle,
      this.durabilityDebuffTime,
      this.durabilityDebuffBarBg,
      this.durabilityDebuffBar,
    ]);
    this.layoutDurabilityDebuffHud();
  }

  private layoutDurabilityDebuffHud(): void {
    if (!this.durabilityDebuffContainer) return;
    if (this.leftHudExpanded) {
      this.durabilityDebuffContainer.setPosition(this.leftHudPanelX + this.leftHudExpandedW - 132, 80);
      this.durabilityDebuffBg.setSize(120, 44);
      this.durabilityDebuffTitle.setText('耐久磨损').setX(27);
      this.durabilityDebuffTime.setX(113);
      this.durabilityDebuffBarBg.setPosition(8, 27).setSize(104, 8);
      this.durabilityDebuffBar.setPosition(9, 28).setSize(102, 6);
    } else {
      this.durabilityDebuffContainer.setPosition(this.leftHudPanelX + this.leftHudCollapsedW - 104, 79);
      this.durabilityDebuffBg.setSize(92, 40);
      this.durabilityDebuffTitle.setText('磨损').setX(27);
      this.durabilityDebuffTime.setX(84);
      this.durabilityDebuffBarBg.setPosition(8, 25).setSize(76, 8);
      this.durabilityDebuffBar.setPosition(9, 26).setSize(74, 6);
    }
  }

  private updateDurabilityDebuffHud(): void {
    if (!this.durabilityDebuffContainer) return;
    const gameScene = this.scene.get('GameScene') as any;
    if (!gameScene || !gameScene.scene?.isActive?.()) {
      this.durabilityDebuffContainer.setVisible(false);
      return;
    }
    const stacks = Number(gameScene.scavengeDurabilityStacks || 0);
    const until = Number(gameScene.scavengeDurabilityPenaltyUntil || 0);
    const duration = Math.max(1, Number(gameScene.scavengeDurabilityPenaltyDurationMs || 1));
    const now = Number(gameScene.time?.now || this.time.now);
    const remainMs = until - now;
    if (stacks <= 0 || remainMs <= 0) {
      this.durabilityDebuffContainer.setVisible(false);
      return;
    }

    this.durabilityDebuffContainer.setVisible(true);
    const remainRatio = Phaser.Math.Clamp(remainMs / duration, 0, 1);
    const barMax = this.leftHudExpanded ? 102 : 74;
    this.durabilityDebuffBar.setSize(Math.max(4, barMax * remainRatio), 6);
    const remainSec = Math.max(1, Math.ceil(remainMs / 1000));
    const reductionPercent = Math.round(stacks * 8);
    const color = stacks >= 3 ? '#ef4444' : stacks >= 2 ? '#f59e0b' : '#fbbf24';
    this.durabilityDebuffTime.setText(`${remainSec}s`).setColor('#fde68a');
    this.durabilityDebuffTitle.setColor(color);
    this.durabilityDebuffBar.setFillStyle(stacks >= 3 ? 0xef4444 : stacks >= 2 ? 0xf59e0b : 0xfbbf24, 0.95);
    this.durabilityDebuffBg.setStrokeStyle(1, stacks >= 3 ? 0xef4444 : 0xf59e0b, 0.92);
    this.durabilityDebuffIcon.setText(stacks >= 3 ? '⚠' : '🛠').setColor(color);
    this.durabilityDebuffTitle.setText(this.leftHudExpanded ? `耐久磨损 -${reductionPercent}%` : `磨损-${reductionPercent}%`);
  }

  private setupEventListeners(): void {
    events.on(GameEvents.PLAYER_HEALTH_CHANGE, (data: { current: number; max: number }) => {
      this.drawHealthBar(data.current, data.max);
      this.healthText.setText(`${Math.floor(data.current)}/${Math.floor(data.max)}`);
    });

    events.on(GameEvents.PLAYER_EXP_CHANGE, (data: { current: number; max: number }) => {
      this.drawExpBar(data.current, data.max);
    });

    events.on(GameEvents.PLAYER_LEVEL_UP, (data: { level: number }) => {
      this.levelText.setText(`Lv.${data.level}`);
      // Flash effect
      this.tweens.add({
        targets: this.levelText, scale: { from: 1.5, to: 1 }, duration: 300,
      });
    });

    events.on(GameEvents.TIME_UPDATE, (data: any) => {
      this.dayText.setText(`第${data.day}天 · 第${data.week || 1}周`);
      this.updateTimeBar(data.timeOfDay, data.isNight, data.isBloodMoon);

      // Blood moon warning
      const daysLeft = data.dayInWeek ? 7 - data.dayInWeek : 0;
      if (data.isBloodMoon) {
        this.bloodMoonIndicator.setText('🩸 血月之夜');
      } else if (daysLeft <= 2 && daysLeft > 0) {
        this.bloodMoonIndicator.setText(`⚠ 血月: ${daysLeft}天后`);
      } else {
        this.bloodMoonIndicator.setText('');
      }
    });

    events.on(GameEvents.ENEMY_KILLED, () => {
      this.killText.setText(`击杀: ${gameState.data.stats.enemiesKilled}`);
    });

    events.on(GameEvents.WEAPON_CHANGED, (data: any) => {
      if (data.config) {
        this.weaponText.setText(data.config.nameCN || data.config.name || '');
      }
    });

    events.on(GameEvents.COMPANION_ROSTER_UPDATED, (data: { configs: CompanionConfig[] }) => {
      const partyCount = data.configs.length;
      const names = data.configs.slice(0, 3).map(c => c.name.split('(')[0]).join(', ');

      // Sync any active companions into GameState so BasePanel shows accurate roster
      let changed = false;
      data.configs.forEach(c => {
        const exists = gameState.data.companions.some(existing => existing.id === c.id);
        if (!exists) {
          gameState.data.companions.push({
            id: c.id,
            name: c.name,
            role: c.role || 'tank',
            level: c.level || 1,
            bulletEffect: c.bulletEffect?.type || 'normal',
            textureKey: c.textureKey,
            status: 'party',
            job: 'idle',
            advancedClass: c.advancedClass,
            promotionTier: c.promotionTier || (c.advancedClass ? 1 : 0),
          });
          changed = true;
        }
      });
      if (changed) BaseSystem.refreshBaseState();

      const totalCount = gameState.data.companions.length;
      const popCap = BaseSystem.getPopulationCapacity();
      this.companionText.setText(`出战: ${partyCount}人 | 人口: ${totalCount}/${popCap}${partyCount > 0 ? '\n' + names : ''}`);
      this.rightStatusTexts.group?.setText(`${totalCount}/${popCap}人`);
    });

    events.on(GameEvents.WAVE_START, (data: any) => {
      const prefix = data.isBloodMoon ? '🩸 ' : '';
      this.waveText.setText(`${prefix}波次 ${data.wave} · ${data.count}敌`);
    });

    events.on(GameEvents.WAVE_COMPLETE, () => {
      this.waveText.setText('波次完成!');
      this.time.delayedCall(2000, () => {
        if (this.waveText?.active) this.waveText.setText('');
      });
    });

    events.on('quest-updated', () => this.refreshQuestHud());
    events.on('quest-completed', () => this.refreshQuestHud());

    events.on('update-resources', (resources: any) => {
      if (!resources) return;
      this.updateResourceHud(resources);
      const parts = [];
      if (resources.wood) parts.push(`木${resources.wood}`);
      if (resources.metal) parts.push(`金${resources.metal}`);
      if (resources.scrap) parts.push(`件${resources.scrap}`);
      if (resources.food) parts.push(`食${resources.food}`);
      if (resources.water) parts.push(`水${resources.water}`);
      if (resources.medical) parts.push(`医${resources.medical}`);
      if (resources.ammo) parts.push(`弹${resources.ammo}`);
      if (resources.energyCore) parts.push(`核${resources.energyCore}`);
      if (resources.bitcoin != null) parts.push(`₿${Number(resources.bitcoin).toFixed(2)}`);
      const base = gameState.data.base;
      if (base.powerCapacity > 0) parts.push(`电${base.powerUsed}/${base.powerCapacity}`);
      if (base.powerUsed > base.powerCapacity) parts.push('⚡超载');
      if (base.foodDeficit > 0) parts.push(`⚠缺粮${base.foodDeficit}`);
      const nodeIssues = (base.diagnosticUpkeepNodes || 0) + (base.diagnosticInputNodes || 0) + (base.diagnosticPowerNodes || 0);
      if (nodeIssues > 0) {
        parts.push(`诊断 维${base.diagnosticUpkeepNodes || 0}/输${base.diagnosticInputNodes || 0}/电${base.diagnosticPowerNodes || 0}`);
      }
      parts.push(`防${Math.round((base.structureIntegrity || 0) * 100)}%`);
      if (base.structureBreachOpen) parts.push('🧱破口');
      this.resourceText.setText(parts.join(' | '));
    });

    this.refreshQuestHud();

    events.on('toggle-crafting', () => this.craftingPanel.togglePanel({ buildOnly: true, category: 'building' }));
    events.on('open-crafting-category', (payload: string | { category?: string; buildOnly?: boolean }) => {
      if (typeof payload === 'string') {
        this.craftingPanel.openCategory(payload, { buildOnly: true });
        return;
      }
      this.craftingPanel.openCategory(payload?.category || 'building', { buildOnly: payload?.buildOnly ?? true });
    });
    events.on('toggle-quests', () => this.questPanel.toggle());
    events.on('open-quests', () => {
      if (!this.questPanel.getIsOpen()) {
        this.questPanel.show();
        return;
      }
      // Rebuild content when already open.
      this.questPanel.hide();
      this.time.delayedCall(20, () => this.questPanel.show());
    });
    events.on('toggle-base', () => this.basePanel.toggle());
    events.on('toggle-leisure', () => this.leisurePanel.toggle());
    events.on('toggle-exchange', () => this.exchangePanel.toggle());
    events.on('open-glasses-shop', () => this.glassesShopPanel.toggle());
    events.on('toggle-gear-vault', () => this.gearVaultPanel.toggle());
    events.on('gear-stash-updated', () => this.gearVaultPanel.refresh());
    events.on('toggle-loot-codex', () => this.lootCodexPanel.toggle());
    events.on('loot-codex-updated', () => this.lootCodexPanel.refresh());

    events.on('show-levelup-panel', () => {
      this.levelUpPanel.show((choice) => {
        events.emit('levelup-choice-made', choice);
      });
    });

    events.on('toggle-collection', () => this.collectionPanel.toggle());
    events.on('glasses-equipped', (data: { id: string; nameCN: string }) => {
      this.glassesText.setText(`眼镜: ${data.nameCN}`);
      const tree = EvolutionSystem.getEquippedBrandSkillTree();
      this.brandTreeText.setText(`弹幕树: ${tree.treeNameCN}`);
      this.rightStatusTexts.glasses?.setText(data.nameCN);
      this.rightStatusTexts.tree?.setText(tree.treeNameCN);
      const hint = this.add.text(this.cameras.main.width / 2, 120, `已装备 ${data.nameCN}`, {
        fontSize: this.hudFs(16, 14), color: '#38bdf8', fontFamily: this.uiFontFamily, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(2000);
      this.tweens.add({
        targets: hint, y: 90, alpha: 0, duration: 1200,
        onComplete: () => hint.destroy(),
      });
    });

    events.on(GameEvents.BASE_UPDATED, () => {
      if (this.basePanel.getIsOpen()) this.basePanel.refresh();
      const totalCount = gameState.data.companions.length;
      const popCap = BaseSystem.getPopulationCapacity();
      this.rightStatusTexts.group?.setText(`${totalCount}/${popCap}人`);
      events.emit('update-resources', gameState.data.resources);
    });

    events.on('protocol-updated', () => {
      this.refreshProtocolStatusHud();
    });

    events.on('quest-completed', (_data: any) => {
      const text = this.add.text(this.cameras.main.width / 2, 200, '✅ 任务完成!', {
        fontSize: this.hudFs(24, 20), color: '#4ade80', fontFamily: this.uiFontFamily, fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(2000);
      this.tweens.add({
        targets: text, y: 170, alpha: 0, duration: 2000,
        onComplete: () => text.destroy(),
      });
    });

    events.on(GameEvents.BUILD_MODE_TOGGLED, (payload: { active?: boolean } | null) => {
      this.buildModeActive = !!payload?.active;
      this.refreshMobileActionButtons();
    });
  }

  private closeTopLayerForMobile(): void {
    if (this.levelUpPanel?.getIsOpen()) return;
    if (this.buildModeActive) { events.emit('mobile-toggle-build'); return; }
    if (this.gearVaultPanel?.getIsOpen()) { this.gearVaultPanel.toggle(); return; }
    if (this.lootCodexPanel?.getIsOpen()) { this.lootCodexPanel.toggle(); return; }
    if (this.glassesShopPanel?.getIsOpen()) { this.glassesShopPanel.toggle(); return; }
    if (this.exchangePanel?.getIsOpen()) { this.exchangePanel.toggle(); return; }
    if (this.basePanel?.getIsOpen()) { this.basePanel.toggle(); return; }
    if (this.leisurePanel?.getIsOpen()) { this.leisurePanel.toggle(); return; }
    if (this.craftingPanel?.getIsOpen()) { this.craftingPanel.togglePanel({ buildOnly: true, category: 'building' }); return; }
    if (this.questPanel?.getIsOpen()) { this.questPanel.toggle(); return; }
    if (this.collectionPanel?.getIsOpen()) { this.collectionPanel.toggle(); return; }
  }

  private createMobileTouchControls(w: number, h: number, portraitLayout: boolean): void {
    this.mobileControls?.destroy();
    this.mobileButtons = {};
    // Keep mobile touch controls above all panels so they remain tappable on phones.
    this.mobileControls = this.add.container(0, 0).setDepth(20000).setScrollFactor(0);
    const uiFont = this.getUIFontFamily();
    const btnW = portraitLayout ? 94 : 84;
    const btnH = portraitLayout ? 36 : 32;
    const gapX = 6;
    const gapY = 7;
    const cols = 2;
    const rows = 4;
    const totalW = cols * btnW + gapX;
    const totalH = rows * btnH + (rows - 1) * gapY;
    const startX = w - totalW - 8 + btnW / 2;
    const startY = portraitLayout ? (h - totalH - 104 + btnH / 2) : (h - totalH - 30 + btnH / 2);

    const addButton = (
      id: string,
      col: number,
      row: number,
      idleLabel: string,
      onTap: () => void,
      activeLabel?: string,
      activeCheck?: () => boolean
    ) => {
      const x = startX + col * (btnW + gapX);
      const y = startY + row * (btnH + gapY);
      const bg = this.add.rectangle(x, y, btnW, btnH, 0x0b1220, 0.88)
        .setStrokeStyle(1, 0x1e3a5f, 0.9)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(20001);
      if (bg.input) (bg.input as any).priorityID = 20;
      const text = this.add.text(x, y, idleLabel, {
        fontSize: portraitLayout ? '14px' : '12px',
        color: '#e2e8f0',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(20002);
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        pointer.event?.preventDefault?.();
        onTap();
        this.time.delayedCall(20, () => this.refreshMobileActionButtons());
      });
      this.mobileControls?.add([bg, text]);
      this.mobileButtons[id] = { bg, text, idleLabel, activeLabel, activeCheck };
    };

    addButton('build', 0, 0, '建造', () => {
      if (this.buildModeActive) {
        events.emit('mobile-toggle-build');
        return;
      }
      if (this.craftingPanel.getIsOpen()) {
        this.craftingPanel.togglePanel({ buildOnly: true, category: 'building' });
      } else {
        this.craftingPanel.openCategory('building', { buildOnly: true });
      }
    }, '建造×', () => this.buildModeActive || this.craftingPanel.getIsOpen());
    addButton('craft', 1, 0, '合成', () => {
      if (this.craftingPanel.getIsOpen()) {
        this.craftingPanel.togglePanel({ buildOnly: false, category: 'weapon' });
      } else {
        this.craftingPanel.openCategory('weapon', { buildOnly: false });
      }
    }, '合成×', () => this.craftingPanel.getIsOpen());
    addButton('base', 0, 1, '伙伴', () => this.basePanel.toggle(), '伙伴×', () => this.basePanel.getIsOpen());
    addButton('quest', 1, 1, '任务', () => this.questPanel.toggle(), '任务×', () => this.questPanel.getIsOpen());
    addButton('interact', 0, 2, '交互E', () => events.emit('mobile-interact'));
    addButton('exchange', 1, 2, '交易', () => this.exchangePanel.toggle(), '交易×', () => this.exchangePanel.getIsOpen());
    addButton('shop', 0, 3, '眼镜店', () => this.glassesShopPanel.toggle(), '店铺×', () => this.glassesShopPanel.getIsOpen());
    addButton('vault', 1, 3, '仓库V', () => this.gearVaultPanel.toggle(), '仓库×', () => this.gearVaultPanel.getIsOpen());

    this.mobileCloseButton?.destroy();
    this.mobileCloseHit?.destroy();
    const closeCenterX = w - 24;
    const closeCenterY = portraitLayout ? 74 : 62;
    this.mobileCloseHit = this.add.rectangle(closeCenterX, closeCenterY, portraitLayout ? 60 : 52, portraitLayout ? 60 : 52, 0x000000, 0.001)
      .setOrigin(0.5)
      .setDepth(20009)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    if (this.mobileCloseHit.input) (this.mobileCloseHit.input as any).priorityID = 50;
    this.mobileCloseButton = this.add.text(w - 10, 58, '✕', {
      fontSize: portraitLayout ? '28px' : '24px',
      color: '#ef4444',
      fontFamily: uiFont,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 4,
      backgroundColor: '#0b1220cc',
      padding: { x: 8, y: 2 },
    }).setOrigin(1, 0).setDepth(20010).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    if (this.mobileCloseButton.input) (this.mobileCloseButton.input as any).priorityID = 51;
    const closeTap = (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.closeTopLayerForMobile();
    };
    this.mobileCloseButton.on('pointerdown', closeTap);
    this.mobileCloseHit.on('pointerdown', closeTap);

    // Virtual joystick (movement)
    this.joystickRadius = portraitLayout ? 50 : 44;
    let joyY = h - this.minimapHeight - (portraitLayout ? 100 : 84);
    if (joyY < 180) joyY = h - 150;
    const joyX = 18 + this.joystickRadius;
    this.joystickCenter.set(joyX, joyY);
    this.joystickBase = this.add.circle(joyX, joyY, this.joystickRadius, 0x0b1220, 0.36)
      .setStrokeStyle(2, 0x38bdf8, 0.78).setDepth(20003).setScrollFactor(0);
    this.joystickKnob = this.add.circle(joyX, joyY, Math.max(16, Math.floor(this.joystickRadius * 0.42)), 0x0ea5e9, 0.9)
      .setStrokeStyle(2, 0x7dd3fc, 1).setDepth(20004).setScrollFactor(0);
    this.joystickZone = this.add.circle(joyX, joyY, this.joystickRadius + 22, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: false }).setDepth(20000).setScrollFactor(0);
    if (this.joystickZone.input) (this.joystickZone.input as any).priorityID = 15;
    this.joystickZone.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.joystickPointerId = pointer.id;
      this.updateJoystickFromPointer(pointer);
    });
    this.mobileControls.add([this.joystickBase, this.joystickKnob, this.joystickZone]);
    this.joystickMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId == null || pointer.id !== this.joystickPointerId) return;
      this.updateJoystickFromPointer(pointer);
    };
    this.joystickUpHandler = (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId == null || pointer.id !== this.joystickPointerId) return;
      this.releaseJoystick();
    };
    this.input.on('pointermove', this.joystickMoveHandler);
    this.input.on('pointerup', this.joystickUpHandler);
  }

  private updateJoystickFromPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.joystickKnob) return;
    const dxRaw = pointer.x - this.joystickCenter.x;
    const dyRaw = pointer.y - this.joystickCenter.y;
    const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
    const maxDist = this.joystickRadius;
    const scale = dist > maxDist ? maxDist / dist : 1;
    const dx = dxRaw * scale;
    const dy = dyRaw * scale;
    this.joystickKnob.setPosition(this.joystickCenter.x + dx, this.joystickCenter.y + dy);
    const nx = Phaser.Math.Clamp(dx / maxDist, -1, 1);
    const ny = Phaser.Math.Clamp(dy / maxDist, -1, 1);
    events.emit('mobile-move', { x: nx, y: ny });
  }

  private releaseJoystick(): void {
    this.joystickPointerId = null;
    if (this.joystickKnob) {
      this.joystickKnob.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    }
    events.emit('mobile-move', { x: 0, y: 0 });
  }

  private refreshMobileActionButtons(): void {
    if (!this.mobileViewport) return;
    const entries = Object.values(this.mobileButtons);
    entries.forEach((entry) => {
      const active = entry.activeCheck ? !!entry.activeCheck() : false;
      const label = active ? (entry.activeLabel || `${entry.idleLabel}×`) : entry.idleLabel;
      entry.text.setText(label);
      entry.bg.setFillStyle(active ? 0x0c3a57 : 0x0b1220, active ? 0.95 : 0.88);
      entry.bg.setStrokeStyle(1, active ? 0x38bdf8 : 0x1e3a5f, 0.92);
      entry.text.setColor(active ? '#67e8f9' : '#e2e8f0');
    });
    if (this.mobileCloseButton) {
      const hasClosable =
        this.buildModeActive ||
        this.craftingPanel.getIsOpen() ||
        this.questPanel.getIsOpen() ||
        this.basePanel.getIsOpen() ||
        this.exchangePanel.getIsOpen() ||
        this.glassesShopPanel.getIsOpen() ||
        this.gearVaultPanel.getIsOpen() ||
        this.collectionPanel.getIsOpen() ||
        this.leisurePanel.getIsOpen();
      this.mobileCloseButton.setVisible(hasClosable);
      this.mobileCloseHit?.setVisible(hasClosable);
    }
  }

  update(time: number, delta: number): void {
    this.updateMinimap();
    this.updateWeaponSlots();
    this.updateDurabilityDebuffHud();
    if (time >= this.storyChainUpdateAt) {
      this.storyChainUpdateAt = time + 180;
      this.updateStoryChainHud();
    }
    if (this.mobileViewport && time >= this.mobileUiRefreshAt) {
      this.mobileUiRefreshAt = time + 120;
      this.refreshMobileActionButtons();
    }

    // Update grade every 2 seconds
    this.gradeTimer -= delta;
    if (this.gradeTimer <= 0) {
      this.gradeTimer = 2000;
      this.updateGrade();
    }
  }

  private updateGrade(): void {
    const stats = gameState.data.stats;
    const kills = stats.enemiesKilled;
    const time = stats.survivalTime || 0;
    const combo = stats.highestCombo;

    // Simple grade formula
    let score = kills * 10 + time * 0.5 + combo * 20;
    const day = gameState.data.currentDay;
    score += day * 50;

    let grade = 'D';
    let color = '#94a3b8';
    if (score > 5000) { grade = 'S+'; color = '#f59e0b'; }
    else if (score > 3000) { grade = 'S'; color = '#fbbf24'; }
    else if (score > 2000) { grade = 'A'; color = '#4ade80'; }
    else if (score > 1200) { grade = 'B'; color = '#38bdf8'; }
    else if (score > 600) { grade = 'C'; color = '#a78bfa'; }

    this.gradeText.setText(`评级 ${grade}`);
    this.gradeText.setColor(color);
  }

  // ========================================
  // DRAWING METHODS
  // ========================================
  private drawHealthBar(current: number, max: number): void {
    const x = 15;
    const y = 55;
    const w = this.leftHudExpanded ? 214 : 142;
    const h = 8;
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x1e293b, 0.8);
    this.healthBarBg.fillRoundedRect(x, y, w, h, 3);

    this.healthBar.clear();
    const ratio = Math.max(0, current / max);
    const color = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xfbbf24 : 0xef4444;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRoundedRect(x, y, w * ratio, h, 3);

    // Low health pulse warning
    if (ratio <= 0.25 && ratio > 0) {
      this.tweens.killTweensOf(this.healthBar);
      this.tweens.add({
        targets: this.healthBar, alpha: { from: 1, to: 0.4 },
        duration: 400, yoyo: true, repeat: -1,
      });
    } else {
      this.tweens.killTweensOf(this.healthBar);
      this.healthBar.setAlpha(1);
    }
  }

  private drawExpBar(current: number, max: number): void {
    const w = this.cameras.main.width;
    const barW = 150, barH = 6;
    const x = w - 15 - barW, y = 30;

    this.expBarBg.clear();
    this.expBarBg.fillStyle(0x1e293b, 0.8);
    this.expBarBg.fillRoundedRect(x, y, barW, barH, 2);

    this.expBar.clear();
    const ratio = max > 0 ? Math.min(1, current / max) : 0;
    this.expBar.fillStyle(0x8b5cf6, 1);
    this.expBar.fillRoundedRect(x, y, barW * ratio, barH, 2);
  }

  private updateStoryChainHud(): void {
    const gameScene = this.scene.get('GameScene') as any;
    const snapshot = gameScene?.getRunEventHudProgressSnapshot?.();
    if (!snapshot || typeof snapshot.chainRatio !== 'number') {
      this.storyChainText?.setText('事件链: 前置 0/2');
      this.storyChainBarFill?.setSize(2, 4);
      return;
    }
    const chainRatio = Phaser.Math.Clamp(Number(snapshot.chainRatio || 0), 0, 1);
    const chapter = Number(snapshot.chapter || 1);
    const chapterLabel = snapshot.chapterLabel || `章节${chapter}`;
    const stageLabel = snapshot.stageLabel || '前置';
    const stageProgress = Math.max(0, Math.floor(snapshot.stageProgress || 0));
    const stageTarget = Math.max(1, Math.floor(snapshot.stageTarget || 1));
    const chapterProgress = Phaser.Math.Clamp(Number(snapshot.chapterProgress || 0), 0, 1);
    const progressColor = chainRatio >= 0.9 ? '#f59e0b' : chainRatio >= 0.5 ? '#22d3ee' : '#67e8f9';
    this.storyChainText.setText(`事件链 ${stageLabel} ${stageProgress}/${stageTarget} · 章节${chapter} ${chapterLabel}`);
    this.storyChainText.setColor(progressColor);
    this.storyChainBarFill.setSize(Math.max(2, Math.round(248 * chainRatio)), 4);
    const fillColor = chainRatio >= 0.9
      ? 0xf59e0b
      : chapterProgress >= 0.66
        ? 0x22d3ee
        : 0x38bdf8;
    this.storyChainBarBg.setFillStyle(chainRatio >= 0.9 ? 0x3f2a12 : 0x1e293b, 0.9);
    this.storyChainBarFill.setFillStyle(fillColor, 0.96);
  }

  private updateTimeBar(timeOfDay: number = 0, isNight: boolean = false, isBloodMoon: boolean = false): void {
    const w = this.cameras.main.width;
    const barW = 248, barH = 5;
    const x = w / 2 - barW / 2, y = 30;

    this.timeBar.clear();
    // Background
    this.timeBar.fillStyle(0x1e293b, 0.8);
    this.timeBar.fillRoundedRect(x, y, barW, barH, 2);

    // Progress
    const color = isBloodMoon ? 0xef4444 : isNight ? 0x7c3aed : 0xfbbf24;
    this.timeBar.fillStyle(color, 1);
    this.timeBar.fillRoundedRect(x, y, barW * (timeOfDay / 100), barH, 2);

    // Day/night divider
    this.timeBar.fillStyle(0xffffff, 0.3);
    this.timeBar.fillRect(x + barW * 0.5, y, 1, barH);
  }

  private updateWeaponSlots(): void {
    if (!this.weaponSlots) return;
    this.weaponSlots.removeAll(true);

    const weapons = gameState.data.weapons;
    const slotW = 40, gap = 6;
    const total = weapons.length * slotW + (weapons.length - 1) * gap;
    const startX = -total / 2;

    weapons.forEach((weapon, i) => {
      const x = startX + i * (slotW + gap);
      const effectiveId = weapon.evolved && weapon.evolvedId ? weapon.evolvedId : weapon.id;
      const def = WEAPON_DEFS[effectiveId];
      if (!def) return;

      // Slot background
      const bg = this.add.rectangle(x + slotW / 2, 0, slotW, slotW, 0x1e293b, 0.9);
      bg.setStrokeStyle(2, weapon.evolved ? 0xf59e0b : 0x334155);
      this.weaponSlots.add(bg);

      // Weapon icon
      const iconTexture = this.getWeaponHudIconTexture(effectiveId);
      if (iconTexture && this.textures.exists(iconTexture)) {
        const icon = this.add.image(x + slotW / 2, -2, iconTexture).setScale(1.3);
        if (weapon.evolved) icon.setTint(0xfbbf24);
        this.weaponSlots.add(icon);
      } else {
        const dot = this.add.circle(x + slotW / 2, -3, 8, def.color);
        this.weaponSlots.add(dot);
      }

      // Level
      const lvl = this.add.text(x + slotW / 2, 12, `${weapon.level}`, {
        fontSize: this.hudFs(11, 10), color: '#94a3b8', fontFamily: this.uiFontFamily,
      }).setOrigin(0.5);
      this.weaponSlots.add(lvl);

      // Evolved indicator
      if (weapon.evolved) {
        const star = this.add.text(x + slotW - 2, -slotW / 2 + 2, '⭐', {
          fontSize: '10px',
        }).setOrigin(1, 0);
        this.weaponSlots.add(star);
      }
    });

    // Empty slots
    for (let i = weapons.length; i < gameState.data.maxWeaponSlots; i++) {
      const x = startX + i * (slotW + gap);
      const bg = this.add.rectangle(x + slotW / 2, 0, slotW, slotW, 0x111827, 0.5);
      bg.setStrokeStyle(1, 0x1e293b);
      this.weaponSlots.add(bg);
    }
  }

  private getWeaponHudIconTexture(weaponId: string): string | null {
    const baseByEvolved: Record<string, string> = {
      overclocked_laser: 'ar_basic',
      crit_storm: 'scatter',
      bullet_hell: 'pulse',
      hellfire: 'flame',
      annihilation_beam: 'pierce',
      reflection_cannon: 'cannon',
      absolute_zero: 'frost',
      emp_pulse: 'chain',
    };
    const resolved = baseByEvolved[weaponId] || weaponId;
    const map: Record<string, string> = {
      ar_basic: 'bullet',
      scatter: 'bullet_scatter',
      pulse: 'bullet_pulse',
      flame: 'bullet_flame',
      pierce: 'bullet_pierce',
      cannon: 'bullet_cannon',
      frost: 'bullet_frost',
      chain: 'bullet_chain',
    };
    return map[resolved] || null;
  }

  private updateMinimap(): void {
    if (!this.minimapGraphics) return;
    this.minimapGraphics.clear();

    const gameScene = this.scene.get('GameScene') as any;
    if (!gameScene || !gameScene.scene.isActive()) return;

    const mapX = 10;
    const mapW = this.minimapWidth;
    const mapH = this.minimapHeight;
    const mapY = this.cameras.main.height - mapH - 10;
    const scaleX = mapW / 2000;
    const scaleY = mapH / 1500;

    // Minimap biome base (mirrors world composition).
    this.minimapGraphics.fillStyle(0x101827, 0.94);
    this.minimapGraphics.fillRect(mapX, mapY, mapW, mapH);

    this.minimapGraphics.fillStyle(0x233447, 0.5); // city NW
    this.minimapGraphics.fillEllipse(mapX + mapW * 0.16, mapY + mapH * 0.25, mapW * 0.38, mapH * 0.42);
    this.minimapGraphics.fillStyle(0x1c3a2e, 0.46); // forest NE
    this.minimapGraphics.fillEllipse(mapX + mapW * 0.8, mapY + mapH * 0.24, mapW * 0.44, mapH * 0.44);
    this.minimapGraphics.fillStyle(0x3a2d21, 0.42); // wasteland SW
    this.minimapGraphics.fillEllipse(mapX + mapW * 0.24, mapY + mapH * 0.78, mapW * 0.54, mapH * 0.42);
    this.minimapGraphics.fillStyle(0x253247, 0.46); // cave / rocky SE
    this.minimapGraphics.fillEllipse(mapX + mapW * 0.84, mapY + mapH * 0.78, mapW * 0.36, mapH * 0.3);
    this.minimapGraphics.fillStyle(0x22d3ee, 0.24); // river
    this.minimapGraphics.fillRect(mapX + mapW * 0.15, mapY + mapH * 0.04, mapW * 0.1, mapH * 0.9);
    this.minimapGraphics.fillRect(mapX + mapW * 0.19, mapY + mapH * 0.69, mapW * 0.18, mapH * 0.13);
    this.minimapGraphics.fillRect(mapX + mapW * 0.18, mapY + mapH * 0.13, mapW * 0.14, mapH * 0.17);
    this.minimapGraphics.fillStyle(0x111827, 0.9); // roads
    this.minimapGraphics.fillRect(mapX + mapW * 0.48, mapY, mapW * 0.04, mapH);
    this.minimapGraphics.fillRect(mapX + mapW * 0.11, mapY + mapH * 0.47, mapW * 0.78, mapH * 0.06);

    // Base
    this.minimapGraphics.fillStyle(0x0ea5e9, 0.32);
    this.minimapGraphics.fillEllipse(mapX + 1000 * scaleX, mapY + 750 * scaleY, 360 * scaleX, 320 * scaleY);

    // Player
    const player = gameScene.player;
    if (player) {
      this.minimapGraphics.fillStyle(0x0ea5e9, 1);
      this.minimapGraphics.fillCircle(mapX + player.x * scaleX, mapY + player.y * scaleY, 3);
    }

    // Enemies (small red dots)
    if (gameScene.enemies) {
      this.minimapGraphics.fillStyle(0xff0000, 0.7);
      gameScene.enemies.getChildren().forEach((e: any) => {
        if (e.active) {
          this.minimapGraphics.fillCircle(mapX + e.x * scaleX, mapY + e.y * scaleY, 1.5);
        }
      });
    }

    // Companions (blue dots)
    if (gameScene.companions) {
      this.minimapGraphics.fillStyle(0x38bdf8, 0.8);
      gameScene.companions.getChildren().forEach((c: any) => {
        if (c.active) {
          this.minimapGraphics.fillCircle(mapX + c.x * scaleX, mapY + c.y * scaleY, 2);
        }
      });
    }

    // Exploration spots (zone-colored markers)
    const spots = Array.isArray(gameScene.explorationSpots) ? gameScene.explorationSpots as any[] : [];
    if (spots.length > 0) {
      const isNight = !!gameState.data.isNight;
      const mapRadius = this.minimapWidth <= 120 ? 2.2 : 2.6;
      const zoneColor = (zone: string): number => {
        if (zone === 'river') return 0x22d3ee;
        if (zone === 'forest') return 0x4ade80;
        if (zone === 'city') return 0xf8fafc;
        if (zone === 'cave') return 0xc4b5fd;
        return 0x94a3b8;
      };
      spots.forEach((spot) => {
        if (!spot || !spot.marker?.active) return;
        const x = mapX + Number(spot.x || 0) * scaleX;
        const y = mapY + Number(spot.y || 0) * scaleY;
        const baseColor = Number.isFinite(spot.color) ? spot.color : zoneColor(spot.zone);
        const color = isNight ? 0x475569 : baseColor;
        this.minimapGraphics.fillStyle(color, isNight ? 0.6 : 0.86);
        this.minimapGraphics.fillCircle(x, y, mapRadius);
      });

      const pendingSpot = gameScene.pendingExplorationSpot as any;
      if (pendingSpot?.marker?.active) {
        const px = mapX + Number(pendingSpot.x || 0) * scaleX;
        const py = mapY + Number(pendingSpot.y || 0) * scaleY;
        this.minimapGraphics.lineStyle(1, 0xfbbf24, 0.9);
        this.minimapGraphics.strokeCircle(px, py, mapRadius + 2.1);
      }
    }

    // Base diagnostics: upkeep/input/power shortages.
    const diagnostics = Array.isArray(gameState.data.base.nodeDiagnostics)
      ? gameState.data.base.nodeDiagnostics
      : [];
    diagnostics.forEach((node: any) => {
      const x = mapX + Number(node.x || 0) * scaleX;
      const y = mapY + Number(node.y || 0) * scaleY;
      const issues: string[] = Array.isArray(node.issues) ? node.issues : [];
      const hasUpkeep = issues.includes('upkeep');
      const hasInput = issues.includes('input');
      const hasPower = issues.includes('power');
      const mixed = Number(hasUpkeep) + Number(hasInput) + Number(hasPower) >= 2;

      if (mixed) {
        this.minimapGraphics.fillStyle(0xf472b6, 0.9);
        this.minimapGraphics.fillCircle(x, y, 2.8);
        this.minimapGraphics.lineStyle(1, 0xfdf2f8, 0.95);
        this.minimapGraphics.strokeCircle(x, y, 4.1);
        return;
      }
      if (hasPower) {
        this.minimapGraphics.fillStyle(0xfbbf24, 0.95);
        this.minimapGraphics.fillTriangle(x, y - 3.6, x + 2.8, y + 3.4, x - 2.8, y + 3.4);
        return;
      }
      if (hasInput) {
        this.minimapGraphics.fillStyle(0x38bdf8, 0.9);
        this.minimapGraphics.fillCircle(x, y, 2.6);
        return;
      }
      if (hasUpkeep) {
        this.minimapGraphics.fillStyle(0xfb7185, 0.9);
        this.minimapGraphics.fillRect(x - 2.3, y - 2.3, 4.6, 4.6);
      }
    });
  }

  private trySelectDiagnosticNodeFromMinimap(screenX: number, screenY: number): void {
    const diagnostics = Array.isArray(gameState.data.base.nodeDiagnostics)
      ? gameState.data.base.nodeDiagnostics
      : [];
    if (diagnostics.length <= 0) {
      this.showHudToast('当前无故障节点', '#93c5fd');
      this.hideMinimapDiagnosticPanel();
      return;
    }
    const mapX = 10;
    const mapW = this.minimapWidth;
    const mapH = this.minimapHeight;
    const mapY = this.cameras.main.height - mapH - 10;
    const scaleX = mapW / 2000;
    const scaleY = mapH / 1500;
    let nearest: any = null;
    let minDist = Number.POSITIVE_INFINITY;
    diagnostics.forEach((node: any) => {
      const x = mapX + Number(node.x || 0) * scaleX;
      const y = mapY + Number(node.y || 0) * scaleY;
      const dist = Phaser.Math.Distance.Between(screenX, screenY, x, y);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    });
    if (!nearest || minDist > 12) {
      this.hideMinimapDiagnosticPanel();
      return;
    }
    this.minimapSelectedNode = {
      x: Math.round(Number(nearest.x || 0)),
      y: Math.round(Number(nearest.y || 0)),
    };
    const gameScene = this.scene.get('GameScene') as any;
    gameScene?.focusCameraOnWorldPoint?.(this.minimapSelectedNode.x, this.minimapSelectedNode.y, 1200);
    this.showMinimapDiagnosticPanel(nearest);
  }

  private showMinimapDiagnosticPanel(node: any): void {
    this.hideMinimapDiagnosticPanel();
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = this.mobileViewport ? Math.min(300, w - 20) : 320;
    const panelH = this.mobileViewport ? 142 : 132;
    const x = Math.min(w - panelW - 10, 10 + this.minimapWidth + 10);
    const y = h - this.minimapHeight - panelH - 18;
    const container = this.add.container(0, 0).setDepth(1900).setScrollFactor(0);
    const bg = this.add.rectangle(x + panelW * 0.5, y + panelH * 0.5, panelW, panelH, 0x0b1220, 0.94)
      .setStrokeStyle(1, 0x38bdf8, 0.8)
      .setScrollFactor(0);
    container.add(bg);
    const issueMap: Record<string, string> = { upkeep: '缺维护', input: '缺输入', power: '缺电' };
    const issues = Array.isArray(node?.issues) ? node.issues : [];
    const issueText = issues.map((key: string) => issueMap[key] || key).join(' / ');
    const details = Array.isArray(node?.shortageResources) && node.shortageResources.length > 0
      ? `短缺: ${node.shortageResources.join('、')}`
      : '短缺: 无';
    const title = this.add.text(x + 10, y + 8, `诊断节点 · ${node?.nameCN || '未知设施'} T${node?.tier || 1}`, {
      fontSize: this.hudFs(13, 12),
      color: '#e2e8f0',
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
    }).setScrollFactor(0);
    const desc = this.add.text(x + 10, y + 30, `问题: ${issueText || '无'}\n${details}`, {
      fontSize: this.hudFs(11, 10),
      color: '#93c5fd',
      fontFamily: this.uiFontFamily,
      lineSpacing: 4,
    }).setScrollFactor(0);
    container.add([title, desc]);

    const makeBtn = (
      bx: number,
      by: number,
      bw: number,
      label: string,
      stroke: number,
      onTap: () => void
    ) => {
      const btn = this.add.rectangle(bx, by, bw, 30, 0x111827, 0.92)
        .setStrokeStyle(1, stroke, 0.95)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      const text = this.add.text(bx, by - 1, label, {
        fontSize: this.hudFs(12, 11),
        color: '#e2e8f0',
        fontFamily: this.uiFontFamily,
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0);
      btn.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onTap();
      });
      container.add([btn, text]);
    };

    const left = x + 62;
    const gap = 100;
    makeBtn(left, y + panelH - 22, 90, '一键维修', 0x22d3ee, () => this.onQuickRepairSelectedNode());
    makeBtn(left + gap, y + panelH - 22, 90, '派工', 0xf59e0b, () => this.onDispatchSelectedNode());
    makeBtn(left + gap * 2, y + panelH - 22, 90, '关闭', 0x64748b, () => this.hideMinimapDiagnosticPanel());

    this.minimapDiagPanel = container;
  }

  private hideMinimapDiagnosticPanel(): void {
    this.minimapDiagPanel?.destroy();
    this.minimapDiagPanel = null;
    this.minimapSelectedNode = null;
  }

  private onQuickRepairSelectedNode(): void {
    const node = this.minimapSelectedNode;
    if (!node) return;
    const result = BaseSystem.quickRepairDiagnosticNodeByCoord(node.x, node.y);
    this.showHudToast(result.message, result.ok ? '#38bdf8' : '#ef4444');
    events.emit('update-resources', gameState.data.resources);
    const refreshed = (gameState.data.base.nodeDiagnostics || []).find((n) => Math.abs(n.x - node.x) < 2 && Math.abs(n.y - node.y) < 2);
    if (refreshed) this.showMinimapDiagnosticPanel(refreshed);
    else this.hideMinimapDiagnosticPanel();
  }

  private onDispatchSelectedNode(): void {
    const node = this.minimapSelectedNode;
    if (!node) return;
    const result = BaseSystem.dispatchCrewToDiagnosticNodeByCoord(node.x, node.y);
    this.showHudToast(result.message, result.ok ? '#f59e0b' : '#ef4444');
    events.emit(GameEvents.BASE_UPDATED, { ...gameState.data.base });
    const refreshed = (gameState.data.base.nodeDiagnostics || []).find((n) => Math.abs(n.x - node.x) < 2 && Math.abs(n.y - node.y) < 2);
    if (refreshed) this.showMinimapDiagnosticPanel(refreshed);
    else this.hideMinimapDiagnosticPanel();
  }

  private showHudToast(message: string, color: string): void {
    const toast = this.add.text(this.cameras.main.width * 0.5, 86, message, {
      fontSize: this.hudFs(14, 12),
      color,
      fontFamily: this.uiFontFamily,
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
      backgroundColor: '#0b1220cc',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(1990).setScrollFactor(0);
    this.tweens.add({
      targets: toast,
      y: 64,
      alpha: 0,
      duration: 1250,
      onComplete: () => toast.destroy(),
    });
  }

  private createResourceHud(startX: number, startY: number): void {
    const entries = [
      { key: 'wood', icon: 'icon_wood' },
      { key: 'metal', icon: 'icon_metal' },
      { key: 'scrap', icon: 'icon_scrap' },
      { key: 'food', icon: 'icon_food' },
      { key: 'water', icon: 'icon_water' },
      { key: 'medical', icon: 'icon_medical' },
      { key: 'ammo', icon: 'icon_ammo' },
      { key: 'energyCore', icon: 'icon_core' },
      { key: 'bitcoin', icon: 'icon_bitcoin' },
      { key: 'power', icon: 'icon_power' },
    ];
    const cellW = 72;
    const cellH = 24;
    const cols = 5;
    entries.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = startX + col * cellW;
      const y = startY + row * cellH;
      const bg = this.add.rectangle(x, y, 68, 22, 0x151a23, 0.84)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x4b5563, 0.75)
        .setDepth(1001);
      const icon = this.textures.exists(entry.icon)
        ? this.add.image(x + 10, y + 11, entry.icon).setScale(1).setDepth(1002)
        : this.add.rectangle(x + 10, y + 10, 10, 10, 0x64748b, 1).setDepth(1002);
      const value = this.add.text(x + 23, y + 3, '0', {
        fontSize: this.hudFs(13, 12),
        color: '#e2e8f0',
        fontFamily: this.uiFontFamily,
        fontStyle: 'bold',
      }).setDepth(1002);
      this.resourceValueTexts[entry.key] = value;
      bg.setScrollFactor(0);
      icon.setScrollFactor(0);
      value.setScrollFactor(0);
      this.leftHudCollapsibleObjects.push(bg, icon, value);
    });
    this.updateResourceHud(gameState.data.resources);
  }

  private updateResourceHud(resources: any): void {
    if (!resources) return;
    const set = (key: string, val: string, color = '#e2e8f0') => {
      const text = this.resourceValueTexts[key];
      if (!text || !text.active || !(text as any).canvas || !(text as any).context) return;
      text.setText(val);
      text.setColor(color);
    };
    set('wood', `${Math.max(0, resources.wood || 0)}`);
    set('metal', `${Math.max(0, resources.metal || 0)}`);
    set('scrap', `${Math.max(0, resources.scrap || 0)}`);
    set('food', `${Math.max(0, resources.food || 0)}`);
    set('water', `${Math.max(0, resources.water || 0)}`);
    set('medical', `${Math.max(0, resources.medical || 0)}`);
    set('ammo', `${Math.max(0, resources.ammo || 0)}`);
    set('energyCore', `${Math.max(0, resources.energyCore || 0)}`);
    set('bitcoin', `${Number(resources.bitcoin || 0).toFixed(2)}`, '#fbbf24');

    const base = gameState.data.base;
    const overload = base.powerUsed > base.powerCapacity;
    set('power', `${base.powerUsed}/${base.powerCapacity}`, overload ? '#ef4444' : '#38bdf8');
    const upkeepCount = Math.max(0, Math.floor(base.diagnosticUpkeepNodes || 0));
    const inputCount = Math.max(0, Math.floor(base.diagnosticInputNodes || 0));
    const powerCount = Math.max(0, Math.floor(base.diagnosticPowerNodes || 0));
    const total = upkeepCount + inputCount + powerCount;
    if (this.minimapDiagText) {
      this.minimapDiagText.setText(`维${upkeepCount} 输${inputCount} 电${powerCount}`);
      this.minimapDiagText.setColor(total > 0 ? '#fda4af' : '#93c5fd');
    }
  }

  private createRightStatusHud(rightX: number, startY: number): void {
    const lineW = 186;
    const rowH = 23;
    const rows = [
      {
        id: 'glasses',
        icon: 'icon_glasses',
        color: '#93c5fd',
        text: AR_GLASSES[gameState.data.equippedGlasses]?.nameCN || '未装备',
      },
      {
        id: 'tree',
        icon: 'icon_bullet_tree',
        color: '#c4b5fd',
        text: EvolutionSystem.getEquippedBrandSkillTree().treeNameCN,
      },
      {
        id: 'group',
        icon: 'icon_group',
        color: '#38bdf8',
        text: `${gameState.data.companions.length}/${BaseSystem.getPopulationCapacity()}人`,
      },
      {
        id: 'protocol',
        icon: 'icon_protocol',
        color: '#67e8f9',
        text: this.getProtocolStatusText(),
      },
    ];
    rows.forEach((row, idx) => {
      const y = startY + idx * rowH;
      const bg = this.add.rectangle(rightX - lineW, y, lineW, 21, 0x151a23, 0.76)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x5b4a36, 0.65)
        .setDepth(1001)
        .setScrollFactor(0);
      const icon = this.textures.exists(row.icon)
        ? this.add.image(rightX - lineW + 10, y + 10, row.icon).setScale(1).setDepth(1002).setScrollFactor(0)
        : this.add.rectangle(rightX - lineW + 10, y + 10, 10, 10, 0x64748b, 1).setDepth(1002).setScrollFactor(0);
      const value = this.add.text(rightX - lineW + 20, y + 4, row.text, {
        fontSize: this.hudFs(13, 12),
        color: row.color,
        fontFamily: this.uiFontFamily,
        fontStyle: 'bold',
      }).setDepth(1002).setScrollFactor(0);
      this.rightStatusTexts[row.id as 'glasses' | 'tree' | 'group' | 'protocol'] = value;
      bg.setData('hud-role', row.id);
      icon.setData('hud-role', row.id);
    });
  }

  private getProtocolStatusText(): string {
    const levels = EvolutionSystem.getProtocolLevels();
    const totalLevel = Object.values(levels).reduce((sum, lv) => sum + Math.max(0, lv || 0), 0);
    if (totalLevel <= 0) return '协议: 未激活';
    const peak = Math.max(...Object.values(levels));
    return `协议 Lv.${totalLevel} · 峰值${peak}`;
  }

  private refreshProtocolStatusHud(): void {
    this.rightStatusTexts.protocol?.setText(this.getProtocolStatusText());
  }

  private refreshQuestHud(): void {
    if (!this.questHudText) return;
    const active = QuestSystem.getActiveQuests();
    if (active.length === 0) {
      this.questHudText.setText('');
      return;
    }
    const quest = active[0];
    const lines: string[] = [];
    lines.push(`任务: ${quest.def.nameCN}`);
    quest.objectives.forEach(o => {
      lines.push(`${o.obj.descriptionCN} ${o.current}/${o.target}`);
    });
    this.questHudText.setText(lines.join('\n'));
  }

  private registerKeyboardHotkeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    // Ensure no duplicate listeners survive scene restart / hot-reload.
    keyboard.off('keydown-T', this.onHotkeyToggleBase);
    keyboard.off('keydown-H', this.onHotkeyToggleLeisure);
    keyboard.off('keydown-V', this.onHotkeyToggleGearVault);
    keyboard.off('keydown-J', this.onHotkeyToggleLootCodex);
    keyboard.on('keydown-T', this.onHotkeyToggleBase);
    keyboard.on('keydown-H', this.onHotkeyToggleLeisure);
    keyboard.on('keydown-V', this.onHotkeyToggleGearVault);
    keyboard.on('keydown-J', this.onHotkeyToggleLootCodex);
  }

  private unregisterKeyboardHotkeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off('keydown-T', this.onHotkeyToggleBase);
    keyboard.off('keydown-H', this.onHotkeyToggleLeisure);
    keyboard.off('keydown-V', this.onHotkeyToggleGearVault);
    keyboard.off('keydown-J', this.onHotkeyToggleLootCodex);
  }

  shutdown(): void {
    events.off(GameEvents.PLAYER_HEALTH_CHANGE);
    events.off(GameEvents.PLAYER_EXP_CHANGE);
    events.off(GameEvents.PLAYER_LEVEL_UP);
    events.off(GameEvents.TIME_UPDATE);
    events.off(GameEvents.ENEMY_KILLED);
    events.off(GameEvents.WEAPON_CHANGED);
    events.off(GameEvents.COMPANION_ROSTER_UPDATED);
    events.off(GameEvents.WAVE_START);
    events.off(GameEvents.WAVE_COMPLETE);
    events.off('quest-updated');
    events.off('update-resources');
    events.off('toggle-crafting');
    events.off('open-crafting-category');
    events.off('toggle-quests');
    events.off('open-quests');
    events.off('toggle-base');
    events.off('toggle-leisure');
    events.off('toggle-exchange');
    events.off('open-glasses-shop');
    events.off('toggle-gear-vault');
    events.off('gear-stash-updated');
    events.off('toggle-loot-codex');
    events.off('loot-codex-updated');
    events.off(GameEvents.BASE_UPDATED);
    events.off('quest-completed');
    events.off('show-levelup-panel');
    events.off('protocol-updated');
    events.off('toggle-collection');
    events.off('glasses-equipped');
    events.off(GameEvents.BUILD_MODE_TOGGLED);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.unregisterKeyboardHotkeys();
    if (this.joystickMoveHandler) {
      this.input.off('pointermove', this.joystickMoveHandler);
      this.joystickMoveHandler = null;
    }
    if (this.joystickUpHandler) {
      this.input.off('pointerup', this.joystickUpHandler);
      this.joystickUpHandler = null;
    }
    this.releaseJoystick();
    this.mobileControls?.destroy();
    this.mobileControls = null;
    this.mobileCloseButton?.destroy();
    this.mobileCloseButton = null;
    this.mobileCloseHit?.destroy();
    this.mobileCloseHit = null;
    this.minimapDiagPanel?.destroy();
    this.minimapDiagPanel = null;
    this.minimapSelectedNode = null;
    this.mobileButtons = {};
    this.joystickZone = null;
    this.joystickBase = null;
    this.joystickKnob = null;

    this.craftingPanel?.destroy();
    this.questPanel?.destroy();
    this.levelUpPanel?.destroy();
    this.collectionPanel?.destroy();
    this.basePanel?.destroy();
    this.leisurePanel?.hide();
    this.exchangePanel?.destroy();
    this.glassesShopPanel?.destroy();
    this.gearVaultPanel?.destroy();
    this.lootCodexPanel?.destroy();
    this.resetRuntimeUiState();
  }
}
