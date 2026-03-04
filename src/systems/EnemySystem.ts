/**
 * EnemySystem - Enhanced with behaviors for 10+ enemy types
 * Supports: chase, run, heavy, ranged, explode, heal, stealth, elite, boss behaviors
 */
import Phaser from 'phaser';
import { events, GameEvents } from '../utils/EventBus';
import { ENEMY_DEFS } from '../data/enemies';
import { gameState } from '../state/GameState';
import {
    ENEMY_V2_TEXTURE_KEYS,
    mapLegacyEnemyTypeToV2Archetype,
} from '../data/v2SpriteAnims';

export class EnemySystem {
    private scene: Phaser.Scene;
    private enemies: Phaser.Physics.Arcade.Group;
    private player: Phaser.Physics.Arcade.Sprite;

    // Boss state
    private bossHealthBar: Phaser.GameObjects.Graphics | null = null;
    private bossNameText: Phaser.GameObjects.Text | null = null;

    constructor(scene: Phaser.Scene, enemies: Phaser.Physics.Arcade.Group, player: Phaser.Physics.Arcade.Sprite) {
        this.scene = scene;
        this.enemies = enemies;
        this.player = player;
    }

    private isV2DirectionalAnimated(enemy: Phaser.Physics.Arcade.Sprite): boolean {
        const key = enemy.texture?.key || '';
        return key === ENEMY_V2_TEXTURE_KEYS.walker
            || key === ENEMY_V2_TEXTURE_KEYS.runner
            || key === ENEMY_V2_TEXTURE_KEYS.brute;
    }

    // Base camp bounds
    private static readonly BASE_MIN_X = 780;
    private static readonly BASE_MAX_X = 1220;
    private static readonly BASE_MIN_Y = 530;
    private static readonly BASE_MAX_Y = 970;

    private isInsideBase(x: number, y: number): boolean {
        return x > EnemySystem.BASE_MIN_X && x < EnemySystem.BASE_MAX_X &&
               y > EnemySystem.BASE_MIN_Y && y < EnemySystem.BASE_MAX_Y;
    }

