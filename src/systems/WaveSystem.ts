/**
 * WaveSystem - Enemy wave spawning with difficulty scaling
 * Manages wave progression, Blood Moon hordes, and boss spawning
 */
import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import { getEnemiesForWeek, getEnemyForWeek, getRandomBoss } from '../data/enemies';
import type { EnemyDef } from '../data/enemies';

export class WaveSystem {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;

  private currentWave: number = 0;
  private enemiesInWave: number = 0;
  private enemiesKilledInWave: number = 0;
  private isWaveActive: boolean = false;
  private waveSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private bloodMoonBossTimer: Phaser.Time.TimerEvent | null = null;
  private bloodMoonSecondBossTimer: Phaser.Time.TimerEvent | null = null;
  private bloodMoonEliteTimer: Phaser.Time.TimerEvent | null = null;
  private spawnedInWave: number = 0;
  private bossSpawnCount: number = 0;

  constructor(scene: Phaser.Scene, enemies: Phaser.Physics.Arcade.Group, _player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.enemies = enemies;
  }

  private getDayBalanceProfile(dayOverride?: number): {
    enemyCountMul: number;
    spawnIntervalMul: number;
    enemySurviveMul: number;
    enemyOffenseMul: number;
    enemySpeedMul: number;
  } {
    const day = Math.max(1, dayOverride || gameState.data.currentDay || 1);
    if (day <= 1) {
      return { enemyCountMul: 0.84, spawnIntervalMul: 1.12, enemySurviveMul: 0.82, enemyOffenseMul: 0.88, enemySpeedMul: 0.94 };
    }
    if (day <= 2) {
      return { enemyCountMul: 0.9, spawnIntervalMul: 1.08, enemySurviveMul: 0.88, enemyOffenseMul: 0.92, enemySpeedMul: 0.96 };
    }
    if (day <= 3) {
      return { enemyCountMul: 0.96, spawnIntervalMul: 1.04, enemySurviveMul: 0.94, enemyOffenseMul: 0.96, enemySpeedMul: 0.98 };
    }
    if (day <= 7) {
      return { enemyCountMul: 1, spawnIntervalMul: 1, enemySurviveMul: 1, enemyOffenseMul: 1, enemySpeedMul: 1 };
    }
    if (day <= 12) {
      return { enemyCountMul: 1.08, spawnIntervalMul: 0.94, enemySurviveMul: 1.12, enemyOffenseMul: 1.08, enemySpeedMul: 1.04 };
    }
    return { enemyCountMul: 1.16, spawnIntervalMul: 0.88, enemySurviveMul: 1.22, enemyOffenseMul: 1.14, enemySpeedMul: 1.08 };
  }

  private nightWarmupUntil: number = 0;

  startNightWaves(): void {
    this.currentWave = 0;
    this.bossSpawnCount = 0;
    this.nightWarmupUntil = this.scene.time.now + 2000;
    if (this.bloodMoonBossTimer) {
      this.bloodMoonBossTimer.remove();
      this.bloodMoonBossTimer = null;
    }
    if (this.bloodMoonSecondBossTimer) {
      this.bloodMoonSecondBossTimer.remove();
      this.bloodMoonSecondBossTimer = null;
    }
    if (this.bloodMoonEliteTimer) {
      this.bloodMoonEliteTimer.remove();
      this.bloodMoonEliteTimer = null;
    }
    // Guaranteed boss return on every blood moon night (day 7/14/21...)
    if (gameState.data.isBloodMoon) {
      this.bloodMoonBossTimer = this.scene.time.addEvent({
        delay: 8000,
        callback: () => {
          if (!gameState.data.isNight || !gameState.data.isBloodMoon || this.bossSpawnCount >= 1) return;
          this.spawnBoss();
        },
      });

      // Pressure up: second boss in later blood-moon phase
      this.bloodMoonSecondBossTimer = this.scene.time.addEvent({
        delay: 43000,
        callback: () => {
          if (!gameState.data.isNight || !gameState.data.isBloodMoon || this.bossSpawnCount >= 2) return;
          if (this.currentWave < 5) return;
          this.spawnBoss(true);
        },
      });

      // Pressure up: elite reinforcements at fixed interval.
      this.bloodMoonEliteTimer = this.scene.time.addEvent({
        delay: 10500,
        loop: true,
        callback: () => {
          if (!gameState.data.isNight || !gameState.data.isBloodMoon) return;
          const week = gameState.data.currentWeek;
          const elite = getEnemyForWeek('elite', week) || getEnemyForWeek('heavy', week);
          if (!elite) return;
          const count = 1 + Math.min(3, Math.floor(this.currentWave / 4));
          for (let i = 0; i < count; i++) this.spawnEnemyOfType(elite);
        },
      });
    }
    this.startNextWave();
  }

