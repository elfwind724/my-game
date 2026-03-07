import Phaser from 'phaser';
import { BITCOIN_PERK_DEFS, gameState, type GearItem, type GearRarity, type GearWeaponType } from '../state/GameState';
import { GearLootSystem } from '../systems/GearLootSystem';
import { events } from '../utils/EventBus';
import { resolvePreferredHeroPortraitTexture } from '../data/customHero';

const RARITY_STYLE: Record<GearRarity, { color: number; label: string; uiColor: string }> = {
  common: { color: 0x94a3b8, label: '普通', uiColor: '#94a3b8' },
  magic: { color: 0x3b82f6, label: '魔法', uiColor: '#3b82f6' },
  rare: { color: 0x10b981, label: '稀有', uiColor: '#10b981' },
  epic: { color: 0xa855f7, label: '史诗', uiColor: '#a855f7' },
  legendary: { color: 0xf59e0b, label: '传说', uiColor: '#f59e0b' },
  mythic: { color: 0xef4444, label: '神话', uiColor: '#ef4444' },
};

const WEAPON_LABELS: Record<GearWeaponType, string> = {
  pistol: '基础激光',
  shotgun: '散射光波',
  rifle: '脉冲连射',
  flamethrower: '烈焰射线',
  laser: '穿透光束',
  rocket: '能量炮',
  orbit: '环绕刀刃',
  holy_water: '圣水',
  lightning_ring: '闪电环',
  boomerang: '回旋镖',
};

const WEAPON_BODY_PART_LABELS: Record<GearWeaponType, string> = {
  pistol: '右手位',
  shotgun: '左手位',
  rifle: '背挂位',
  flamethrower: '肩挂位',
  laser: '目镜位',
  rocket: '重装位',
  orbit: '环绕位',
  holy_water: '辅助位',
  lightning_ring: '光环位',
  boomerang: '投掷位',
};