    private findNearestStructure(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite | null {
        const gs = this.scene as any;
        const walls = gs?.walls?.getChildren ? gs.walls.getChildren() : [];
        const turrets = gs?.turrets?.getChildren ? gs.turrets.getChildren() : [];

        // Siege priority: turrets first, then walls.
        let nearestTurret: Phaser.Physics.Arcade.Sprite | null = null;
        let turretDist = range;
        turrets.forEach((b: any) => {
            if (!b || !b.active) return;
            const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
            if (d < turretDist) {
                turretDist = d;
                nearestTurret = b as Phaser.Physics.Arcade.Sprite;
            }
        });
        if (nearestTurret) return nearestTurret;

        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let nearDist = range;
        walls.forEach((b: any) => {
            if (!b || !b.active) return;
            const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
            if (d < nearDist) {
                nearDist = d;
                nearest = b as Phaser.Physics.Arcade.Sprite;
            }
        });
        return nearest;
    }

    public spawnEnemy(wave: number, day: number): void {
        const side = Phaser.Math.Between(0, 3);
        let x: number, y: number;
        switch (side) {
            case 0: x = Phaser.Math.Between(50, 1950); y = Phaser.Math.Between(30, 80); break;
            case 1: x = Phaser.Math.Between(1900, 1950); y = Phaser.Math.Between(50, 1450); break;
            case 2: x = Phaser.Math.Between(50, 1950); y = Phaser.Math.Between(1400, 1450); break;
            default: x = Phaser.Math.Between(30, 80); y = Phaser.Math.Between(50, 1450); break;
        }

        if (this.isInsideBase(x, y)) {
            x = Phaser.Math.Between(0, 1) === 0 ? 80 : 1920;
            y = Phaser.Math.Between(50, 1450);
        }

        const cX = Phaser.Math.Clamp(x, 50, 1950);
        const cY = Phaser.Math.Clamp(y, 50, 1450);
        const diffMult = 1 + (wave - 1) * 0.1 + (day - 1) * 0.15;

        let enemyType = 'zombie';
        let baseHealth = 30;
        let baseSpeed = 60;
        const roll = Math.random();
        if (wave >= 3 && roll < 0.2) { enemyType = 'runner'; baseHealth = 20; baseSpeed = 100; }
        else if (wave >= 5 && roll < 0.15) { enemyType = 'tank'; baseHealth = 80; baseSpeed = 35; }

        const enemy = this.enemies.get(cX, cY, enemyType) as Phaser.Physics.Arcade.Sprite;
        if (!enemy) return;

        const v2Archetype = mapLegacyEnemyTypeToV2Archetype(enemyType);
        const v2TextureKey = ENEMY_V2_TEXTURE_KEYS[v2Archetype];
        const useV2Texture = this.scene.textures.exists(v2TextureKey);

        enemy.enableBody(true, cX, cY, true, true);
        enemy.setActive(true).setVisible(true);
        enemy.setTexture(useV2Texture ? v2TextureKey : enemyType);
        enemy.setCollideWorldBounds(true);

        if (enemy.body) {
            const body = enemy.body as Phaser.Physics.Arcade.Body;
            body.setSize(24, 24);
            body.setOffset((enemy.width - 24) / 2, (enemy.height - 24) / 2);
            body.setBounce(0.1, 0.1);
        }

        const ed: any = enemy;
        ed.health = Math.floor(baseHealth * diffMult);
        ed.speed = Math.min(baseSpeed + 20, baseSpeed + (wave - 1) * 2);
        ed.enemyType = enemyType;
        ed.behavior = enemyType === 'runner' ? 'run' : enemyType === 'tank' ? 'heavy' : 'chase';
        ed.enemyAnimArchetype = v2Archetype;
        ed.dead = false;

        // Loot + damage mapping (ensure resource drops work)
        const mapId = enemyType === 'zombie' ? 'controlled' : enemyType === 'tank' ? 'heavy' : enemyType;
        const def = ENEMY_DEFS[mapId];
        if (def) {
            ed.lootTable = def.lootTable;
            ed.xpValue = def.xpValue;
            ed.damage = Math.floor(def.baseDamage * diffMult);
        }

        if (enemyType === 'tank') enemy.setScale(3);
        else enemy.setScale(2);

        const effectColor = enemyType === 'runner' ? 0xfbbf24 : enemyType === 'tank' ? 0x8b5cf6 : 0xef4444;
        const effect = this.scene.add.circle(cX, cY, 20, effectColor, 0.5);
        this.scene.tweens.add({ targets: effect, alpha: 0, scale: 2, duration: 300, onComplete: () => effect.destroy() });
    }

    public update(): void {
        let hasBossActive = false;
        this.enemies.children.each((child) => {
            const enemy = child as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active) return true;

            const ed = enemy as any;
            if (ed.dead) {
                enemy.setVelocity(0, 0);
                return true;
            }
            const speed = ed.speed || 60;
            const behavior = ed.behavior || 'chase';

            if (ed.isBoss) {
                hasBossActive = true;
                this.updateBossBehavior(enemy);
                return true;
            }

            const distToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            const structureTarget = this.findNearestStructure(enemy.x, enemy.y, 680);
            const shouldSiege = !!structureTarget && (
                gameState.data.isNight ||
                this.isInsideBase(enemy.x, enemy.y) ||
                distToPlayer > 170
            );
            if (shouldSiege && structureTarget) {
                const distToStructure = Phaser.Math.Distance.Between(enemy.x, enemy.y, structureTarget.x, structureTarget.y);
                if (distToStructure < 70) {
                    enemy.setVelocity(0, 0);
                    const now = this.scene.time.now;
                    if (!ed.lastSiegeHit || now - ed.lastSiegeHit > 650) {
                        ed.lastSiegeHit = now;
                        const gs = this.scene as any;
                        // Private method at runtime is callable from JS output.
                        gs.enemyDamageBuilding?.(enemy, structureTarget);
                    }
                } else {
                    this.scene.physics.moveToObject(enemy, structureTarget, speed * 0.95);
                    if (!this.isV2DirectionalAnimated(enemy)) {
                        enemy.setFlipX(structureTarget.x < enemy.x);
                    }
                }
                return true;
            }

            this.updateShieldRegen(enemy);

            switch (behavior) {
                case 'chase':
                case 'run':
                case 'elite': {
                    const chaseSpeed = ed.special === 'enrage_on_hit'
                        ? speed * (1 + (ed.enrageStacks || 0) * 0.06)
                        : speed;
                    this.scene.physics.moveToObject(enemy, this.player, chaseSpeed);
                    break;
                }

                case 'heavy':
                    this.scene.physics.moveToObject(enemy, this.player, speed * 0.7);
                    break;

                case 'ranged': {
                    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    if (ed.special === 'acid_pool') {
                        if (dist > 180) {
                            this.scene.physics.moveToObject(enemy, this.player, speed);
                        } else if (dist < 120) {
                            const awayAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                            enemy.setVelocity(Math.cos(awayAngle) * speed, Math.sin(awayAngle) * speed);
                        } else {
                            enemy.setVelocity(0, 0);
                            this.spitterAcidPool(enemy);
                            this.rangedAttack(enemy);
                        }
                    } else if (ed.special === 'summon_minions') {
                        if (dist > 250) {
                            this.scene.physics.moveToObject(enemy, this.player, speed * 0.8);
                        } else {
                            enemy.setVelocity(0, 0);
                            this.necromancerSummon(enemy);
                        }
                    } else if (ed.special === 'lob_attack') {
                        if (dist > 220) {
                            this.scene.physics.moveToObject(enemy, this.player, speed);
                        } else if (dist < 140) {
                            const awayAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                            enemy.setVelocity(Math.cos(awayAngle) * speed, Math.sin(awayAngle) * speed);
                        } else {
                            enemy.setVelocity(0, 0);
                            this.bomberLobAttack(enemy);
                        }
                    } else if (dist > 200) {
                        this.scene.physics.moveToObject(enemy, this.player, speed);
                    } else if (dist < 150) {
                        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    } else {
                        enemy.setVelocity(0, 0);
                        this.rangedAttack(enemy);
                    }
                    break;
                }

                case 'explode':
                    this.scene.physics.moveToObject(enemy, this.player, speed * 1.2);
                    break;

                case 'heal': {
                    const nearestAlly = this.findNearestEnemy(enemy.x, enemy.y, 300, enemy);
                    if (nearestAlly) {
                        const allyDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, nearestAlly.x, nearestAlly.y);
                        if (allyDist > 80) {
                            this.scene.physics.moveToObject(enemy, nearestAlly, speed);
                        } else {
                            enemy.setVelocity(0, 0);
                            this.healNearby(enemy);
                        }
                    } else {
                        this.scene.physics.moveToObject(enemy, this.player, speed * 0.6);
                    }
                    break;
                }

                case 'stealth': {
                    this.scene.physics.moveToObject(enemy, this.player, speed);
                    const stealthDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    if (stealthDist > 200) {
                        enemy.setAlpha(0.15);
                    } else {
                        enemy.setAlpha(0.6);
                    }

                    if (ed.special === 'life_drain' && stealthDist < 50) {
                        const now = this.scene.time.now;
                        if (!ed.lastDrain || now - ed.lastDrain > 1500) {
                            ed.lastDrain = now;
                            const drainAmount = Math.min(ed.damage || 10, 15);
                            events.emit(GameEvents.PLAYER_HIT, { damage: drainAmount });
                            ed.health = Math.min((ed.health || 18) + Math.floor(drainAmount * 0.5), (ed.maxHealth || 40));
                            const drainFx = this.scene.add.circle(enemy.x, enemy.y, 15, 0x00ff00, 0.4).setDepth(9);
                            this.scene.tweens.add({ targets: drainFx, alpha: 0, scale: 2, duration: 400, onComplete: () => drainFx.destroy() });
                        }
                    }
                    break;
                }

                default:
                    this.scene.physics.moveToObject(enemy, this.player, speed);
            }

            // Face player
            if (!this.isV2DirectionalAnimated(enemy)) {
                enemy.setFlipX(this.player.x < enemy.x);
            }
            return true;
        });