  private startNextWave(): void {
    this.currentWave++;
    const state = gameState.data;
    const isBloodMoon = state.isBloodMoon;
    const week = state.currentWeek;
    const pressure = Math.max(0, this.currentWave - 1);
    const pace = this.getDayBalanceProfile(state.currentDay);

    // Base enemy count scales with day and week
    let baseCount = 18 + state.currentDay * 3 + week * 5 + pressure * 5;
    if (isBloodMoon) {
      baseCount = Math.floor(baseCount * (2.2 + week * 0.5));
    }
    baseCount = Phaser.Math.Clamp(Math.floor(baseCount * pace.enemyCountMul), 8, isBloodMoon ? 200 : 120);
    this.enemiesInWave = baseCount;
    this.enemiesKilledInWave = 0;
    this.spawnedInWave = 0;
    this.isWaveActive = true;

    state.currentWave = this.currentWave;

    events.emit(GameEvents.WAVE_START, {
      wave: this.currentWave,
      count: this.enemiesInWave,
      isBloodMoon,
    });

    this.showWaveAnnouncement();

    // Spawn enemies over time (gradual ramp-up prevents start-of-night lag)
    const spawnInterval = Math.max(
      isBloodMoon ? 200 : 280,
      (isBloodMoon ? 350 : 500) - pressure * 15 - week * 8
    );
    const pacedSpawnInterval = Math.max(isBloodMoon ? 180 : 250, Math.round(spawnInterval * pace.spawnIntervalMul));
    this.waveSpawnTimer = this.scene.time.addEvent({
      delay: pacedSpawnInterval,
      callback: this.spawnNextEnemy,
      callbackScope: this,
      loop: true,
    });

    // Spawn boss on Blood Moon after wave 5
    if (isBloodMoon && this.currentWave >= 2 && this.bossSpawnCount < 1) {
      this.scene.time.delayedCall(2500, () => this.spawnBoss());
    }
  }

  private spawnNextEnemy(): void {
    if (this.spawnedInWave >= this.enemiesInWave) {
      if (this.waveSpawnTimer) {
        this.waveSpawnTimer.remove();
        this.waveSpawnTimer = null;
      }
      return;
    }

    // Cap active enemies to prevent performance degradation
    const activeEnemies = this.enemies.countActive(true);
    const isWarmup = this.scene.time.now < this.nightWarmupUntil;
    const maxActive = isWarmup ? 8 : (gameState.data.isBloodMoon ? 60 : 40);
    if (activeEnemies >= maxActive) return;

    const week = gameState.data.currentWeek;
    const availableTypes = getEnemiesForWeek(week);
    if (availableTypes.length === 0) return;

    // Weighted random selection + faction bias from GameScene.
    const factionWeights = gameState.data.isNight
      ? (((this.scene as any).getNightEnemyFactionWeights?.() || {}) as Record<string, number>)
      : {};
    const weightedEntries = availableTypes.map((type) => {
      const mul = Phaser.Math.Clamp(Number(factionWeights[type.id] || 1), 0.18, 2.3);
      return {
        type,
        weight: Math.max(0.01, type.spawnWeight * mul),
      };
    });
    const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return;
    let roll = Math.random() * totalWeight;
    let selectedType: EnemyDef = weightedEntries[0].type;
    for (const entry of weightedEntries) {
      roll -= entry.weight;
      if (roll <= 0) {
        selectedType = entry.type;
        break;
      }
    }

    const scaled = getEnemyForWeek(selectedType.id, week);
    if (!scaled) return;

    this.spawnEnemyOfType(scaled);
    this.spawnedInWave++;
  }

