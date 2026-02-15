/**
 * CRTScene - Retro arcade visual overlay
 * Renders scanlines, vignette, and CRT curvature effects on top of all other scenes
 * Runs as an always-on overlay scene
 */
import Phaser from 'phaser';

export default class CRTScene extends Phaser.Scene {
  private scanlineGraphics!: Phaser.GameObjects.Graphics;
  private vignetteGraphics!: Phaser.GameObjects.Graphics;
  private scanlineOffset: number = 0;
  private flickerTimer: number = 0;
  private noiseGraphics!: Phaser.GameObjects.Graphics;
  private compactViewport: boolean = false;

  constructor() {
    super({ key: 'CRTScene' });
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.compactViewport = w <= 900;

    // Scanlines overlay
    this.scanlineGraphics = this.add.graphics().setDepth(9000).setAlpha(this.compactViewport ? 0.018 : 0.045);
    this.drawScanlines(w, h);

    // Vignette (dark edges)
    this.vignetteGraphics = this.add.graphics().setDepth(9001);
    this.drawVignette(w, h);

    // Film grain / noise layer
    this.noiseGraphics = this.add.graphics().setDepth(8999).setAlpha(this.compactViewport ? 0.008 : 0.015);

    // Slight green/cyan tint at edges (retro monitor effect)
    const edgeGlow = this.add.graphics().setDepth(8998).setAlpha(this.compactViewport ? 0.012 : 0.025);
    // Top edge
    edgeGlow.fillGradientStyle(0x0ea5e9, 0x0ea5e9, 0x000000, 0x000000, 0.15, 0.15, 0, 0);
    edgeGlow.fillRect(0, 0, w, 30);
    // Bottom edge
    edgeGlow.fillGradientStyle(0x000000, 0x000000, 0x0ea5e9, 0x0ea5e9, 0, 0, 0.15, 0.15);
    edgeGlow.fillRect(0, h - 30, w, 30);
    // Left edge
    edgeGlow.fillGradientStyle(0x0ea5e9, 0x000000, 0x0ea5e9, 0x000000, 0.1, 0, 0.1, 0);
    edgeGlow.fillRect(0, 0, 20, h);
    // Right edge
    edgeGlow.fillGradientStyle(0x000000, 0x0ea5e9, 0x000000, 0x0ea5e9, 0, 0.1, 0, 0.1);
    edgeGlow.fillRect(w - 20, 0, 20, h);

    // Subtle chromatic aberration borders
    this.add.rectangle(1, h / 2, 2, h, 0xff0000, this.compactViewport ? 0.012 : 0.02).setDepth(9002);
    this.add.rectangle(w - 1, h / 2, 2, h, 0x0000ff, this.compactViewport ? 0.012 : 0.02).setDepth(9002);

    // Ensure no input blocking
    this.input.enabled = false;
  }

  update(_time: number, delta: number): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Animate scanline scroll (subtle)
    this.scanlineOffset += delta * 0.02;
    if (this.scanlineOffset > 4) this.scanlineOffset -= 4;

    // Occasional flicker
    this.flickerTimer -= delta;
    if (this.flickerTimer <= 0) {
      this.flickerTimer = Phaser.Math.Between(3000, 8000);
      // Brief brightness flicker
      this.scanlineGraphics.setAlpha(this.compactViewport ? 0.03 : 0.065);
      this.time.delayedCall(50, () => {
        this.scanlineGraphics.setAlpha(this.compactViewport ? 0.018 : 0.045);
      });
    }

    // Update noise grain (very subtle)
    if (this.compactViewport) return;
    this.updateNoise(w, h);
  }

  private drawScanlines(w: number, h: number): void {
    this.scanlineGraphics.clear();
    this.scanlineGraphics.fillStyle(0x000000, 1);

    for (let y = 0; y < h; y += 3) {
      this.scanlineGraphics.fillRect(0, y, w, 1);
    }
  }

  private drawVignette(w: number, h: number): void {
    this.vignetteGraphics.clear();

    // Corner darkening - multiple layers for smooth gradient
    const layers = 8;
    for (let i = 0; i < layers; i++) {
      const alpha = 0.018 * (layers - i) / layers;
      const inset = i * 40;
      this.vignetteGraphics.fillStyle(0x000000, alpha);

      // Top
      this.vignetteGraphics.fillRect(0, 0, w, inset + 20);
      // Bottom
      this.vignetteGraphics.fillRect(0, h - inset - 20, w, inset + 20);
      // Left
      this.vignetteGraphics.fillRect(0, 0, inset + 20, h);
      // Right
      this.vignetteGraphics.fillRect(w - inset - 20, 0, inset + 20, h);
    }

    // Corner emphasis
    const cornerSize = 120;
    const cornerAlpha = this.compactViewport ? 0.08 : 0.11;

    this.vignetteGraphics.fillStyle(0x000000, cornerAlpha);
    // Top-left
    this.vignetteGraphics.fillTriangle(0, 0, cornerSize, 0, 0, cornerSize);
    // Top-right
    this.vignetteGraphics.fillTriangle(w, 0, w - cornerSize, 0, w, cornerSize);
    // Bottom-left
    this.vignetteGraphics.fillTriangle(0, h, cornerSize, h, 0, h - cornerSize);
    // Bottom-right
    this.vignetteGraphics.fillTriangle(w, h, w - cornerSize, h, w, h - cornerSize);
  }

  private updateNoise(w: number, h: number): void {
    this.noiseGraphics.clear();

    // Sparse random noise dots
    const dotCount = 30;
    for (let i = 0; i < dotCount; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const brightness = Phaser.Math.Between(0, 1) === 0 ? 0x000000 : 0xffffff;
      this.noiseGraphics.fillStyle(brightness, Phaser.Math.FloatBetween(0.3, 1));
      this.noiseGraphics.fillRect(x, y, 1, 1);
    }
  }
}