        if (!hasBossActive) {
            if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = null; }
            if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }
        }
    }

    public applySpecialOnHit(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
        const ed = enemy as any;
        if (ed.special === 'enrage_on_hit') {
            ed.enrageStacks = Math.min(10, (ed.enrageStacks || 0) + 1);
            const bonus = ed.enrageStacks * 0.08;
            ed.speed = Math.min(200, (ed.baseSpeed || ed.speed || 75) * (1 + bonus));
            ed.damage = Math.floor((ed.baseDamage || ed.damage || 14) * (1 + bonus * 0.5));
            enemy.setTint(Phaser.Display.Color.GetColor(
                Math.min(255, 200 + ed.enrageStacks * 5),
                Math.max(0, 100 - ed.enrageStacks * 10),
                0
            ));
            if (ed.enrageStacks >= 5 && !ed.enrageAlert) {
                ed.enrageAlert = true;
                const alert = this.scene.add.text(enemy.x, enemy.y - 30, '狂暴!', {
                    fontSize: '14px', color: '#ff4400', fontStyle: 'bold',
                    stroke: '#000000', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(1500);
                this.scene.tweens.add({ targets: alert, y: alert.y - 20, alpha: 0, duration: 800, onComplete: () => alert.destroy() });
            }
        }

        if (ed.special === 'shield_regen' && !ed.shieldBroken) {
            ed.shieldHp = Math.max(0, (ed.shieldHp ?? ed.health * 0.5) - damage);
            if (ed.shieldHp <= 0) {
                ed.shieldBroken = true;
                ed.shieldRegenTimer = this.scene.time.now + 5000;
                enemy.clearTint();
                const breakFx = this.scene.add.circle(enemy.x, enemy.y, 25, 0x3366cc, 0.5).setDepth(10);
                this.scene.tweens.add({ targets: breakFx, alpha: 0, scale: 2, duration: 400, onComplete: () => breakFx.destroy() });
            }
        }

        if (ed.special === 'explode_on_death' && (ed.health || 0) <= 0) {
            this.triggerExplosion(enemy);
        }
    }

    private triggerExplosion(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        const explosionRadius = 80;
        const explosionDamage = Math.max(15, (ed.damage || 30) * 0.8);

        const blast = this.scene.add.circle(enemy.x, enemy.y, explosionRadius, 0xff6600, 0.6).setDepth(50);
        this.scene.tweens.add({
            targets: blast, alpha: 0, scale: 1.5, duration: 400,
            onComplete: () => blast.destroy(),
        });
        this.scene.cameras.main.shake(150, 0.01);

        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if (dist < explosionRadius) {
            events.emit(GameEvents.PLAYER_HIT, { damage: Math.round(explosionDamage) });
        }
    }

    private spitterAcidPool(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        const now = this.scene.time.now;
        if (!ed.lastAcidPool) ed.lastAcidPool = 0;
        if (now - ed.lastAcidPool < 3000) return;
        ed.lastAcidPool = now;

        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const poolX = enemy.x + Math.cos(angle) * 60;
        const poolY = enemy.y + Math.sin(angle) * 60;

        const pool = this.scene.add.circle(poolX, poolY, 30, 0x33cc33, 0.35).setDepth(5);
        let tickCount = 0;
        const poolTimer = this.scene.time.addEvent({
            delay: 500,
            repeat: 7,
            callback: () => {
                tickCount++;
                const pDist = Phaser.Math.Distance.Between(poolX, poolY, this.player.x, this.player.y);
                if (pDist < 35) {
                    events.emit(GameEvents.PLAYER_HIT, { damage: Math.max(3, (ed.damage || 8) * 0.3) });
                }
                pool.setAlpha(Math.max(0, 0.35 - tickCount * 0.04));
                if (tickCount >= 7) {
                    pool.destroy();
                    poolTimer.destroy();
                }
            },
        });
    }

    private necromancerSummon(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        const now = this.scene.time.now;
        if (!ed.lastSummon) ed.lastSummon = 0;
        if (now - ed.lastSummon < 6000) return;
        ed.lastSummon = now;

        const text = this.scene.add.text(enemy.x, enemy.y - 30, '唤醒!', {
            fontSize: '14px', color: '#aa33ff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(1500);
        this.scene.tweens.add({ targets: text, y: text.y - 20, alpha: 0, duration: 800, onComplete: () => text.destroy() });

        const week = Math.max(1, gameState.data.currentWeek || 1);
        for (let i = 0; i < 2; i++) {
            this.scene.time.delayedCall(i * 300, () => {
                const mAngle = (i / 2) * Math.PI * 2 + Math.random() * Math.PI;
                const mx = enemy.x + Math.cos(mAngle) * 30;
                const my = enemy.y + Math.sin(mAngle) * 30;
                const minion = this.enemies.create(mx, my, 'zombie') as Phaser.Physics.Arcade.Sprite;
                if (minion) {
                    minion.setTint(0x9933ff);
                    minion.setScale(1.5);
                    (minion as any).health = Math.floor(15 + week * 5);
                    (minion as any).speed = 70 + week * 3;
                    (minion as any).damage = Math.floor(5 + week * 2);
                    (minion as any).enemyType = 'summoned';
                    (minion as any).behavior = 'chase';
                    (minion as any).xpValue = 2;
                    const spawnFx = this.scene.add.circle(mx, my, 15, 0x9933ff, 0.5).setDepth(8);
                    this.scene.tweens.add({ targets: spawnFx, alpha: 0, scale: 2, duration: 300, onComplete: () => spawnFx.destroy() });
                }
            });
        }
    }

    private bomberLobAttack(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        const now = this.scene.time.now;
        if (!ed.lastLob) ed.lastLob = 0;
        if (now - ed.lastLob < 2500) return;
        ed.lastLob = now;

        const targetX = this.player.x + Phaser.Math.Between(-40, 40);
        const targetY = this.player.y + Phaser.Math.Between(-40, 40);

        const projectile = this.scene.add.circle(enemy.x, enemy.y, 6, 0xff9933, 0.9).setDepth(12);
        this.scene.tweens.add({
            targets: projectile,
            x: targetX, y: targetY,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => {
                projectile.destroy();
                const blast = this.scene.add.circle(targetX, targetY, 40, 0xff6633, 0.5).setDepth(10);
                this.scene.tweens.add({
                    targets: blast, alpha: 0, scale: 1.5, duration: 400,
                    onComplete: () => blast.destroy(),
                });
                const dist = Phaser.Math.Distance.Between(targetX, targetY, this.player.x, this.player.y);
                if (dist < 45) {
                    events.emit(GameEvents.PLAYER_HIT, { damage: Math.max(10, (ed.damage || 22) * 0.6) });
                }
            },
        });
    }

    private updateShieldRegen(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        if (ed.special !== 'shield_regen') return;
        const now = this.scene.time.now;
        if (ed.shieldBroken && ed.shieldRegenTimer && now > ed.shieldRegenTimer) {
            ed.shieldBroken = false;
            ed.shieldHp = (ed.maxHealth || ed.health) * 0.3;
            enemy.setTint(0x3366cc);
            const regenFx = this.scene.add.circle(enemy.x, enemy.y, 20, 0x66aaff, 0.4).setDepth(9);
            this.scene.tweens.add({ targets: regenFx, alpha: 0, scale: 2, duration: 500, onComplete: () => regenFx.destroy() });
        }
        if (!ed.shieldBroken) {
            enemy.setTint(0x3366cc);
        }
    }

    private rangedAttack(enemy: Phaser.Physics.Arcade.Sprite): void {
        const ed = enemy as any;
        const now = this.scene.time.now;
        if (!ed.lastRangedAttack) ed.lastRangedAttack = 0;
        if (now - ed.lastRangedAttack < 2000) return;
        ed.lastRangedAttack = now;

        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const bullet = this.scene.add.circle(enemy.x, enemy.y, 5, 0xff00ff, 0.8);
        bullet.setDepth(10);

        const speed = 200;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.scene.tweens.add({
            targets: bullet,
            x: bullet.x + vx * 2,
            y: bullet.y + vy * 2,
            duration: 2000,
            onUpdate: () => {
                const dist = Phaser.Math.Distance.Between(bullet.x, bullet.y, this.player.x, this.player.y);
                if (dist < 20) {
                    events.emit(GameEvents.PLAYER_HIT, { damage: ed.damage || 12 });
                    bullet.destroy();
                }
            },
            onComplete: () => bullet.destroy(),
        });
    }

    private healNearby(healer: Phaser.Physics.Arcade.Sprite): void {
        const hd = healer as any;
        const now = this.scene.time.now;
        if (!hd.lastHeal) hd.lastHeal = 0;
        if (now - hd.lastHeal < 3000) return;
        hd.lastHeal = now;

        // Heal effect
        const ring = this.scene.add.circle(healer.x, healer.y, 60, 0x00ff88, 0.2);
        ring.setDepth(8);
        this.scene.tweens.add({
            targets: ring, alpha: 0, scale: 1.5, duration: 500,
            onComplete: () => ring.destroy(),
        });

        // Heal nearby enemies
        this.enemies.getChildren().forEach(e => {
            const enemy = e as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active || enemy === healer) return;
            const dist = Phaser.Math.Distance.Between(healer.x, healer.y, enemy.x, enemy.y);
            if (dist < 100) {
                const ed = enemy as any;
                ed.health = Math.min((ed.health || 30) + 10, (ed.maxHealth || 50));
            }
        });
    }

    public findNearestEnemy(x?: number, y?: number, maxRange: number = 2000, exclude?: Phaser.Physics.Arcade.Sprite): Phaser.Physics.Arcade.Sprite | null {
        const searchX = x ?? this.player.x;
        const searchY = y ?? this.player.y;
        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let minDist = maxRange;

        for (const child of this.enemies.getChildren()) {
            const enemy = child as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active || enemy === exclude) continue;
            const dist = Phaser.Math.Distance.Between(searchX, searchY, enemy.x, enemy.y);
            if (dist < minDist) { minDist = dist; nearest = enemy; }
        }
        return nearest;
    }

    // ============================================================
    // BOSS
    // ============================================================
    public spawnBoss(wave: number, _player: Phaser.Physics.Arcade.Sprite): void {
        const cx = this.scene.cameras.main.width / 2;
        const bossAnnounce = this.scene.add.text(cx, 80, '⚠️ AI核心体来袭 ⚠️', {
            fontSize: '32px', color: '#ff0000', fontFamily: 'Courier New', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.scene.cameras.main.shake(500, 0.01);
        this.scene.tweens.add({
            targets: bossAnnounce, alpha: 0, yoyo: true, repeat: 3, duration: 200,
            onComplete: () => bossAnnounce.destroy(),
        });

        this.scene.time.delayedCall(1500, () => {
            const side = Phaser.Math.Between(0, 3);
            let x: number, y: number;
            switch (side) {
                case 0: x = Phaser.Math.Between(100, 1900); y = 80; break;
                case 1: x = 1900; y = Phaser.Math.Between(100, 1400); break;
                case 2: x = Phaser.Math.Between(100, 1900); y = 1400; break;
                default: x = 100; y = Phaser.Math.Between(100, 1400); break;
            }

            const bossLevel = Math.floor(wave / 5);
            const bossTypes = ['AI核心·暴君', 'AI核心·死灵', 'AI核心·吞噬者'];
            const bossType = bossTypes[Math.min(bossLevel - 1, bossTypes.length - 1)];

            const boss = this.enemies.create(x, y, 'tank') as Phaser.Physics.Arcade.Sprite;
            boss.setScale(3);
            boss.setTint(0xff0066);

            const baseHealth = 200 + bossLevel * 100;
            (boss as any).health = baseHealth;
            (boss as any).maxHealth = baseHealth;
            (boss as any).speed = 40 + bossLevel * 5;
            (boss as any).damage = 20 + bossLevel * 5;
            (boss as any).isBoss = true;
            (boss as any).bossType = bossType;
            (boss as any).behavior = 'boss_tyrant';
            (boss as any).lastSpecialAttack = 0;
            (boss as any).isEnraged = false;

            this.createBossHealthBar(bossType);
        });
    }

    private createBossHealthBar(bossType: string): void {
        this.bossNameText = this.scene.add.text(400, 25, `💀 ${bossType} 💀`, {
            fontSize: '18px', color: '#ff0066', fontFamily: 'Courier New', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2100);

        this.bossHealthBar = this.scene.add.graphics().setScrollFactor(0).setDepth(2100);
        this.updateBossHealthBar(1, 1);
    }

    public updateBossHealthBar(current: number, max: number): void {
        if (!this.bossHealthBar) return;
        this.bossHealthBar.clear();
        const width = 300;
        const x = 400 - width / 2;
        const y = 40;
        this.bossHealthBar.fillStyle(0x000000, 0.8);
        this.bossHealthBar.fillRect(x, y, width, 10);
        const percent = Math.max(0, current / max);
        this.bossHealthBar.fillStyle(0xff0066, 1);
        this.bossHealthBar.fillRect(x, y, width * percent, 10);
        this.bossHealthBar.lineStyle(2, 0xffffff, 0.5);
        this.bossHealthBar.strokeRect(x, y, width, 10);
    }

    private updateBossBehavior(boss: Phaser.Physics.Arcade.Sprite): void {
        const bd = boss as any;
        if (!this.bossHealthBar || !this.bossNameText) {
            const bossLabel = bd?.enemyDef?.nameCN || bd?.bossType || '首领目标';
            this.createBossHealthBar(String(bossLabel));
        }
        const maxHealth = Math.max(1, bd.maxHealth || bd.health || 1);
        const hpRate = Phaser.Math.Clamp((bd.health || maxHealth) / maxHealth, 0, 1);
        const enrageThreshold = Phaser.Math.Clamp(bd.enrageThreshold ?? 0.45, 0.2, 0.8);
        if (!bd.isEnraged && hpRate <= enrageThreshold) {
            bd.isEnraged = true;
            const alert = this.scene.add.text(boss.x, boss.y - 70, '首领狂暴!', {
                fontSize: '18px',
                color: '#fb7185',
                fontFamily: 'Courier New',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(1900);
            this.scene.tweens.add({
                targets: alert,
                y: alert.y - 24,
                alpha: 0,
                duration: 900,
                onComplete: () => alert.destroy(),
            });
            this.scene.cameras.main.shake(260, 0.01);
        }
        const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
        const speed = ((boss as any).speed || 40) * (bd.isEnraged ? 1.16 : 1);

        this.updateBossHealthBar((boss as any).health, (boss as any).maxHealth);

        if (dist > 100) {
            this.scene.physics.moveToObject(boss, this.player, speed);
        } else {
            boss.setVelocity(0, 0);
        }

        const curTime = this.scene.time.now;
        const lastAttack = (boss as any).lastSpecialAttack || 0;
        const cooldown = (boss as any).isEnraged ? 1300 : 2600;

        if (curTime - lastAttack > cooldown) {
            (boss as any).lastSpecialAttack = curTime;
            this.bossSpecialAttack(boss);
        }

        boss.setFlipX(this.player.x < boss.x);
    }

    private bossSpecialAttack(boss: Phaser.Physics.Arcade.Sprite): void {
        const bd = boss as any;
        const baseDamage = Math.max(12, bd.damage || 20);
        const week = Math.max(1, gameState.data.currentWeek || 1);
        const rageMul = bd.isEnraged ? 1.2 : 1;
        const bossType = (boss as any).bossType;
        const attackType = Phaser.Math.RND.pick(['summon', 'aoe', 'charge']);

        if (attackType === 'summon' || bossType === 'AI核心·死灵') {
            const text = this.scene.add.text(boss.x, boss.y - 40, '召唤傀儡!', { fontSize: '18px', color: '#8b5cf6' }).setOrigin(0.5);
            this.scene.tweens.add({ targets: text, y: text.y - 20, alpha: 0, duration: 800, onComplete: () => text.destroy() });

            for (let i = 0; i < 3; i++) {
                this.scene.time.delayedCall(i * 200, () => {
                    const angle = (i / 3) * Math.PI * 2;
                    const mx = boss.x + Math.cos(angle) * 40;
                    const my = boss.y + Math.sin(angle) * 40;
                    const minion = this.enemies.create(mx, my, 'zombie') as Phaser.Physics.Arcade.Sprite;
                    if (minion) {
                        minion.setTint(0x8b5cf6);
                        (minion as any).health = Math.floor((26 + week * 10) * rageMul);
                        (minion as any).speed = Math.floor(92 + week * 6);
                        (minion as any).damage = Math.floor((7 + week * 2) * rageMul);
                        (minion as any).enemyType = 'minion';
                        (minion as any).behavior = 'chase';
                    }
                });
            }
        } else if (attackType === 'aoe' || bossType === 'AI核心·吞噬者') {
            const text = this.scene.add.text(boss.x, boss.y - 40, '震荡冲击!', { fontSize: '18px', color: '#ef4444' }).setOrigin(0.5);
            this.scene.tweens.add({ targets: text, y: text.y - 20, alpha: 0, duration: 800, onComplete: () => text.destroy() });

            const shockwave = this.scene.add.circle(boss.x, boss.y, 30, 0xff0000, 0.5).setDepth(50);
            this.scene.tweens.add({
                targets: shockwave, scale: 4, alpha: 0, duration: 500,
                onComplete: () => {
                    shockwave.destroy();
                    if (Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y) < 120) {
                        events.emit(GameEvents.PLAYER_HIT, { damage: Math.max(14, Math.round(baseDamage * 0.7 * rageMul)) });
                        this.scene.cameras.main.shake(200, 0.02);
                    }
                },
            });
        } else {
            const text = this.scene.add.text(boss.x, boss.y - 40, '狂暴冲锋!', { fontSize: '18px', color: '#fbbf24' }).setOrigin(0.5);
            this.scene.tweens.add({ targets: text, y: text.y - 20, alpha: 0, duration: 800, onComplete: () => text.destroy() });

            this.scene.tweens.add({
                targets: boss, x: this.player.x, y: this.player.y, duration: 400, ease: 'Quad.easeIn',
                onComplete: () => {
                    const impact = this.scene.add.circle(boss.x, boss.y, 40, 0xfbbf24, 0.5);
                    this.scene.tweens.add({ targets: impact, scale: 2, alpha: 0, duration: 300, onComplete: () => impact.destroy() });
                    if (Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y) < 50) {
                        events.emit(GameEvents.PLAYER_HIT, { damage: Math.max(18, Math.round(baseDamage * 0.95 * rageMul)) });
                    }
                },
            });
        }
    }

    public onBossKilled(boss: Phaser.Physics.Arcade.Sprite): void {
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const x = boss.x + Math.cos(angle) * 20;
            const y = boss.y + Math.sin(angle) * 20;
            this.scene.time.delayedCall(i * 50, () => this.createDeathEffect(x, y));
        }

        this.scene.cameras.main.shake(500, 0.03);

        if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = null; }
        if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }

        const cx = this.scene.cameras.main.width / 2;
        const victoryText = this.scene.add.text(cx, 100, '🏆 AI核心已击溃! 🏆', {
            fontSize: '32px', color: '#4ade80', fontFamily: 'Courier New', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
        this.scene.tweens.add({ targets: victoryText, alpha: 0, y: 70, duration: 2000, onComplete: () => victoryText.destroy() });

        boss.disableBody(true, true);
    }

    private createDeathEffect(x: number, y: number): void {
        const flash = this.scene.add.circle(x, y, 20, 0xffff00, 0.6).setDepth(100);
        this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2.5, duration: 200, onComplete: () => flash.destroy() });
    }
}