  spawnEnemyOfType(def: EnemyDef): Phaser.Physics.Arcade.Sprite {
    // Spawn from world edges
    const side = Phaser.Math.Between(0, 3);
    let x: number, y: number;
    switch (side) {
      case 0: x = Phaser.Math.Between(50, 1950); y = Phaser.Math.Between(20, 60); break;
      case 1: x = Phaser.Math.Between(1900, 1960); y = Phaser.Math.Between(50, 1450); break;
      case 2: x = Phaser.Math.Between(50, 1950); y = Phaser.Math.Between(1420, 1470); break;
      default: x = Phaser.Math.Between(20, 60); y = Phaser.Math.Between(50, 1450); break;
    }

    // Choose texture based on size
    let texture = 'zombie';
    if (def.size >= 25) texture = 'tank';
    else if (def.size <= 11) texture = 'runner';

    const enemy = this.enemies.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    if (!enemy) return enemy;

    enemy.setActive(true).setVisible(true);
    enemy.setTint(def.color);
    enemy.setDepth(5);

    // Scale sprite based on def size
    const scale = def.size / 12;
    enemy.setScale(Math.max(1.2, Math.min(scale, 3.2)));

    // Set physics body
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const bodySize = Math.max(12, def.size);
      body.setSize(bodySize, bodySize);
      body.setOffset((enemy.width - bodySize) / 2, (enemy.height - bodySize) / 2);
      body.setBounce(0.2);
    }

    // Store enemy data
    const ed = enemy as any;
    ed.health = def.baseHealth;
    ed.maxHealth = def.baseHealth;
    ed.damage = def.baseDamage;
    ed.speed = def.speed;
    ed.enemyType = def.id;
    ed.enemyDef = def;
    ed.behavior = def.behavior;
    ed.isBoss = def.isBoss || false;
    ed.xpValue = def.xpValue;
    ed.lootTable = def.lootTable;
    ed.special = def.special;

    // Behavior-specific setup
    if (def.behavior === 'stealth') {
      enemy.setAlpha(0.3);
    }
    if (def.behavior === 'elite') {
      // Random buff
      const buffs = ['speed', 'armor', 'damage'];
      const buff = buffs[Math.floor(Math.random() * buffs.length)];
      if (buff === 'speed') ed.speed *= 1.5;
      else if (buff === 'armor') ed.health *= 1.5;
      else ed.damage *= 1.5;
    }

    const pressure = Math.max(0, this.currentWave - 1);
    const day = Math.max(1, gameState.data.currentDay || 1);
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const bloodMoon = !!gameState.data.isBloodMoon;
    const pace = this.getDayBalanceProfile(day);
    const survivabilityMul = 1 + Math.min(
      2.8,
      pressure * 0.08 + (week - 1) * 0.16 + (day - 1) * 0.035 + (bloodMoon ? 0.45 : 0)
    );
    const offenseMul = 1 + Math.min(
      1.65,
      pressure * 0.05 + (week - 1) * 0.12 + (bloodMoon ? 0.28 : 0)
    );
    const speedMul = 1 + Math.min(
      0.55,
      pressure * 0.015 + (week - 1) * 0.025 + (bloodMoon ? 0.08 : 0)
    );
    ed.health = Math.max(1, Math.floor(ed.health * survivabilityMul * pace.enemySurviveMul));
    ed.maxHealth = ed.health;
    ed.damage = Math.max(1, Math.floor(ed.damage * offenseMul * pace.enemyOffenseMul));
    ed.speed = Math.max(20, Math.floor(ed.speed * speedMul * pace.enemySpeedMul));