export class GearVaultPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen = false;
  private page = 0;
  private pageSize = 5;
  private fontBoost = 1;
  private layoutBoost = 1;
  private mobileViewport = false;
  private portraitViewport = false;

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
    const keepPage = this.page;
    this.hide(true);
    this.page = keepPage;
    this.show();
  }

  refresh(): void {
    if (!this.isOpen) return;
    this.rebuild();
  }

  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 1024 || (navigator.maxTouchPoints || 0) > 1;
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private computeFontBoost(panelW: number): number {
    const gameW = this.scene.cameras.main.width || 1;
    const canvasDisplayW = this.scene.game.canvas?.getBoundingClientRect().width || gameW;
    const density = gameW / Math.max(1, canvasDisplayW);
    const panelFactor = Phaser.Math.Clamp(panelW / 980, 0.85, 1.25);
    let boost = density * panelFactor * 1.28;
    if (this.mobileViewport && this.portraitViewport) {
      boost = Math.max(boost, 1.85);
    }
    return Phaser.Math.Clamp(boost, 1.2, 2.6);
  }

  private fs(base: number, min: number = 12): string {
    return `${Math.max(min, Math.round(base * this.fontBoost))}px`;
  }

  private unit(value: number): number {
    return Math.round(value * this.layoutBoost);
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = Math.min(1100, w - 20);
    const panelH = Math.min(700, h - 18);
    this.mobileViewport = this.isMobileDevice();
    this.portraitViewport = h > w * 1.15;
    this.fontBoost = this.computeFontBoost(panelW);
    this.layoutBoost = Phaser.Math.Clamp(this.fontBoost * 0.72, 1, 1.68);
    this.pageSize = this.mobileViewport ? (this.portraitViewport ? 4 : 5) : 5;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const stash = gameState.getGearStash();
    const totalPages = Math.max(1, Math.ceil(stash.length / this.pageSize));
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const uiFont = this.getUIFontFamily();

    this.container = this.scene.add.container(0, 0).setDepth(4500).setScrollFactor(0);

    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.68).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    const bg = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x0b1220, 0.97);
    bg.setStrokeStyle(2, 0x38bdf8, 0.78);
    this.container.add(bg);

    this.container.add(this.scene.add.text(panelX + this.unit(16), panelY + this.unit(10), '🎒 战利品仓库 · 装备打造台', {
      fontSize: this.fs(25, 20),
      color: '#38bdf8',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }));
    this.container.add(this.scene.add.text(
      panelX + this.unit(16),
      panelY + this.unit(46),
      `仓库: ${stash.length} 件  |  当前比特币: ₿${(gameState.data.resources.bitcoin || 0).toFixed(3)}`,
      {
        fontSize: this.fs(13, 12),
        color: '#fbbf24',
        fontFamily: uiFont,
      }
    ));

    const close = this.scene.add.text(panelX + panelW - this.unit(14), panelY + this.unit(8), '✕', {
      fontSize: this.fs(24, 20),
      color: '#ef4444',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    this.container.add(close);

    const listTop = this.drawAvatarShowcase(panelX, panelY, panelW);
    this.drawStashList(panelX, panelW, listTop, stash, totalPages);
    this.drawPerkShop(panelX, panelY, panelW, panelH);
  }

  private drawAvatarShowcase(panelX: number, panelY: number, panelW: number): number {
    const uiFont = this.getUIFontFamily();
    const showcaseTop = panelY + this.unit(72);
    const showcaseH = this.unit(178);
    const showcaseW = panelW - this.unit(24);
    const centerX = panelX + panelW * 0.5;
    const centerY = showcaseTop + this.unit(92);
    const avatarBox = this.scene.add.rectangle(panelX + 12, showcaseTop, showcaseW, showcaseH, 0x0f172a, 0.86).setOrigin(0, 0);
    avatarBox.setStrokeStyle(1, 0x334155, 0.7);
    this.container?.add(avatarBox);

    this.container?.add(this.scene.add.text(panelX + this.unit(18), showcaseTop + this.unit(8), '角色 Avatar · 装备部位可视化', {
      fontSize: this.fs(14, 12),
      color: '#93c5fd',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }));

    const avatarRing = this.scene.add.circle(centerX, centerY, this.unit(34), 0x111827, 0.96).setStrokeStyle(2, 0x38bdf8, 0.5);
    this.container?.add(avatarRing);
    const avatarTexture = resolvePreferredHeroPortraitTexture(this.scene);
    if (this.scene.textures.exists(avatarTexture)) {
      const avatar = this.scene.add.image(centerX, centerY + this.unit(2), avatarTexture).setScale(this.mobileViewport ? 2.35 : 2.2);
      avatar.setTint(0xe2e8f0);
      this.container?.add(avatar);
    } else {
      const fallback = this.scene.add.text(centerX, centerY, 'AV', {
        fontSize: this.fs(17, 14),
        color: '#e2e8f0',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.container?.add(fallback);
    }

    const slotBoxW = Math.max(this.unit(220), Math.min(this.unit(340), Math.floor((panelW - this.unit(108)) * 0.36)));
    const leftBoxX = panelX + this.unit(16);
    const rightBoxX = panelX + panelW - slotBoxW - this.unit(16);
    const slotBaseY = showcaseTop + this.unit(34);
    const slotStepY = this.unit(48);
    const slotBoxH = this.unit(42);

    const slotDefs: Array<{
      weaponType: GearWeaponType;
      anchorDx: number;
      anchorDy: number;
      boxX: number;
      boxY: number;
      align: 'left' | 'right';
    }> = [
      { weaponType: 'shotgun', anchorDx: -this.unit(22), anchorDy: -this.unit(6), boxX: leftBoxX, boxY: slotBaseY, align: 'left' },
      { weaponType: 'rifle', anchorDx: -this.unit(16), anchorDy: -this.unit(20), boxX: leftBoxX, boxY: slotBaseY + slotStepY, align: 'left' },
      { weaponType: 'rocket', anchorDx: -this.unit(20), anchorDy: this.unit(18), boxX: leftBoxX, boxY: slotBaseY + slotStepY * 2, align: 'left' },
      { weaponType: 'pistol', anchorDx: this.unit(22), anchorDy: -this.unit(4), boxX: rightBoxX, boxY: slotBaseY, align: 'right' },
      { weaponType: 'flamethrower', anchorDx: this.unit(16), anchorDy: -this.unit(18), boxX: rightBoxX, boxY: slotBaseY + slotStepY, align: 'right' },
      { weaponType: 'laser', anchorDx: this.unit(18), anchorDy: this.unit(16), boxX: rightBoxX, boxY: slotBaseY + slotStepY * 2, align: 'right' },
    ];

    slotDefs.forEach((slot) => {
      const equipped = gameState.getEquippedGearForWeapon(slot.weaponType);
      const rarity = equipped ? RARITY_STYLE[equipped.rarity] : null;
      const lineColor = rarity?.color || 0x334155;
      const boxW = slotBoxW;
      const boxH = slotBoxH;
      const box = this.scene.add.rectangle(slot.boxX, slot.boxY, boxW, boxH, 0x111827, 0.86).setOrigin(0, 0);
      box.setStrokeStyle(1, lineColor, equipped ? 0.75 : 0.38);
      this.container?.add(box);

      const anchorX = centerX + slot.anchorDx;
      const anchorY = centerY + slot.anchorDy;
      const targetX = slot.align === 'left' ? (slot.boxX + boxW) : slot.boxX;
      const targetY = slot.boxY + boxH * 0.5;
      const link = this.scene.add.graphics();
      link.lineStyle(1, lineColor, equipped ? 0.9 : 0.45);
      link.beginPath();
      link.moveTo(anchorX, anchorY);
      link.lineTo(targetX, targetY);
      link.strokePath();
      this.container?.add(link);

      const part = WEAPON_BODY_PART_LABELS[slot.weaponType];
      const titleColor = rarity?.uiColor || '#94a3b8';
      const rarityTag = rarity ? `[${rarity.label}]` : '[未装备]';
      const title = `${part} · ${WEAPON_LABELS[slot.weaponType]} ${rarityTag}`;
      const name = equipped ? equipped.nameCN : '空位';
      const detail = equipped
        ? GearLootSystem.formatBonusSummary(equipped)
        : '待装备';
      const affixLine = equipped
        ? `${GearLootSystem.getThemeLabel(equipped.sourceTheme)} · ${GearLootSystem.formatAffixSummary(equipped, 2) || '基础词条'}`
        : '待装备';
      this.container?.add(this.scene.add.text(slot.boxX + this.unit(8), slot.boxY + this.unit(4), `${title}  ${name}`, {
        fontSize: this.fs(11, 12),
        color: titleColor,
        fontFamily: uiFont,
        fontStyle: equipped ? 'bold' : 'normal',
      }));
      this.container?.add(this.scene.add.text(slot.boxX + this.unit(8), slot.boxY + this.unit(18), detail, {
        fontSize: this.fs(10, 12),
        color: equipped ? '#cbd5e1' : '#64748b',
        fontFamily: uiFont,
      }));
      this.container?.add(this.scene.add.text(slot.boxX + this.unit(8), slot.boxY + this.unit(29), affixLine, {
        fontSize: this.fs(9, 11),
        color: equipped ? '#94a3b8' : '#475569',
        fontFamily: uiFont,
      }));

      const rarityChip = this.scene.add.rectangle(slot.boxX + boxW - this.unit(9), slot.boxY + boxH * 0.5, this.unit(8), this.unit(8), lineColor, 0.95);
      this.container?.add(rarityChip);
    });

    return showcaseTop + showcaseH + this.unit(10);
  }

  private drawStashList(
    panelX: number,
    panelW: number,
    listTop: number,
    stash: GearItem[],
    totalPages: number
  ): void {
    const uiFont = this.getUIFontFamily();
    const listH = this.unit(264);
    const listW = panelW - this.unit(24);
    const rowH = this.unit(56);
    const start = this.page * this.pageSize;
    const pageItems = stash.slice(start, start + this.pageSize);
    const leftTextX = panelX + this.unit(30);
    const detailTextX = panelX + Math.floor(panelW * 0.42);
    const equipBtnX = panelX + panelW - this.unit(164);
    const sellBtnX = panelX + panelW - this.unit(84);

    const viewport = this.scene.add.rectangle(panelX + this.unit(12), listTop, listW, listH, 0x0f172a, 0.82).setOrigin(0, 0);
    viewport.setStrokeStyle(1, 0x334155, 0.72);
    this.container?.add(viewport);

    this.container?.add(this.scene.add.text(panelX + this.unit(18), listTop + this.unit(7), `仓库页 ${this.page + 1}/${totalPages}`, {
      fontSize: this.fs(12, 12),
      color: '#94a3b8',
      fontFamily: uiFont,
    }));

    pageItems.forEach((item, idx) => {
      const y = listTop + this.unit(26) + idx * rowH;
      const style = RARITY_STYLE[item.rarity];
      const equippedUid = gameState.data.equippedGearSlots[item.weaponType];
      const isEquipped = equippedUid === item.uid;
      const row = this.scene.add.rectangle(panelX + this.unit(14), y, listW - this.unit(4), rowH - this.unit(2), style.color, 0.14).setOrigin(0, 0);
      row.setStrokeStyle(1, style.color, 0.45);
      this.container?.add(row);
      this.container?.add(this.scene.add.rectangle(panelX + this.unit(22), y + rowH * 0.5, this.unit(8), this.unit(8), style.color, 0.95));
      this.container?.add(this.scene.add.text(
        leftTextX,
        y + this.unit(5),
        `[${style.label}] ${WEAPON_BODY_PART_LABELS[item.weaponType]} · ${item.nameCN} ${isEquipped ? '· 已装备' : ''}`,
        {
          fontSize: this.fs(12, 12),
          color: style.uiColor,
          fontFamily: uiFont,
          fontStyle: isEquipped ? 'bold' : 'normal',
          wordWrap: { width: Math.max(180, detailTextX - leftTextX - this.unit(14)) },
        }
      ));
      this.container?.add(this.scene.add.text(
        detailTextX,
        y + this.unit(8),
        `${WEAPON_LABELS[item.weaponType]} · ${GearLootSystem.formatBonusSummary(item)}`,
        {
          fontSize: this.fs(10, 12),
          color: '#cbd5e1',
          fontFamily: uiFont,
          wordWrap: { width: Math.max(180, sellBtnX - detailTextX - this.unit(10)) },
        }
      ));
      this.container?.add(this.scene.add.text(
        detailTextX,
        y + this.unit(25),
        `${GearLootSystem.getThemeLabel(item.sourceTheme)} · ${GearLootSystem.formatAffixSummary(item, 2) || '基础词条'} · 售₿${item.sellValue.toFixed(2)}`,
        {
          fontSize: this.fs(9, 11),
          color: '#94a3b8',
          fontFamily: uiFont,
          wordWrap: { width: Math.max(180, sellBtnX - detailTextX - this.unit(10)) },
        }
      ));

      const equipBtn = this.scene.add.text(equipBtnX, y + this.unit(14), isEquipped ? '卸下' : '装备', {
        fontSize: this.fs(11, 12),
        color: '#22c55e',
        fontFamily: uiFont,
        backgroundColor: '#13251a',
        padding: { x: this.unit(8), y: this.unit(3) },
      }).setInteractive({ useHandCursor: true });
      equipBtn.on('pointerdown', () => {
        const res = isEquipped
          ? gameState.unequipGear(item.weaponType)
          : gameState.equipGear(item.uid);
        const part = WEAPON_BODY_PART_LABELS[item.weaponType];
        if (res.ok) {
          const actionText = isEquipped ? `已卸下 ${part}` : `已装备至 ${part}`;
          this.flash(`${actionText} · ${item.nameCN}`, '#4ade80');
        } else {
          this.flash(res.message, '#ef4444');
        }
        events.emit('gear-stash-updated', { count: gameState.data.gearStash.length });
        this.rebuild();
      });
      this.container?.add(equipBtn);

      const sellBtn = this.scene.add.text(sellBtnX, y + this.unit(14), '出售', {
        fontSize: this.fs(11, 12),
        color: '#fbbf24',
        fontFamily: uiFont,
        backgroundColor: '#30220f',
        padding: { x: this.unit(8), y: this.unit(3) },
      }).setInteractive({ useHandCursor: true });
      sellBtn.on('pointerdown', () => {
        const res = gameState.sellGear(item.uid);
        this.flash(res.message, res.ok ? '#fbbf24' : '#ef4444');
        if (res.ok) events.emit('update-resources', gameState.data.resources);
        events.emit('gear-stash-updated', { count: gameState.data.gearStash.length });
        this.rebuild();
      });
      this.container?.add(sellBtn);
    });

    if (pageItems.length <= 0) {
      this.container?.add(this.scene.add.text(panelX + panelW / 2, listTop + listH / 2, '暂无装备掉落', {
        fontSize: this.fs(17, 14),
        color: '#64748b',
        fontFamily: uiFont,
      }).setOrigin(0.5));
    }

    const prev = this.scene.add.text(panelX + this.unit(16), listTop + listH + this.unit(6), '◀ 上一页', {
      fontSize: this.fs(12, 12),
      color: this.page > 0 ? '#93c5fd' : '#475569',
      fontFamily: uiFont,
    }).setInteractive({ useHandCursor: this.page > 0 });
    prev.on('pointerdown', () => {
      if (this.page <= 0) return;
      this.page -= 1;
      this.rebuild();
    });
    this.container?.add(prev);

    const next = this.scene.add.text(panelX + panelW - this.unit(16), listTop + listH + this.unit(6), '下一页 ▶', {
      fontSize: this.fs(12, 12),
      color: this.page < totalPages - 1 ? '#93c5fd' : '#475569',
      fontFamily: uiFont,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: this.page < totalPages - 1 });
    next.on('pointerdown', () => {
      if (this.page >= totalPages - 1) return;
      this.page += 1;
      this.rebuild();
    });
    this.container?.add(next);
  }

  private drawPerkShop(panelX: number, panelY: number, panelW: number, panelH: number): void {
    const uiFont = this.getUIFontFamily();
    const shopH = this.unit(156);
    const shopTop = panelY + panelH - shopH - this.unit(12);
    this.container?.add(this.scene.add.rectangle(panelX + this.unit(12), shopTop, panelW - this.unit(24), shopH, 0x101826, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x334155, 0.75));
    this.container?.add(this.scene.add.text(panelX + this.unit(18), shopTop + this.unit(8), '比特币强化（永久）', {
      fontSize: this.fs(14, 12),
      color: '#fbbf24',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }));

    BITCOIN_PERK_DEFS.forEach((perk, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const colW = (panelW - this.unit(56)) / 2;
      const x = panelX + this.unit(18) + col * colW;
      const y = shopTop + this.unit(34) + row * this.unit(46);
      const purchased = !!gameState.data.bitcoinPerks[perk.id];
      this.container?.add(this.scene.add.text(
        x,
        y,
        `${perk.nameCN} · ${perk.descCN}`,
        {
          fontSize: this.fs(11, 12),
          color: purchased ? '#22c55e' : '#cbd5e1',
          fontFamily: uiFont,
          wordWrap: { width: colW - this.unit(98) },
        }
      ));
      const btn = this.scene.add.text(
        x + colW - this.unit(8),
        y + this.unit(4),
        purchased ? '已购买' : `购买 ₿${perk.cost}`,
        {
          fontSize: this.fs(11, 12),
          color: purchased ? '#64748b' : '#fbbf24',
          fontFamily: uiFont,
          backgroundColor: purchased ? '#1f2937' : '#2c1f0f',
          padding: { x: this.unit(6), y: this.unit(3) },
        }
      ).setOrigin(1, 0).setInteractive({ useHandCursor: !purchased });
      if (!purchased) {
        btn.on('pointerdown', () => {
          const res = gameState.purchaseBitcoinPerk(perk.id);
          this.flash(res.message, res.ok ? '#4ade80' : '#ef4444');
          if (res.ok) events.emit('update-resources', gameState.data.resources);
          this.rebuild();
        });
      }
      this.container?.add(btn);
    });
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
      duration: 120,
      onComplete: () => target.destroy(),
    });
  }

  destroy(): void {
    this.hide(true);
  }

  private flash(message: string, color: string): void {
    const w = this.scene.cameras.main.width;
    const text = this.scene.add.text(w / 2, 112, message, {
      fontSize: this.fs(18, 16),
      color,
      fontFamily: this.getUIFontFamily(),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4600);
    this.scene.tweens.add({
      targets: text,
      y: 90,
      alpha: 0,
      duration: 1100,
      onComplete: () => text.destroy(),
    });
  }
}
