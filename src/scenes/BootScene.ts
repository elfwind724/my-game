import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { ASSET_OVERRIDES } from '../data/assetOverrides';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const progressBar = this.add.graphics();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x111827, 1);
      progressBar.fillRect(width / 4, height / 2 - 7, width / 2, 14);
      progressBar.fillStyle(0x0ea5e9, 1);
      progressBar.fillRect(width / 4 + 2, height / 2 - 5, (width / 2 - 4) * value, 10);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
    });

    this.preloadAssetOverrides();
  }

  create(): void {
    this.generateAssets();
    this.initRunState();
    this.scene.start('MenuScene');
  }

  private generateAssets(): void {
    this.generatePlayerSprite();
    this.generateEnemySprites();
    this.generateCompanionSprite();
    this.generateProjectileSprites();
    this.generateStructureSprites();
    this.generateLootSprites();
    this.generateParticleTextures();
    this.generateTerrainTextures();
    this.generateVillageTextures();
  }

  private drawTexture(
    key: string,
    width: number,
    height: number,
    painter: (g: Phaser.GameObjects.Graphics) => void
  ): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.clear();
    painter(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private drawCanvasTexture(
    key: string,
    width: number,
    height: number,
    painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): void {
    if (this.textures.exists(key)) return;
    const canvas = this.textures.createCanvas(key, width, height);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, width, height);
    painter(ctx, width, height);
    canvas.refresh();
  }

  private preloadAssetOverrides(): void {
    const loadedKeys = new Set<string>();
    for (const override of ASSET_OVERRIDES) {
      if (!override.key || !override.path) continue;
      if (loadedKeys.has(override.key)) continue;
      loadedKeys.add(override.key);
      this.load.image(override.key, override.path);
    }
  }

  private generatePlayerSprite(): void {
    this.drawTexture('player', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.34);
      g.fillEllipse(16, 30, 16, 4);

      g.fillStyle(0x08101f);
      g.fillRect(11, 3, 10, 7); // helmet
      g.fillRect(9, 10, 14, 12); // torso
      g.fillRect(8, 11, 2, 8); // left arm
      g.fillRect(22, 11, 2, 8); // right arm
      g.fillRect(10, 22, 5, 8); // left leg
      g.fillRect(17, 22, 5, 8); // right leg

      g.fillStyle(0xf1c792);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x0ea5e9);
      g.fillRect(12, 6, 8, 2); // visor
      g.fillStyle(0xbfe9ff);
      g.fillRect(13, 6, 2, 1);

      g.fillStyle(0x1f3a63);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x2b527f);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0x123053);
      g.fillRect(12, 14, 8, 6);
      g.fillStyle(0x22d3ee);
      g.fillRect(14, 16, 4, 2);

      g.fillStyle(0x13233d);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0b1729);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);

      // wrist gun
      g.fillStyle(0x0f172a);
      g.fillRect(23, 15, 7, 3);
      g.fillStyle(0x94a3b8);
      g.fillRect(26, 14, 2, 4);
      g.fillStyle(0xfbbf24);
      g.fillRect(30, 16, 1, 1);
    });
  }

  private generateEnemySprites(): void {
    this.drawTexture('zombie', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(16, 29, 17, 5);

      g.fillStyle(0x0b1220);
      g.fillRect(10, 5, 12, 7);
      g.fillRect(9, 12, 14, 10);
      g.fillRect(8, 12, 2, 8);
      g.fillRect(22, 12, 2, 8);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);

      g.fillStyle(0x6ee7b7);
      g.fillRect(11, 6, 10, 5);
      g.fillStyle(0xef4444);
      g.fillRect(12, 7, 2, 2);
      g.fillRect(18, 7, 2, 2);

      g.fillStyle(0x15803d);
      g.fillRect(10, 13, 12, 8);
      g.fillStyle(0x7f1d1d);
      g.fillRect(11, 15, 3, 2);
      g.fillRect(18, 18, 3, 2);

      g.fillStyle(0x14532d);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 27, 7, 3);
      g.fillRect(16, 27, 7, 3);
    });

    this.drawTexture('runner', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(16, 29, 13, 4);

      g.fillStyle(0x0b1220);
      g.fillRect(10, 4, 12, 6);
      g.fillRect(10, 10, 12, 10);
      g.fillRect(9, 11, 2, 8);
      g.fillRect(21, 11, 2, 8);
      g.fillRect(11, 20, 4, 10);
      g.fillRect(17, 20, 4, 10);

      g.fillStyle(0xfda4af);
      g.fillRect(11, 5, 10, 4);
      g.fillStyle(0xf59e0b);
      g.fillRect(12, 6, 3, 2);
      g.fillRect(17, 6, 3, 2);

      g.fillStyle(0x991b1b);
      g.fillRect(11, 11, 10, 8);
      g.fillStyle(0xb91c1c);
      g.fillRect(11, 13, 10, 1);
      g.fillRect(11, 16, 10, 1);

      g.fillStyle(0x7f1d1d);
      g.fillRect(11, 20, 4, 8);
      g.fillRect(17, 20, 4, 8);
      g.fillStyle(0x111827);
      g.fillRect(10, 28, 6, 2);
      g.fillRect(16, 28, 6, 2);
    });

    this.drawTexture('tank', 48, 48, (g) => {
      g.fillStyle(0x000000, 0.45);
      g.fillEllipse(24, 45, 28, 7);

      g.fillStyle(0x1b0c2e);
      g.fillRect(8, 14, 32, 22);
      g.fillRect(6, 18, 4, 14);
      g.fillRect(38, 18, 4, 14);
      g.fillRect(11, 32, 9, 14);
      g.fillRect(28, 32, 9, 14);

      g.fillStyle(0xc4b5fd);
      g.fillRect(17, 6, 14, 8);
      g.fillStyle(0xef4444);
      g.fillRect(19, 9, 3, 2);
      g.fillRect(26, 9, 3, 2);

      g.fillStyle(0x6d28d9);
      g.fillRect(10, 16, 28, 16);
      g.fillStyle(0x4c1d95);
      g.fillRect(12, 18, 24, 12);
      g.fillStyle(0xfbbf24);
      g.fillRect(14, 30, 20, 2);
      g.fillStyle(0x111827);
      g.fillRect(16, 30, 3, 2);
      g.fillRect(22, 30, 3, 2);
      g.fillRect(28, 30, 3, 2);

      g.fillStyle(0x7c3aed);
      g.fillRect(11, 32, 9, 10);
      g.fillRect(28, 32, 9, 10);
      g.fillStyle(0x111827);
      g.fillRect(10, 42, 11, 4);
      g.fillRect(27, 42, 11, 4);
    });
  }

  private generateCompanionSprite(): void {
    this.drawTexture('companion', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);

      g.fillStyle(0x0a1324);
      g.fillRect(11, 3, 10, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(8, 11, 2, 7);
      g.fillRect(22, 11, 2, 7);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);

      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x60a5fa);
      g.fillRect(12, 6, 8, 2);
      g.fillStyle(0xdbeafe);
      g.fillRect(13, 6, 2, 1);

      g.fillStyle(0x1e40af);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x3b82f6);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0x1d4ed8);
      g.fillRect(13, 15, 6, 4);
      g.fillStyle(0xfbbf24);
      g.fillRect(18, 16, 3, 3);

      g.fillStyle(0x1d3a8a);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);

      g.fillStyle(0x334155);
      g.fillRect(23, 15, 6, 3);
      g.fillStyle(0x0f172a);
      g.fillRect(25, 14, 2, 4);
    });
  }

  private generateProjectileSprites(): void {
    this.drawTexture('bullet', 16, 16, (g) => {
      g.fillStyle(0x7dd3fc, 0.2);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0x0ea5e9, 0.8);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0xf8fafc, 0.9);
      g.fillCircle(8, 8, 2);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(6, 5, 2, 1);
    });

    this.drawTexture('bullet_scatter', 16, 16, (g) => {
      g.fillStyle(0x93c5fd, 0.28);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0x38bdf8, 0.92);
      g.fillCircle(8, 8, 4);
      g.fillStyle(0xe0f2fe, 0.95);
      g.fillCircle(8, 8, 2);
    });

    this.drawTexture('bullet_pulse', 16, 16, (g) => {
      g.fillStyle(0x22d3ee, 0.25);
      g.fillRect(2, 5, 12, 6);
      g.fillStyle(0x06b6d4, 0.95);
      g.fillRect(3, 6, 10, 4);
      g.fillStyle(0xe0fbff, 0.95);
      g.fillRect(5, 7, 6, 2);
    });

    this.drawTexture('bullet_flame', 16, 16, (g) => {
      g.fillStyle(0xfb923c, 0.24);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0xf97316, 0.95);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0xfacc15, 0.95);
      g.fillCircle(9, 7, 2);
      g.fillStyle(0xfffbeb, 0.9);
      g.fillCircle(10, 6, 1);
    });

    this.drawTexture('bullet_pierce', 16, 16, (g) => {
      g.fillStyle(0x67e8f9, 0.24);
      g.fillRect(1, 6, 14, 4);
      g.fillStyle(0x22d3ee, 0.95);
      g.fillRect(2, 6, 12, 4);
      g.fillStyle(0xe0f7ff, 0.95);
      g.fillRect(12, 6, 2, 4);
    });

    this.drawTexture('bullet_cannon', 16, 16, (g) => {
      g.fillStyle(0xc084fc, 0.25);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0xa855f7, 0.95);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0xe9d5ff, 0.95);
      g.fillCircle(8, 8, 2);
    });

    this.drawTexture('bullet_frost', 16, 16, (g) => {
      g.fillStyle(0xbfdbfe, 0.26);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0x93c5fd, 0.95);
      g.fillCircle(8, 8, 4);
      g.fillStyle(0xf0f9ff, 0.95);
      g.fillRect(7, 4, 2, 8);
      g.fillRect(4, 7, 8, 2);
    });

    this.drawTexture('bullet_chain', 16, 16, (g) => {
      g.fillStyle(0xd8b4fe, 0.25);
      g.fillCircle(8, 8, 7);
      g.fillStyle(0xa855f7, 0.95);
      g.fillCircle(8, 8, 4);
      g.fillStyle(0xf5d0fe, 0.95);
      g.fillRect(5, 5, 6, 2);
      g.fillRect(7, 7, 2, 4);
    });
  }

  private generateStructureSprites(): void {
    this.drawTexture('wall', 64, 64, (g) => {
      // Steel wall module: full tile with beams and rivets.
      g.fillStyle(0x121a27);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x2a3a50);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x1f2d41);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x3e566f);
      for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 4, 64);
      g.fillRect(0, 0, 64, 4);
      g.fillRect(0, 60, 64, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 30, 52, 3);
      g.fillStyle(0xa5f3fc);
      g.fillRect(10, 31, 44, 1);
      g.fillStyle(0xfbbf24);
      for (let y = 6; y <= 56; y += 10) {
        g.fillRect(2, y, 2, 2);
        g.fillRect(60, y, 2, 2);
      }
      for (let x = 8; x <= 52; x += 11) {
        g.fillRect(x, 2, 2, 2);
        g.fillRect(x, 60, 2, 2);
      }
    });
    this.drawTexture('wall_v2', 64, 64, (g) => {
      g.fillStyle(0x121a27);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x2a3a50);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x1f2d41);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x405a75);
      for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 4, 64);
      g.fillRect(0, 0, 64, 4);
      g.fillRect(0, 60, 64, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 20, 52, 3);
      g.fillRect(6, 40, 52, 2);
      g.fillStyle(0xa5f3fc);
      g.fillRect(12, 21, 40, 1);
      g.fillRect(10, 40, 44, 1);
      g.fillStyle(0xfbbf24);
      for (let y = 6; y <= 56; y += 10) {
        g.fillRect(2, y, 2, 2);
        g.fillRect(60, y, 2, 2);
      }
    });
    this.drawTexture('wall_v3', 64, 64, (g) => {
      g.fillStyle(0x121a27);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x2d3e54);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x223248);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x4b607a);
      for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 29, 52, 4);
      g.fillStyle(0xbff6ff);
      g.fillRect(8, 31, 48, 1);
      g.fillStyle(0xfbbf24);
      for (let x = 6; x <= 56; x += 10) {
        g.fillRect(x, 2, 2, 2);
        g.fillRect(x, 60, 2, 2);
      }
    });

    this.drawTexture('turret', 64, 64, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(8, 10, 48, 44);
      g.fillStyle(0x1f2937);
      g.fillRect(12, 14, 40, 36);
      g.fillStyle(0x334155);
      g.fillCircle(32, 32, 16);
      g.fillStyle(0x111827);
      g.fillCircle(32, 32, 11);
      g.fillStyle(0x475569);
      g.fillRect(26, 18, 12, 10);
      g.fillStyle(0x0ea5e9);
      g.fillRect(29, 20, 6, 2);
      g.fillStyle(0x1e293b);
      g.fillRect(30, 4, 4, 16);
      g.fillStyle(0xfbbf24);
      g.fillRect(31, 4, 2, 2);
      g.fillStyle(0x22c55e);
      g.fillCircle(32, 42, 3);
    });

    this.drawTexture('barricade', 64, 64, (g) => {
      g.fillStyle(0x4a2d1a);
      g.fillRect(4, 44, 56, 14);
      g.fillStyle(0x603b22);
      g.fillRect(8, 46, 48, 10);
      g.fillStyle(0x9ca3af);
      g.fillRect(10, 46, 4, 10);
      g.fillRect(50, 46, 4, 10);
      g.fillStyle(0x7c2d12);
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 11;
        g.beginPath();
        g.moveTo(x, 44);
        g.lineTo(x + 5, 14 + Phaser.Math.Between(-2, 2));
        g.lineTo(x + 10, 44);
        g.closePath();
        g.fillPath();
      }
      g.fillStyle(0x111827);
      for (let i = 0; i < 5; i++) {
        g.fillCircle(11 + i * 11, 16, 2);
      }
    });

    this.drawTexture('generator', 64, 64, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x334155);
      g.fillRect(12, 12, 40, 40);
      g.fillStyle(0x0f172a);
      for (let y = 17; y < 37; y += 5) {
        g.fillRect(16, y, 20, 2);
      }
      g.fillStyle(0x0ea5e9);
      g.fillRect(38, 16, 10, 8);
      g.fillStyle(0x7dd3fc);
      g.fillRect(40, 18, 6, 2);
      g.fillStyle(0x22c55e);
      g.fillCircle(44, 40, 6);
      g.fillStyle(0x86efac);
      g.fillCircle(44, 40, 3);
    });

    this.drawTexture('farm', 64, 64, (g) => {
      g.fillStyle(0x1f261c);
      g.fillRect(4, 14, 56, 44);
      g.fillStyle(0x3f2a1b);
      g.fillRect(8, 18, 48, 36);
      g.fillStyle(0x2f1f12);
      for (let i = 0; i < 3; i++) {
        g.fillRect(10 + i * 16, 20, 12, 30);
      }
      g.fillStyle(0x22c55e);
      for (let i = 0; i < 8; i++) {
        g.fillRect(12 + i * 6, 28 + (i % 2) * 7, 2, 9);
      }
      g.fillStyle(0x64748b);
      g.fillRect(4, 14, 56, 3);
      g.fillRect(4, 55, 56, 3);
    });

    this.drawTexture('storage', 64, 64, (g) => {
      g.fillStyle(0x3f2a1b);
      g.fillRect(8, 10, 48, 46);
      g.fillStyle(0x6b4a2e);
      g.fillRect(12, 14, 40, 38);
      g.fillStyle(0x9ca3af);
      g.fillRect(8, 30, 48, 4);
      g.fillRect(30, 10, 4, 46);
      g.fillStyle(0xfbbf24);
      g.fillRect(29, 29, 6, 6);
    });

    this.drawTexture('medical', 64, 64, (g) => {
      g.fillStyle(0xe2e8f0);
      g.beginPath();
      g.moveTo(6, 18);
      g.lineTo(32, 4);
      g.lineTo(58, 18);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xf8fafc);
      g.fillRect(10, 18, 44, 38);
      g.fillStyle(0xef4444);
      g.fillRect(30, 24, 4, 20);
      g.fillRect(22, 32, 20, 4);
      g.fillStyle(0x38bdf8);
      g.fillRect(10, 18, 44, 2);
    });

    this.drawTexture('watchTower', 64, 64, (g) => {
      g.fillStyle(0x3f2a1b);
      g.fillRect(24, 24, 16, 34);
      g.fillStyle(0x5b3b22);
      g.fillRect(26, 26, 12, 30);
      g.fillStyle(0x64748b);
      g.fillRect(6, 10, 52, 14);
      g.fillStyle(0x334155);
      g.fillRect(10, 12, 44, 10);
      g.fillStyle(0x0ea5e9);
      g.fillRect(6, 10, 4, 12);
      g.fillRect(54, 10, 4, 12);
      g.fillRect(6, 10, 52, 2);
    });

    this.drawTexture('campfire', 64, 64, (g) => {
      g.fillStyle(0x4a2c1a);
      g.fillRect(14, 46, 36, 8);
      g.fillRect(18, 40, 28, 8);
      g.fillStyle(0xf97316);
      g.fillCircle(32, 30, 12);
      g.fillStyle(0xfbbf24);
      g.fillCircle(32, 28, 8);
      g.fillStyle(0xfef3c7);
      g.fillCircle(32, 25, 4);
    });

    this.drawTexture('reinforced_wall', 64, 64, (g) => {
      g.fillStyle(0x161d2b);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x505b6a);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x6b7280);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x374151);
      for (let y = 10; y < 60; y += 12) g.fillRect(8, y, 48, 5);
      g.fillStyle(0x9ca3af);
      for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 4, 64);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 29, 52, 5);
      g.fillStyle(0xdbeafe);
      g.fillRect(10, 31, 44, 1);
      g.fillStyle(0xfbbf24);
      g.fillRect(2, 2, 3, 3);
      g.fillRect(59, 2, 3, 3);
      g.fillRect(2, 59, 3, 3);
      g.fillRect(59, 59, 3, 3);
    });
    this.drawTexture('reinforced_wall_v2', 64, 64, (g) => {
      g.fillStyle(0x161d2b);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x566273);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x7b8596);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x4b5563);
      for (let y = 10; y < 60; y += 10) g.fillRect(8, y, 48, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 18, 52, 3);
      g.fillRect(6, 44, 52, 3);
      g.fillStyle(0xdbeafe);
      g.fillRect(10, 19, 44, 1);
      g.fillRect(10, 45, 44, 1);
    });
    this.drawTexture('reinforced_wall_v3', 64, 64, (g) => {
      g.fillStyle(0x171f2e);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x5c6777);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x8b95a5);
      g.fillRect(6, 6, 52, 52);
      g.fillStyle(0x374151);
      for (let x = 8; x < 56; x += 12) g.fillRect(x, 8, 5, 48);
      g.fillStyle(0x22d3ee);
      g.fillRect(6, 30, 52, 4);
      g.fillStyle(0xdbeafe);
      g.fillRect(8, 31, 48, 1);
      g.fillStyle(0xfbbf24);
      g.fillRect(2, 2, 3, 3);
      g.fillRect(59, 2, 3, 3);
      g.fillRect(2, 59, 3, 3);
      g.fillRect(59, 59, 3, 3);
    });

    this.drawTexture('gate', 64, 64, (g) => {
      g.fillStyle(0x161d2b);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x334155);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x0b1220);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x566376);
      for (let y = 12; y < 52; y += 6) g.fillRect(10, y, 44, 3);
      g.fillStyle(0x94a3b8);
      g.fillRect(8, 8, 3, 48);
      g.fillRect(53, 8, 3, 48);
      g.fillStyle(0xfbbf24);
      g.fillCircle(32, 34, 3);
      g.fillStyle(0x22d3ee);
      g.fillRect(22, 18, 20, 2);
    });
    this.drawTexture('gate_v2', 64, 64, (g) => {
      g.fillStyle(0x161d2b);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x334155);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x0a101d);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x5c6c80);
      for (let y = 11; y < 54; y += 7) g.fillRect(10, y, 44, 3);
      g.fillStyle(0x94a3b8);
      g.fillRect(8, 8, 3, 48);
      g.fillRect(53, 8, 3, 48);
      g.fillStyle(0x22d3ee);
      g.fillRect(20, 18, 24, 2);
      g.fillStyle(0xfbbf24);
      g.fillCircle(32, 37, 3);
    });
    this.drawTexture('gate_v3', 64, 64, (g) => {
      g.fillStyle(0x161d2b);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x37485f);
      g.fillRect(2, 2, 60, 60);
      g.fillStyle(0x0e1726);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x64748b);
      for (let x = 12; x < 56; x += 8) g.fillRect(x, 10, 3, 44);
      g.fillStyle(0x94a3b8);
      g.fillRect(8, 8, 3, 48);
      g.fillRect(53, 8, 3, 48);
      g.fillStyle(0x22d3ee);
      g.fillRect(22, 16, 20, 2);
      g.fillStyle(0xfbbf24);
      g.fillCircle(32, 34, 3);
    });

    this.drawTexture('spike_trap', 64, 64, (g) => {
      g.fillStyle(0x2b2117);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x5b4126);
      g.fillRect(3, 38, 58, 22);
      g.fillStyle(0x94a3b8);
      for (let i = 0; i < 7; i++) {
        const x = 6 + i * 8;
        g.beginPath();
        g.moveTo(x, 40);
        g.lineTo(x + 4, 16);
        g.lineTo(x + 8, 40);
        g.closePath();
        g.fillPath();
      }
      g.fillStyle(0xfb7185);
      g.fillRect(0, 52, 64, 4);
    });

    this.drawTexture('electric_fence', 64, 64, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x334155);
      g.fillRect(6, 8, 8, 48);
      g.fillRect(50, 8, 8, 48);
      g.fillStyle(0x22d3ee);
      g.fillRect(14, 18, 36, 3);
      g.fillRect(14, 30, 36, 3);
      g.fillRect(14, 42, 36, 3);
      g.fillStyle(0xa5f3fc);
      g.fillCircle(22, 20, 2);
      g.fillCircle(42, 32, 2);
      g.fillCircle(28, 44, 2);
    });

    this.drawTexture('mine_field', 64, 64, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x374151);
      g.fillRect(4, 4, 56, 56);
      g.fillStyle(0x6b7280);
      g.fillCircle(18, 20, 8);
      g.fillCircle(46, 20, 8);
      g.fillCircle(32, 42, 8);
      g.fillStyle(0xf97316);
      g.fillCircle(32, 42, 3);
      g.fillStyle(0x111827);
      g.fillRect(30, 16, 4, 6);
    });

    this.drawTexture('laser_turret', 64, 64, (g) => {
      g.fillStyle(0x0b1320);
      g.fillRect(8, 10, 48, 44);
      g.fillStyle(0x164e63);
      g.fillRect(12, 14, 40, 36);
      g.fillStyle(0x22d3ee);
      g.fillCircle(32, 32, 12);
      g.fillStyle(0x67e8f9);
      g.fillRect(26, 10, 12, 18);
      g.fillStyle(0x0f172a);
      g.fillRect(30, 2, 4, 12);
    });

    this.drawTexture('slow_turret', 64, 64, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(8, 10, 48, 44);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 14, 40, 36);
      g.fillStyle(0x93c5fd);
      g.fillCircle(32, 32, 12);
      g.fillStyle(0xdbeafe);
      g.fillCircle(32, 32, 6);
      g.fillStyle(0x1e3a8a);
      g.fillRect(29, 7, 6, 12);
    });

    this.drawTexture('missile_turret', 64, 64, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(8, 10, 48, 44);
      g.fillStyle(0x3f3f46);
      g.fillRect(12, 14, 40, 36);
      g.fillStyle(0xf97316);
      g.fillRect(16, 20, 10, 8);
      g.fillRect(38, 20, 10, 8);
      g.fillStyle(0x1f2937);
      g.fillRect(22, 28, 20, 16);
      g.fillStyle(0xfbbf24);
      g.fillCircle(32, 36, 4);
    });

    this.drawTexture('kitchen', 64, 64, (g) => {
      g.fillStyle(0x3f2a1b);
      g.fillRect(6, 8, 52, 50);
      g.fillStyle(0x6b4a2e);
      g.fillRect(10, 12, 44, 42);
      g.fillStyle(0x9ca3af);
      g.fillRect(14, 24, 16, 12);
      g.fillRect(34, 24, 16, 12);
      g.fillStyle(0xfbbf24);
      g.fillCircle(22, 30, 2);
      g.fillCircle(42, 30, 2);
      g.fillStyle(0xfb7185);
      g.fillRect(20, 14, 24, 4);
    });

    this.drawTexture('water_collector', 64, 64, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 12, 40, 40);
      g.fillStyle(0x38bdf8);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0xbae6fd);
      g.fillCircle(32, 30, 8);
      g.fillStyle(0x64748b);
      g.fillRect(30, 4, 4, 14);
    });

    this.drawTexture('ammo_factory', 64, 64, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(4, 8, 56, 48);
      g.fillStyle(0x334155);
      g.fillRect(8, 12, 48, 40);
      g.fillStyle(0xf59e0b);
      for (let i = 0; i < 5; i++) {
        g.fillRect(12 + i * 8, 20, 4, 20);
      }
      g.fillStyle(0x78350f);
      g.fillRect(10, 42, 44, 6);
    });

    this.drawTexture('medical_station', 64, 64, (g) => {
      g.fillStyle(0xf8fafc);
      g.fillRect(6, 10, 52, 44);
      g.fillStyle(0xe2e8f0);
      g.fillRect(10, 14, 44, 36);
      g.fillStyle(0xef4444);
      g.fillRect(30, 20, 4, 20);
      g.fillRect(22, 28, 20, 4);
      g.fillStyle(0x38bdf8);
      g.fillRect(6, 10, 52, 3);
    });

    this.drawTexture('radar', 64, 64, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x1f2937);
      g.fillRect(12, 12, 40, 40);
      g.fillStyle(0x0ea5e9);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0x083344);
      g.fillCircle(32, 32, 10);
      g.fillStyle(0x67e8f9);
      g.fillRect(32, 18, 2, 14);
      g.fillRect(32, 32, 10, 2);
    });

    this.drawTexture('workbench', 64, 64, (g) => {
      g.fillStyle(0x3f2a1b);
      g.fillRect(4, 22, 56, 34);
      g.fillStyle(0x5b3b22);
      g.fillRect(8, 26, 48, 28);
      g.fillStyle(0x94a3b8);
      g.fillRect(10, 18, 44, 6);
      g.fillStyle(0x0ea5e9);
      g.fillRect(14, 30, 16, 2);
      g.fillRect(34, 30, 16, 2);
      g.fillStyle(0xfbbf24);
      g.fillRect(28, 36, 8, 8);
    });

    this.drawTexture('room_quarters', 64, 64, (g) => {
      g.fillStyle(0x1e293b);
      g.fillRect(6, 8, 52, 48);
      g.fillStyle(0x334155);
      g.fillRect(10, 12, 44, 40);
      g.fillStyle(0x0f172a);
      g.fillRect(24, 20, 16, 26);
      g.fillStyle(0x93c5fd);
      g.fillRect(14, 18, 8, 10);
      g.fillRect(42, 18, 8, 10);
      g.fillStyle(0xfbbf24);
      g.fillRect(31, 32, 3, 3);
    });

    this.drawTexture('bunk_bed', 64, 64, (g) => {
      g.fillStyle(0x334155);
      g.fillRect(8, 12, 48, 40);
      g.fillStyle(0x475569);
      g.fillRect(12, 18, 40, 10);
      g.fillRect(12, 34, 40, 10);
      g.fillStyle(0x94a3b8);
      g.fillRect(14, 20, 14, 6);
      g.fillRect(14, 36, 14, 6);
      g.fillStyle(0x64748b);
      g.fillRect(10, 12, 3, 40);
      g.fillRect(51, 12, 3, 40);
    });

    this.drawTexture('guard_post', 64, 64, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x334155);
      g.fillRect(14, 14, 36, 36);
      g.fillStyle(0x64748b);
      g.fillRect(30, 8, 4, 26);
      g.fillStyle(0xfbbf24);
      g.fillRect(24, 20, 16, 6);
      g.fillStyle(0x0ea5e9);
      g.fillRect(18, 34, 28, 10);
    });

    this.drawTexture('kitchen_station', 64, 64, (g) => {
      g.fillStyle(0x3f2a1b);
      g.fillRect(6, 18, 52, 38);
      g.fillStyle(0x7c4a2a);
      g.fillRect(10, 22, 44, 30);
      g.fillStyle(0x94a3b8);
      g.fillRect(12, 14, 40, 6);
      g.fillStyle(0xf59e0b);
      g.fillCircle(20, 32, 5);
      g.fillStyle(0xfb923c);
      g.fillCircle(20, 32, 2);
      g.fillStyle(0x22d3ee);
      g.fillRect(34, 28, 14, 10);
    });

    this.drawTexture('teleporter', 64, 64, (g) => {
      g.fillStyle(0x1e1b4b);
      g.fillRect(6, 10, 52, 44);
      g.fillStyle(0x312e81);
      g.fillRect(10, 14, 44, 36);
      g.fillStyle(0xa78bfa);
      g.fillCircle(32, 32, 16);
      g.fillStyle(0xe9d5ff);
      g.fillCircle(32, 32, 9);
      g.fillStyle(0xc4b5fd);
      g.fillRect(30, 8, 4, 8);
    });

    this.drawTexture('shield_generator', 64, 64, (g) => {
      g.fillStyle(0x0b1320);
      g.fillRect(8, 8, 48, 48);
      g.fillStyle(0x1e3a8a);
      g.fillRect(12, 12, 40, 40);
      g.fillStyle(0x38bdf8);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0x7dd3fc);
      g.fillCircle(32, 32, 10);
      g.fillStyle(0x0ea5e9);
      g.fillRect(30, 12, 4, 12);
      g.fillRect(30, 40, 4, 12);
    });

    this.drawTexture('flag', 64, 64, (g) => {
      g.fillStyle(0x334155);
      g.fillRect(30, 10, 4, 44);
      g.fillStyle(0x0ea5e9);
      g.fillRect(34, 12, 20, 14);
      g.fillStyle(0xf8fafc);
      g.fillRect(38, 16, 6, 2);
      g.fillRect(38, 20, 10, 2);
      g.fillStyle(0x64748b);
      g.fillRect(22, 54, 20, 4);
    });
  }

  private generateLootSprites(): void {
    this.drawTexture('loot_wood', 24, 24, (g) => {
      g.fillStyle(0x92400e);
      g.fillRect(4, 8, 16, 6);
      g.fillRect(6, 14, 12, 6);
      g.fillStyle(0xa16207);
      g.fillCircle(8, 11, 2);
      g.fillCircle(16, 11, 2);
    });

    this.drawTexture('loot_metal', 24, 24, (g) => {
      g.fillStyle(0x9ca3af);
      g.fillRect(4, 8, 16, 10);
      g.fillStyle(0x6b7280);
      g.fillRect(6, 10, 12, 6);
      g.fillStyle(0xd1d5db);
      g.fillRect(6, 10, 4, 2);
    });

    this.drawTexture('loot_food', 24, 24, (g) => {
      g.fillStyle(0xdc2626);
      g.fillRect(6, 6, 12, 14);
      g.fillStyle(0xef4444);
      g.fillRect(8, 8, 8, 10);
      g.fillStyle(0xfef3c7);
      g.fillRect(8, 10, 8, 4);
      g.fillStyle(0x9ca3af);
      g.fillRect(7, 5, 10, 3);
    });

    this.drawTexture('loot_ammo', 24, 24, (g) => {
      g.fillStyle(0x78350f);
      g.fillRect(4, 8, 16, 12);
      g.fillStyle(0x92400e);
      g.fillRect(6, 10, 12, 8);
      g.fillStyle(0xfbbf24);
      for (let i = 0; i < 3; i++) {
        g.fillRect(8 + i * 3, 4, 2, 8);
        g.fillStyle(0xf59e0b);
        g.fillRect(8 + i * 3, 4, 2, 3);
        g.fillStyle(0xfbbf24);
      }
    });

    this.drawTexture('loot_scrap', 24, 24, (g) => {
      g.fillStyle(0x6b7280);
      g.fillRect(4, 4, 8, 8);
      g.fillRect(12, 12, 8, 8);
      g.fillStyle(0x9ca3af);
      g.fillCircle(8, 8, 3);
      g.fillCircle(16, 16, 3);
      g.fillStyle(0x374151);
      g.fillCircle(8, 8, 1);
      g.fillCircle(16, 16, 1);
    });

    this.drawTexture('loot_water', 24, 24, (g) => {
      g.fillStyle(0x1d4ed8);
      g.fillRect(8, 4, 8, 16);
      g.fillStyle(0x60a5fa);
      g.fillRect(9, 7, 6, 10);
      g.fillStyle(0x93c5fd);
      g.fillRect(10, 3, 4, 3);
    });

    this.drawTexture('loot_medical', 24, 24, (g) => {
      g.fillStyle(0xdc2626);
      g.fillRect(5, 7, 14, 12);
      g.fillStyle(0xffffff);
      g.fillRect(10, 9, 4, 8);
      g.fillRect(8, 11, 8, 4);
      g.fillStyle(0x7f1d1d);
      g.fillRect(9, 5, 6, 2);
    });

    this.drawTexture('loot_core', 24, 24, (g) => {
      g.fillStyle(0x6d28d9);
      g.fillCircle(12, 12, 8);
      g.fillStyle(0xa78bfa);
      g.fillCircle(12, 12, 5);
      g.fillStyle(0xf5d0fe);
      g.fillCircle(12, 12, 2);
    });
  }

  private generateParticleTextures(): void {
    this.drawTexture('particle_blood', 8, 8, (g) => {
      g.fillStyle(0xef4444);
      g.fillCircle(4, 4, 4);
    });
    this.drawTexture('particle_spark', 6, 6, (g) => {
      g.fillStyle(0xfbbf24);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xffffff);
      g.fillCircle(2, 2, 1);
    });
    this.drawTexture('particle_smoke', 12, 12, (g) => {
      g.fillStyle(0x6b7280, 0.6);
      g.fillCircle(6, 6, 6);
    });
    this.drawTexture('particle_flash', 8, 8, (g) => {
      g.fillStyle(0xfef3c7);
      g.fillCircle(4, 4, 4);
      g.fillStyle(0xfbbf24);
      g.fillCircle(4, 4, 2);
    });
    this.drawTexture('particle_dust', 8, 8, (g) => {
      g.fillStyle(0x78716c, 0.5);
      g.fillCircle(4, 4, 4);
    });
    this.drawTexture('particle_impact', 4, 4, (g) => {
      g.fillStyle(0xffffff);
      g.fillCircle(2, 2, 2);
    });
  }

  private generateTerrainTextures(): void {
    this.drawCanvasTexture('world_base_map', 2000, 1500, (ctx, w, h) => {
      ctx.fillStyle = '#070c16';
      ctx.fillRect(0, 0, w, h);

      const zones = [
        { x: 0, y: 0, ww: w / 2, hh: h / 2, color: '#1b2436' },      // city
        { x: w / 2, y: 0, ww: w / 2, hh: h / 2, color: '#132a20' },  // jungle
        { x: 0, y: h / 2, ww: w / 2, hh: h / 2, color: '#32251b' },  // wasteland
        { x: w / 2, y: h / 2, ww: w / 2, hh: h / 2, color: '#1a2030' }, // industry
      ];

      zones.forEach((z, idx) => {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x, z.y, z.ww, z.hh);
        for (let i = 0; i < 3500; i++) {
          const px = z.x + Math.floor(Math.random() * z.ww);
          const py = z.y + Math.floor(Math.random() * z.hh);
          const s = 1 + Math.floor(Math.random() * 2);
          ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)';
          ctx.fillRect(px, py, s, s);
        }
      });

      // Cross roads
      ctx.fillStyle = 'rgba(14, 20, 33, 0.96)';
      ctx.fillRect(w / 2 - 44, 0, 88, h);
      ctx.fillRect(0, h / 2 - 44, w, 88);
      ctx.fillStyle = 'rgba(125, 145, 175, 0.26)';
      ctx.fillRect(w / 2 - 34, 0, 2, h);
      ctx.fillRect(w / 2 + 32, 0, 2, h);
      ctx.fillRect(0, h / 2 - 34, w, 2);
      ctx.fillRect(0, h / 2 + 32, w, 2);
      ctx.fillStyle = 'rgba(178, 198, 228, 0.42)';
      for (let y = 14; y < h; y += 30) ctx.fillRect(w / 2 - 4, y, 8, 14);
      for (let x = 14; x < w; x += 30) ctx.fillRect(x, h / 2 - 4, 14, 8);

      // Base center glow
      const centerGlow = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 420);
      centerGlow.addColorStop(0, 'rgba(255, 209, 112, 0.09)');
      centerGlow.addColorStop(1, 'rgba(255, 209, 112, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(w / 2 - 420, h / 2 - 420, 840, 840);

      // Very subtle scanline for unified look
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }
    });

    this.drawCanvasTexture('zone_city_tile', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1a2130';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 3);
        ctx.fillStyle = i % 3 === 0 ? '#2c3345' : '#20283a';
        ctx.fillRect(x, y, s, s);
      }
      ctx.strokeStyle = 'rgba(82, 96, 122, 0.35)';
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    });

    this.drawCanvasTexture('zone_jungle_tile', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#102818';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 2);
        ctx.fillStyle = i % 4 === 0 ? '#1f4d2d' : '#173c24';
        ctx.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 24; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        ctx.fillStyle = 'rgba(90, 162, 106, 0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 4 + Math.random() * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.drawCanvasTexture('zone_wasteland_tile', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2b2117';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 190; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 3);
        ctx.fillStyle = i % 3 === 0 ? '#3a2b1e' : '#2f2419';
        ctx.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        ctx.strokeStyle = 'rgba(112, 82, 55, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 4 + Math.random() * 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    this.drawCanvasTexture('zone_industry_tile', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#171a26';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 180; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 3);
        ctx.fillStyle = i % 2 === 0 ? '#252d41' : '#1f2537';
        ctx.fillRect(x, y, s, s);
      }
      ctx.strokeStyle = 'rgba(72, 82, 115, 0.35)';
      for (let i = 0; i < 10; i++) {
        const x = 4 + i * 12;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 10, h);
        ctx.stroke();
      }
    });

    this.drawCanvasTexture('zone_road_tile', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#131722';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 130; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 2);
        ctx.fillStyle = i % 2 === 0 ? '#1d2433' : '#171d2a';
        ctx.fillRect(x, y, s, s);
      }
      ctx.fillStyle = 'rgba(139, 157, 186, 0.38)';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(8 + i * 16, 60, 8, 4);
      }
    });

    this.drawTexture('deco_tree', 40, 56, (g) => {
      g.fillStyle(0x2f2417);
      g.fillRect(18, 28, 4, 26);
      g.fillStyle(0x1f5a2f);
      g.fillCircle(20, 24, 13);
      g.fillStyle(0x2d7a3a, 0.45);
      g.fillCircle(18, 22, 8);
      g.fillCircle(24, 26, 6);
    });

    this.drawTexture('deco_ruin', 64, 64, (g) => {
      g.fillStyle(0x1b1f2a, 0.95);
      g.fillRect(6, 12, 52, 44);
      g.fillStyle(0x2f3947, 0.55);
      g.fillRect(10, 16, 44, 36);
      g.fillStyle(0xfbbf24, 0.22);
      for (let y = 18; y < 48; y += 8) {
        for (let x = 12; x < 50; x += 8) {
          if (Math.random() > 0.6) g.fillRect(x, y, 3, 3);
        }
      }
    });

    this.drawTexture('deco_machine', 72, 48, (g) => {
      g.fillStyle(0x1b1d2a);
      g.fillRect(4, 8, 64, 34);
      g.fillStyle(0x3b3f52);
      g.fillRect(8, 12, 56, 26);
      g.fillStyle(0x4f566f);
      g.fillRect(14, 16, 18, 8);
      g.fillRect(40, 20, 16, 10);
      g.fillStyle(0x0ea5e9, 0.45);
      g.fillRect(10, 28, 44, 3);
    });

    this.drawTexture('deco_crater', 40, 40, (g) => {
      g.fillStyle(0x2a1f16, 0.75);
      g.fillCircle(20, 20, 17);
      g.fillStyle(0x3d2b1f, 0.55);
      g.fillCircle(20, 20, 11);
      g.fillStyle(0x140f0a, 0.5);
      g.fillCircle(20, 20, 7);
    });
  }

  private generateVillageTextures(): void {
    this.drawCanvasTexture('village_ground', 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0f1b2a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a2a40';
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
      ctx.strokeStyle = 'rgba(95, 122, 155, 0.4)';
      for (let x = 0; x < w; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.fillRect(0, 30, w, 3);
      ctx.fillRect(0, 0, w, 2);
    });

    this.drawCanvasTexture('village_path', 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#30271f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4f3f31';
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
      ctx.strokeStyle = 'rgba(106, 84, 66, 0.55)';
      for (let x = 0; x < w; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fillRect(0, 30, w, 3);
    });

    this.drawTexture('hut_large', 96, 80, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(0, 18, 96, 58);
      g.fillStyle(0x334155);
      g.fillRect(6, 24, 84, 46);
      g.fillStyle(0x0f172a);
      g.fillRect(40, 36, 16, 34);
      g.fillStyle(0x475569);
      g.beginPath();
      g.moveTo(48, 2);
      g.lineTo(0, 26);
      g.lineTo(96, 26);
      g.closePath();
      g.fillPath();
      g.fillStyle(0x0ea5e9);
      g.fillRect(10, 30, 22, 6);
      g.fillStyle(0x7dd3fc);
      g.fillRect(12, 32, 18, 2);
      g.fillStyle(0xfbbf24);
      g.fillRect(62, 36, 18, 12);
      g.fillStyle(0xfef3c7);
      g.fillRect(64, 38, 14, 8);
    });

    this.drawTexture('street_lamp', 16, 64, (g) => {
      g.fillStyle(0x151d2b);
      g.fillRect(6, 12, 4, 46);
      g.fillStyle(0x475569);
      g.fillRect(4, 10, 8, 4);
      g.fillStyle(0x1f2937);
      g.fillRect(2, 0, 12, 16);
      g.fillStyle(0x334155);
      g.fillRect(3, 1, 10, 14);
      g.fillStyle(0xfef3c7);
      g.fillRect(4, 3, 8, 8);
      g.fillStyle(0xf59e0b);
      g.fillRect(4, 12, 8, 2);
      g.fillStyle(0xffffff, 0.28);
      g.fillRect(5, 4, 2, 5);
    });

    this.drawTexture('supply_crate', 48, 32, (g) => {
      g.fillStyle(0x2b1d12);
      g.fillRect(0, 0, 48, 32);
      g.fillStyle(0x3f2a1b);
      g.fillRect(3, 3, 42, 26);
      g.lineStyle(2, 0x0f172a, 1);
      g.strokeRect(3, 3, 42, 26);
      g.fillStyle(0xfbbf24);
      g.fillRect(20, 12, 8, 8);
    });

    this.drawTexture('farm_plot', 96, 48, (g) => {
      g.fillStyle(0x1f1a15);
      g.fillRect(0, 0, 96, 48);
      g.fillStyle(0x2f261e);
      for (let i = 0; i < 3; i++) {
        g.fillRect(8 + i * 28, 6, 20, 36);
      }
      g.fillStyle(0x22c55e);
      for (let i = 0; i < 6; i++) {
        g.fillRect(12 + i * 12, 12 + (i % 2) * 10, 3, 12);
        g.fillRect(10 + i * 12, 16 + (i % 2) * 10, 7, 3);
      }
    });

    this.drawTexture('store_front', 320, 170, (g) => {
      g.fillStyle(0x0e1624);
      g.fillRect(0, 8, 320, 162);
      g.fillStyle(0x1f3045);
      g.fillRect(8, 14, 304, 150);

      g.fillStyle(0x0b1220);
      g.fillRect(8, 20, 304, 22);
      g.fillStyle(0x22d3ee);
      g.fillRect(10, 24, 300, 3);
      g.fillStyle(0x7dd3fc);
      g.fillRect(10, 39, 300, 2);

      g.fillStyle(0x334155);
      g.fillRect(18, 44, 284, 116);
      g.fillStyle(0x2b3e56);
      g.fillRect(24, 50, 272, 108);

      g.fillStyle(0x0a1221);
      g.fillRect(126, 72, 68, 88);
      g.fillStyle(0x060d1a);
      g.fillRect(134, 80, 52, 80);
      g.fillStyle(0x1e293b);
      g.fillRect(158, 102, 2, 52);

      g.fillStyle(0x1e293b);
      g.fillRect(38, 72, 72, 54);
      g.fillRect(210, 72, 72, 54);
      g.fillStyle(0x67e8f9);
      g.fillRect(44, 78, 60, 42);
      g.fillRect(216, 78, 60, 42);
      g.fillStyle(0xffffff);
      g.fillRect(48, 82, 10, 30);
      g.fillRect(220, 82, 10, 30);
      g.fillStyle(0x0ea5e9);
      g.fillRect(44, 114, 60, 3);
      g.fillRect(216, 114, 60, 3);

      g.fillStyle(0x2a1f16);
      g.fillRect(18, 146, 284, 14);
      g.fillStyle(0x3f2a1b);
      g.fillRect(24, 150, 272, 10);
      g.fillStyle(0x94a3b8);
      for (let x = 34; x < 288; x += 26) g.fillRect(x, 150, 12, 5);
    });

    this.drawTexture('store_sign_board', 360, 56, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(4, 6, 352, 44);
      g.fillStyle(0x1e3a8a);
      g.fillRect(8, 10, 344, 36);
      g.fillStyle(0x38bdf8);
      g.fillRect(8, 10, 344, 3);
      g.fillRect(8, 43, 344, 3);
      g.fillStyle(0xfbbf24);
      g.fillRect(12, 16, 16, 24);
      g.fillRect(332, 16, 16, 24);
    });

    this.drawTexture('store_counter', 120, 48, (g) => {
      g.fillStyle(0x1b2434);
      g.fillRect(0, 8, 120, 40);
      g.fillStyle(0x334155);
      g.fillRect(4, 12, 112, 34);
      g.fillStyle(0x0b1220);
      g.fillRect(0, 4, 120, 9);
      g.fillStyle(0x22d3ee);
      g.fillRect(2, 7, 116, 2);
      g.fillStyle(0x7dd3fc);
      g.fillRect(8, 17, 22, 22);
      g.fillRect(90, 17, 22, 22);
      g.fillStyle(0x1f2937);
      g.fillRect(34, 18, 52, 20);
      g.fillStyle(0xfbbf24);
      g.fillRect(56, 24, 8, 8);
    });
  }

  private initRunState(): void {
    gameState.load();
    gameState.resetRun();
    (window as any).runState = gameState.toLegacyRunState();
  }
}
