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
  private player: Phaser.Physics.Arcade.Sprite;

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

  constructor(scene: Phaser.Scene, enemies: Phaser.Physics.Arcade.Group, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.enemies = enemies;
    this.player = player;
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
    } else if (!isBloodMoon && gameState.data.currentDay >= 3 && this.currentWave >= 4 && this.bossSpawnCount < 1) {
      // Regular nights also need a visible pressure spike, but lighter than blood moon.
      this.scene.time.delayedCall(3200, () => this.spawnBoss());
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
    const scriptedThreat = this.pickScriptedThreat(availableTypes);
    const weightedEntries = availableTypes.map((type) => {
      const mul = Phaser.Math.Clamp(Number(factionWeights[type.id] || 1), 0.18, 2.3);
      const scriptedMul = scriptedThreat?.id === type.id ? 2.85 : 1;
      return {
        type,
        weight: Math.max(0.01, type.spawnWeight * mul * scriptedMul),
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

  private pickScriptedThreat(availableTypes: EnemyDef[]): EnemyDef | null {
    const cadence = gameState.data.isBloodMoon ? 5 : 7;
    if (this.spawnedInWave === 0 || this.spawnedInWave % cadence !== cadence - 1) return null;
    const week = Math.max(1, gameState.data.currentWeek || 1);
    const pressure = Math.max(0, this.currentWave - 1);
    const specialistEntries = availableTypes
      .filter((type) => {
        if (type.isBoss) return false;
        return type.behavior === 'ranged'
          || type.behavior === 'heavy'
          || type.behavior === 'explode'
          || type.behavior === 'heal'
          || type.behavior === 'stealth'
          || type.behavior === 'elite'
          || type.id === 'spitter'
          || type.id === 'necromancer'
          || type.id === 'bomber'
          || type.id === 'parasite'
          || type.id === 'shield_bearer'
          || type.id === 'berserker';
      })
      .map((type) => {
        let weight = type.spawnWeight;
        if (type.behavior === 'ranged' || type.id === 'spitter') weight *= 1.2 + pressure * 0.06;
        if (type.behavior === 'heavy' || type.id === 'shield_bearer') weight *= 1.15 + week * 0.08;
        if (type.behavior === 'heal' || type.id === 'necromancer') weight *= 1 + Math.max(0, pressure - 1) * 0.05;
        if (type.behavior === 'elite') weight *= 0.7 + pressure * 0.12;
        if (type.id === 'bomber' || type.behavior === 'explode') weight *= 0.95 + pressure * 0.08;
        return { type, weight: Math.max(0.1, weight) };
      });
    if (specialistEntries.length === 0) return null;
    const total = specialistEntries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of specialistEntries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }
    return specialistEntries[0].type;
  }

  private getEdgeSpawnPoint(): { x: number; y: number } {
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0: return { x: Phaser.Math.Between(50, 1950), y: Phaser.Math.Between(20, 60) };
      case 1: return { x: Phaser.Math.Between(1900, 1960), y: Phaser.Math.Between(50, 1450) };
      case 2: return { x: Phaser.Math.Between(50, 1950), y: Phaser.Math.Between(1420, 1470) };
      default: return { x: Phaser.Math.Between(20, 60), y: Phaser.Math.Between(50, 1450) };
    }
  }

  private getBossSpawnPoint(): { x: number; y: number } {
    const bounds = new Phaser.Geom.Rectangle(60, 60, 1880, 1380);
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(420, 560);
      const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * radius, bounds.left, bounds.right);
      const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * radius, bounds.top, bounds.bottom);
      const dist = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (dist >= 360 && dist <= 620) return { x, y };
    }
    return this.getEdgeSpawnPoint();
  }

  spawnEnemyOfType(def: EnemyDef, options?: { x?: number; y?: number; entranceFx?: boolean }): Phaser.Physics.Arcade.Sprite {
    const edgeSpawn = this.getEdgeSpawnPoint();
    const spawnPoint = {
      x: options?.x ?? edgeSpawn.x,
      y: options?.y ?? edgeSpawn.y,
    };
    const x = spawnPoint.x;
    const y = spawnPoint.y;

    // Choose texture based on size
    let texture = 'zombie';
    if (def.size >= 25) texture = 'tank';
    else if (def.size <= 11) texture = 'runner';

    const enemy = this.enemies.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    if (!enemy) return enemy;

    enemy.setActive(true).setVisible(true);
    enemy.setTint(def.color);
    enemy.setDepth(def.isBoss ? 12 : 5);

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
    ed.spawnWave = this.currentWave;

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

    if (options?.entranceFx || def.isBoss) {
      const entryColor = def.isBoss ? 0xfb7185 : def.color;
      const entryFx = this.scene.add.circle(x, y, def.isBoss ? 34 : 20, entryColor, def.isBoss ? 0.26 : 0.18)
        .setDepth(def.isBoss ? 14 : 8);
      this.scene.tweens.add({
        targets: entryFx,
        alpha: 0,
        scale: def.isBoss ? 2.8 : 2.1,
        duration: def.isBoss ? 700 : 320,
        onComplete: () => entryFx.destroy(),
      });
    }

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
    const bossPoint = this.getBossSpawnPoint();
    const boss = this.spawnEnemyOfType(scaled, { x: bossPoint.x, y: bossPoint.y, entranceFx: true });
    if (!boss) return;

    const bd = boss as any;
    const isBloodMoon = !!gameState.data.isBloodMoon;
    const bloodMoonMul = isBloodMoon ? 1.8 : 1.18;
    const weekMul = 1 + Math.max(0, gameState.data.currentWeek - 1) * 0.42;
    const pressureMul = forceSecond ? 2.35 : (isBloodMoon ? 1.95 : 1.32);
    bd.health = Math.floor((bd.health || scaled.baseHealth) * bloodMoonMul * weekMul * pressureMul);
    bd.maxHealth = bd.health;
    bd.damage = Math.floor((bd.damage || scaled.baseDamage) * ((isBloodMoon ? 1.35 : 1.14) + (gameState.data.currentWeek - 1) * 0.18) * (forceSecond ? 1.28 : 1.08));
    bd.speed = Math.floor((bd.speed || scaled.speed) * (forceSecond ? 1.18 : (isBloodMoon ? 1.1 : 1.04)));
    bd.bossArmorMul = Phaser.Math.Clamp(
      (isBloodMoon ? 0.36 : 0.28) + gameState.data.currentWeek * 0.035 + this.currentWave * 0.012 + (forceSecond ? 0.08 : 0),
      isBloodMoon ? 0.38 : 0.26,
      0.78
    );
    bd.bossHitCapRatio = forceSecond ? 0.022 : (isBloodMoon ? 0.028 : 0.034);
    bd.enrageThreshold = forceSecond ? 0.62 : (isBloodMoon ? 0.48 : 0.42);

    if (forceSecond) {
      boss.setTint(0xff225f);
      boss.setScale((boss.scale || 1) * 1.08);
    }
    const alertText = isBloodMoon ? '⚠ 强敌出现 ⚠' : '⚠ 变异首领逼近 ⚠';

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
    const warnTitle = forceSecond ? '⚠ 二次首领突入 ⚠' : alertText;
    const warn = this.scene.add.text(w / 2, 60, warnTitle, {
      fontSize: '24px', color: '#fbbf24', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    const bossName = this.scene.add.text(w / 2, 90, scaled.nameCN, {
      fontSize: '36px', color: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setScale(0);

    const marker = this.scene.add.text(boss.x, boss.y - Math.max(58, boss.displayHeight * 0.7), scaled.nameCN, {
      fontSize: '16px',
      color: '#ffd166',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#3b0d17',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    }).setOrigin(0.5).setDepth(1500);
    (boss as any).bossMarker = marker;
    this.scene.tweens.add({
      targets: marker,
      alpha: { from: 0.2, to: 0.92 },
      duration: 460,
      yoyo: true,
      repeat: 2,
    });

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