    return enemy;
  }

  private spawnBoss(forceSecond: boolean = false): void {
    if (!forceSecond && this.bossSpawnCount >= 1) return;
    if (forceSecond && this.bossSpawnCount >= 2) return;
    const week = gameState.data.currentWeek;
    const bossDef = getRandomBoss(week);
    if (!bossDef) return;

    const scaled = getEnemyForWeek(bossDef.id, week);
    if (!scaled) return;

    this.bossSpawnCount += 1;
    const boss = this.spawnEnemyOfType(scaled);
    if (!boss) return;

    const bd = boss as any;
    const bloodMoonMul = gameState.data.isBloodMoon ? 1.8 : 1.35;
    const weekMul = 1 + Math.max(0, gameState.data.currentWeek - 1) * 0.42;
    const pressureMul = forceSecond ? 2.35 : 1.95;
    bd.health = Math.floor((bd.health || scaled.baseHealth) * bloodMoonMul * weekMul * pressureMul);
    bd.maxHealth = bd.health;
    bd.damage = Math.floor((bd.damage || scaled.baseDamage) * (1.35 + (gameState.data.currentWeek - 1) * 0.18) * (forceSecond ? 1.28 : 1.12));
    bd.speed = Math.floor((bd.speed || scaled.speed) * (forceSecond ? 1.18 : 1.1));
    bd.bossArmorMul = Phaser.Math.Clamp(
      0.36 + gameState.data.currentWeek * 0.035 + this.currentWave * 0.012 + (forceSecond ? 0.08 : 0),
      0.38,
      0.78
    );
    bd.bossHitCapRatio = forceSecond ? 0.022 : 0.028;
    bd.enrageThreshold = forceSecond ? 0.62 : 0.48;

    if (forceSecond) {
      boss.setTint(0xff225f);
      boss.setScale((boss.scale || 1) * 1.08);
    }

    // Boss announcement - dramatic entrance
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;

    // Screen shake
    this.scene.cameras.main.shake(1000, 0.02);

    // Dark flash
    const flash = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(1998);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 1500,
      onComplete: () => flash.destroy(),
    });

    // Warning text with scale-in animation
    const warnTitle = forceSecond ? '⚠ 二次首领突入 ⚠' : '⚠ 强敌出现 ⚠';
    const warn = this.scene.add.text(w / 2, 60, warnTitle, {
      fontSize: '24px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    const bossName = this.scene.add.text(w / 2, 90, scaled.nameCN, {
      fontSize: '36px', color: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setScale(0);

    this.scene.tweens.add({
      targets: bossName, scale: { from: 0, to: 1 }, duration: 500,
      ease: 'Back.easeOut',
    });

    this.scene.time.delayedCall(3500, () => {
      [warn, bossName].forEach(t => {
        this.scene.tweens.add({
          targets: t, alpha: 0, duration: 1000,
          onComplete: () => t.destroy(),
        });
      });
    });
  }

  onEnemyKilled(_enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!this.isWaveActive) return;
    this.enemiesKilledInWave++;
    gameState.data.totalKills++;
    gameState.data.stats.enemiesKilled++;

    const ed = _enemy as any;
    if (ed.isBoss) gameState.data.stats.bossesKilled++;
    if (ed.behavior === 'elite') gameState.data.stats.elitesKilled++;

    // Check wave complete
    if (this.enemiesKilledInWave >= this.enemiesInWave && this.spawnedInWave >= this.enemiesInWave) {
      this.onWaveComplete();
    }
  }

  private onWaveComplete(): void {
    this.isWaveActive = false;
    events.emit(GameEvents.WAVE_COMPLETE, { wave: this.currentWave });

    const maxWaves = gameState.data.isBloodMoon
      ? 14 + gameState.data.currentWeek * 3
      : Math.min(10, 6 + gameState.data.currentWeek);
    if (this.currentWave < maxWaves) {
      this.scene.time.delayedCall(3000, () => {
        if (gameState.data.isNight) {
          this.startNextWave();
        }
      });
    }
  }

  private showWaveAnnouncement(): void {
    const w = this.scene.cameras.main.width;
    const prefix = gameState.data.isBloodMoon ? '🩸 血月 ' : '';
    const text = this.scene.add.text(w / 2, 200, `${prefix}波次 ${this.currentWave}`, {
      fontSize: '28px', color: gameState.data.isBloodMoon ? '#ef4444' : '#fbbf24',
      fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    this.scene.tweens.add({
      targets: text, alpha: 0, y: 170, duration: 2000, delay: 1500,
      onComplete: () => text.destroy(),
    });
  }

  getWaveInfo(): { wave: number; killed: number; total: number; active: boolean } {
    return {
      wave: this.currentWave,
      killed: this.enemiesKilledInWave,
      total: this.enemiesInWave,
      active: this.isWaveActive,
    };
  }

  stopWaves(): void {
    this.isWaveActive = false;
    if (this.waveSpawnTimer) {
      this.waveSpawnTimer.remove();
      this.waveSpawnTimer = null;
    }
    if (this.bloodMoonBossTimer) {
      this.bloodMoonBossTimer.remove();
      this.bloodMoonBossTimer = null;
    }
    if (this.bloodMoonSecondBossTimer) {
      this.bloodMoonSecondBossTimer.remove();
      this.bloodMoonSecondBossTimer = null;
    }
    if (this.bloodMoonEliteTimer) {
      this.bloodMoonEliteTimer.remove();
      this.bloodMoonEliteTimer = null;
    }
  }

  destroy(): void {
    this.stopWaves();
  }
}
