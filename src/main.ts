// Phaser 3 Roguelike Survival Game
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MenuScene from './scenes/MenuScene';
import GameScene from './scenes/GameScene';
import UIScene from './scenes/UIScene';
import CRTScene from './scenes/CRTScene';

const mobileUA = (() => {
  if (typeof window === 'undefined') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Android|iPhone|iPad|iPod/i.test(ua) && !/Windows|Macintosh|Linux x86/i.test(ua);
})();
const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;

const STAGE_DESKTOP = { width: 1280, height: 720 };
const STAGE_MOBILE_PORTRAIT = { width: 560, height: 1212 };
const STAGE_MOBILE_PORTRAIT_WIDE = { width: 640, height: 1138 };
const STAGE_MOBILE_LANDSCAPE = { width: 1560, height: 720 };

const resolveStageForViewport = (vw: number, vh: number) => {
  const portrait = vh > vw;
  if (!mobileUA && vw >= 1024) return STAGE_DESKTOP;
  const mobileLikeViewport = portrait || vw <= 768 || mobileUA;
  if (!mobileLikeViewport) return STAGE_DESKTOP;
  if (portrait) {
    const portraitAspect = vw / Math.max(1, vh);
    return portraitAspect >= 0.52 ? STAGE_MOBILE_PORTRAIT_WIDE : STAGE_MOBILE_PORTRAIT;
  }
  return STAGE_MOBILE_LANDSCAPE;
};

const initialStage = resolveStageForViewport(viewportWidth, viewportHeight);
const prefersMobilePerf = initialStage.width !== STAGE_DESKTOP.width || initialStage.height !== STAGE_DESKTOP.height;
const hardwareThreads = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 8) : 8;
const deviceMemoryGB = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 0) : 0;
const lowEndMobilePerf = prefersMobilePerf && (hardwareThreads <= 6 || (deviceMemoryGB > 0 && deviceMemoryGB <= 4));

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: initialStage.width,
  height: initialStage.height,
  parent: 'game-container',
  backgroundColor: '#0d1117',
  pixelArt: true,
  antialias: false,
  antialiasGL: false,
  autoRound: true,
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  fps: {
    target: lowEndMobilePerf ? 45 : prefersMobilePerf ? 50 : 60,
    forceSetTimeOut: lowEndMobilePerf,
    smoothStep: !lowEndMobilePerf,
  },
  scene: [BootScene, MenuScene, GameScene, UIScene, CRTScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      fps: lowEndMobilePerf ? 50 : 60,
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    expandParent: true,
  }
};

// Remove loading text
const loadingEl = document.getElementById('loading');
if (loadingEl) {
  loadingEl.remove();
}

// Start game
const game = new Phaser.Game(config);
if (typeof window !== 'undefined') {
  (window as any).__phaserGame = game;
  const applyResponsiveResize = () => {
    const nextStage = resolveStageForViewport(window.innerWidth, window.innerHeight);
    const currentW = game.scale.gameSize.width;
    const currentH = game.scale.gameSize.height;
    const changed = currentW !== nextStage.width || currentH !== nextStage.height;
    if (!changed) return;
    game.scale.setGameSize(nextStage.width, nextStage.height);
    game.scale.refresh();

    // Menu uses static coordinates at create-time. Rebuild it on stage ratio changes.
    try {
      const menu = game.scene.getScene('MenuScene');
      if (menu && menu.scene.isActive()) {
        menu.scene.restart();
      }
    } catch (_e) {
      // Scene may not be booted yet.
    }
  };

  window.addEventListener('resize', applyResponsiveResize);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(applyResponsiveResize, 80);
    window.setTimeout(applyResponsiveResize, 280);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyResponsiveResize);
  }
  applyResponsiveResize();
  window.setTimeout(applyResponsiveResize, 120);
}
