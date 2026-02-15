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
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapWidth: number = 150;
  private minimapHeight: number = 112;

  // Right side
  private companionText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private resourceValueTexts: Record<string, Phaser.GameObjects.Text> = {};
  private rightStatusTexts: {
    glasses?: Phaser.GameObjects.Text;
    tree?: Phaser.GameObjects.Text;
    group?: Phaser.GameObjects.Text;
  } = {};

  // Wave / Blood Moon
  private waveText!: Phaser.GameObjects.Text;
  private bloodMoonIndicator!: Phaser.GameObjects.Text;
  private questHudText!: Phaser.GameObjects.Text;

  // Grade
  private gradeText!: Phaser.GameObjects.Text;
  private gradeTimer: number = 0;
  private glassesText!: Phaser.GameObjects.Text;

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
  private brandTreeText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const portraitLayout = h > w * 1.2;

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
    this.input.setTopOnly(true);

    // ========================================
    // TOP BAR
    // ========================================
    this.add.rectangle(w / 2, 0, w, 50, 0x0f172a, 0.92)
      .setOrigin(0.5, 0).setDepth(1000);

    // Day / Time (top center)
    this.dayText = this.add.text(w / 2, 8, '第1天 · 第1周', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);

    // Time bar (below day text)
    this.timeBar = this.add.graphics().setDepth(1001);

    // Blood moon indicator
    this.bloodMoonIndicator = this.add.text(w / 2, 36, '', {
      fontSize: '12px', color: '#ef4444', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);

    // Level + XP (top right)
    this.levelText = this.add.text(w - 15, 5, 'Lv.1', {
      fontSize: '22px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(1001);

    this.expBarBg = this.add.graphics().setDepth(1001);
    this.expBar = this.add.graphics().setDepth(1001);
    this.drawExpBar(0, 1);

    // ========================================
    // LEFT SIDE
    // ========================================
    // Health bar
    this.healthBarBg = this.add.graphics().setDepth(1001);
    this.healthBar = this.add.graphics().setDepth(1001);
    this.healthText = this.add.text(15, 58, '100/100', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setDepth(1001);
    this.drawHealthBar(100, 100);

    // Kills
    this.killText = this.add.text(15, 80, '击杀: 0', {
      fontSize: '14px', color: '#ef4444', fontFamily: 'Courier New',
    }).setDepth(1001);

    // Resources
    this.resourceText = this.add.text(15, 100, '', {
      fontSize: '12px', color: '#94a3b8', fontFamily: 'Courier New',
    }).setDepth(1001).setVisible(false);
    this.createResourceHud(15, 98);

    // Wave info
    this.waveText = this.add.text(15, 140, '', {
      fontSize: '16px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
    }).setDepth(1001);

    // Quest HUD (top-left under wave)
    this.questHudText = this.add.text(15, 165, '', {
      fontSize: '12px', color: '#e2e8f0', fontFamily: 'Courier New',
    }).setDepth(1001);

    // ========================================
    // BOTTOM CENTER - WEAPON SLOTS
    // ========================================
    this.weaponSlots = this.add.container(portraitLayout ? (w / 2) : (w - 160), portraitLayout ? (h - 146) : (h - 120)).setDepth(1001);
    this.updateWeaponSlots();

    this.weaponText = this.add.text(portraitLayout ? (w / 2) : (w - 160), portraitLayout ? (h - 176) : (h - 150), '', {
      fontSize: '14px', color: '#0ea5e9', fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(1001);

    // ========================================
    // BOTTOM LEFT - MINIMAP
    // ========================================
    this.minimapWidth = portraitLayout ? 112 : 150;
    this.minimapHeight = portraitLayout ? 84 : 112;
    this.add.rectangle(10, h - 10, this.minimapWidth, this.minimapHeight, 0x0f172a, 0.85)
      .setOrigin(0, 1).setStrokeStyle(1, 0x0ea5e9, 0.5).setDepth(1000);
    this.minimapGraphics = this.add.graphics().setDepth(1001);

    this.add.text(10 + this.minimapWidth * 0.5, h - this.minimapHeight - 8, '小地图', {
      fontSize: portraitLayout ? '10px' : '11px',
      color: '#0ea5e9',
      fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(1001);

    // ========================================
    // RIGHT SIDE - COMPANIONS
    // ========================================
    this.companionText = this.add.text(w - 15, 110, '微信群: 0人', {
      fontSize: '14px', color: '#38bdf8', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);

    // ========================================
    // TOP LEFT - GRADE
    // ========================================
    this.gradeText = this.add.text(w - 15, 50, '', {
      fontSize: '18px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(1001);

    const equippedName = AR_GLASSES[gameState.data.equippedGlasses]?.nameCN || '未装备';
    this.glassesText = this.add.text(w - 15, 72, `眼镜: ${equippedName}`, {
      fontSize: '11px', color: '#93c5fd', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);
    const tree = EvolutionSystem.getEquippedBrandSkillTree();
    this.brandTreeText = this.add.text(w - 15, 86, `弹幕树: ${tree.treeNameCN}`, {
      fontSize: '11px', color: '#c4b5fd', fontFamily: 'Courier New',
    }).setOrigin(1, 0).setDepth(1001).setVisible(false);
    this.createRightStatusHud(w - 15, 74);

    // ========================================
    // BOTTOM RIGHT - CONTROLS
    // ========================================
    const compactHud = w <= 900;
    const controlsText = compactHud
      ? (portraitLayout
        ? '竖屏HUD: B建造 C制造 Q任务 T基地 V仓库\nE交互 X交易 R拆除 G图鉴'
        : 'B建造 C制造 Q任务 T基地 H休闲 V仓库\nE交互 X交易 R拆除 G图鉴')
      : 'WASD:移动 | B:建造 | C:制造 | Q:任务 | T:基地 | H:休闲 | V:仓库 | E:交互 | X:交易 | R:拆除 | G:图鉴';
    this.add.text(w - 10, h - 10, controlsText, {
      fontSize: compactHud ? (portraitLayout ? '15px' : '12px') : '11px',
      color: '#475569',
      fontFamily: 'Courier New',
      align: 'right',
      lineSpacing: 4,
    }).setOrigin(1, 1).setDepth(1001);

    // ========================================
    // EVENT LISTENERS
    // ========================================
    this.setupEventListeners();

    // ESC closes top-most panel
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.levelUpPanel?.getIsOpen()) return;
      if (this.gearVaultPanel?.getIsOpen()) { this.gearVaultPanel.toggle(); return; }
      if (this.glassesShopPanel?.getIsOpen()) { this.glassesShopPanel.toggle(); return; }
      if (this.exchangePanel?.getIsOpen()) { this.exchangePanel.toggle(); return; }
      if (this.basePanel?.getIsOpen()) { this.basePanel.toggle(); return; }
      if (this.leisurePanel?.getIsOpen()) { this.leisurePanel.toggle(); return; }
      if (this.craftingPanel?.getIsOpen()) { this.craftingPanel.toggle(); return; }
      if (this.questPanel?.getIsOpen()) { this.questPanel.toggle(); return; }
      if (this.collectionPanel?.getIsOpen()) { this.collectionPanel.toggle(); return; }
    });

    // Ensure base panel can always toggle from UI scene
    this.input.keyboard?.on('keydown-T', () => {
      if (this.levelUpPanel?.getIsOpen()) return;
      this.basePanel.toggle();
    });
    this.input.keyboard?.on('keydown-H', () => {
      if (this.levelUpPanel?.getIsOpen()) return;
      this.leisurePanel.toggle();
    });
    this.input.keyboard?.on('keydown-V', () => {
      if (this.levelUpPanel?.getIsOpen()) return;
      this.gearVaultPanel.toggle();
    });
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
        fontSize: '16px', color: '#38bdf8', fontFamily: 'Courier New', fontStyle: 'bold',
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

    events.on('quest-completed', (_data: any) => {
      const text = this.add.text(this.cameras.main.width / 2, 200, '✅ 任务完成!', {
        fontSize: '24px', color: '#4ade80', fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(2000);
      this.tweens.add({
        targets: text, y: 170, alpha: 0, duration: 2000,
        onComplete: () => text.destroy(),
      });
    });
  }

  update(_time: number, delta: number): void {
    this.updateMinimap();
    this.updateWeaponSlots();

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
    const x = 15, y = 55, w = 180, h = 6;
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
    const barW = 120, barH = 5;
    const x = w - 15 - barW, y = 30;

    this.expBarBg.clear();
    this.expBarBg.fillStyle(0x1e293b, 0.8);
    this.expBarBg.fillRoundedRect(x, y, barW, barH, 2);

    this.expBar.clear();
    const ratio = max > 0 ? Math.min(1, current / max) : 0;
    this.expBar.fillStyle(0x8b5cf6, 1);
    this.expBar.fillRoundedRect(x, y, barW * ratio, barH, 2);
  }

  private updateTimeBar(timeOfDay: number = 0, isNight: boolean = false, isBloodMoon: boolean = false): void {
    const w = this.cameras.main.width;
    const barW = 200, barH = 4;
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
        fontSize: '11px', color: '#94a3b8', fontFamily: 'Courier New',
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

    // Zone backgrounds
    this.minimapGraphics.fillStyle(0x2a2a3a, 0.4);
    this.minimapGraphics.fillRect(mapX, mapY, mapW / 2, mapH / 2);
    this.minimapGraphics.fillStyle(0x1a2a1a, 0.4);
    this.minimapGraphics.fillRect(mapX + mapW / 2, mapY, mapW / 2, mapH / 2);
    this.minimapGraphics.fillStyle(0x2a2a1a, 0.4);
    this.minimapGraphics.fillRect(mapX, mapY + mapH / 2, mapW / 2, mapH / 2);
    this.minimapGraphics.fillStyle(0x1a1a2a, 0.4);
    this.minimapGraphics.fillRect(mapX + mapW / 2, mapY + mapH / 2, mapW / 2, mapH / 2);

    // Base
    this.minimapGraphics.fillStyle(0x0ea5e9, 0.3);
    this.minimapGraphics.fillRect(mapX + 790 * scaleX, mapY + 560 * scaleX, 420 * scaleX, 420 * scaleY);

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
    const cellW = 74;
    const cellH = 20;
    const cols = 5;
    entries.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = startX + col * cellW;
      const y = startY + row * cellH;
      const bg = this.add.rectangle(x, y, 70, 18, 0x0f172a, 0.72)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x1e293b, 0.8)
        .setDepth(1001);
      const icon = this.textures.exists(entry.icon)
        ? this.add.image(x + 9, y + 9, entry.icon).setScale(0.95).setDepth(1002)
        : this.add.rectangle(x + 9, y + 9, 10, 10, 0x64748b, 1).setDepth(1002);
      const value = this.add.text(x + 18, y + 4, '0', {
        fontSize: '11px',
        color: '#e2e8f0',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }).setDepth(1002);
      this.resourceValueTexts[entry.key] = value;
      bg.setScrollFactor(0);
      icon.setScrollFactor(0);
      value.setScrollFactor(0);
    });
    this.updateResourceHud(gameState.data.resources);
  }

  private updateResourceHud(resources: any): void {
    if (!resources) return;
    const set = (key: string, val: string, color = '#e2e8f0') => {
      const text = this.resourceValueTexts[key];
      if (!text) return;
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
  }

  private createRightStatusHud(rightX: number, startY: number): void {
    const lineW = 162;
    const rowH = 19;
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
    ];
    rows.forEach((row, idx) => {
      const y = startY + idx * rowH;
      const bg = this.add.rectangle(rightX - lineW, y, lineW, 17, 0x0f172a, 0.7)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x1e293b, 0.8)
        .setDepth(1001)
        .setScrollFactor(0);
      const icon = this.textures.exists(row.icon)
        ? this.add.image(rightX - lineW + 9, y + 8, row.icon).setScale(0.9).setDepth(1002).setScrollFactor(0)
        : this.add.rectangle(rightX - lineW + 9, y + 8, 10, 10, 0x64748b, 1).setDepth(1002).setScrollFactor(0);
      const value = this.add.text(rightX - lineW + 18, y + 3, row.text, {
        fontSize: '11px',
        color: row.color,
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }).setDepth(1002).setScrollFactor(0);
      this.rightStatusTexts[row.id as 'glasses' | 'tree' | 'group'] = value;
      bg.setData('hud-role', row.id);
      icon.setData('hud-role', row.id);
    });
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
    events.off(GameEvents.BASE_UPDATED);
    events.off('quest-completed');
    events.off('show-levelup-panel');
    events.off('toggle-collection');
    events.off('glasses-equipped');
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.craftingPanel?.destroy();
    this.questPanel?.destroy();
    this.levelUpPanel?.destroy();
    this.collectionPanel?.destroy();
    this.basePanel?.destroy();
    this.leisurePanel?.hide();
    this.exchangePanel?.destroy();
    this.glassesShopPanel?.destroy();
    this.gearVaultPanel?.destroy();
  }
}
