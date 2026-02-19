import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { ASSET_OVERRIDES } from '../data/assetOverrides';
import {
  HERO_V2_ACTIONS,
  HERO_V2_DIRECTIONS,
  HERO_V2_ROW_WIDTH,
  HERO_V2_SHEET_PATH,
  HERO_V2_TEXTURE_KEY,
  ENEMY_V2_ACTIONS,
  ENEMY_V2_DIRECTIONS,
  ENEMY_V2_ROW_WIDTH,
  ENEMY_V2_SHEET_PATHS,
  ENEMY_V2_TEXTURE_KEYS,
  type EnemyV2Archetype,
  buildFrameRange,
  enemyAnimKey,
  heroAnimKey,
  V2_FRAME_SIZE,
} from '../data/v2SpriteAnims';

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
    this.preloadV2SpriteSheets();
  }

  create(): void {
    this.generateAssets();
    this.registerV2Animations();
    this.initRunState();
    this.scene.start('MenuScene');
  }

  private generateAssets(): void {
    this.generatePlayerSprite();
    this.generateEnemySprites();
    this.generateCompanionSprite();
    this.generateCharacterRoleSprites();
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

  private preloadV2SpriteSheets(): void {
    this.load.spritesheet(HERO_V2_TEXTURE_KEY, HERO_V2_SHEET_PATH, {
      frameWidth: V2_FRAME_SIZE,
      frameHeight: V2_FRAME_SIZE,
    });

    (Object.keys(ENEMY_V2_TEXTURE_KEYS) as EnemyV2Archetype[]).forEach((kind) => {
      this.load.spritesheet(ENEMY_V2_TEXTURE_KEYS[kind], ENEMY_V2_SHEET_PATHS[kind], {
        frameWidth: V2_FRAME_SIZE,
        frameHeight: V2_FRAME_SIZE,
      });
    });
  }

  private registerV2Animations(): void {
    this.registerHeroV2Animations();
    (Object.keys(ENEMY_V2_TEXTURE_KEYS) as EnemyV2Archetype[]).forEach((kind) => {
      this.registerEnemyV2Animations(kind);
    });
  }

  private registerHeroV2Animations(): void {
    if (!this.textures.exists(HERO_V2_TEXTURE_KEY)) return;
    HERO_V2_DIRECTIONS.forEach((dir, row) => {
      (Object.entries(HERO_V2_ACTIONS) as Array<[keyof typeof HERO_V2_ACTIONS, typeof HERO_V2_ACTIONS.walk]>).forEach(([action, def]) => {
        const key = heroAnimKey(dir, action);
        const frames = buildFrameRange(row, HERO_V2_ROW_WIDTH, def.start, def.count);
        this.createAnimationIfMissing(key, HERO_V2_TEXTURE_KEY, frames, def.frameRate, def.repeat);
      });
    });
  }

  private registerEnemyV2Animations(kind: EnemyV2Archetype): void {
    const textureKey = ENEMY_V2_TEXTURE_KEYS[kind];
    if (!this.textures.exists(textureKey)) return;
    ENEMY_V2_DIRECTIONS.forEach((dir, row) => {
      (Object.entries(ENEMY_V2_ACTIONS) as Array<[keyof typeof ENEMY_V2_ACTIONS, typeof ENEMY_V2_ACTIONS.walk]>).forEach(([action, def]) => {
        const key = enemyAnimKey(kind, dir, action);
        const frames = buildFrameRange(row, ENEMY_V2_ROW_WIDTH, def.start, def.count);
        this.createAnimationIfMissing(key, textureKey, frames, def.frameRate, def.repeat);
      });
    });
  }

  private createAnimationIfMissing(
    key: string,
    textureKey: string,
    frameNumbers: number[],
    frameRate: number,
    repeat: number
  ): void {
    if (this.anims.exists(key)) return;
    if (!this.textures.exists(textureKey)) return;
    this.anims.create({
      key,
      frames: frameNumbers.map((frame) => ({ key: textureKey, frame })),
      frameRate,
      repeat,
    });
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

  private generateCharacterRoleSprites(): void {
    this.drawTexture('npc_merchant', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x1f1b12);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf7d7a8);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xf59e0b);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x92400e);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0xfbbf24);
      g.fillRect(24, 14, 5, 5);
    });

    this.drawTexture('npc_commander', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x0d1524);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf3cc9c);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x0ea5e9);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x1d4ed8);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0x22d3ee);
      g.fillRect(13, 16, 6, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('npc_weaponsmith', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x1b1022);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf1c99a);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xa855f7);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x7c3aed);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0xf472b6);
      g.fillRect(13, 15, 6, 3);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0x93c5fd);
      g.fillRect(23, 13, 6, 2);
      g.fillRect(26, 12, 2, 4);
    });

    this.drawTexture('companion_tank', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x0d1426);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(8, 10, 16, 13);
      g.fillRect(9, 22, 6, 8);
      g.fillRect(17, 22, 6, 8);
      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x1d4ed8);
      g.fillRect(9, 11, 14, 11);
      g.fillStyle(0x60a5fa);
      g.fillRect(10, 12, 12, 2);
      g.fillStyle(0x22d3ee);
      g.fillRect(14, 16, 4, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('companion_sniper', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x0a1820);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 11);
      g.fillRect(10, 21, 5, 9);
      g.fillRect(17, 21, 5, 9);
      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x0f766e);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x14b8a6);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0x67e8f9);
      g.fillRect(23, 13, 8, 2);
      g.fillRect(28, 12, 2, 4);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('companion_medic', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x1a1224);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 11);
      g.fillRect(10, 21, 5, 9);
      g.fillRect(17, 21, 5, 9);
      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xbe185d);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0xf472b6);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0xffffff);
      g.fillRect(14, 14, 4, 6);
      g.fillRect(13, 15, 6, 4);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('npc_guard', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x0b1322);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf3cc9c);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x1d4ed8);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x60a5fa);
      g.fillRect(11, 13, 10, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0x93c5fd);
      g.fillRect(23, 14, 6, 2);
    });

    this.drawTexture('npc_doctor', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x1f2937);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf2c99a);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xf8fafc);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0xf43f5e);
      g.fillRect(14, 13, 4, 6);
      g.fillRect(13, 14, 6, 4);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('npc_engineer', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x1f1b12);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf5d2a7);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xf59e0b);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0xb45309);
      g.fillRect(11, 13, 10, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0x94a3b8);
      g.fillRect(23, 13, 6, 3);
    });

    this.drawTexture('npc_scout', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x0a1820);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf2c89a);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x0f766e);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x14b8a6);
      g.fillRect(11, 13, 10, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0x67e8f9);
      g.fillRect(23, 14, 5, 2);
    });

    this.drawTexture('companion_engineer', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x121722);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(8, 10, 16, 13);
      g.fillRect(9, 22, 6, 8);
      g.fillRect(17, 22, 6, 8);
      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0xf59e0b);
      g.fillRect(9, 11, 14, 11);
      g.fillStyle(0xfbbf24);
      g.fillRect(10, 13, 12, 2);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
      g.fillStyle(0x94a3b8);
      g.fillRect(23, 13, 6, 3);
    });

    this.drawTexture('companion_raider', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x150f20);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf0c996);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x6d28d9);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0xa855f7);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0xf472b6);
      g.fillRect(23, 13, 8, 2);
      g.fillRect(28, 12, 2, 4);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('companion_support', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.33);
      g.fillEllipse(16, 30, 15, 4);
      g.fillStyle(0x111827);
      g.fillRect(10, 3, 12, 7);
      g.fillRect(9, 10, 14, 12);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xf1cda1);
      g.fillRect(12, 5, 8, 3);
      g.fillStyle(0x0891b2);
      g.fillRect(10, 11, 12, 10);
      g.fillStyle(0x22d3ee);
      g.fillRect(11, 12, 10, 2);
      g.fillStyle(0xe0f2fe);
      g.fillRect(14, 15, 4, 5);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });
  }

  private generateProjectileSprites(): void {
    this.drawTexture('bullet', 16, 16, (g) => {
      g.fillStyle(0x0b1220);
      g.fillRect(5, 1, 6, 14);
      g.fillStyle(0x0ea5e9);
      g.fillRect(6, 3, 4, 10);
      g.fillStyle(0xe0f2fe);
      g.fillRect(7, 1, 2, 9);
      g.fillStyle(0x38bdf8);
      g.fillRect(5, 12, 6, 2);
    });

    this.drawTexture('bullet_scatter', 16, 16, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(5, 3, 6, 10);
      g.fillStyle(0x38bdf8);
      g.fillRect(6, 4, 4, 8);
      g.fillStyle(0xe0f2fe);
      g.fillRect(7, 6, 2, 4);
      g.fillStyle(0x93c5fd);
      g.fillRect(4, 6, 1, 2);
      g.fillRect(11, 6, 1, 2);
    });

    this.drawTexture('bullet_pulse', 16, 16, (g) => {
      g.fillStyle(0x05202d);
      g.fillRect(3, 2, 10, 12);
      g.fillStyle(0x06b6d4);
      g.fillRect(4, 4, 8, 8);
      g.fillStyle(0x67e8f9);
      g.fillRect(5, 6, 6, 4);
      g.fillStyle(0xe0fbff);
      g.fillRect(6, 7, 4, 2);
    });

    this.drawTexture('bullet_flame', 16, 16, (g) => {
      g.fillStyle(0x4a1a06);
      g.fillRect(6, 1, 4, 13);
      g.fillStyle(0xea580c);
      g.fillRect(6, 3, 4, 9);
      g.fillStyle(0xfb923c);
      g.fillRect(7, 1, 2, 6);
      g.fillStyle(0xfacc15);
      g.fillRect(7, 2, 2, 3);
      g.fillStyle(0xfffbeb);
      g.fillRect(7, 2, 1, 1);
    });

    this.drawTexture('bullet_pierce', 16, 16, (g) => {
      g.fillStyle(0x082f49);
      g.fillRect(7, 1, 2, 14);
      g.fillStyle(0x0ea5e9);
      g.fillRect(7, 3, 2, 10);
      g.fillStyle(0xe0f7ff);
      g.fillRect(7, 1, 1, 6);
      g.fillStyle(0x67e8f9);
      g.fillRect(6, 12, 4, 2);
    });

    this.drawTexture('bullet_cannon', 16, 16, (g) => {
      g.fillStyle(0x2e1065);
      g.fillRect(4, 2, 8, 12);
      g.fillStyle(0x9333ea);
      g.fillRect(5, 3, 6, 10);
      g.fillStyle(0xe9d5ff);
      g.fillRect(6, 5, 4, 5);
      g.fillStyle(0xc084fc);
      g.fillRect(5, 11, 6, 2);
    });

    this.drawTexture('bullet_frost', 16, 16, (g) => {
      g.fillStyle(0x0c2236);
      g.fillRect(6, 2, 4, 12);
      g.fillRect(2, 6, 12, 4);
      g.fillStyle(0x93c5fd);
      g.fillRect(7, 2, 2, 12);
      g.fillRect(2, 7, 12, 2);
      g.fillStyle(0xf0f9ff);
      g.fillRect(7, 5, 2, 6);
      g.fillRect(5, 7, 6, 2);
    });

    this.drawTexture('bullet_chain', 16, 16, (g) => {
      g.fillStyle(0x2f123f);
      g.fillRect(5, 2, 6, 12);
      g.fillStyle(0xa855f7);
      g.fillRect(6, 3, 4, 10);
      g.fillStyle(0xf0abfc);
      g.fillRect(5, 5, 2, 2);
      g.fillRect(9, 7, 2, 2);
      g.fillRect(5, 9, 2, 2);
      g.fillRect(9, 11, 2, 2);
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
      g.fillStyle(0x0b1220, 0.38);
      g.fillRect(9, 10, 3, 1);
      g.fillRect(24, 22, 5, 1);
      g.fillRect(41, 46, 4, 1);
      g.fillStyle(0xf59e0b, 0.28);
      g.fillRect(6, 12, 8, 2);
      g.fillRect(50, 48, 8, 2);
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
      g.fillStyle(0x67e8f9, 0.55);
      g.fillRect(24, 29, 16, 2);
      g.fillStyle(0x0b1220, 0.45);
      g.fillRect(18, 46, 28, 2);
      g.fillStyle(0xf59e0b, 0.26);
      g.fillRect(14, 16, 6, 2);
      g.fillRect(44, 16, 6, 2);
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
      g.fillStyle(0xfbbf24, 0.3);
      g.fillRect(12, 48, 40, 2);
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
      g.fillStyle(0x0b1220, 0.34);
      g.fillRect(16, 40, 32, 2);
      g.fillStyle(0xa3e635, 0.28);
      g.fillRect(12, 18, 10, 2);
      g.fillRect(42, 18, 10, 2);
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
      g.fillStyle(0x93c5fd, 0.42);
      g.fillRect(12, 18, 10, 2);
      g.fillRect(42, 18, 10, 2);
      g.fillStyle(0x0b1220, 0.35);
      g.fillRect(12, 46, 40, 2);
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
      g.fillStyle(0x67e8f9, 0.45);
      g.fillRect(20, 36, 24, 2);
      g.fillStyle(0x0b1220, 0.35);
      g.fillRect(18, 44, 28, 2);
      g.fillStyle(0xf59e0b, 0.26);
      g.fillRect(22, 16, 20, 2);
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

      const paintEllipse = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        color: string,
        alpha: number,
        rotation = 0
      ) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Core biome bodies (irregular / overlapping so it doesn't look like a hard 2x2 split).
      paintEllipse(300, 340, 470, 350, '#26384a', 0.92, -0.14);   // urban core (NW)
      paintEllipse(1660, 360, 610, 390, '#1a3a2d', 0.9, 0.08);    // forest belt (E/N)
      paintEllipse(460, 1180, 670, 430, '#3a2d20', 0.84, 0.11);   // wasteland/sand (SW)
      paintEllipse(1600, 1170, 560, 360, '#222b3b', 0.9, -0.08);  // rocky/cave outskirts (SE)
      paintEllipse(1000, 760, 420, 300, '#28364a', 0.42, 0);      // base transition basin

      // Soft transition grain.
      for (let i = 0; i < 9800; i += 1) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const s = 1 + Math.floor(Math.random() * 2);
        const t = Math.random();
        let color = 'rgba(255,255,255,0.03)';
        if (x < 700 && y < 760) color = 'rgba(176,200,232,0.05)'; // city speckle
        else if (x > 1180 && y < 780) color = 'rgba(126,186,126,0.05)'; // forest speckle
        else if (x < 1080 && y > 760) color = 'rgba(164,132,98,0.05)'; // wasteland speckle
        else if (x > 1120 && y > 760) color = 'rgba(136,152,180,0.045)'; // rocky speckle
        ctx.fillStyle = color;
        if (t > 0.16) ctx.fillRect(x, y, s, s);
      }

      // River trunk + branch (aligned with gameplay water lanes).
      ctx.fillStyle = 'rgba(28, 132, 191, 0.35)';
      ctx.fillRect(292, 90, 168, 1320);
      ctx.fillStyle = 'rgba(36, 162, 225, 0.26)';
      ctx.fillRect(380, 1020, 346, 176);
      ctx.fillStyle = 'rgba(36, 162, 225, 0.22)';
      ctx.fillRect(352, 176, 224, 298);
      for (let i = 0; i < 54; i += 1) {
        const rx = 308 + Math.random() * 410;
        const ry = 120 + Math.random() * 1290;
        const rw = 10 + Math.random() * 22;
        const rh = 2 + Math.random() * 6;
        ctx.fillStyle = 'rgba(205, 235, 255, 0.12)';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main road network: center avenue + mid horizontal boulevard + branch roads.
      ctx.fillStyle = 'rgba(12, 18, 30, 0.94)';
      ctx.fillRect(w / 2 - 36, 0, 72, h);
      ctx.fillRect(210, h / 2 - 36, 1580, 72);
      ctx.fillRect(192, 302, 290, 58);
      ctx.fillRect(1330, 366, 370, 56);
      ctx.fillRect(1320, 1080, 360, 56);
      ctx.fillStyle = 'rgba(140, 160, 188, 0.28)';
      ctx.fillRect(w / 2 - 26, 0, 2, h);
      ctx.fillRect(w / 2 + 24, 0, 2, h);
      ctx.fillRect(220, h / 2 - 26, 1560, 2);
      ctx.fillRect(220, h / 2 + 24, 1560, 2);
      ctx.fillStyle = 'rgba(200, 218, 238, 0.44)';
      for (let y = 16; y < h; y += 30) ctx.fillRect(w / 2 - 4, y, 8, 14);
      for (let x = 240; x < 1760; x += 30) ctx.fillRect(x, h / 2 - 4, 14, 8);

      // Base center halo and outer vignette.
      const centerGlow = ctx.createRadialGradient(w / 2, h / 2, 70, w / 2, h / 2, 500);
      centerGlow.addColorStop(0, 'rgba(255, 210, 122, 0.08)');
      centerGlow.addColorStop(0.55, 'rgba(127, 200, 255, 0.045)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(w / 2 - 520, h / 2 - 520, 1040, 1040);
      const vignette = ctx.createRadialGradient(w / 2, h / 2, 520, w / 2, h / 2, 1150);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

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

    this.drawTexture('deco_boulder', 56, 36, (g) => {
      g.fillStyle(0x1f2937, 0.95);
      g.fillEllipse(28, 20, 50, 24);
      g.fillStyle(0x334155, 0.88);
      g.fillEllipse(26, 18, 40, 18);
      g.fillStyle(0x94a3b8, 0.32);
      g.fillRect(17, 12, 12, 4);
      g.fillRect(31, 16, 9, 3);
    });

    this.drawTexture('deco_pine', 42, 64, (g) => {
      g.fillStyle(0x2a1f16);
      g.fillRect(18, 38, 6, 22);
      g.fillStyle(0x14532d);
      g.fillTriangle(21, 8, 4, 30, 38, 30);
      g.fillStyle(0x166534);
      g.fillTriangle(21, 16, 2, 39, 40, 39);
      g.fillStyle(0x22c55e, 0.25);
      g.fillRect(16, 18, 10, 2);
      g.fillRect(13, 26, 16, 2);
    });

    this.drawTexture('deco_billboard', 90, 66, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(10, 8, 70, 42);
      g.fillStyle(0x334155);
      g.fillRect(14, 12, 62, 34);
      g.fillStyle(0x0ea5e9);
      g.fillRect(16, 14, 58, 6);
      g.fillStyle(0xf8fafc);
      g.fillRect(20, 24, 16, 4);
      g.fillRect(40, 24, 30, 4);
      g.fillStyle(0x0f172a);
      g.fillRect(22, 32, 40, 9);
      g.fillStyle(0x475569);
      g.fillRect(24, 50, 6, 14);
      g.fillRect(60, 50, 6, 14);
    });

    this.drawTexture('deco_river_pier', 72, 42, (g) => {
      g.fillStyle(0x2f241a);
      g.fillRect(4, 10, 64, 12);
      g.fillStyle(0x4b3828);
      g.fillRect(6, 12, 60, 8);
      g.fillStyle(0x1f2937);
      g.fillRect(12, 22, 6, 16);
      g.fillRect(54, 22, 6, 16);
      g.fillStyle(0x94a3b8);
      g.fillRect(34, 8, 4, 2);
    });

    this.drawTexture('deco_cave_stalagmite', 44, 68, (g) => {
      g.fillStyle(0x111827);
      g.fillTriangle(22, 6, 5, 64, 39, 64);
      g.fillStyle(0x1f2937);
      g.fillTriangle(22, 12, 10, 62, 34, 62);
      g.fillStyle(0x334155, 0.35);
      g.fillRect(20, 26, 4, 18);
    });

    this.drawTexture('deco_wreck_car', 102, 46, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 10, 102, 36);
      g.fillStyle(0x334155);
      g.fillRect(8, 14, 86, 28);
      g.fillStyle(0x1e293b);
      g.fillRect(14, 18, 74, 22);
      g.fillStyle(0x7dd3fc);
      g.fillRect(18, 20, 16, 9);
      g.fillRect(68, 20, 14, 9);
      g.fillStyle(0x991b1b);
      g.fillRect(24, 14, 40, 3);
      g.fillStyle(0x64748b);
      g.fillCircle(18, 40, 6);
      g.fillCircle(82, 40, 6);
      g.fillStyle(0x0b1220);
      g.fillCircle(18, 40, 3);
      g.fillCircle(82, 40, 3);
      g.fillStyle(0xef4444, 0.45);
      g.fillRect(92, 28, 6, 3);
    });

    this.drawTexture('deco_barricade', 88, 42, (g) => {
      g.fillStyle(0x2b1d12);
      g.fillRect(2, 20, 84, 12);
      g.fillStyle(0x4b3524);
      g.fillRect(4, 22, 80, 8);
      g.fillStyle(0x7f1d1d);
      g.fillRect(10, 14, 68, 4);
      g.fillStyle(0x9ca3af);
      for (let x = 6; x < 82; x += 14) g.fillRect(x, 8, 3, 10);
      g.fillStyle(0x334155);
      g.fillRect(8, 30, 6, 10);
      g.fillRect(74, 30, 6, 10);
    });

    this.drawTexture('deco_radio_tower', 60, 120, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(26, 20, 8, 90);
      g.fillStyle(0x334155);
      g.fillRect(28, 22, 4, 86);
      g.lineStyle(2, 0x64748b, 1);
      g.beginPath();
      g.moveTo(30, 20);
      g.lineTo(12, 108);
      g.moveTo(30, 20);
      g.lineTo(48, 108);
      g.strokePath();
      g.fillStyle(0x1e293b);
      g.fillRect(20, 8, 20, 14);
      g.fillStyle(0xf43f5e);
      g.fillCircle(30, 10, 3);
      g.fillStyle(0x22d3ee);
      g.fillRect(28, 12, 4, 3);
    });

    this.drawTexture('deco_bridge_broken', 116, 48, (g) => {
      g.fillStyle(0x2f241a);
      g.fillRect(0, 16, 116, 14);
      g.fillStyle(0x4b3828);
      g.fillRect(4, 18, 108, 10);
      g.fillStyle(0x1e293b);
      g.fillRect(44, 18, 26, 10);
      g.fillStyle(0x0b1220);
      g.fillRect(48, 18, 18, 10);
      g.fillStyle(0x334155);
      g.fillRect(8, 30, 8, 14);
      g.fillRect(98, 30, 8, 14);
      g.fillStyle(0x64748b);
      g.fillRect(24, 8, 6, 10);
      g.fillRect(84, 8, 6, 10);
    });

    this.drawTexture('deco_river_boat', 86, 44, (g) => {
      g.fillStyle(0x0f172a);
      g.fillEllipse(43, 30, 78, 20);
      g.fillStyle(0x334155);
      g.fillEllipse(43, 28, 70, 16);
      g.fillStyle(0x1e293b);
      g.fillRect(18, 20, 50, 10);
      g.fillStyle(0x0ea5e9);
      g.fillRect(24, 22, 20, 6);
      g.fillStyle(0xfbbf24);
      g.fillRect(54, 20, 8, 10);
      g.fillStyle(0x7dd3fc, 0.5);
      g.fillRect(24, 24, 14, 2);
    });

    this.drawTexture('deco_forest_shrine', 92, 78, (g) => {
      g.fillStyle(0x14532d);
      g.fillTriangle(46, 6, 10, 26, 82, 26);
      g.fillStyle(0x1f2937);
      g.fillRect(10, 26, 72, 48);
      g.fillStyle(0x334155);
      g.fillRect(16, 32, 60, 40);
      g.fillStyle(0x0b1220);
      g.fillRect(36, 44, 20, 28);
      g.fillStyle(0x86efac);
      g.fillRect(24, 38, 14, 12);
      g.fillRect(54, 38, 14, 12);
      g.fillStyle(0xfacc15);
      g.fillRect(42, 30, 8, 6);
    });

    this.drawTexture('deco_cave_gate', 126, 88, (g) => {
      g.fillStyle(0x111827);
      g.fillEllipse(63, 54, 120, 62);
      g.fillStyle(0x1f2937);
      g.fillEllipse(63, 52, 108, 52);
      g.fillStyle(0x030712);
      g.fillEllipse(63, 54, 68, 34);
      g.fillStyle(0x334155);
      g.fillRect(12, 16, 22, 18);
      g.fillRect(92, 16, 22, 18);
      g.fillStyle(0x64748b);
      g.fillRect(16, 20, 14, 10);
      g.fillRect(96, 20, 14, 10);
      g.fillStyle(0xa78bfa, 0.44);
      g.fillRect(52, 42, 22, 4);
    });
  }

  private generateVillageTextures(): void {
    this.drawCanvasTexture('village_ground', 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#1a2430';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#253443';
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
      ctx.strokeStyle = 'rgba(101, 123, 139, 0.32)';
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
      // Moss + life patches to reduce hardcore metallic feeling.
      for (let i = 0; i < 36; i += 1) {
        const px = Math.floor(Math.random() * w);
        const py = Math.floor(Math.random() * h);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(120, 168, 112, 0.22)' : 'rgba(97, 143, 102, 0.16)';
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.fillStyle = 'rgba(255, 214, 138, 0.08)';
      ctx.fillRect(0, 31, w, 2);
    });

    this.drawCanvasTexture('village_path', 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#362c24';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5e4c3a';
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
      ctx.strokeStyle = 'rgba(124, 100, 76, 0.5)';
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
      ctx.fillStyle = 'rgba(255, 207, 129, 0.16)';
      ctx.fillRect(0, 30, w, 2);
      for (let i = 0; i < 8; i += 1) {
        const fx = 6 + i * 7;
        const fy = 6 + (i % 2) * 18;
        ctx.fillStyle = 'rgba(46, 34, 24, 0.35)';
        ctx.fillRect(fx, fy, 3, 2);
      }
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

    this.drawTexture('house_ruin_small', 84, 72, (g) => {
      g.fillStyle(0x141a26);
      g.fillRect(0, 16, 84, 56);
      g.fillStyle(0x2d3748);
      g.fillRect(4, 22, 76, 44);
      g.fillStyle(0x1f2937);
      g.fillRect(32, 40, 18, 26);
      g.fillStyle(0x64748b);
      g.beginPath();
      g.moveTo(42, 6);
      g.lineTo(0, 24);
      g.lineTo(84, 24);
      g.closePath();
      g.fillPath();
      g.fillStyle(0x94a3b8);
      g.fillRect(10, 30, 16, 11);
      g.fillRect(58, 30, 16, 11);
      g.fillStyle(0xef4444);
      g.fillRect(60, 22, 14, 3);
      g.fillStyle(0x0f172a);
      g.fillRect(8, 60, 68, 4);
    });

    this.drawTexture('house_apartment', 92, 108, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 0, 92, 108);
      g.fillStyle(0x263547);
      g.fillRect(6, 8, 80, 92);
      g.fillStyle(0x1e293b);
      g.fillRect(10, 12, 72, 84);
      g.fillStyle(0x334155);
      for (let y = 16; y <= 74; y += 14) {
        for (let x = 16; x <= 68; x += 14) {
          g.fillRect(x, y, 10, 8);
        }
      }
      g.fillStyle(0x7dd3fc);
      g.fillRect(16, 16, 10, 8);
      g.fillRect(44, 30, 10, 8);
      g.fillRect(58, 58, 10, 8);
      g.fillStyle(0x0f172a);
      g.fillRect(36, 76, 20, 24);
      g.fillStyle(0x22d3ee);
      g.fillRect(8, 10, 76, 2);
      g.fillRect(8, 98, 76, 2);
    });

    this.drawTexture('house_shop_ruin', 104, 78, (g) => {
      g.fillStyle(0x131a28);
      g.fillRect(0, 10, 104, 68);
      g.fillStyle(0x334155);
      g.fillRect(6, 16, 92, 56);
      g.fillStyle(0x1e293b);
      g.fillRect(10, 20, 84, 48);
      g.fillStyle(0x0f172a);
      g.fillRect(38, 34, 28, 34);
      g.fillStyle(0x67e8f9);
      g.fillRect(14, 30, 18, 16);
      g.fillRect(72, 30, 18, 16);
      g.fillStyle(0xf59e0b);
      g.fillRect(18, 16, 68, 6);
      g.fillStyle(0x7c2d12);
      g.fillRect(20, 17, 64, 2);
      g.fillStyle(0x0b1220);
      g.fillRect(8, 64, 88, 4);
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

    this.drawTexture('camp_tent', 98, 74, (g) => {
      g.fillStyle(0x0b1220, 0.28);
      g.fillEllipse(49, 66, 72, 10);
      g.fillStyle(0x5f4634);
      g.fillRect(12, 56, 74, 8);
      g.fillStyle(0x8b6b4b);
      g.fillTriangle(49, 12, 8, 58, 90, 58);
      g.fillStyle(0xb79266);
      g.fillTriangle(49, 18, 16, 56, 82, 56);
      g.fillStyle(0x352616);
      g.fillRect(40, 37, 18, 21);
      g.fillStyle(0xfef3c7);
      g.fillRect(45, 41, 8, 9);
      g.fillStyle(0x22c55e);
      g.fillRect(8, 58, 10, 4);
      g.fillRect(80, 58, 10, 4);
    });

    this.drawTexture('camp_garden_box', 96, 46, (g) => {
      g.fillStyle(0x3b2a1b);
      g.fillRect(0, 14, 96, 32);
      g.fillStyle(0x5a3f28);
      g.fillRect(4, 18, 88, 24);
      g.fillStyle(0x2d2117);
      g.fillRect(8, 22, 80, 16);
      g.fillStyle(0x22c55e);
      for (let i = 0; i < 8; i += 1) {
        const x = 12 + i * 10;
        const y = 24 + (i % 2) * 3;
        g.fillRect(x, y, 3, 10);
        g.fillRect(x - 1, y + 2, 6, 2);
      }
      g.fillStyle(0xf59e0b);
      g.fillRect(16, 18, 64, 2);
    });

    this.drawTexture('camp_clothesline', 112, 60, (g) => {
      g.fillStyle(0x6b4f36);
      g.fillRect(8, 8, 5, 48);
      g.fillRect(99, 8, 5, 48);
      g.fillStyle(0xb08968);
      g.fillRect(8, 10, 96, 2);
      g.fillStyle(0x94a3b8);
      g.fillRect(20, 20, 12, 14);
      g.fillStyle(0x22d3ee);
      g.fillRect(38, 20, 12, 14);
      g.fillStyle(0xfbbf24);
      g.fillRect(56, 20, 12, 14);
      g.fillStyle(0xfb7185);
      g.fillRect(74, 20, 12, 14);
      g.fillStyle(0x0b1220, 0.28);
      g.fillEllipse(56, 56, 70, 8);
    });

    this.drawTexture('camp_table', 96, 52, (g) => {
      g.fillStyle(0x3b2a1b);
      g.fillRect(8, 14, 80, 14);
      g.fillStyle(0x5a3f28);
      g.fillRect(10, 16, 76, 10);
      g.fillStyle(0x2f241a);
      g.fillRect(14, 28, 6, 20);
      g.fillRect(76, 28, 6, 20);
      g.fillStyle(0xfacc15);
      g.fillRect(20, 18, 10, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(38, 18, 10, 4);
      g.fillStyle(0xfb7185);
      g.fillRect(56, 18, 10, 4);
      g.fillStyle(0x0b1220, 0.26);
      g.fillEllipse(48, 50, 64, 8);
    });

    this.drawTexture('camp_string_lights', 188, 26, (g) => {
      g.fillStyle(0x8b6b4b);
      g.fillRect(4, 4, 180, 2);
      const bulbs = [
        { x: 16, c: 0xf59e0b },
        { x: 36, c: 0xfbbf24 },
        { x: 56, c: 0x22d3ee },
        { x: 76, c: 0xfb7185 },
        { x: 96, c: 0xf59e0b },
        { x: 116, c: 0x86efac },
        { x: 136, c: 0xfbbf24 },
        { x: 156, c: 0x22d3ee },
      ];
      bulbs.forEach((b) => {
        g.fillStyle(b.c, 0.28);
        g.fillCircle(b.x, 12, 6);
        g.fillStyle(b.c, 0.95);
        g.fillRect(b.x - 2, 8, 4, 6);
      });
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

    this.drawTexture('base_hq_hall', 214, 142, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(0, 20, 214, 122);
      g.fillStyle(0x1e293b);
      g.fillRect(10, 28, 194, 106);
      g.fillStyle(0x334155);
      g.fillRect(16, 34, 182, 94);
      g.fillStyle(0x0b1220);
      g.fillRect(86, 60, 42, 74);
      g.fillStyle(0x22d3ee);
      g.fillRect(20, 38, 174, 5);
      g.fillStyle(0x67e8f9);
      g.fillRect(24, 46, 166, 2);
      g.fillStyle(0xfbbf24);
      g.fillRect(84, 8, 46, 18);
      g.fillStyle(0x0f172a);
      g.fillRect(90, 12, 34, 10);
      g.fillStyle(0x60a5fa);
      g.fillRect(28, 64, 42, 30);
      g.fillRect(144, 64, 42, 30);
      g.fillStyle(0xffffff);
      g.fillRect(32, 68, 10, 22);
      g.fillRect(148, 68, 10, 22);
      g.fillStyle(0x94a3b8);
      for (let x = 26; x < 188; x += 18) g.fillRect(x, 124, 10, 4);
    });

    this.drawTexture('base_residence_block', 140, 98, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 12, 140, 86);
      g.fillStyle(0x263547);
      g.fillRect(8, 18, 124, 74);
      g.fillStyle(0x1e293b);
      g.fillRect(14, 24, 112, 68);
      g.fillStyle(0x334155);
      for (let y = 30; y <= 64; y += 12) {
        for (let x = 20; x <= 106; x += 17) {
          g.fillRect(x, y, 10, 8);
        }
      }
      g.fillStyle(0x93c5fd);
      g.fillRect(20, 30, 10, 8);
      g.fillRect(54, 42, 10, 8);
      g.fillRect(88, 54, 10, 8);
      g.fillStyle(0x0f172a);
      g.fillRect(60, 68, 20, 24);
      g.fillStyle(0x64748b);
      g.fillRect(20, 14, 100, 2);
    });

    this.drawTexture('base_workshop_block', 146, 102, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 12, 146, 90);
      g.fillStyle(0x2b3244);
      g.fillRect(8, 18, 130, 80);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 22, 122, 74);
      g.fillStyle(0x334155);
      g.fillRect(18, 28, 48, 20);
      g.fillRect(80, 28, 48, 20);
      g.fillStyle(0x0b1220);
      g.fillRect(58, 54, 30, 42);
      g.fillStyle(0x22d3ee);
      g.fillRect(20, 32, 44, 12);
      g.fillRect(82, 32, 44, 12);
      g.fillStyle(0xf59e0b);
      g.fillRect(22, 18, 102, 5);
      g.fillStyle(0x94a3b8);
      g.fillRect(30, 62, 24, 16);
      g.fillRect(94, 62, 24, 16);
    });

    this.drawTexture('base_clinic_block', 132, 98, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 10, 132, 88);
      g.fillStyle(0x334155);
      g.fillRect(8, 16, 116, 78);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 20, 108, 72);
      g.fillStyle(0x67e8f9);
      g.fillRect(18, 28, 42, 24);
      g.fillRect(72, 28, 42, 24);
      g.fillStyle(0xffffff);
      g.fillRect(34, 58, 8, 22);
      g.fillRect(26, 66, 24, 8);
      g.fillStyle(0xf43f5e);
      g.fillRect(44, 18, 44, 8);
      g.fillStyle(0x0f172a);
      g.fillRect(56, 58, 20, 34);
    });

    this.drawTexture('house_tower_ruin', 96, 128, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 0, 96, 128);
      g.fillStyle(0x263547);
      g.fillRect(8, 8, 80, 112);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 12, 72, 108);
      g.fillStyle(0x334155);
      for (let y = 18; y <= 88; y += 14) {
        for (let x = 20; x <= 64; x += 14) {
          g.fillRect(x, y, 8, 8);
        }
      }
      g.fillStyle(0x94a3b8);
      g.fillRect(20, 18, 8, 8);
      g.fillRect(48, 46, 8, 8);
      g.fillRect(62, 74, 8, 8);
      g.fillStyle(0x0f172a);
      g.fillRect(38, 92, 20, 28);
      g.fillStyle(0xef4444);
      g.fillRect(54, 8, 24, 4);
      g.fillStyle(0x334155);
      g.fillRect(12, 120, 72, 4);
    });

    this.drawTexture('house_block_ruin', 108, 86, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 12, 108, 74);
      g.fillStyle(0x2a3445);
      g.fillRect(6, 18, 96, 64);
      g.fillStyle(0x1e293b);
      g.fillRect(10, 22, 88, 60);
      g.fillStyle(0x334155);
      g.fillRect(16, 28, 26, 16);
      g.fillRect(66, 28, 26, 16);
      g.fillRect(16, 50, 26, 14);
      g.fillRect(66, 50, 26, 14);
      g.fillStyle(0x67e8f9);
      g.fillRect(18, 30, 22, 12);
      g.fillRect(68, 50, 22, 10);
      g.fillStyle(0x0b1220);
      g.fillRect(44, 40, 20, 42);
      g.fillStyle(0x0f172a);
      g.fillRect(0, 80, 108, 4);
    });

    this.drawTexture('shop_kiosk_ruin', 108, 84, (g) => {
      g.fillStyle(0x121a2a);
      g.fillRect(0, 12, 108, 72);
      g.fillStyle(0x334155);
      g.fillRect(8, 18, 92, 62);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 22, 84, 56);
      g.fillStyle(0xf59e0b);
      g.fillRect(18, 18, 72, 8);
      g.fillStyle(0x7c2d12);
      g.fillRect(20, 21, 68, 2);
      g.fillStyle(0x67e8f9);
      g.fillRect(18, 34, 24, 20);
      g.fillRect(66, 34, 24, 20);
      g.fillStyle(0x0b1220);
      g.fillRect(44, 46, 20, 32);
      g.fillStyle(0x94a3b8);
      g.fillRect(20, 58, 68, 2);
    });

    this.drawTexture('forest_cabin', 92, 76, (g) => {
      g.fillStyle(0x1f2937);
      g.fillRect(0, 22, 92, 54);
      g.fillStyle(0x3f2a1b);
      g.fillRect(8, 28, 76, 44);
      g.fillStyle(0x5b3a25);
      g.fillRect(12, 32, 68, 36);
      g.fillStyle(0x0f172a);
      g.fillRect(36, 42, 20, 30);
      g.fillStyle(0x86efac);
      g.fillRect(18, 38, 14, 12);
      g.fillRect(60, 38, 14, 12);
      g.fillStyle(0x14532d);
      g.fillTriangle(46, 6, 4, 30, 88, 30);
      g.fillStyle(0x166534);
      g.fillRect(14, 24, 64, 4);
    });

    this.drawTexture('cave_watch_post', 110, 84, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 16, 110, 68);
      g.fillStyle(0x1f2937);
      g.fillRect(8, 24, 94, 56);
      g.fillStyle(0x334155);
      g.fillRect(14, 30, 82, 46);
      g.fillStyle(0x0b1220);
      g.fillRect(42, 44, 26, 32);
      g.fillStyle(0x93c5fd);
      g.fillRect(18, 38, 18, 14);
      g.fillRect(74, 38, 18, 14);
      g.fillStyle(0xc4b5fd);
      g.fillRect(48, 8, 14, 10);
      g.fillStyle(0x64748b);
      g.fillRect(30, 18, 50, 4);
    });

    this.drawTexture('base_command_center', 188, 128, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(0, 12, 188, 116);
      g.fillStyle(0x1e293b);
      g.fillRect(10, 18, 168, 104);
      g.fillStyle(0x334155);
      g.fillRect(16, 24, 156, 92);
      g.fillStyle(0x0b1220);
      g.fillRect(76, 54, 36, 62);
      g.fillStyle(0x67e8f9);
      g.fillRect(24, 44, 40, 26);
      g.fillRect(124, 44, 40, 26);
      g.fillStyle(0xfbbf24);
      g.fillRect(68, 10, 52, 12);
      g.fillStyle(0x0ea5e9);
      g.fillRect(20, 28, 148, 4);
      g.fillStyle(0x94a3b8);
      g.fillRect(24, 116, 140, 4);
    });

    this.drawTexture('base_market_arcade', 166, 98, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 16, 166, 82);
      g.fillStyle(0x334155);
      g.fillRect(8, 22, 150, 72);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 26, 142, 66);
      g.fillStyle(0xf59e0b);
      g.fillRect(18, 26, 130, 10);
      g.fillStyle(0x7c2d12);
      g.fillRect(22, 30, 122, 2);
      g.fillStyle(0x67e8f9);
      g.fillRect(20, 40, 32, 20);
      g.fillRect(68, 40, 32, 20);
      g.fillRect(114, 40, 32, 20);
      g.fillStyle(0x0b1220);
      g.fillRect(66, 62, 34, 30);
      g.fillStyle(0x94a3b8);
      g.fillRect(20, 64, 126, 2);
    });

    this.drawTexture('base_training_yard', 172, 88, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 18, 172, 70);
      g.fillStyle(0x1f2937);
      g.fillRect(8, 24, 156, 58);
      g.fillStyle(0x334155);
      g.fillRect(14, 30, 144, 46);
      g.fillStyle(0x0f172a);
      g.fillRect(22, 36, 52, 32);
      g.fillRect(98, 36, 52, 32);
      g.fillStyle(0x22d3ee);
      g.fillRect(30, 44, 36, 8);
      g.fillRect(106, 44, 36, 8);
      g.fillStyle(0xfbbf24);
      g.fillRect(76, 28, 20, 8);
      g.fillStyle(0x64748b);
      g.fillRect(20, 78, 132, 4);
    });

    this.drawTexture('base_drone_hangar', 176, 108, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 12, 176, 96);
      g.fillStyle(0x2b3244);
      g.fillRect(10, 18, 156, 86);
      g.fillStyle(0x1e293b);
      g.fillRect(16, 24, 144, 78);
      g.fillStyle(0x0b1220);
      g.fillRect(60, 52, 56, 50);
      g.fillStyle(0x67e8f9);
      g.fillRect(24, 36, 40, 22);
      g.fillRect(112, 36, 40, 22);
      g.fillStyle(0xf43f5e);
      g.fillRect(74, 18, 28, 8);
      g.fillStyle(0x22d3ee);
      g.fillRect(20, 28, 136, 3);
      g.fillStyle(0x64748b);
      g.fillRect(20, 102, 136, 4);
    });

    this.drawTexture('house_duplex_ruin', 118, 94, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 18, 118, 76);
      g.fillStyle(0x2a3445);
      g.fillRect(8, 24, 102, 66);
      g.fillStyle(0x1e293b);
      g.fillRect(14, 30, 90, 60);
      g.fillStyle(0x334155);
      g.fillRect(18, 36, 26, 18);
      g.fillRect(74, 36, 26, 18);
      g.fillRect(18, 58, 26, 14);
      g.fillRect(74, 58, 26, 14);
      g.fillStyle(0x67e8f9);
      g.fillRect(20, 38, 22, 12);
      g.fillRect(76, 58, 22, 10);
      g.fillStyle(0x0b1220);
      g.fillRect(48, 50, 22, 40);
      g.fillStyle(0x7f1d1d);
      g.fillRect(22, 24, 74, 4);
    });

    this.drawTexture('house_factory_ruin', 132, 102, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 14, 132, 88);
      g.fillStyle(0x1f2937);
      g.fillRect(8, 22, 116, 78);
      g.fillStyle(0x334155);
      g.fillRect(14, 28, 104, 70);
      g.fillStyle(0x0f172a);
      g.fillRect(56, 56, 22, 42);
      g.fillStyle(0x64748b);
      g.fillRect(24, 36, 24, 14);
      g.fillRect(84, 36, 24, 14);
      g.fillStyle(0xf59e0b);
      g.fillRect(16, 22, 100, 6);
      g.fillStyle(0x7c2d12);
      g.fillRect(20, 24, 92, 2);
      g.fillStyle(0x94a3b8);
      g.fillRect(20, 98, 92, 3);
    });

    this.drawTexture('house_clinic_ruin', 112, 90, (g) => {
      g.fillStyle(0x111827);
      g.fillRect(0, 12, 112, 78);
      g.fillStyle(0x334155);
      g.fillRect(8, 18, 96, 70);
      g.fillStyle(0x1e293b);
      g.fillRect(12, 24, 88, 64);
      g.fillStyle(0x67e8f9);
      g.fillRect(18, 34, 28, 18);
      g.fillRect(66, 34, 28, 18);
      g.fillStyle(0xffffff);
      g.fillRect(48, 58, 8, 22);
      g.fillRect(42, 64, 20, 8);
      g.fillStyle(0xf43f5e);
      g.fillRect(38, 22, 36, 8);
      g.fillStyle(0x0b1220);
      g.fillRect(46, 58, 20, 30);
    });
  }

  private initRunState(): void {
    gameState.load();
    gameState.resetRun();
    (window as any).runState = gameState.toLegacyRunState();
  }
}
