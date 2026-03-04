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
import {
  CUSTOM_HERO_KEYS,
  CUSTOM_HERO_RAW_KEYS,
  CUSTOM_HERO_RAW_PATHS,
  type CustomHeroDirection,
} from '../data/customHero';

const KENNEY_RPG_SHEET_KEY = 'kenney_rpg_sheet';
const KENNEY_RPG_SHEET_PATH = '/assets/kenney_roguelike-rpg-pack/Spritesheet/roguelikeSheet_transparent.png';
const KENNEY_RPG_THEME_ENABLED = true;
const USER_ASSET_OVERRIDES: Array<{ key: string; path: string }> = [
  { key: 'bullet', path: '/assets/generated/user_upload/bullet.png' },
  { key: 'bullet_scatter', path: '/assets/generated/user_upload/bullet_scatter.png' },
  { key: 'bullet_pulse', path: '/assets/generated/user_upload/bullet_pulse.png' },
  { key: 'bullet_flame', path: '/assets/generated/user_upload/bullet_flame.png' },
  { key: 'bullet_pierce', path: '/assets/generated/user_upload/bullet_pierce.png' },
  { key: 'bullet_cannon', path: '/assets/generated/user_upload/bullet_cannon.png' },
  { key: 'bullet_frost', path: '/assets/generated/user_upload/bullet_frost.png' },
  { key: 'bullet_chain', path: '/assets/generated/user_upload/bullet_chain.png' },
  { key: 'companion', path: '/assets/generated/user_upload/companion.png' },
  { key: 'companion_tank', path: '/assets/generated/user_upload/companion_tank.png' },
  { key: 'companion_sniper', path: '/assets/generated/user_upload/companion_sniper.png' },
  { key: 'companion_medic', path: '/assets/generated/user_upload/companion_medic.png' },
  { key: 'companion_engineer', path: '/assets/generated/user_upload/companion_engineer.png' },
  { key: 'companion_raider', path: '/assets/generated/user_upload/companion_raider.png' },
  { key: 'companion_support', path: '/assets/generated/user_upload/companion_support.png' },
  { key: 'companion_custom_s', path: '/assets/generated/user_upload/companion_custom_s.png' },
  { key: 'companion_custom_n', path: '/assets/generated/user_upload/companion_custom_n.png' },
  { key: 'companion_custom_w', path: '/assets/generated/user_upload/companion_custom_w.png' },
  { key: 'companion_custom_e', path: '/assets/generated/user_upload/companion_custom_e.png' },
  { key: 'companion_custom_attack_w', path: '/assets/generated/user_upload/companion_custom_attack_w.png' },
  { key: 'user_base_tile_src', path: '/assets/基地背景圖塊.jpg' },
  { key: 'user_workbench_src', path: '/assets/工作臺.jpg' },
  { key: 'user_bunk_bed_src', path: '/assets/雙層床位.jpg' },
  { key: 'user_medical_station_src', path: '/assets/醫療站.jpg' },
  { key: 'user_room_quarters_src', path: '/assets/宿舍房間.jpg' },
];

const WORLD_BIOME_CITY_ASSETS: Array<{ key: string; path: string }> = [
  { key: 'bg_city_01', path: '/assets/废墟城市 01.jpg' },
  { key: 'bg_city_02', path: '/assets/废墟城市 02.jpg' },
  { key: 'bg_city_03', path: '/assets/废墟城市 03.jpg' },
  { key: 'bg_city_04', path: '/assets/废墟城市 04.jpg' },
  { key: 'bg_city_05', path: '/assets/废墟城市 05.jpg' },
  { key: 'bg_city_06', path: '/assets/废墟城市 06.jpg' },
  { key: 'bg_city_07', path: '/assets/废墟城市 07.jpg' },
];

const WORLD_BIOME_FOREST_ASSETS: Array<{ key: string; path: string }> = [
  { key: 'bg_forest_01', path: '/assets/森林01.jpg' },
  { key: 'bg_forest_02', path: '/assets/森林 02.jpg' },
  { key: 'bg_forest_03', path: '/assets/森林 03.jpg' },
];

