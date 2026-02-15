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

export class LootSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private drops: LootDrop[] = [];

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
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

    let dropped = false;
    for (const entry of lootTable) {
      if (Math.random() > entry.chance) continue;
      const amount = Math.max(1, Math.round(Phaser.Math.Between(entry.min, entry.max) * safeGain));
      if (amount <= 0) continue;

      if (entry.type === 'resource') {
        this.spawnResourceDrop(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), entry.id, amount);
        dropped = true;
      }
    }

    // Always drop random resources so building never starves
    const day = gameState.data.currentDay || 1;
    const baseDrops = 1 + Math.floor(day / 6) + (gameState.data.isBloodMoon ? 1 : 0) + bonusDrops;
    const extraDrops = Math.min(7, Math.max(1, Math.round(baseDrops * Math.sqrt(safeGain))));
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
    const drop = this.scene.add.sprite(x, y, texture);
    drop.setDepth(4);
    drop.setScale(0.78);
    this.scene.tweens.add({
      targets: drop, scale: 1, duration: 200, ease: 'Back.easeOut',
    });

    const lootDrop: LootDrop = {
      sprite: drop,
      type: 'resource',
      id: resourceId,
      value: amount,
      collecting: false,
    };
    this.drops.push(lootDrop);

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

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (!drop.sprite || !drop.sprite.active) {
        this.drops.splice(i, 1);
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        drop.sprite.x, drop.sprite.y,
        this.player.x, this.player.y
      );

      // Start collecting if within pickup radius
      if (!drop.collecting && dist < pickupRadius) {
        drop.collecting = true;
      }

      if (drop.collecting) {
        // Move toward player
        const angle = Phaser.Math.Angle.Between(
          drop.sprite.x, drop.sprite.y,
          this.player.x, this.player.y
        );
        const speed = Math.max(5, 300 - dist);
        drop.sprite.x += Math.cos(angle) * speed * 0.016;
        drop.sprite.y += Math.sin(angle) * speed * 0.016;

        // Collect when close enough
        if (dist < 20) {
          this.collectDrop(drop);
          // Cleanup glow if exists
          const glow = (drop.sprite as any)._glow;
          if (glow) glow.destroy();
          drop.sprite.destroy();
          this.drops.splice(i, 1);
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
      const glow = (drop.sprite as any)?._glow;
      if (glow && glow.active) glow.destroy();
      if (drop.sprite && drop.sprite.active) drop.sprite.destroy();
    }
    this.drops = [];
  }
}
