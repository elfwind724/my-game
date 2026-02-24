import Phaser from 'phaser';

interface LootCodexEntryView {
  id: string;
  nameCN: string;
  iconKey: string;
  accentColor: number;
  accentText: string;
  usageCN: string;
  sourceCN: string;
  loreCN: string;
  discovered: boolean;
  collected: number;
}

interface LootCodexSnapshot {
  unlocked: number;
  total: number;
  entries: LootCodexEntryView[];
}

export class LootCodexPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isOpen = false;
  private page = 0;
  private readonly pageSize = 4;

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

  refresh(): void {
    if (!this.isOpen) return;
    this.hide(true);
    this.show();
  }

  private getUIFontFamily(): string {
    return 'PingFang SC, "Microsoft YaHei", "Noto Sans SC", "Heiti SC", "Source Han Sans SC", sans-serif';
  }

  private fs(base: number, min: number = 11): string {
    const w = this.scene.cameras.main.width || 1;
    const h = this.scene.cameras.main.height || 1;
    const portrait = h > w;
    const mobile = typeof window !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || window.innerWidth <= 1024
      || (navigator.maxTouchPoints || 0) > 1
    );
    const boost = mobile ? (portrait ? 1.2 : 1.08) : 1;
    return `${Math.max(min, Math.round(base * boost))}px`;
  }

  private getSnapshot(): LootCodexSnapshot {
    const gameScene = this.scene.scene.get('GameScene') as any;
    const snapshot = gameScene?.getLootCodexSnapshot?.();
    if (!snapshot || !Array.isArray(snapshot.entries)) {
      return { unlocked: 0, total: 0, entries: [] };
    }
    return snapshot as LootCodexSnapshot;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const snapshot = this.getSnapshot();
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = Math.min(960, w - 36);
    const panelH = Math.min(640, h - 36);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const cardW = (panelW - 56) / 2;
    const cardH = (panelH - 170) / 2;
    const totalPages = Math.max(1, Math.ceil(snapshot.entries.length / this.pageSize));
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const start = this.page * this.pageSize;
    const entries = snapshot.entries.slice(start, start + this.pageSize);
    const uiFont = this.getUIFontFamily();

    this.container = this.scene.add.container(0, 0).setDepth(4300).setScrollFactor(0);

    const overlay = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.64).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    const bg = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x061126, 0.96)
      .setStrokeStyle(2, 0x60a5fa, 0.88);
    this.container.add(bg);

    this.container.add(this.scene.add.text(panelX + 16, panelY + 12, '📘 战利品图鉴', {
      fontSize: this.fs(26, 20),
      color: '#7dd3fc',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }));

    this.container.add(this.scene.add.text(panelX + 16, panelY + 46,
      `已解锁 ${snapshot.unlocked}/${snapshot.total} · 第 ${this.page + 1}/${totalPages} 页`, {
      fontSize: this.fs(13, 12),
      color: '#93c5fd',
      fontFamily: uiFont,
    }));

    const close = this.scene.add.text(panelX + panelW - 12, panelY + 8, '✕', {
      fontSize: this.fs(24, 20),
      color: '#ef4444',
      fontFamily: uiFont,
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    this.container.add(close);

    entries.forEach((entry, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = panelX + 20 + col * (cardW + 16);
      const cy = panelY + 74 + row * (cardH + 12);
      const accent = entry.discovered ? entry.accentColor : 0x334155;
      const textColor = entry.discovered ? '#e2e8f0' : '#64748b';

      const card = this.scene.add.rectangle(cx + cardW / 2, cy + cardH / 2, cardW, cardH, 0x0b1220, 0.94)
        .setStrokeStyle(1, accent, 0.95);
      this.container!.add(card);

      const iconPlate = this.scene.add.rectangle(cx + 36, cy + 34, 46, 46, 0x0f172a, 0.98)
        .setStrokeStyle(1, accent, 0.9);
      this.container!.add(iconPlate);

      if (entry.discovered && this.scene.textures.exists(entry.iconKey)) {
        const icon = this.scene.add.image(cx + 36, cy + 34, entry.iconKey).setScale(1.3);
        this.container!.add(icon);
      } else {
        const lock = this.scene.add.text(cx + 36, cy + 34, '?', {
          fontSize: this.fs(24, 20),
          color: '#94a3b8',
          fontFamily: uiFont,
          fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container!.add(lock);
      }

      this.container!.add(this.scene.add.text(cx + 66, cy + 12, entry.discovered ? entry.nameCN : '未解锁条目', {
        fontSize: this.fs(17, 14),
        color: entry.discovered ? entry.accentText : '#94a3b8',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }));

      this.container!.add(this.scene.add.text(cx + 66, cy + 38,
        `累计拾取 ${Math.max(0, Math.floor(entry.collected || 0))}`, {
        fontSize: this.fs(12, 10),
        color: '#67e8f9',
        fontFamily: uiFont,
      }));

      const bodyText = entry.discovered
        ? `用途：${entry.usageCN}\n来源：${entry.sourceCN}\n档案：${entry.loreCN}`
        : '尚未发现该资源\n继续战斗并拾取相关掉落后解锁';
      this.container!.add(this.scene.add.text(cx + 14, cy + 66, bodyText, {
        fontSize: this.fs(12, 10),
        color: textColor,
        fontFamily: uiFont,
        lineSpacing: 4,
        wordWrap: { width: cardW - 28 },
      }));
    });

    const makePageBtn = (
      x: number,
      label: string,
      enabled: boolean,
      nextPage: number
    ) => {
      const bgBtn = this.scene.add.rectangle(x, panelY + panelH - 26, 84, 28, enabled ? 0x10223c : 0x1e293b, 0.96)
        .setStrokeStyle(1, enabled ? 0x60a5fa : 0x475569, 0.95);
      const text = this.scene.add.text(x, panelY + panelH - 26, label, {
        fontSize: this.fs(13, 11),
        color: enabled ? '#e2e8f0' : '#64748b',
        fontFamily: uiFont,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.container!.add([bgBtn, text]);
      if (!enabled) return;
      bgBtn.setInteractive({ useHandCursor: true });
      bgBtn.on('pointerdown', () => {
        this.page = Phaser.Math.Clamp(nextPage, 0, totalPages - 1);
        this.refresh();
      });
    };

    makePageBtn(panelX + 74, '◀ 上一页', this.page > 0, this.page - 1);
    makePageBtn(panelX + panelW - 74, '下一页 ▶', this.page + 1 < totalPages, this.page + 1);

    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 180 });
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
}
