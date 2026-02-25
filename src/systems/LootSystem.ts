/**
 * LootSystem - XP gems, resource drops, item pickups
 * Vampire Survivors style auto-collection
 */
import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import type { LootEntry } from '../data/enemies';

interface LootDrop {
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
  type: 'xp' | 'resource' | 'item';
  id: string;
  value: number;
  collecting: boolean;
}

interface LootCollectorTarget {
  x: number;
  y: number;
  radius: number;
}

export class LootSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private drops: LootDrop[] = [];
  private companionCollectors: LootCollectorTarget[] = [];
  private readonly resourceAccentColor: Record<string, number> = {
    wood: 0xb77b45,
    metal: 0x90a4b7,
    food: 0xd5a557,
    water: 0x5aa7d6,
    scrap: 0x7d8fa4,
    medical: 0xc46a6a,
    ammo: 0xcf9154,
    energyCore: 0x9d84e6,
  };
  private readonly resourceShortLabel: Record<string, string> = {
    wood: '木',
    metal: '金',
    food: '食',
    water: '水',
    scrap: '件',
    medical: '医',
    ammo: '弹',
    energyCore: '核',
  };
  private readonly resourceDisplayLabel: Record<string, string> = {
    wood: '木材',
    metal: '金属',
    food: '食物',
    water: '净水',
    scrap: '零件',
    medical: '医疗',
    ammo: '弹药',
    energyCore: '能核',
  };

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
  }

  setCompanionCollectors(collectors: LootCollectorTarget[]): void {
    this.companionCollectors = collectors
      .filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y))
      .map((item) => ({
        x: item.x,
        y: item.y,
        radius: Math.max(36, Math.floor(item.radius || 72)),
      }));
  }

  /**
   * Spawn XP gem at position
   */
  spawnXPGem(x: number, y: number, xpValue: number): void {
    const size = Math.min(4 + xpValue / 10, 8);
    const color = xpValue >= 25 ? 0xa855f7 : xpValue >= 10 ? 0x3b82f6 : 0x22c55e;

    const gem = this.scene.add.circle(x, y, size, color, 0.9);
    gem.setDepth(4);

    // Inner glow
    const glow = this.scene.add.circle(x, y, size * 0.5, 0xffffff, 0.6);
    glow.setDepth(4);

    // Pop-in animation
    gem.setScale(0);
    glow.setScale(0);
    this.scene.tweens.add({
      targets: [gem, glow],
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    const drop: LootDrop = {
      sprite: gem,
      type: 'xp',
      id: 'xp',
      value: xpValue,
      collecting: false,
    };
    this.drops.push(drop);

    // Store glow ref for cleanup
    (gem as any)._glow = glow;

    // Auto-collect after delay
    this.scene.time.delayedCall(500, () => {
      drop.collecting = true;
    });
  }

  /**
   * Spawn resource drops from loot table
   */
  spawnLoot(
    x: number,
    y: number,
    lootTable?: LootEntry[],
    bonusDrops: number = 0,
    gainMultiplier: number = 1
  ): void {
    if (!lootTable) return;
    const safeGain = Phaser.Math.Clamp(gainMultiplier || 1, 0.45, 2.5);
    const mergedDrops: Map<string, number> = new Map();

    let dropped = false;
    for (const entry of lootTable) {
      if (Math.random() > entry.chance) continue;
      const amount = Math.max(1, Math.round(Phaser.Math.Between(entry.min, entry.max) * safeGain));
      if (amount <= 0) continue;

      if (entry.type === 'resource') {
        mergedDrops.set(entry.id, (mergedDrops.get(entry.id) || 0) + amount);
        dropped = true;
      }
    }

    // Merge same-resource drops to reduce on-screen clutter and improve readability.
    let mergedIndex = 0;
    mergedDrops.forEach((amount, id) => {
      this.spawnResourceDrop(
        x + Phaser.Math.Between(-18, 18) + mergedIndex * 3,
        y + Phaser.Math.Between(-16, 16) - mergedIndex * 2,
        id,
        amount
      );
      mergedIndex += 1;
    });

    // Always drop some random resources so building never starves, but keep count controlled.
    const day = gameState.data.currentDay || 1;
    const baseDrops = 1 + Math.floor(day / 8) + (gameState.data.isBloodMoon ? 1 : 0) + bonusDrops;
    const extraDrops = Phaser.Math.Clamp(
      Math.round(baseDrops * (0.55 + safeGain * 0.35)),
      1,
      4
    );
    for (let i = 0; i < extraDrops; i++) {
      this.spawnRandomResourceDrop(x, y, safeGain);
    }

    // Fallback: ensure at least one small resource drop so players always see rewards
    if (!dropped) {
      const fallback = lootTable.find(entry => entry.type === 'resource');
      if (fallback) {
        this.spawnResourceDrop(
          x + Phaser.Math.Between(-10, 10),
          y + Phaser.Math.Between(-10, 10),
          fallback.id,
          Math.max(1, Math.round(1 * safeGain))
        );
      }
    }
  }

  private spawnRandomResourceDrop(x: number, y: number, gainMultiplier: number = 1): void {
    const pool: Array<{ id: string; weight: number; min: number; max: number }> = [
      { id: 'wood', weight: 18, min: 1, max: 3 },
      { id: 'scrap', weight: 18, min: 1, max: 3 },
      { id: 'food', weight: 16, min: 1, max: 3 },
      { id: 'metal', weight: 10, min: 1, max: 2 },
      { id: 'water', weight: 8, min: 1, max: 2 },
      { id: 'medical', weight: 6, min: 1, max: 2 },
      { id: 'ammo', weight: 6, min: 1, max: 2 },
      { id: 'energyCore', weight: 2, min: 1, max: 1 },
    ];

    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    let chosen = pool[0];
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) {
        chosen = p;
        break;
      }
    }
    const amount = Math.max(1, Math.round(Phaser.Math.Between(chosen.min, chosen.max) * gainMultiplier));
    this.spawnResourceDrop(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-12, 12), chosen.id, amount);
  }

  private spawnResourceDrop(x: number, y: number, resourceId: string, amount: number): void {
    const textureMap: Record<string, string> = {
      wood: 'loot_wood',
      metal: 'loot_metal',
      food: 'loot_food',
      water: 'loot_water',
      scrap: 'loot_scrap',
      medical: 'loot_medical',
      ammo: 'loot_ammo',
      energyCore: 'loot_core',
    };
    const texture = textureMap[resourceId] || 'loot_scrap';
    const accentColor = this.resourceAccentColor[resourceId] || 0x7d8fa4;

    const badge = this.scene.add.rectangle(x, y, 28, 28, 0x030712, 0.92)
      .setStrokeStyle(1, accentColor, 0.9)
      .setDepth(3.78);

    const glow = this.scene.add.circle(x, y, 10, accentColor, 0.11).setDepth(3.8);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.18 },
      duration: 980,
      yoyo: true,
      repeat: -1,
    });

    const drop = this.scene.add.sprite(x, y, texture);
    drop.setDepth(4);
    drop.setScale(1.2);
    this.scene.tweens.add({
      targets: drop, scale: 1.26, duration: 190, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: drop,
      y: drop.y - 1.5,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const displayName = this.resourceShortLabel[resourceId] || this.resourceDisplayLabel[resourceId] || '资';
    const amountText = Math.max(1, Math.round(amount));
    const tag = this.scene.add.text(
      x,
      y + 13,
      `${displayName}x${amountText}`,
      {
        fontSize: '14px',
        color: '#e2e8f0',
        fontFamily: 'PingFang SC, "Microsoft YaHei", sans-serif',
        backgroundColor: '#020712cc',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }
    ).setOrigin(0.5, 0).setDepth(4.3);
    tag.setStroke('#000000', 3);
    tag.setVisible(false);
    tag.setAlpha(0);

    const lootDrop: LootDrop = {
      sprite: drop,
      type: 'resource',
      id: resourceId,
      value: amount,
      collecting: false,
    };
    this.drops.push(lootDrop);
    (drop as any)._badge = badge;
    (drop as any)._glow = glow;
    (drop as any)._tag = tag;

    // Auto-collect after brief delay
    this.scene.time.delayedCall(300, () => {
      lootDrop.collecting = true;
    });
  }

  /**
   * Update - move collecting items toward player
   */
  update(): void {
    const pickupRadius = gameState.getComputedStats().pickupRadius;
    const tagRevealRadius = Math.min(115, Math.max(58, pickupRadius * 0.85));
    const maxVisibleTags = this.scene.scale.width <= 540
      ? 2
      : this.scene.scale.width <= 960
        ? 3
        : 5;
    const tagCandidates: Array<{ drop: LootDrop; distance: number }> = [];
    const getNearestCollector = (
      x: number,
      y: number
    ): { x: number; y: number; radius: number; distance: number } => {
      let nearest = {
        x: this.player.x,
        y: this.player.y,
        radius: pickupRadius,
        distance: Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y),
      };
      for (const collector of this.companionCollectors) {
        const distance = Phaser.Math.Distance.Between(x, y, collector.x, collector.y);
        if (distance < nearest.distance) {
          nearest = {
            x: collector.x,
            y: collector.y,
            radius: collector.radius,
            distance,
          };
        }
      }
      return nearest;
    };

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (!drop.sprite || !drop.sprite.active) {
        this.drops.splice(i, 1);
        continue;
      }

      const nearestCollector = getNearestCollector(drop.sprite.x, drop.sprite.y);
      const dist = nearestCollector.distance;
      const tag = (drop.sprite as any)._tag as Phaser.GameObjects.Text | undefined;
      const shouldRevealTag = drop.type === 'resource' && (dist <= tagRevealRadius || drop.collecting);
      if (shouldRevealTag && tag && tag.active) {
        tagCandidates.push({ drop, distance: dist });
      }

      // Start collecting if within pickup radius
      if (!drop.collecting && dist < nearestCollector.radius) {
        drop.collecting = true;
      }

      if (drop.collecting) {
        // Move toward player
        const angle = Phaser.Math.Angle.Between(
          drop.sprite.x, drop.sprite.y,
          nearestCollector.x, nearestCollector.y
        );
        const speed = Math.max(5, 300 - dist);
        drop.sprite.x += Math.cos(angle) * speed * 0.016;
        drop.sprite.y += Math.sin(angle) * speed * 0.016;
        const badge = (drop.sprite as any)._badge as Phaser.GameObjects.Rectangle | undefined;
        if (badge && badge.active) {
          badge.x = drop.sprite.x;
          badge.y = drop.sprite.y;
        }
        const glow = (drop.sprite as any)._glow as Phaser.GameObjects.Arc | undefined;
        if (glow && glow.active) {
          glow.x = drop.sprite.x;
          glow.y = drop.sprite.y;
        }

        // Collect when close enough
        if (dist < 20) {
          this.collectDrop(drop);
          // Cleanup glow if exists
          const badge = (drop.sprite as any)._badge;
          if (badge) badge.destroy();
          const glow = (drop.sprite as any)._glow;
          if (glow) glow.destroy();
          const tag = (drop.sprite as any)._tag;
          if (tag) tag.destroy();
          drop.sprite.destroy();
          this.drops.splice(i, 1);
        }
      }
    }

    // Reduce text clutter: only the nearest few resource labels are visible at once.
    tagCandidates.sort((a, b) => a.distance - b.distance);
    const visibleDrops = new Set<LootDrop>(
      tagCandidates.slice(0, maxVisibleTags).map((entry) => entry.drop)
    );

    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];
      if (!drop?.sprite?.active) continue;
      const tag = (drop.sprite as any)._tag as Phaser.GameObjects.Text | undefined;
      if (!tag || !tag.active) continue;
      if (visibleDrops.has(drop)) {
        tag.setVisible(true);
        tag.x = drop.sprite.x;
        tag.y = drop.sprite.y + 13;
        tag.alpha = Math.min(1, tag.alpha + 0.22);
      } else {
        tag.alpha = Math.max(0, tag.alpha - 0.2);
        if (tag.alpha <= 0.04) {
          tag.setVisible(false);
        }
      }
    }
  }

  private collectDrop(drop: LootDrop): void {
    if (drop.type === 'xp') {
      const leveledUp = gameState.addExperience(drop.value);
      events.emit(GameEvents.PLAYER_EXP_CHANGE, {
        current: gameState.data.playerExp,
        max: gameState.data.expToNextLevel,
      });
      if (leveledUp) {
        events.emit(GameEvents.PLAYER_LEVEL_UP, { level: gameState.data.playerLevel });
      }
    } else if (drop.type === 'resource') {
      gameState.addResource(drop.id as any, drop.value);
      gameState.data.stats.resourcesGathered += drop.value;
      events.emit(GameEvents.LOOT_COLLECTED, {
        type: drop.id,
        amount: drop.value,
      });
      events.emit('update-resources', gameState.data.resources);
    }
  }

  destroy(): void {
    for (const drop of this.drops) {
      const badge = (drop.sprite as any)?._badge;
      if (badge && badge.active) badge.destroy();
      const glow = (drop.sprite as any)?._glow;
      if (glow && glow.active) glow.destroy();
      const tag = (drop.sprite as any)?._tag;
      if (tag && tag.active) tag.destroy();
      if (drop.sprite && drop.sprite.active) drop.sprite.destroy();
    }
    this.drops = [];
  }
}