const WORLD_BIOME_SNOW_ASSETS: Array<{ key: string; path: string }> = [
  { key: 'bg_snow_01', path: '/assets/雪地 01.jpg' },
  { key: 'bg_snow_02', path: '/assets/雪地 02.jpg' },
];

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
    this.preloadKenneyRpgSheet();
    this.preloadV2SpriteSheets();
    this.preloadCustomHeroRawSprites();
    this.preloadWorldBiomeBackgrounds();
  }

  create(): void {
    this.generateAssets();
    this.registerV2Animations();
    this.initRunState();
    this.scene.start('MenuScene');
  }

  private generateAssets(): void {
    this.applyKenneyRpgThemeAssets();
    this.generateCustomHeroDirectionalSprites();
    this.generatePlayerSprite();
    this.generateEnemySprites();
    this.generateCompanionSprite();
    this.generateCharacterRoleSprites();
    this.generateProjectileSprites();
    this.generateProtocolUiTextures();
    this.generateHudIconSet();
    this.generateMiniGameUiSkinTextures();
    this.generateMiniGameObjectAtlasTextures();
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

  private drawCanvasTextureForce(
    key: string,
    width: number,
    height: number,
    painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = this.textures.createCanvas(key, width, height);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, width, height);
    painter(ctx, width, height);
    canvas.refresh();
  }

  private drawSourceToTexture(
    sourceKey: string,
    targetKey: string,
    width: number,
    height: number,
    options?: {
      fit?: 'cover' | 'contain';
      padding?: number;
      force?: boolean;
      smoothing?: boolean;
      yOffset?: number;
      overlay?: string;
      trimWhiteFromEdges?: boolean;
      whiteThreshold?: number;
      trimAlphaBounds?: boolean;
      alphaMin?: number;
    }
  ): boolean {
    const source = this.getSourceImage(sourceKey);
    if (!source) return false;
    const fit = options?.fit ?? 'contain';
    const padding = Phaser.Math.Clamp(Math.floor(options?.padding ?? 0), 0, Math.floor(Math.min(width, height) / 2));
    const force = options?.force ?? true;

    if (force && this.textures.exists(targetKey)) this.textures.remove(targetKey);
    if (this.textures.exists(targetKey)) return true;

    const canvas = this.textures.createCanvas(targetKey, width, height);
    if (!canvas) return false;
    const ctx = canvas.getContext();
    const srcW = Math.max(1, Math.floor((source as any).width || 0));
    const srcH = Math.max(1, Math.floor((source as any).height || 0));
    if (srcW < 2 || srcH < 2) return false;

    let sourceToDraw: CanvasImageSource = source;
    let cropX = 0;
    let cropY = 0;
    let cropW = srcW;
    let cropH = srcH;
    if (options?.trimWhiteFromEdges || options?.trimAlphaBounds) {
      const workCanvas = document.createElement('canvas');
      workCanvas.width = srcW;
      workCanvas.height = srcH;
      const workCtx = workCanvas.getContext('2d');
      if (workCtx) {
        workCtx.clearRect(0, 0, srcW, srcH);
        workCtx.drawImage(source, 0, 0, srcW, srcH);
        try {
          const imageData = workCtx.getImageData(0, 0, srcW, srcH);
          if (options?.trimWhiteFromEdges) {
            this.trimNearWhiteFromEdges(imageData.data, srcW, srcH, options?.whiteThreshold ?? 236);
            workCtx.putImageData(imageData, 0, 0);
          }
          if (options?.trimAlphaBounds) {
            const bounds = this.findAlphaBounds(imageData.data, srcW, srcH, options?.alphaMin ?? 10);
            if (bounds) {
              cropX = bounds.x;
              cropY = bounds.y;
              cropW = Math.max(1, bounds.w);
              cropH = Math.max(1, bounds.h);
            }
          }
          sourceToDraw = workCanvas;
        } catch {
          // Keep original source when pixel readback fails.
          sourceToDraw = source;
        }
      }
    }

    const innerW = Math.max(1, width - padding * 2);
    const innerH = Math.max(1, height - padding * 2);
    const scale = fit === 'cover'
      ? Math.max(innerW / cropW, innerH / cropH)
      : Math.min(innerW / cropW, innerH / cropH);
    const drawW = Math.max(1, Math.round(cropW * scale));
    const drawH = Math.max(1, Math.round(cropH * scale));
    const dx = Math.round(padding + (innerW - drawW) * 0.5);
    const dy = Math.round(padding + (innerH - drawH) * 0.5 + (options?.yOffset ?? 0));

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = options?.smoothing ?? true;
    ctx.drawImage(sourceToDraw, cropX, cropY, cropW, cropH, dx, dy, drawW, drawH);
    if (options?.overlay) {
      ctx.fillStyle = options.overlay;
      ctx.fillRect(0, 0, width, height);
    }
    canvas.refresh();
    return true;
  }

  private trimNearWhiteFromEdges(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    whiteThreshold: number
  ): void {
    const threshold = Phaser.Math.Clamp(Math.floor(whiteThreshold), 200, 250);
    const marked = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;
    const isNearWhite = (idx: number): boolean => {
      const base = idx * 4;
      const a = data[base + 3];
      if (a <= 6) return false;
      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      return r >= threshold && g >= threshold && b >= threshold;
    };
    const tryPush = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = y * width + x;
      if (marked[idx]) return;
      if (!isNearWhite(idx)) return;
      marked[idx] = 1;
      queue[tail++] = idx;
    };
    for (let x = 0; x < width; x += 1) {
      tryPush(x, 0);
      tryPush(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      tryPush(0, y);
      tryPush(width - 1, y);
    }
    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);
      tryPush(x + 1, y);
      tryPush(x - 1, y);
      tryPush(x, y + 1);
      tryPush(x, y - 1);
    }
    for (let i = 0; i < marked.length; i += 1) {
      if (!marked[i]) continue;
      data[i * 4 + 3] = 0;
    }
  }

  private preloadAssetOverrides(): void {
    const loadedKeys = new Set<string>();
    for (const override of USER_ASSET_OVERRIDES) {
      if (!override.key || !override.path) continue;
      if (loadedKeys.has(override.key)) continue;
      loadedKeys.add(override.key);
      this.load.image(override.key, encodeURI(override.path));
    }
    for (const override of ASSET_OVERRIDES) {
      if (!override.key || !override.path) continue;
      if (loadedKeys.has(override.key)) continue;
      loadedKeys.add(override.key);
      this.load.image(override.key, encodeURI(override.path));
    }
  }

  private preloadKenneyRpgSheet(): void {
    if (!KENNEY_RPG_THEME_ENABLED) return;
    if (this.textures.exists(KENNEY_RPG_SHEET_KEY)) return;
    this.load.spritesheet(KENNEY_RPG_SHEET_KEY, KENNEY_RPG_SHEET_PATH, {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
      margin: 0,
    });
  }

  private preloadCustomHeroRawSprites(): void {
    (Object.keys(CUSTOM_HERO_RAW_KEYS) as CustomHeroDirection[]).forEach((dir) => {
      const key = CUSTOM_HERO_RAW_KEYS[dir];
      const path = CUSTOM_HERO_RAW_PATHS[dir];
      if (!key || !path) return;
      if (this.textures.exists(key)) return;
      this.load.image(key, path);
    });
  }

  private preloadWorldBiomeBackgrounds(): void {
    const assets = [
      ...WORLD_BIOME_CITY_ASSETS,
      ...WORLD_BIOME_FOREST_ASSETS,
      ...WORLD_BIOME_SNOW_ASSETS,
    ];
    assets.forEach((asset) => {
      if (!asset.key || !asset.path) return;
      if (this.textures.exists(asset.key)) return;
      this.load.image(asset.key, encodeURI(asset.path));
    });
  }

  private generateCustomHeroDirectionalSprites(): void {
    (Object.keys(CUSTOM_HERO_KEYS) as CustomHeroDirection[]).forEach((dir) => {
      const rawKey = CUSTOM_HERO_RAW_KEYS[dir];
      const outKey = CUSTOM_HERO_KEYS[dir];
      this.buildCustomHeroDirectionTexture(rawKey, outKey);
    });
  }

  private buildCustomHeroDirectionTexture(rawKey: string, outKey: string): void {
    const source = this.getSourceImage(rawKey);
    if (!source) return;

    const srcW = Math.max(1, Math.floor((source as any).width || 0));
    const srcH = Math.max(1, Math.floor((source as any).height || 0));
    if (srcW < 8 || srcH < 8) return;

    const workCanvas = document.createElement('canvas');
    workCanvas.width = srcW;
    workCanvas.height = srcH;
    const workCtx = workCanvas.getContext('2d');
    if (!workCtx) return;
    workCtx.clearRect(0, 0, srcW, srcH);
    workCtx.drawImage(source, 0, 0, srcW, srcH);

    let imageData: ImageData;
    try {
      imageData = workCtx.getImageData(0, 0, srcW, srcH);
    } catch {
      return;
    }

    const data = imageData.data;
    const isBackground = new Uint8Array(srcW * srcH);
    const refColors = this.pickEdgeReferenceColors(data, srcW, srcH);
    if (refColors.length === 0) return;
    const matchTol = 34;

    const queue = new Uint32Array(srcW * srcH);
    let qHead = 0;
    let qTail = 0;
    const tryPush = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= srcW || y >= srcH) return;
      const idx = y * srcW + x;
      if (isBackground[idx]) return;
      const di = idx * 4;
      const a = data[di + 3];
      if (a <= 6) return;
      const r = data[di];
      const g = data[di + 1];
      const b = data[di + 2];
      if (!this.matchesBackgroundColor(r, g, b, refColors, matchTol)) return;
      isBackground[idx] = 1;
      queue[qTail++] = idx;
    };

    for (let x = 0; x < srcW; x++) {
      tryPush(x, 0);
      tryPush(x, srcH - 1);
    }
    for (let y = 0; y < srcH; y++) {
      tryPush(0, y);
      tryPush(srcW - 1, y);
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % srcW;
      const y = (idx / srcW) | 0;
      tryPush(x + 1, y);
      tryPush(x - 1, y);
      tryPush(x, y + 1);
      tryPush(x, y - 1);
    }

    for (let i = 0; i < isBackground.length; i++) {
      if (!isBackground[i]) continue;
      data[i * 4 + 3] = 0;
    }
    workCtx.putImageData(imageData, 0, 0);

    const bbox = this.findAlphaBounds(data, srcW, srcH, 8);
    if (!bbox) return;
    const pad = 8;
    const sx = Math.max(0, bbox.x - pad);
    const sy = Math.max(0, bbox.y - pad);
    const sw = Math.min(srcW - sx, bbox.w + pad * 2);
    const sh = Math.min(srcH - sy, bbox.h + pad * 2);
    if (sw < 4 || sh < 4) return;

    if (this.textures.exists(outKey)) this.textures.remove(outKey);
    const outCanvas = this.textures.createCanvas(outKey, 32, 32);
    if (!outCanvas) return;
    const outCtx = outCanvas.getContext();
    outCtx.clearRect(0, 0, 32, 32);
    outCtx.imageSmoothingEnabled = true;
    const maxW = 30;
    const maxH = 30;
    const scale = Math.min(maxW / sw, maxH / sh);
    const drawW = sw * scale;
    const drawH = sh * scale;
    const dx = Math.round((32 - drawW) * 0.5);
    const dy = Math.round(32 - drawH);
    outCtx.drawImage(workCanvas, sx, sy, sw, sh, dx, dy, drawW, drawH);
    outCanvas.refresh();
  }

  private getSourceImage(textureKey: string): CanvasImageSource | null {
    if (!this.textures.exists(textureKey)) return null;
    const texture = this.textures.get(textureKey);
    const frame = texture?.get('__BASE') || texture?.get(0);
    const source = frame?.source?.image as CanvasImageSource | undefined;
    return source || null;
  }

  private getWorldBiomeSourceImages(keys: string[]): CanvasImageSource[] {
    const out: CanvasImageSource[] = [];
    keys.forEach((key) => {
      const src = this.getSourceImage(key);
      if (!src) return;
      const w = Math.floor((src as any).width || 0);
      const h = Math.floor((src as any).height || 0);
      if (w < 32 || h < 32) return;
      out.push(src);
    });
    return out;
  }

  private drawBiomeTileFromSources(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sources: CanvasImageSource[],
    tint?: string
  ): boolean {
    if (!sources.length) return false;
    const cell = Math.max(24, Math.floor(Math.min(width, height) / 3));
    ctx.imageSmoothingEnabled = true;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const src = Phaser.Utils.Array.GetRandom(sources);
        const srcW = Math.max(32, Math.floor((src as any).width || 0));
        const srcH = Math.max(32, Math.floor((src as any).height || 0));
        const minSide = Math.max(48, Math.floor(Math.min(srcW, srcH) * 0.34));
        const maxSide = Math.max(minSide + 4, Math.floor(Math.min(srcW, srcH) * 0.7));
        const sw = Phaser.Math.Between(minSide, maxSide);
        const sh = Phaser.Math.Between(minSide, maxSide);
        const sx = Phaser.Math.Between(0, Math.max(0, srcW - sw));
        const sy = Phaser.Math.Between(0, Math.max(0, srcH - sh));
        ctx.drawImage(src, sx, sy, sw, sh, x, y, cell + 1, cell + 1);
      }
    }
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, width, height);
    }
    return true;
  }

  private drawClassifiedWorldBaseMap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): boolean {
    const citySources = this.getWorldBiomeSourceImages(WORLD_BIOME_CITY_ASSETS.map((it) => it.key));
    const forestSources = this.getWorldBiomeSourceImages(WORLD_BIOME_FOREST_ASSETS.map((it) => it.key));
    const snowSources = this.getWorldBiomeSourceImages(WORLD_BIOME_SNOW_ASSETS.map((it) => it.key));
    if (!citySources.length && !forestSources.length && !snowSources.length) return false;

    const allSources = [...citySources, ...forestSources, ...snowSources];
    const pickRandom = (pool: CanvasImageSource[]): CanvasImageSource | null => {
      if (!pool.length) return null;
      return Phaser.Utils.Array.GetRandom(pool);
    };
    const drawCover = (
      src: CanvasImageSource,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      jitter = 0.16
    ) => {
      const srcW = Math.max(64, Math.floor((src as any).width || 0));
      const srcH = Math.max(64, Math.floor((src as any).height || 0));
      const dstRatio = dw / Math.max(1, dh);
      const srcRatio = srcW / Math.max(1, srcH);
      let sw = srcW;
      let sh = srcH;
      if (srcRatio > dstRatio) {
        sh = srcH;
        sw = Math.floor(sh * dstRatio);
      } else {
        sw = srcW;
        sh = Math.floor(sw / Math.max(0.01, dstRatio));
      }
      sw = Phaser.Math.Clamp(sw, 48, srcW);
      sh = Phaser.Math.Clamp(sh, 48, srcH);
      const sxBase = Math.max(0, Math.floor((srcW - sw) * 0.5));
      const syBase = Math.max(0, Math.floor((srcH - sh) * 0.5));
      const jitterX = Math.floor((srcW - sw) * jitter);
      const jitterY = Math.floor((srcH - sh) * jitter);
      const sx = Phaser.Math.Clamp(
        sxBase + Phaser.Math.Between(-jitterX, jitterX),
        0,
        Math.max(0, srcW - sw)
      );
      const sy = Phaser.Math.Clamp(
        syBase + Phaser.Math.Between(-jitterY, jitterY),
        0,
        Math.max(0, srcH - sh)
      );
      ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    };
    const drawZone = (
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      pools: CanvasImageSource[],
      tint: string
    ) => {
      const main = pickRandom(pools.length ? pools : allSources);
      if (main) {
        drawCover(main, dx, dy, dw, dh, 0.08);
      } else {
        ctx.fillStyle = '#111a2b';
        ctx.fillRect(dx, dy, dw, dh);
      }
      if (pools.length > 1) {
        const overlaySource = pickRandom(pools);
        if (overlaySource) {
          ctx.save();
          ctx.globalAlpha = 0.12;
          drawCover(overlaySource, dx, dy, dw, dh, 0.22);
          ctx.restore();
        }
      }
      ctx.fillStyle = tint;
      ctx.fillRect(dx, dy, dw, dh);
    };

    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;

    // Coherent biome blocks: no small random tiles.
    drawZone(0, 0, width, height, snowSources.length ? snowSources : allSources, 'rgba(56, 68, 84, 0.28)');
    drawZone(0, 0, 780, 760, citySources.length ? citySources : allSources, 'rgba(18, 26, 38, 0.2)');
    drawZone(1220, 0, 780, 820, forestSources.length ? forestSources : allSources, 'rgba(14, 56, 36, 0.2)');
    drawZone(1320, 860, 680, 640, snowSources.length ? snowSources : allSources, 'rgba(70, 84, 102, 0.17)');
    drawZone(760, 500, 480, 520, citySources.length ? citySources : allSources, 'rgba(24, 36, 52, 0.22)');

    // Keep roads readable, but no explicit water overlays.

    ctx.fillStyle = 'rgba(12, 18, 30, 0.78)';
    ctx.fillRect(width / 2 - 36, 0, 72, height);
    ctx.fillRect(210, height / 2 - 36, 1580, 72);
    ctx.fillRect(192, 302, 290, 58);
    ctx.fillRect(1330, 366, 370, 56);
    ctx.fillRect(1320, 1080, 360, 56);
    ctx.fillStyle = 'rgba(199, 214, 235, 0.42)';
    for (let y = 16; y < height; y += 30) ctx.fillRect(width / 2 - 4, y, 8, 14);
    for (let x = 240; x < 1760; x += 30) ctx.fillRect(x, height / 2 - 4, 14, 8);

    const centerGlow = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 520);
    centerGlow.addColorStop(0, 'rgba(255, 214, 143, 0.09)');
    centerGlow.addColorStop(0.6, 'rgba(127, 200, 255, 0.048)');
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(width / 2 - 540, height / 2 - 540, 1080, 1080);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, 520, width / 2, height / 2, 1150);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    return true;
  }

  private pickEdgeReferenceColors(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): Array<{ r: number; g: number; b: number }> {
    const counts = new Map<string, { r: number; g: number; b: number; n: number }>();
    const sample = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a <= 12) return;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const k = `${r},${g},${b}`;
      const hit = counts.get(k);
      if (hit) hit.n += 1;
      else counts.set(k, { r, g, b, n: 1 });
    };

    const stride = Math.max(1, Math.floor(Math.min(width, height) / 96));
    for (let x = 0; x < width; x += stride) {
      sample(x, 0);
      sample(x, height - 1);
    }
    for (let y = 0; y < height; y += stride) {
      sample(0, y);
      sample(width - 1, y);
    }

    return [...counts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((c) => ({ r: c.r, g: c.g, b: c.b }));
  }

  private matchesBackgroundColor(
    r: number,
    g: number,
    b: number,
    refs: Array<{ r: number; g: number; b: number }>,
    tol: number
  ): boolean {
    for (let i = 0; i < refs.length; i++) {
      const rr = refs[i].r - r;
      const gg = refs[i].g - g;
      const bb = refs[i].b - b;
      if (Math.sqrt(rr * rr + gg * gg + bb * bb) <= tol) return true;
    }
    return false;
  }

  private findAlphaBounds(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    alphaMin: number
  ): { x: number; y: number; w: number; h: number } | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < alphaMin) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }

  private applyKenneyRpgThemeAssets(): void {
    if (!KENNEY_RPG_THEME_ENABLED) return;
    if (!this.textures.exists(KENNEY_RPG_SHEET_KEY)) return;

    const tile = (key: string, frame: number, size = 32) => this.aliasKenneyTileTexture(key, frame, size, size);

    // UI icon set
    tile('build_icon_kenney', 959, 24);
    tile('turret_icon_kenney', 1124, 24);
    tile('icon_wood', 520, 18);
    tile('icon_metal', 673, 18);
    tile('icon_food', 345, 18);
    tile('icon_water', 286, 18);
    tile('icon_scrap', 1059, 18);
    tile('icon_medical', 449, 18);
    tile('icon_ammo', 740, 18);
    tile('icon_energyCore', 451, 18);
    tile('icon_protocol', 452, 18);

    // NOTE:
    // This pack is a tileset and requires proper autotile/map composition.
    // We intentionally do NOT override world/buildings/characters here to avoid broken assembly.
  }

  private aliasKenneyTileTexture(key: string, frameIndex: number, width: number, height: number): void {
    const sheet = this.textures.get(KENNEY_RPG_SHEET_KEY);
    const frame = sheet?.get(frameIndex);
    const source = frame?.source?.image as CanvasImageSource | undefined;
    if (!frame || !source) return;
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = this.textures.createCanvas(key, width, height);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      source,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      width,
      height
    );
    canvas.refresh();
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

    this.drawTexture('swarm', 24, 24, (g) => {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(12, 22, 12, 3);
      g.fillStyle(0x3d5c0f);
      g.fillRect(8, 4, 8, 6);
      g.fillRect(7, 10, 10, 7);
      g.fillRect(8, 17, 3, 5);
      g.fillRect(13, 17, 3, 5);
      g.fillStyle(0x84cc16);
      g.fillRect(9, 5, 6, 4);
      g.fillStyle(0xef4444);
      g.fillRect(9, 6, 2, 1);
      g.fillRect(13, 6, 2, 1);
      g.fillStyle(0x65a30d);
      g.fillRect(8, 11, 8, 5);
      g.fillStyle(0x3f6212);
      g.fillRect(8, 17, 3, 4);
      g.fillRect(13, 17, 3, 4);
    });

    this.drawTexture('shield_bearer', 36, 36, (g) => {
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(18, 33, 22, 5);
      g.fillStyle(0x0c2461);
      g.fillRect(12, 6, 12, 8);
      g.fillRect(10, 14, 16, 12);
      g.fillRect(12, 26, 5, 8);
      g.fillRect(19, 26, 5, 8);
      g.fillStyle(0x3b82f6);
      g.fillRect(13, 7, 10, 6);
      g.fillStyle(0xef4444);
      g.fillRect(14, 9, 2, 2);
      g.fillRect(20, 9, 2, 2);
      g.fillStyle(0x1e40af);
      g.fillRect(11, 15, 14, 10);
      g.fillStyle(0x1d4ed8);
      g.fillRect(12, 17, 12, 6);
      g.fillStyle(0x60a5fa);
      g.fillRect(3, 10, 6, 18);
      g.fillRect(4, 11, 4, 16);
      g.fillStyle(0xbfdbfe);
      g.fillRect(5, 13, 2, 12);
      g.fillStyle(0x0f172a);
      g.fillRect(11, 34, 7, 2);
      g.fillRect(18, 34, 7, 2);
    });

    this.drawTexture('berserker', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(16, 29, 17, 5);
      g.fillStyle(0x1a0505);
      g.fillRect(10, 4, 12, 7);
      g.fillRect(9, 11, 14, 11);
      g.fillRect(8, 12, 2, 8);
      g.fillRect(22, 12, 2, 8);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xfca5a5);
      g.fillRect(11, 5, 10, 5);
      g.fillStyle(0xef4444);
      g.fillRect(12, 6, 3, 2);
      g.fillRect(17, 6, 3, 2);
      g.fillStyle(0xb91c1c);
      g.fillRect(10, 12, 12, 9);
      g.fillStyle(0xdc2626);
      g.fillRect(11, 14, 10, 1);
      g.fillStyle(0xfbbf24);
      g.fillRect(8, 15, 3, 4);
      g.fillRect(21, 15, 3, 4);
      g.fillStyle(0x991b1b);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('spitter', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(16, 29, 15, 5);
      g.fillStyle(0x052e16);
      g.fillRect(10, 5, 12, 7);
      g.fillRect(9, 12, 14, 10);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0x22c55e);
      g.fillRect(11, 6, 10, 5);
      g.fillStyle(0xfacc15);
      g.fillRect(12, 7, 2, 2);
      g.fillRect(18, 7, 2, 2);
      g.fillStyle(0x15803d);
      g.fillRect(10, 13, 12, 8);
      g.fillStyle(0x4ade80);
      g.fillRect(14, 18, 4, 3);
      g.fillStyle(0x16a34a);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
    });

    this.drawTexture('necromancer', 36, 36, (g) => {
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(18, 33, 18, 5);
      g.fillStyle(0x1b0530);
      g.fillRect(11, 2, 14, 4);
      g.fillRect(12, 6, 12, 7);
      g.fillRect(10, 13, 16, 12);
      g.fillRect(12, 25, 5, 9);
      g.fillRect(19, 25, 5, 9);
      g.fillStyle(0xc084fc);
      g.fillRect(13, 7, 10, 5);
      g.fillStyle(0xa855f7);
      g.fillRect(14, 8, 3, 2);
      g.fillRect(19, 8, 3, 2);
      g.fillStyle(0x581c87);
      g.fillRect(11, 14, 14, 10);
      g.fillStyle(0x7e22ce);
      g.fillRect(12, 16, 12, 6);
      g.fillStyle(0xd8b4fe);
      g.fillRect(17, 3, 6, 2);
      g.fillRect(13, 3, 2, 8);
      g.fillStyle(0x3b0764);
      g.fillRect(12, 25, 5, 7);
      g.fillRect(19, 25, 5, 7);
      g.fillStyle(0x0f172a);
      g.fillRect(11, 32, 7, 2);
      g.fillRect(18, 32, 7, 2);
    });

    this.drawTexture('parasite', 24, 24, (g) => {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(12, 22, 12, 3);
      g.fillStyle(0x3d2808);
      g.fillRect(8, 5, 8, 5);
      g.fillRect(7, 10, 10, 7);
      g.fillRect(8, 17, 3, 5);
      g.fillRect(13, 17, 3, 5);
      g.fillStyle(0xd97706);
      g.fillRect(9, 6, 6, 3);
      g.fillStyle(0xef4444);
      g.fillRect(10, 7, 1, 1);
      g.fillRect(13, 7, 1, 1);
      g.fillStyle(0x92400e);
      g.fillRect(8, 11, 8, 5);
      g.fillStyle(0x451a03);
      g.fillRect(8, 17, 3, 4);
      g.fillRect(13, 17, 3, 4);
    });

    this.drawTexture('bomber', 32, 32, (g) => {
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(16, 29, 16, 5);
      g.fillStyle(0x3d1c0c);
      g.fillRect(10, 4, 12, 7);
      g.fillRect(9, 11, 14, 11);
      g.fillRect(10, 22, 5, 8);
      g.fillRect(17, 22, 5, 8);
      g.fillStyle(0xfb923c);
      g.fillRect(11, 5, 10, 5);
      g.fillStyle(0xef4444);
      g.fillRect(12, 6, 2, 2);
      g.fillRect(18, 6, 2, 2);
      g.fillStyle(0x9a3412);
      g.fillRect(10, 12, 12, 9);
      g.fillStyle(0xfbbf24);
      g.fillRect(13, 14, 6, 5);
      g.fillStyle(0xef4444);
      g.fillRect(14, 15, 4, 3);
      g.fillStyle(0x78350f);
      g.fillRect(10, 22, 5, 6);
      g.fillRect(17, 22, 5, 6);
      g.fillStyle(0x0f172a);
      g.fillRect(9, 28, 7, 2);
      g.fillRect(16, 28, 7, 2);
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
    // Keep user-provided or pack-provided projectile textures when available.
    // Only generate handcrafted fallbacks for missing keys.

    this.drawTexture('bullet', 16, 16, (g) => {
      g.fillStyle(0x071022);
      g.fillRect(4, 4, 8, 8);
      g.fillStyle(0x22d3ee);
      g.fillRect(5, 5, 6, 6);
      g.fillStyle(0xe0f9ff);
      g.fillRect(7, 3, 2, 10);
      g.fillRect(3, 7, 10, 2);
      g.fillStyle(0x67e8f9);
      g.fillRect(6, 6, 4, 4);
    });

    this.drawTexture('bullet_scatter', 16, 16, (g) => {
      g.fillStyle(0x0b1220);
      g.fillRect(2, 6, 12, 4);
      g.fillStyle(0x38bdf8);
      g.fillRect(3, 7, 10, 2);
      g.fillStyle(0xe0f2fe);
      g.fillRect(1, 6, 2, 4);
      g.fillRect(13, 6, 2, 4);
      g.fillRect(6, 4, 4, 8);
    });

    this.drawTexture('bullet_pulse', 16, 16, (g) => {
      g.fillStyle(0x091525);
      g.fillRect(3, 3, 10, 10);
      g.fillStyle(0x3b82f6);
      g.fillRect(4, 4, 8, 8);
      g.fillStyle(0x93c5fd);
      g.fillRect(5, 5, 6, 6);
      g.fillStyle(0xe0f2fe);
      g.fillRect(6, 6, 4, 4);
      g.fillStyle(0x22d3ee);
      g.fillRect(7, 2, 2, 12);
      g.fillRect(2, 7, 12, 2);
    });

    this.drawTexture('bullet_flame', 16, 16, (g) => {
      g.fillStyle(0x2e1065);
      g.fillRect(6, 1, 4, 14);
      g.fillStyle(0xfb7185);
      g.fillRect(6, 3, 4, 9);
      g.fillStyle(0xfb923c);
      g.fillRect(7, 1, 2, 6);
      g.fillStyle(0xfacc15);
      g.fillRect(7, 2, 2, 3);
      g.fillStyle(0xfffbeb);
      g.fillRect(7, 2, 1, 1);
      g.fillStyle(0xf472b6);
      g.fillRect(5, 11, 6, 2);
    });

    this.drawTexture('bullet_pierce', 16, 16, (g) => {
      g.fillStyle(0x0f172a);
      g.fillRect(7, 1, 2, 14);
      g.fillStyle(0x7dd3fc);
      g.fillRect(7, 2, 2, 12);
      g.fillStyle(0xe0f7ff);
      g.fillRect(7, 1, 1, 6);
      g.fillRect(6, 12, 4, 2);
      g.fillStyle(0x38bdf8);
      g.fillRect(5, 9, 6, 1);
    });

    this.drawTexture('bullet_cannon', 16, 16, (g) => {
      g.fillStyle(0x140a2f);
      g.fillRect(3, 3, 10, 10);
      g.fillStyle(0xa855f7);
      g.fillRect(4, 4, 8, 8);
      g.fillStyle(0xd8b4fe);
      g.fillRect(5, 5, 6, 6);
      g.fillStyle(0xf5d0fe);
      g.fillRect(6, 6, 4, 4);
      g.fillStyle(0x7e22ce);
      g.fillRect(7, 1, 2, 2);
      g.fillRect(7, 13, 2, 2);
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
      g.fillStyle(0x67e8f9);
      g.fillRect(6, 1, 4, 1);
      g.fillRect(6, 14, 4, 1);
    });

    this.drawTexture('bullet_chain', 16, 16, (g) => {
      g.fillStyle(0x2f123f);
      g.fillRect(5, 2, 6, 12);
      g.fillStyle(0xa855f7);
      g.fillRect(6, 3, 4, 10);
      g.fillStyle(0xf0abfc);
      g.fillRect(5, 4, 2, 2);
      g.fillRect(9, 6, 2, 2);
      g.fillRect(5, 8, 2, 2);
      g.fillRect(9, 10, 2, 2);
      g.fillRect(5, 12, 2, 2);
      g.fillStyle(0xffffff);
      g.fillRect(8, 5, 1, 1);
      g.fillRect(7, 9, 1, 1);
    });

    this.drawTexture('bullet_orbit', 16, 16, (g) => {
      g.fillStyle(0x2d0a3f);
      g.fillRect(3, 3, 10, 10);
      g.fillStyle(0xf472b6);
      g.fillRect(4, 6, 8, 4);
      g.fillRect(6, 4, 4, 8);
      g.fillStyle(0xfda4af);
      g.fillRect(5, 5, 6, 6);
      g.fillStyle(0xfff1f2);
      g.fillRect(7, 7, 2, 2);
      g.fillStyle(0xf472b6);
      g.fillRect(3, 3, 2, 2);
      g.fillRect(11, 3, 2, 2);
      g.fillRect(3, 11, 2, 2);
      g.fillRect(11, 11, 2, 2);
    });

    this.drawTexture('bullet_holy', 16, 16, (g) => {
      g.fillStyle(0x0c2461);
      g.fillRect(5, 2, 6, 12);
      g.fillRect(2, 5, 12, 6);
      g.fillStyle(0x60a5fa);
      g.fillRect(6, 3, 4, 10);
      g.fillRect(3, 6, 10, 4);
      g.fillStyle(0xbfdbfe);
      g.fillRect(7, 4, 2, 8);
      g.fillRect(4, 7, 8, 2);
      g.fillStyle(0xeff6ff);
      g.fillRect(7, 7, 2, 2);
    });

    this.drawTexture('bullet_boomerang', 16, 16, (g) => {
      g.fillStyle(0x064e3b);
      g.fillRect(3, 5, 10, 6);
      g.fillStyle(0x34d399);
      g.fillRect(4, 6, 8, 4);
      g.fillStyle(0x6ee7b7);
      g.fillRect(3, 7, 3, 2);
      g.fillRect(10, 7, 3, 2);
      g.fillRect(6, 5, 4, 1);
      g.fillRect(6, 10, 4, 1);
      g.fillStyle(0xd1fae5);
      g.fillRect(7, 7, 2, 2);
    });
  }

  private generateProtocolUiTextures(): void {
    this.drawTexture('icon_protocol', 18, 18, (g) => {
      g.fillStyle(0x071120, 0.95);
      g.fillCircle(9, 9, 8);
      g.fillStyle(0x22d3ee, 0.24);
      g.fillCircle(9, 9, 7);
      g.fillStyle(0x22d3ee, 0.95);
      g.fillRect(3, 8, 12, 2);
      g.fillRect(8, 3, 2, 12);
      g.fillStyle(0x67e8f9, 1);
      g.fillCircle(9, 9, 2);
    });

    this.drawTexture('protocol_icon_barrage_matrix', 28, 28, (g) => {
      g.fillStyle(0x041526, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0x22d3ee, 0.9);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0x0ea5e9, 0.92);
      g.fillRect(5, 6, 4, 4);
      g.fillRect(12, 6, 4, 4);
      g.fillRect(19, 6, 4, 4);
      g.fillRect(8, 13, 4, 4);
      g.fillRect(15, 13, 4, 4);
      g.fillRect(12, 20, 4, 4);
      g.fillStyle(0xe0f2fe, 0.8);
      g.fillRect(13, 11, 2, 6);
    });

    this.drawTexture('protocol_icon_phase_lance', 28, 28, (g) => {
      g.fillStyle(0x06182b, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0x7dd3fc, 0.9);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0x38bdf8, 0.95);
      g.fillRect(13, 4, 2, 20);
      g.fillStyle(0xe0f2fe, 0.95);
      g.fillRect(12, 2, 4, 5);
      g.fillRect(11, 20, 6, 4);
      g.fillStyle(0x67e8f9, 0.72);
      g.fillRect(8, 10, 12, 2);
      g.fillRect(9, 14, 10, 2);
    });

    this.drawTexture('protocol_icon_overclock_link', 28, 28, (g) => {
      g.fillStyle(0x281005, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0xf59e0b, 0.95);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0xfb923c, 0.95);
      g.fillRect(10, 4, 8, 4);
      g.fillRect(7, 11, 7, 4);
      g.fillRect(12, 18, 9, 4);
      g.fillStyle(0xfef3c7, 0.96);
      g.fillRect(14, 6, 2, 8);
      g.fillRect(11, 13, 2, 7);
    });

    this.drawTexture('protocol_icon_echo_reactor', 28, 28, (g) => {
      g.fillStyle(0x1b0d2f, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0xa78bfa, 0.9);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0xc4b5fd, 0.2);
      g.fillCircle(14, 14, 10);
      g.lineStyle(2, 0xc4b5fd, 0.95);
      g.strokeCircle(14, 14, 8);
      g.fillStyle(0xa78bfa, 0.9);
      g.fillCircle(14, 14, 4);
      g.fillStyle(0xf5d0fe, 0.95);
      g.fillRect(13, 4, 2, 4);
      g.fillRect(13, 20, 2, 4);
      g.fillRect(4, 13, 4, 2);
      g.fillRect(20, 13, 4, 2);
    });

    this.drawTexture('protocol_icon_hunter_instinct', 28, 28, (g) => {
      g.fillStyle(0x062316, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0x34d399, 0.9);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0x10b981, 0.92);
      g.fillRect(4, 19, 7, 3);
      g.fillRect(10, 14, 6, 3);
      g.fillRect(15, 10, 6, 3);
      g.fillStyle(0x6ee7b7, 0.95);
      g.fillRect(20, 8, 4, 4);
      g.fillStyle(0xbbf7d0, 1);
      g.fillRect(21, 9, 2, 2);
    });

    this.drawTexture('protocol_icon_companion_sync', 28, 28, (g) => {
      g.fillStyle(0x08192a, 1);
      g.fillRect(1, 1, 26, 26);
      g.lineStyle(1, 0x38bdf8, 0.9);
      g.strokeRect(1, 1, 26, 26);
      g.fillStyle(0x38bdf8, 0.9);
      g.fillCircle(10, 11, 4);
      g.fillCircle(18, 11, 4);
      g.fillStyle(0x67e8f9, 0.85);
      g.fillRect(7, 15, 6, 5);
      g.fillRect(15, 15, 6, 5);
      g.fillStyle(0xbfdbfe, 0.92);
      g.fillRect(12, 12, 4, 2);
      g.fillRect(13, 10, 2, 6);
    });
  }

  private generateHudIconSet(): void {
    const size = 18;
    const px = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    const basePlate = (ctx: CanvasRenderingContext2D, tint = '#0b1627') => {
      px(ctx, 1, 1, tint, 16, 16);
      px(ctx, 1, 1, '#35506d', 16, 1);
      px(ctx, 1, 1, '#35506d', 1, 16);
      px(ctx, 1, 16, '#162538', 16, 1);
      px(ctx, 16, 1, '#162538', 1, 16);
      px(ctx, 2, 2, '#4f6f8d', 1, 1);
    };
    const draw = (key: string, painter: (ctx: CanvasRenderingContext2D) => void) => {
      this.drawCanvasTextureForce(key, size, size, (ctx) => {
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        painter(ctx);
      });
    };

    draw('icon_wood', (ctx) => {
      basePlate(ctx, '#1f1728');
      px(ctx, 4, 6, '#5a371f', 10, 3);
      px(ctx, 4, 10, '#6c4426', 10, 3);
      px(ctx, 3, 7, '#d6a16f', 2, 1);
      px(ctx, 13, 7, '#d6a16f', 2, 1);
      px(ctx, 7, 7, '#bf8552', 4, 1);
      px(ctx, 6, 11, '#d6a16f', 4, 1);
    });

    draw('icon_metal', (ctx) => {
      basePlate(ctx, '#141b2a');
      px(ctx, 3, 8, '#62748d', 12, 5);
      px(ctx, 4, 7, '#89a2bc', 10, 1);
      px(ctx, 5, 9, '#b9d0e8', 6, 1);
      px(ctx, 12, 10, '#4d6178', 2, 2);
    });

    draw('icon_scrap', (ctx) => {
      basePlate(ctx, '#151d2c');
      px(ctx, 7, 5, '#6f8499', 4, 8);
      px(ctx, 5, 7, '#6f8499', 8, 4);
      px(ctx, 8, 8, '#c7d8ea', 2, 2);
      px(ctx, 5, 5, '#495d73', 2, 2);
      px(ctx, 11, 5, '#495d73', 2, 2);
      px(ctx, 5, 11, '#495d73', 2, 2);
      px(ctx, 11, 11, '#495d73', 2, 2);
    });

    draw('icon_food', (ctx) => {
      basePlate(ctx, '#241d12');
      px(ctx, 4, 8, '#9a6a35', 10, 5);
      px(ctx, 5, 7, '#cb8a45', 8, 1);
      px(ctx, 7, 5, '#41b55f', 4, 2);
      px(ctx, 8, 9, '#e15f58', 2, 2);
      px(ctx, 6, 10, '#efb153', 2, 2);
      px(ctx, 11, 10, '#f0d06e', 2, 2);
    });

    draw('icon_water', (ctx) => {
      basePlate(ctx, '#102233');
      px(ctx, 7, 4, '#2f84ca', 4, 9);
      px(ctx, 8, 3, '#54b4ff', 2, 1);
      px(ctx, 8, 5, '#8ad8ff', 2, 6);
      px(ctx, 7, 12, '#2f84ca', 4, 1);
    });

    draw('icon_medical', (ctx) => {
      basePlate(ctx, '#27111a');
      px(ctx, 7, 5, '#f05d72', 4, 8);
      px(ctx, 5, 7, '#f05d72', 8, 4);
      px(ctx, 8, 6, '#ffd9e0', 2, 1);
      px(ctx, 8, 11, '#ffd9e0', 2, 1);
    });

    draw('icon_ammo', (ctx) => {
      basePlate(ctx, '#241b14');
      px(ctx, 4, 6, '#d2a15f', 3, 6);
      px(ctx, 8, 5, '#dbad65', 3, 7);
      px(ctx, 12, 6, '#d2a15f', 3, 6);
      px(ctx, 4, 5, '#f4d193', 3, 1);
      px(ctx, 8, 4, '#f4d193', 3, 1);
      px(ctx, 12, 5, '#f4d193', 3, 1);
      px(ctx, 4, 12, '#6e5235', 3, 1);
      px(ctx, 8, 12, '#6e5235', 3, 1);
      px(ctx, 12, 12, '#6e5235', 3, 1);
    });

    const corePainter = (ctx: CanvasRenderingContext2D) => {
      basePlate(ctx, '#1a1233');
      px(ctx, 6, 4, '#6b4ad3', 6, 10);
      px(ctx, 7, 5, '#8d6cff', 4, 8);
      px(ctx, 8, 7, '#c7b5ff', 2, 4);
      px(ctx, 7, 8, '#c7b5ff', 4, 2);
      px(ctx, 8, 8, '#f2ecff', 1, 1);
    };
    draw('icon_core', corePainter);
    draw('icon_energyCore', corePainter);

    draw('icon_bitcoin', (ctx) => {
      basePlate(ctx, '#2c1f0c');
      px(ctx, 4, 4, '#d99614', 10, 10);
      px(ctx, 5, 5, '#f2b938', 8, 8);
      px(ctx, 8, 6, '#fff0ad', 1, 6);
      px(ctx, 10, 6, '#fff0ad', 1, 6);
      px(ctx, 8, 7, '#ffe07e', 3, 1);
      px(ctx, 8, 10, '#ffe07e', 3, 1);
      px(ctx, 8, 12, '#ffe07e', 3, 1);
    });

    draw('icon_power', (ctx) => {
      basePlate(ctx, '#221d11');
      px(ctx, 8, 3, '#f5b21d', 3, 4);
      px(ctx, 7, 7, '#f5b21d', 3, 4);
      px(ctx, 9, 10, '#f5b21d', 3, 4);
      px(ctx, 8, 4, '#ffe48f', 2, 1);
      px(ctx, 8, 8, '#ffe48f', 2, 1);
    });

    draw('icon_glasses', (ctx) => {
      basePlate(ctx, '#0f1f33');
      px(ctx, 3, 7, '#1e3852', 12, 4);
      px(ctx, 4, 6, '#2e5378', 4, 6);
      px(ctx, 10, 6, '#2e5378', 4, 6);
      px(ctx, 5, 7, '#7ad7ff', 2, 3);
      px(ctx, 11, 7, '#7ad7ff', 2, 3);
      px(ctx, 8, 8, '#0b121d', 2, 2);
    });

    draw('icon_bullet_tree', (ctx) => {
      basePlate(ctx, '#0f1c2d');
      px(ctx, 8, 4, '#2a455f', 2, 10);
      px(ctx, 5, 8, '#2a455f', 8, 2);
      px(ctx, 4, 5, '#56c5ff', 3, 3);
      px(ctx, 11, 5, '#56c5ff', 3, 3);
      px(ctx, 8, 11, '#56c5ff', 3, 3);
      px(ctx, 5, 6, '#c9f0ff', 1, 1);
      px(ctx, 12, 6, '#c9f0ff', 1, 1);
      px(ctx, 9, 12, '#c9f0ff', 1, 1);
    });

    draw('icon_group', (ctx) => {
      basePlate(ctx, '#101f32');
      px(ctx, 5, 10, '#4e6781', 8, 4);
      px(ctx, 5, 5, '#89b7e4', 3, 4);
      px(ctx, 10, 4, '#89b7e4', 3, 5);
      px(ctx, 11, 5, '#d8ecff', 1, 1);
      px(ctx, 6, 6, '#d8ecff', 1, 1);
    });

    draw('icon_protocol', (ctx) => {
      basePlate(ctx, '#0f1d31');
      px(ctx, 4, 4, '#2f5679', 10, 10);
      px(ctx, 5, 5, '#173149', 8, 8);
      px(ctx, 8, 6, '#7ce1ff', 2, 6);
      px(ctx, 6, 8, '#7ce1ff', 6, 2);
      px(ctx, 8, 8, '#ddf8ff', 2, 2);
    });
  }

  private generateMiniGameUiSkinTextures(): void {
    const variants = [
      {
        id: 'river',
        accent: '#34d9ff',
        base: '#0b1d35',
        tileA: '#133d66',
        tileB: '#102f4d',
        edge: '#5edfff',
        glow: '#7dd3fc',
      },
      {
        id: 'forest',
        accent: '#4ade80',
        base: '#12261c',
        tileA: '#214531',
        tileB: '#193928',
        edge: '#86efac',
        glow: '#bbf7d0',
      },
      {
        id: 'city',
        accent: '#f59e0b',
        base: '#22180f',
        tileA: '#3a2b1b',
        tileB: '#2e2318',
        edge: '#fbbf24',
        glow: '#fde68a',
      },
      {
        id: 'cave',
        accent: '#a78bfa',
        base: '#1a1430',
        tileA: '#2d2251',
        tileB: '#241b45',
        edge: '#c4b5fd',
        glow: '#ddd6fe',
      },
    ] as const;

    const drawCornerDeco = (ctx: CanvasRenderingContext2D, w: number, h: number, edge: string) => {
      ctx.strokeStyle = edge;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 4); ctx.lineTo(4, 4); ctx.lineTo(4, 10);
      ctx.moveTo(w - 10, 4); ctx.lineTo(w - 4, 4); ctx.lineTo(w - 4, 10);
      ctx.moveTo(10, h - 4); ctx.lineTo(4, h - 4); ctx.lineTo(4, h - 10);
      ctx.moveTo(w - 10, h - 4); ctx.lineTo(w - 4, h - 4); ctx.lineTo(w - 4, h - 10);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    variants.forEach((v) => {
      this.drawCanvasTexture(`mg_tile_${v.id}`, 96, 96, (ctx, w, h) => {
        ctx.fillStyle = v.base;
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, `${v.tileA}cc`);
        grad.addColorStop(1, `${v.tileB}cc`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 8) {
          for (let x = 0; x < w; x += 8) {
            const checker = ((x + y) / 8) % 2 === 0;
            ctx.fillStyle = checker ? `${v.tileA}55` : `${v.tileB}44`;
            ctx.fillRect(x, y, 7, 7);
          }
        }
        ctx.strokeStyle = `${v.edge}55`;
        ctx.lineWidth = 1;
        for (let i = 6; i < w; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 6, h);
          ctx.stroke();
        }
      });

      this.drawCanvasTexture(`mg_panel_${v.id}`, 360, 240, (ctx, w, h) => {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `${v.base}f8`);
        grad.addColorStop(1, `${v.base}d4`);
        ctx.fillStyle = grad;
        ctx.fillRect(2, 2, w - 4, h - 4);
        ctx.strokeStyle = `${v.edge}cc`;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        ctx.strokeStyle = `${v.accent}66`;
        ctx.lineWidth = 1;
        ctx.strokeRect(6.5, 6.5, w - 13, h - 13);
        drawCornerDeco(ctx, w, h, v.edge);
        const glow = ctx.createRadialGradient(w * 0.5, h * 0.12, 8, w * 0.5, h * 0.12, w * 0.4);
        glow.addColorStop(0, `${v.glow}66`);
        glow.addColorStop(1, '#00000000');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h * 0.55);
      });

      this.drawCanvasTexture(`mg_safe_${v.id}`, 240, 84, (ctx, w, h) => {
        ctx.fillStyle = `${v.tileA}e6`;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `${v.glow}22`;
        ctx.fillRect(0, 0, w, h * 0.38);
        ctx.strokeStyle = `${v.edge}dd`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = `${v.edge}66`;
        for (let x = 8; x < w - 8; x += 14) {
          ctx.fillRect(x, h - 10, 7, 2);
        }
      });

      this.drawCanvasTexture(`mg_risky_${v.id}`, 240, 84, (ctx, w, h) => {
        ctx.fillStyle = '#2b111b';
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, '#7f1d1d88');
        grad.addColorStop(1, `${v.accent}22`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#fb7185dd';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = '#fb718566';
        for (let x = 6; x < w - 8; x += 16) {
          ctx.fillRect(x, 6, 8, 2);
        }
      });

      this.drawCanvasTexture(`mg_button_${v.id}`, 320, 56, (ctx, w, h) => {
        ctx.fillStyle = `${v.tileA}f2`;
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `${v.glow}44`);
        grad.addColorStop(1, '#00000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `${v.edge}e6`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = `${v.accent}66`;
        ctx.lineWidth = 1;
        ctx.strokeRect(6, 6, w - 12, h - 12);
      });
      this.drawCanvasTexture(`mg_button_hover_${v.id}`, 320, 56, (ctx, w, h) => {
        ctx.fillStyle = `${v.tileA}ff`;
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `${v.glow}66`);
        grad.addColorStop(1, `${v.glow}16`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `${v.edge}ff`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = `${v.accent}99`;
        ctx.lineWidth = 1;
        ctx.strokeRect(5, 5, w - 10, h - 10);
      });
      this.drawCanvasTexture(`mg_button_pressed_${v.id}`, 320, 56, (ctx, w, h) => {
        ctx.fillStyle = `${v.tileB}ff`;
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#00000066');
        grad.addColorStop(1, `${v.glow}22`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `${v.edge}dd`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = `${v.accent}88`;
        ctx.lineWidth = 1;
        ctx.strokeRect(7, 7, w - 14, h - 14);
      });

      this.drawCanvasTexture(`mg_bar_${v.id}`, 420, 32, (ctx, w, h) => {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `${v.tileB}d9`;
        ctx.fillRect(2, 2, w - 4, h - 4);
        ctx.strokeStyle = `${v.edge}cc`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = `${v.glow}33`;
        ctx.fillRect(4, 4, w - 8, Math.floor(h * 0.35));
      });

      this.drawCanvasTexture(`mg_icon_${v.id}`, 28, 28, (ctx, w, h) => {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `${v.edge}dd`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = `${v.accent}cc`;
        ctx.fillRect(6, 12, 16, 4);
        ctx.fillRect(12, 6, 4, 16);
        ctx.fillStyle = `${v.glow}cc`;
        ctx.fillRect(10, 10, 8, 8);
      });
    });
  }

  private generateMiniGameObjectAtlasTextures(): void {
    const variants = [
      {
        id: 'river',
        edge: '#67e8f9',
        fill: '#0c4a6e',
        glow: '#a5f3fc',
        danger: '#fb7185',
      },
      {
        id: 'forest',
        edge: '#4ade80',
        fill: '#14532d',
        glow: '#bbf7d0',
        danger: '#f59e0b',
      },
      {
        id: 'city',
        edge: '#fbbf24',
        fill: '#3f2a14',
        glow: '#fde68a',
        danger: '#fb7185',
      },
      {
        id: 'cave',
        edge: '#c4b5fd',
        fill: '#2a1f47',
        glow: '#ddd6fe',
        danger: '#fb7185',
      },
    ] as const;
    const frameNames = ['player', 'loot', 'trap', 'enemy', 'hint', 'medical', 'tech', 'stash'] as const;
    const frameSize = 32;

    variants.forEach((variant) => {
      const key = `mg_obj_${variant.id}`;
      this.drawCanvasTexture(key, frameSize * frameNames.length, frameSize, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        frameNames.forEach((frameName, index) => {
          const x = index * frameSize;
          ctx.fillStyle = '#030712';
          ctx.fillRect(x + 1, 1, frameSize - 2, frameSize - 2);
          ctx.strokeStyle = `${variant.edge}cc`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1.5, 1.5, frameSize - 3, frameSize - 3);
          ctx.fillStyle = `${variant.fill}dd`;
          ctx.fillRect(x + 4, 4, frameSize - 8, frameSize - 8);
          ctx.fillStyle = `${variant.glow}44`;
          ctx.fillRect(x + 4, 4, frameSize - 8, 8);

          if (frameName === 'player') {
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(x + 12, 8, 8, 6);
            ctx.fillRect(x + 11, 14, 10, 9);
            ctx.fillRect(x + 12, 23, 3, 5);
            ctx.fillRect(x + 17, 23, 3, 5);
            ctx.fillStyle = '#67e8f9';
            ctx.fillRect(x + 13, 10, 6, 2);
          } else if (frameName === 'loot') {
            ctx.fillStyle = '#facc15';
            ctx.fillRect(x + 8, 13, 16, 11);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x + 8, 11, 16, 3);
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(x + 10, 16, 12, 2);
          } else if (frameName === 'trap') {
            ctx.fillStyle = variant.danger;
            for (let i = 0; i < 5; i += 1) {
              const sx = x + 7 + i * 4;
              ctx.beginPath();
              ctx.moveTo(sx, 25);
              ctx.lineTo(sx + 2, 11);
              ctx.lineTo(sx + 4, 25);
              ctx.fill();
            }
          } else if (frameName === 'enemy') {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x + 10, 9, 12, 8);
            ctx.fillRect(x + 9, 17, 14, 9);
            ctx.fillStyle = '#111827';
            ctx.fillRect(x + 12, 12, 2, 2);
            ctx.fillRect(x + 18, 12, 2, 2);
          } else if (frameName === 'hint') {
            ctx.fillStyle = variant.glow;
            ctx.fillRect(x + 15, 6, 2, 14);
            ctx.fillRect(x + 12, 20, 8, 2);
            ctx.fillStyle = variant.edge;
            ctx.fillRect(x + 14, 24, 4, 4);
          } else if (frameName === 'medical') {
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(x + 8, 10, 16, 14);
            ctx.fillStyle = '#cffafe';
            ctx.fillRect(x + 14, 12, 4, 10);
            ctx.fillRect(x + 11, 15, 10, 4);
          } else if (frameName === 'tech') {
            ctx.fillStyle = '#a78bfa';
            ctx.fillRect(x + 9, 9, 14, 14);
            ctx.fillStyle = '#ddd6fe';
            ctx.fillRect(x + 12, 12, 8, 2);
            ctx.fillRect(x + 12, 16, 8, 2);
            ctx.fillRect(x + 12, 20, 5, 2);
          } else {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(x + 9, 9, 14, 14);
            ctx.fillStyle = '#ffedd5';
            ctx.fillRect(x + 11, 11, 10, 10);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(x + 13, 13, 6, 6);
          }
        });
      });
      const texture = this.textures.get(key);
      frameNames.forEach((frameName, index) => {
        if (!texture.has(frameName)) {
          texture.add(frameName, 0, index * frameSize, 0, frameSize, frameSize);
        }
      });
    });
  }

  private generateStructureSprites(): void {
    this.drawSourceToTexture('user_workbench_src', 'workbench', 64, 64, {
      fit: 'contain',
      padding: 1,
      smoothing: true,
      force: true,
      trimWhiteFromEdges: true,
      trimAlphaBounds: true,
      whiteThreshold: 232,
    });
    this.drawSourceToTexture('user_medical_station_src', 'medical_station', 64, 64, {
      fit: 'contain',
      padding: 1,
      smoothing: true,
      force: true,
      trimWhiteFromEdges: true,
      trimAlphaBounds: true,
      whiteThreshold: 232,
    });
    this.drawSourceToTexture('user_room_quarters_src', 'room_quarters', 64, 64, {
      fit: 'contain',
      padding: 1,
      smoothing: true,
      force: true,
      trimWhiteFromEdges: true,
      trimAlphaBounds: true,
      whiteThreshold: 232,
    });
    this.drawSourceToTexture('user_bunk_bed_src', 'bunk_bed', 64, 64, {
      fit: 'contain',
      padding: 1,
      smoothing: true,
      force: true,
      trimWhiteFromEdges: true,
      trimAlphaBounds: true,
      whiteThreshold: 232,
    });

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
    const keys = ['loot_wood', 'loot_metal', 'loot_food', 'loot_water', 'loot_scrap', 'loot_medical', 'loot_ammo', 'loot_core'];
    keys.forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key);
    });

    const drawToken = (key: string, palette: Record<string, string>, rows: string[]): void => {
      this.drawCanvasTexture(key, 24, 24, (ctx, w, h) => {
        const scale = 2;
        const spriteW = rows[0].length * scale;
        const spriteH = rows.length * scale;
        const offsetX = Math.floor((w - spriteW) / 2);
        const offsetY = Math.floor((h - spriteH) / 2);
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;

        rows.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const code = row[x];
            if (code === '.') continue;
            const color = palette[code];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
          }
        });
      });
    };

    drawToken(
      'loot_wood',
      { x: '#2a1b12', b: '#8d5c34', h: '#c99a64', s: '#d3b27c' },
      [
        '............',
        '..xxxxxxxx..',
        '.xbbbssbbbx.',
        '.xbbbbbbbbx.',
        '.xhhhsshhhx.',
        '.xbbbssbbbx.',
        '.xbbbssbbbx.',
        '.xhhhsshhhx.',
        '.xbbbbbbbbx.',
        '.xbbbssbbbx.',
        '..xxxxxxxx..',
        '............',
      ]
    );

    drawToken(
      'loot_metal',
      { x: '#263446', m: '#71859a', h: '#c9d7e4', d: '#4e6071' },
      [
        '............',
        '...xxxxxx...',
        '..xmmmmmmx..',
        '.xmmhhhhmmx.',
        '.xmmhhhhmmx.',
        '.xmmmmmmmmx.',
        '..xmmmmmmx..',
        '...xddddx...',
        '...xddddx...',
        '...xxxxxx...',
        '............',
        '............',
      ]
    );

    drawToken(
      'loot_food',
      { x: '#2d2418', d: '#6f5632', b: '#b9945a', h: '#e6c483', r: '#a73a2d', g: '#2d9f56', l: '#ffd175' },
      [
        '....ll......',
        '...lggl.....',
        '..xxxxxxxx..',
        '.xddddddddx.',
        '.xdbbbbbbdx.',
        '.xdbrrrbbdx.',
        '.xdbrrrbbdx.',
        '.xdbbbbbbdx.',
        '.xdhhhhhhdx.',
        '.xddddddddx.',
        '..xxxxxxxx..',
        '............',
      ]
    );

    drawToken(
      'loot_water',
      { x: '#1b2f43', w: '#4f7aa3', c: '#8fd0f2' },
      [
        '.....xx.....',
        '....xwwx....',
        '....xwwx....',
        '...xwccwx...',
        '...xwccwx...',
        '...xwccwx...',
        '...xwccwx...',
        '...xwccwx...',
        '...xwccwx...',
        '...xwccwx...',
        '....xxxx....',
        '............',
      ]
    );

    drawToken(
      'loot_scrap',
      { x: '#273443', s: '#6d8094', h: '#a2b3c4' },
      [
        '....xx......',
        '...xssx.....',
        '..xssssx....',
        '.xsshhssx...',
        '.sshxxhss...',
        'xssh..hssx..',
        'xssh..hssx..',
        '.sshxxhss...',
        '.xsshhssx...',
        '..xssssx....',
        '...xssx.....',
        '....xx......',
      ]
    );

    drawToken(
      'loot_medical',
      { x: '#3a1b20', r: '#be4b57', w: '#f6edf0' },
      [
        '............',
        '..xxxxxxxx..',
        '.xrrrrrrrrx.',
        '.xrrrrrrrrx.',
        '.xrrrwwrrrx.',
        '.xrrrwwrrrx.',
        '.xwwwwwwwwx.',
        '.xrrrwwrrrx.',
        '.xrrrwwrrrx.',
        '.xrrrrrrrrx.',
        '..xxxxxxxx..',
        '............',
      ]
    );

    drawToken(
      'loot_ammo',
      { t: '#f4cc72', b: '#b88544', s: '#6f4f2e', x: '#352714' },
      [
        '............',
        '..tt.tt.tt..',
        '..tt.tt.tt..',
        '..tt.tt.tt..',
        '..bb.bb.bb..',
        '..bb.bb.bb..',
        '..bb.bb.bb..',
        '..bb.bb.bb..',
        '..ss.ss.ss..',
        '..ss.ss.ss..',
        '...xxxxxx...',
        '............',
      ]
    );

    drawToken(
      'loot_core',
      { g: '#6f54b6', p: '#8b68ea', C: '#b59cff', W: '#f1eaff' },
      [
        '.....g......',
        '....gpg.....',
        '...gpppg....',
        '..gppCppg...',
        '.gppCCCppg..',
        '.ppCCWCCpp..',
        '.gppCCCppg..',
        '..gppCppg...',
        '...gpppg....',
        '....gpg.....',
        '.....g......',
        '............',
      ]
    );
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
    this.drawCanvasTextureForce('world_base_map', 2000, 1500, (ctx, w, h) => {
      if (this.drawClassifiedWorldBaseMap(ctx, w, h)) return;
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

      // No water tint overlays; keep terrain fully image-driven.

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
      const sources = this.getWorldBiomeSourceImages(WORLD_BIOME_CITY_ASSETS.map((it) => it.key));
      if (this.drawBiomeTileFromSources(ctx, w, h, sources, 'rgba(12, 18, 28, 0.24)')) return;
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
      const sources = this.getWorldBiomeSourceImages(WORLD_BIOME_FOREST_ASSETS.map((it) => it.key));
      if (this.drawBiomeTileFromSources(ctx, w, h, sources, 'rgba(9, 42, 22, 0.22)')) return;
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
      const sources = this.getWorldBiomeSourceImages(WORLD_BIOME_SNOW_ASSETS.map((it) => it.key));
      if (this.drawBiomeTileFromSources(ctx, w, h, sources, 'rgba(26, 32, 44, 0.24)')) return;
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
      const sources = this.getWorldBiomeSourceImages(WORLD_BIOME_CITY_ASSETS.map((it) => it.key));
      if (this.drawBiomeTileFromSources(ctx, w, h, sources, 'rgba(17, 24, 39, 0.34)')) return;
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
      const citySources = this.getWorldBiomeSourceImages(WORLD_BIOME_CITY_ASSETS.map((it) => it.key));
      const snowSources = this.getWorldBiomeSourceImages(WORLD_BIOME_SNOW_ASSETS.map((it) => it.key));
      const sources = [...citySources, ...snowSources];
      if (this.drawBiomeTileFromSources(ctx, w, h, sources, 'rgba(10, 17, 28, 0.42)')) {
        ctx.fillStyle = 'rgba(210, 224, 242, 0.35)';
        for (let i = 0; i < 7; i += 1) ctx.fillRect(10 + i * 16, 60, 8, 4);
        return;
      }
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
    if (this.textures.exists('user_base_tile_src')) {
      const makeBaseTile = (targetKey: string, overlay?: string) => {
        this.drawSourceToTexture('user_base_tile_src', targetKey, 64, 64, {
          fit: 'cover',
          smoothing: true,
          force: true,
          overlay,
        });
      };
      makeBaseTile('village_ground');
      makeBaseTile('village_path', 'rgba(12, 18, 28, 0.08)');
      return;
    }

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
