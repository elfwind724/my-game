/**
 * DayCycleSystem - 7-day horde cycle with Blood Moon
 * Extracted from GameScene for modularity
 */
import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import { getStoryForDay, getBloodMoonStory, DAY_TIPS } from '../data/story';
import { StoryOverlay } from '../ui/StoryOverlay';

export class DayCycleSystem {
  private scene: Phaser.Scene;
  private timer: Phaser.Time.TimerEvent | null = null;
  private storyOverlay: StoryOverlay;
  private readonly DAY_DURATION = 100000; // 100 seconds per cycle (65 day + 35 night)
  private readonly NIGHT_START = 65; // Night begins at 65% of cycle

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.storyOverlay = new StoryOverlay(scene);
  }

  start(): void {
    this.timer = this.scene.time.addEvent({
      delay: this.DAY_DURATION / 100,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });
  }

  private tick(): void {
    const state = gameState.data;
    state.timeOfDay += 1;

    // Track survival time (each tick = DAY_DURATION/100 ms)
    state.stats.survivalTime = (state.stats.survivalTime || 0) + this.DAY_DURATION / 100 / 1000;

    if (state.timeOfDay >= 100) {
      state.timeOfDay = 0;
      gameState.advanceDay();
      this.onDayStart();
    }

    const wasNight = state.isNight;
    state.isNight = state.timeOfDay >= this.NIGHT_START;

    if (!wasNight && state.isNight) {
      this.onNightStart();
    }

    events.emit(GameEvents.TIME_UPDATE, {
      day: state.currentDay,
      timeOfDay: state.timeOfDay,
      isNight: state.isNight,
      isBloodMoon: state.isBloodMoon,
      week: state.currentWeek,
      dayInWeek: gameState.getDayInWeek(),
    });
  }

  private onDayStart(): void {
    const state = gameState.data;
    const day = state.currentDay;

    // Production from buildings
    this.processProduction();

    events.emit(GameEvents.DAY_START, { day });

    // Show story event
    const storyEvent = getStoryForDay(day);
    const tip = DAY_TIPS[day];
    const bloodMoonDays = gameState.getDaysUntilBloodMoon();

    this.showDayAnnouncement(day, storyEvent, tip, bloodMoonDays);
  }

  private onNightStart(): void {
    const state = gameState.data;
    state.isBloodMoon = state.currentDay % 7 === 0;

    if (state.isBloodMoon) {
      state.stats.bloodMoonsSurvived++;
      const story = getBloodMoonStory(state.currentDay);
      this.showBloodMoonAnnouncement(story);
    } else {
      this.showNightAnnouncement();
    }

    events.emit(GameEvents.NIGHT_START, {
      day: state.currentDay,
      isBloodMoon: state.isBloodMoon,
      week: state.currentWeek,
    });
  }

  private processProduction(): void {
    // Buildings produce resources each day
    // This will be connected to BuildSystem
  }

  private showDayAnnouncement(day: number, story: any, tip: string | undefined, bloodMoonDays: number): void {
    const w = this.scene.cameras.main.width;
    const texts: Phaser.GameObjects.Text[] = [];

    // Day number (always shown as big header)
    const dayText = this.scene.add.text(w / 2, 80, `第 ${day} 天`, {
      fontSize: '40px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(dayText);

    // Week info
    const weekInfo = `第${gameState.data.currentWeek}周 · 第${gameState.getDayInWeek()}天`;
    const weekText = this.scene.add.text(w / 2, 125, weekInfo, {
      fontSize: '20px', color: '#94a3b8', fontFamily: 'Courier New',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(weekText);

    // Blood moon warning (always shown if applicable)
    if (bloodMoonDays <= 2 && bloodMoonDays > 0) {
      const warningText = bloodMoonDays === 1
        ? '⚠️ 明天就是血月之夜！做好准备！'
        : `⚠️ 距离血月还有 ${bloodMoonDays} 天`;
      const warning = this.scene.add.text(w / 2, 155, warningText, {
        fontSize: '22px', color: '#ef4444', fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
      texts.push(warning);
    }

    // Fade out header
    this.scene.time.delayedCall(3000, () => {
      texts.forEach(t => {
        this.scene.tweens.add({
          targets: t, alpha: 0, duration: 1000,
          onComplete: () => t.destroy(),
        });
      });
    });

    // Story dialogue with typewriter overlay (if story exists)
    if (story && story.lines.length > 0) {
      this.scene.time.delayedCall(800, () => {
        this.storyOverlay.show(story.titleCN || `第${day}天`, story.lines, 6000);
      });
    } else if (tip) {
      // Show tip as a brief overlay
      this.scene.time.delayedCall(800, () => {
        this.storyOverlay.show('提示', [tip], 3000);
      });
    }
  }

  private showNightAnnouncement(): void {
    const w = this.scene.cameras.main.width;
    const threatLevel = Math.floor(1 + (gameState.data.currentDay - 1) * 0.5);
    const texts: Phaser.GameObjects.Text[] = [];

    const title = this.scene.add.text(w / 2, 80, '🌙 夜幕降临', {
      fontSize: '36px', color: '#7c3aed', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(title);

    const sub = this.scene.add.text(w / 2, 125, `被控体来袭! 威胁等级: ${threatLevel}x`, {
      fontSize: '20px', color: '#c4b5fd', fontFamily: 'Courier New',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(sub);

    this.scene.time.delayedCall(2500, () => {
      texts.forEach(t => {
        this.scene.tweens.add({
          targets: t, alpha: 0, duration: 800,
          onComplete: () => t.destroy(),
        });
      });
    });
  }

  private showBloodMoonAnnouncement(story: any): void {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const texts: Phaser.GameObjects.Text[] = [];

    const title = this.scene.add.text(w / 2, 60, '🩸 血月之夜 🩸', {
      fontSize: '42px', color: '#dc2626', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(title);

    const weekNum = gameState.data.currentWeek;
    const sub = this.scene.add.text(w / 2, 110, `第${weekNum}周血月 · 敌人数量 x${Math.floor(2 + weekNum)}`, {
      fontSize: '22px', color: '#fca5a5', fontFamily: 'Courier New',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    texts.push(sub);

    // Screen flash red
    const flash = this.scene.add.rectangle(w / 2, h / 2, w, h, 0xff0000, 0.3)
      .setScrollFactor(0).setDepth(1999);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 2000,
      onComplete: () => flash.destroy(),
    });

    // Screen shake
    this.scene.cameras.main.shake(800, 0.015);

    this.scene.time.delayedCall(4000, () => {
      texts.forEach(t => {
        this.scene.tweens.add({
          targets: t, alpha: 0, duration: 1000,
          onComplete: () => t.destroy(),
        });
      });
    });

    // Story overlay with typewriter for blood moon stories
    if (story && story.lines.length > 0) {
      this.scene.time.delayedCall(1500, () => {
        this.storyOverlay.show(story.titleCN || '血月之夜', story.lines, 6000);
      });
    }
  }

  isNight(): boolean {
    return gameState.data.isNight;
  }

  isBloodMoon(): boolean {
    return gameState.data.isBloodMoon;
  }

  getCurrentDay(): number {
    return gameState.data.currentDay;
  }

  getDarkness(): number {
    const t = gameState.data.timeOfDay;
    if (t < this.NIGHT_START) return 0;
    // Gradual transition from 50-65, then full night
    const nightProgress = (t - this.NIGHT_START) / (100 - this.NIGHT_START);
    const maxDark = gameState.data.isBloodMoon ? 0.75 : 0.6;
    return Math.min(nightProgress * 1.5, 1) * maxDark;
  }

  destroy(): void {
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }
    this.storyOverlay?.destroy();
  }
}
