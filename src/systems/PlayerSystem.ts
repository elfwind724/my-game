import Phaser from 'phaser';
import { events, GameEvents } from '../utils/EventBus';
import { EvolutionSystem } from './EvolutionSystem';

export class PlayerSystem {
    private scene: Phaser.Scene;
    private player: Phaser.Physics.Arcade.Sprite;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

    // WASD keys
    private keyW!: Phaser.Input.Keyboard.Key;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyS!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;

    // Player stats
    private maxHealth: number = 100;
    private currentHealth: number = 100;
    private isInvincible: boolean = false;
    private movementEnabled: boolean = true;
    private virtualMove: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
    private upgrades: any; // Reference to upgrades object
    private statSyncAccumulator: number = 0;
    private regenAccumulator: number = 0;

    constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite, cursors: Phaser.Types.Input.Keyboard.CursorKeys, upgrades: any) {
        this.scene = scene;
        this.player = player;
        this.cursors = cursors;
        this.upgrades = upgrades;

        // WASD support
        const kb = scene.input.keyboard!;
        this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // Listen for damage/heal events
        events.on(GameEvents.PLAYER_HIT, this.onPlayerHit, this);
        events.on(GameEvents.PLAYER_HEAL_REQUEST, this.onHealRequested, this);

        this.syncDerivedStats(true);
        this.currentHealth = this.maxHealth;
        events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
    }

    public update(): void {
        if (!this.player.active) return;
        const delta = this.scene.game.loop?.delta || 16;
        this.statSyncAccumulator += delta;
        if (this.statSyncAccumulator >= 250) {
            this.statSyncAccumulator = 0;
            this.syncDerivedStats(false);
        }

        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (!this.movementEnabled) {
            body.setVelocity(0, 0);
            return;
        }

        const computed = EvolutionSystem.getComputedStats();
        const moveSpeed = (computed.moveSpeed || 200) + (this.upgrades.moveSpeedBonus * 25);

        let moveX = 0;
        let moveY = 0;
        const left = this.cursors.left.isDown || this.keyA.isDown;
        const right = this.cursors.right.isDown || this.keyD.isDown;
        const up = this.cursors.up.isDown || this.keyW.isDown;
        const down = this.cursors.down.isDown || this.keyS.isDown;
        if (left) moveX -= 1;
        if (right) moveX += 1;
        if (up) moveY -= 1;
        if (down) moveY += 1;

        // Use virtual stick direction when no keyboard direction is pressed.
        if (moveX === 0 && moveY === 0) {
            moveX = this.virtualMove.x;
            moveY = this.virtualMove.y;
            if (Math.abs(moveX) < 0.08) moveX = 0;
            if (Math.abs(moveY) < 0.08) moveY = 0;
        }

        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        if (length > 1) {
            moveX /= length;
            moveY /= length;
        }
        body.setVelocity(moveX * moveSpeed, moveY * moveSpeed);
        if (moveX < -0.05) this.player.setFlipX(true);
        else if (moveX > 0.05) this.player.setFlipX(false);

        const regenPerSecond = Math.max(0, (computed.regen || 0) + (this.upgrades.healthRegen || 0) * 0.35);
        if (regenPerSecond > 0 && this.currentHealth > 0 && this.currentHealth < this.maxHealth) {
            this.regenAccumulator += delta;
            if (this.regenAccumulator >= 1000) {
                const ticks = Math.floor(this.regenAccumulator / 1000);
                this.regenAccumulator -= ticks * 1000;
                this.heal(regenPerSecond * ticks);
            }
        } else {
            this.regenAccumulator = 0;
        }
    }

    private onPlayerHit(data: { damage: number }): void {
        if (this.isInvincible || this.currentHealth <= 0) return;

        const computed = EvolutionSystem.getComputedStats();
        const armor = Math.max(0, computed.armor || 0);
        const reduced = data.damage * (100 / (100 + armor * 7));
        const finalDamage = Math.max(1, Math.round(reduced));

        this.currentHealth = Math.max(0, this.currentHealth - finalDamage);
        events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
        this.scene.cameras.main.shake(200, 0.01);

        if (this.currentHealth <= 0) {
            events.emit(GameEvents.GAME_OVER);
            this.player.setTint(0x555555);
            this.player.setVelocity(0, 0);
            this.scene.physics.pause();
        }
    }

    public heal(amount: number): void {
        if (this.currentHealth <= 0) return;
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
    }

    public setInvincible(value: boolean): void {
        this.isInvincible = value;
    }

    public getHealth(): number {
        return this.currentHealth;
    }

    public reset(): void {
        this.syncDerivedStats(true);
        this.currentHealth = this.maxHealth;
        this.isInvincible = false;
        this.movementEnabled = true;
        this.virtualMove.set(0, 0);
        this.regenAccumulator = 0;
        this.statSyncAccumulator = 0;
        this.player.clearTint();
        this.player.setActive(true);
        this.player.setVisible(true);
        if (this.player.body) this.player.body.enable = true;
        events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
    }

    public healPlayer(amount: number): void {
        this.heal(amount);
    }

    public setMovementEnabled(enabled: boolean): void {
        this.movementEnabled = enabled;
        if (!enabled) this.virtualMove.set(0, 0);
    }

    public setVirtualDirection(x: number, y: number): void {
        this.virtualMove.set(Phaser.Math.Clamp(x, -1, 1), Phaser.Math.Clamp(y, -1, 1));
    }

    private onHealRequested(data: { amount: number }): void {
        this.heal(data.amount);
    }

    private syncDerivedStats(forceFullRefill: boolean): void {
        const computed = EvolutionSystem.getComputedStats();
        const nextMax = Math.max(60, Math.round(computed.maxHealth || 100));
        if (forceFullRefill) {
            this.maxHealth = nextMax;
            this.currentHealth = nextMax;
            events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
            return;
        }

        if (nextMax === this.maxHealth) return;
        const ratio = this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 1;
        this.maxHealth = nextMax;
        this.currentHealth = Phaser.Math.Clamp(Math.round(this.maxHealth * ratio), 1, this.maxHealth);
        events.emit(GameEvents.PLAYER_HEALTH_CHANGE, { current: this.currentHealth, max: this.maxHealth });
    }
}
