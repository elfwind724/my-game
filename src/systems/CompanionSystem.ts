import Phaser from 'phaser';
import {
    BulletEffect,
    CompanionConfig,
    CompanionRole,
    generateRandomCompanion,
    BULLET_EFFECTS
} from '../types/SkillTypes';
import { gameState, type CompanionData } from '../state/GameState';
import { events, GameEvents } from '../utils/EventBus';
import {
    getCompanionMilestoneBonuses,
    getReachedCompanionMilestone,
} from '../data/companionMilestones';

interface CompanionInstance {
    id: string;
    config: CompanionConfig;
    sprite: Phaser.Physics.Arcade.Sprite;
    lastFire: number;
    lastHeal: number;
    lastPattern: number;
    killCount: number;
    nextLevelKills: number;
    damageProgress: number;
    baseDamage: number;
    baseFireRate: number;
    baseRange: number;
    baseHealth: number;
    baseBulletDamage: number;
    baseBulletColor: number;
    baseTextureKey: string;
}

type CompanionProgressResult = {
    leveledUp: boolean;
    level: number;
    name: string;
    tint: number;
    milestoneLevel?: number;
    milestoneTitleCN?: string;
    milestoneDetailCN?: string;
    promoted?: boolean;
    advancedClass?: string;
    reachedMax?: boolean;
} | null;

type CompanionAssistProgress = {
    companionId: string;
    progress: CompanionProgressResult;
};

interface AdvancedClassDef {
    nameCN: string;
    damageMul: number;
    fireRateMul: number;
    rangeMul: number;
    hpMul: number;
    speedMul: number;
    bonusPierce?: number;
    bonusExplosionRadius?: number;
    bonusHoming?: number;
}

const ROLE_DEFINITIONS: Record<CompanionRole, { hp: number; range: number; fireRate: number; color: number; speed: number }> = {
    tank: { hp: 240, range: 260, fireRate: 760, color: 0x3b82f6, speed: 120 },
    sniper: { hp: 110, range: 760, fireRate: 1500, color: 0x10b981, speed: 155 },
    medic: { hp: 140, range: 420, fireRate: 980, color: 0xf43f5e, speed: 165 }
};

const LEVEL_COLOR_CYCLE: number[] = [
    0x7dd3fc, 0x38bdf8, 0x22d3ee, 0x34d399,
    0xfacc15, 0xfb923c, 0xf472b6, 0xa78bfa
];

const COMPANION_PROMOTION_LEVEL = 20;
const COMPANION_MAX_LEVEL = 40;
const ROLE_ADVANCED_CLASSES: Record<CompanionRole, AdvancedClassDef[]> = {
    tank: [
        { nameCN: '堡垒先锋', damageMul: 1.22, fireRateMul: 0.92, rangeMul: 1.08, hpMul: 1.38, speedMul: 1.05, bonusExplosionRadius: 26 },
        { nameCN: '震荡破阵者', damageMul: 1.34, fireRateMul: 0.94, rangeMul: 1.02, hpMul: 1.2, speedMul: 1.08, bonusExplosionRadius: 38 },
        { nameCN: '泰坦守望', damageMul: 1.18, fireRateMul: 0.86, rangeMul: 1.14, hpMul: 1.46, speedMul: 1.0, bonusExplosionRadius: 18 },
    ],
    sniper: [
        { nameCN: '鹰眼裁决者', damageMul: 1.42, fireRateMul: 0.95, rangeMul: 1.26, hpMul: 1.06, speedMul: 1.08, bonusPierce: 2 },
        { nameCN: '轨道狙猎手', damageMul: 1.34, fireRateMul: 0.88, rangeMul: 1.32, hpMul: 1.0, speedMul: 1.1, bonusPierce: 3 },
        { nameCN: '幻影穿刺者', damageMul: 1.28, fireRateMul: 0.82, rangeMul: 1.2, hpMul: 1.02, speedMul: 1.16, bonusPierce: 2 },
    ],
    medic: [
        { nameCN: '圣疗指挥官', damageMul: 1.2, fireRateMul: 0.84, rangeMul: 1.18, hpMul: 1.22, speedMul: 1.14, bonusHoming: 0.06 },
        { nameCN: '纳米战地医官', damageMul: 1.24, fireRateMul: 0.86, rangeMul: 1.14, hpMul: 1.2, speedMul: 1.1, bonusHoming: 0.08 },
        { nameCN: '急救突击手', damageMul: 1.3, fireRateMul: 0.9, rangeMul: 1.08, hpMul: 1.12, speedMul: 1.2, bonusHoming: 0.05 },
    ],
};

export class CompanionSystem {
    private readonly companions: CompanionInstance[] = [];

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly group: Phaser.Physics.Arcade.Group,
        private readonly player: Phaser.Physics.Arcade.Sprite
    ) {}

    /**
     * Adds a companion. Accepts either a CompanionConfig or legacy role string for backwards compatibility.
     * Returns the resolved config so callers can store additional metadata if needed.
     */
    public addCompanion(
        x: number,
        y: number,
        configOrRole?: CompanionConfig | CompanionRole
    ): CompanionConfig {
        const config = this.resolveConfig(configOrRole);
        config.level = Phaser.Math.Clamp(Math.max(1, config.level || 1), 1, COMPANION_MAX_LEVEL);
        config.promotionTier = config.promotionTier === 1 || !!config.advancedClass ? 1 : 0;
        const textureKey = this.resolveCompanionTextureKey(config);
        config.textureKey = textureKey;
        const sprite = this.group.create(x, y, textureKey) as Phaser.Physics.Arcade.Sprite;
        sprite.setScale(textureKey === 'companion' ? 2.15 : 2.25);
        if (textureKey === 'companion') {
            sprite.setTint(config.bulletEffect.color ?? 0xffffff);
        } else {
            sprite.clearTint();
        }
        sprite.setCollideWorldBounds(true);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.setSize(22, 24);
        body.setOffset((sprite.width - 22) / 2, (sprite.height - 24) / 2);
        body.setDrag(220, 220);
        body.setMaxVelocity(260, 260);
        const stats = config.stats;
        (sprite as any).maxHealth = stats.health;
        (sprite as any).health = stats.health;

        const companion: CompanionInstance = {
            id: config.id,
            config,
            sprite,
            lastFire: 0,
            lastHeal: 0,
            lastPattern: 0,
            killCount: 0,
            nextLevelKills: this.getKillsToNextLevel(config.level),
            damageProgress: 0,
            baseDamage: this.inferBaseValue(config.stats.damage, config.level, 1.08),
            baseFireRate: config.stats.fireRate,
            baseRange: this.inferBaseValue(config.stats.range, config.level, 1.02),
            baseHealth: this.inferBaseValue(config.stats.health, config.level, 1.09),
            baseBulletDamage: this.inferBaseValue(config.bulletEffect.damage, config.level, 1.08),
            baseBulletColor: config.bulletEffect.color ?? 0xffffff,
            baseTextureKey: textureKey,
        };
        this.applyLevelScaling(companion);

        this.companions.push(companion);
        return config;
    }

    public getConfigs(): CompanionConfig[] {
        return this.companions.filter(c => c.sprite.active).map(c => c.config);
    }

    public hasCompanion(id: string): boolean {
        return this.companions.some(c => c.id === id);
    }

    public setCompanionActive(id: string, active: boolean, x?: number, y?: number): void {
        const comp = this.companions.find(c => c.id === id);
        if (!comp) return;
        if (active) {
            comp.sprite.enableBody(true, x ?? comp.sprite.x, y ?? comp.sprite.y, true, true);
            comp.sprite.setVisible(true);
            comp.sprite.setActive(true);
        } else {
            comp.sprite.disableBody(true, true);
            comp.sprite.setVisible(false);
            comp.sprite.setActive(false);
        }
    }

    public buildConfigFromData(data: CompanionData): CompanionConfig {
        const role = data.role || 'tank';
        const roleStats = ROLE_DEFINITIONS[role];
        const baseEffect = BULLET_EFFECTS[data.bulletEffect as keyof typeof BULLET_EFFECTS] || BULLET_EFFECTS.normal;
        const level = Phaser.Math.Clamp(Math.max(1, data.level || 1), 1, COMPANION_MAX_LEVEL);
        return {
            id: data.id,
            name: data.name,
            level,
            textureKey: data.textureKey,
            advancedClass: data.advancedClass,
            promotionTier: data.promotionTier === 1 || !!data.advancedClass ? 1 : 0,
            role,
            bulletEffect: {
                ...baseEffect,
                damage: baseEffect.damage + level * 2
            },
            stats: {
                damage: 10 + level * 2,
                fireRate: roleStats.fireRate,
                range: roleStats.range,
                health: roleStats.hp + level * 8,
                speed: roleStats.speed
            }
        };
    }

    public registerKill(companionId: string): CompanionProgressResult {
        const comp = this.companions.find(c => c.id === companionId);
        if (!comp || !comp.sprite.active) return null;
        comp.killCount += 1.45;
        return this.resolveCompanionProgress(comp);
    }

    public registerDamage(companionId: string, dealtDamage: number): CompanionProgressResult {
        const comp = this.companions.find(c => c.id === companionId);
        if (!comp || !comp.sprite.active) return null;
        const safeDamage = Math.max(0, dealtDamage || 0);
        if (safeDamage <= 0) return null;
        if (comp.config.level >= COMPANION_MAX_LEVEL) {
            return {
                leveledUp: false,
                level: COMPANION_MAX_LEVEL,
                name: comp.config.name,
                tint: comp.config.bulletEffect.color ?? 0xffffff,
                reachedMax: true,
                advancedClass: comp.config.advancedClass,
            };
        }
        const level = Math.max(1, comp.config.level || 1);
        const damagePerProgress = 56 + level * 3.2;
        const roleBonus = comp.config.role === 'sniper' ? 0.12 : comp.config.role === 'medic' ? 0.08 : 0.1;
        const gain = Phaser.Math.Clamp(0.14 + safeDamage / Math.max(16, damagePerProgress) + roleBonus, 0.14, 2.6);
        comp.damageProgress += safeDamage;
        comp.killCount += gain;
        return this.resolveCompanionProgress(comp);
    }

    public registerTeamAssistKill(weight: number = 0.42, maxCompanions: number = 3): CompanionAssistProgress[] {
        const active = this.companions
            .filter(comp => comp.sprite.active && comp.config.level < COMPANION_MAX_LEVEL)
            .sort((a, b) => (a.config.level || 1) - (b.config.level || 1));
        if (active.length <= 0) return [];

        const credit = Phaser.Math.Clamp(weight, 0.15, 0.95);
        const cap = Phaser.Math.Clamp(maxCompanions, 1, active.length);
        const targets = active.slice(0, cap);
        const results: CompanionAssistProgress[] = [];
        targets.forEach((comp, idx) => {
            const roleBoost = comp.config.role === 'sniper' ? 1.06 : comp.config.role === 'medic' ? 1.0 : 1.04;
            const splitPenalty = 1 - idx * 0.08;
            const gained = Math.max(0.08, credit * roleBoost * splitPenalty);
            comp.killCount += gained;
            const progress = this.resolveCompanionProgress(comp);
            if (progress) {
                results.push({ companionId: comp.id, progress });
            }
        });
        return results;
    }

    public update(
        enemies: Phaser.Physics.Arcade.Group,
        bullets: Phaser.Physics.Arcade.Group,
        damageBonus: number = 0,
        fireRateMultiplier: number = 1
    ): void {
        const now = this.scene.time.now;
        const fireRateMul = Phaser.Math.Clamp(fireRateMultiplier || 1, 0.55, 4.6);
        const active = this.companions.filter(comp => comp.sprite.active);
        const isNight = !!gameState.data.isNight;
        active.forEach((comp, index) => {
            if (!comp.sprite.active) return;

            this.updateMovement(comp, index, active.length, isNight);
            this.ensureFollow(comp, index, active.length, isNight);
            this.handleSupportAbilities(comp, now);

            const fireRate = Math.max(70, (comp.config.stats.fireRate || 800) / fireRateMul);
            const fireReady = now - comp.lastFire > fireRate;
            if (!fireReady) return;

            const target = this.findTarget(comp, enemies);
            if (!target) return;

            this.fireAt(comp, target, bullets, damageBonus);
            comp.lastFire = now;
        });
    }

    private resolveConfig(input?: CompanionConfig | CompanionRole): CompanionConfig {
        if (!input) {
            return generateRandomCompanion();
        }

        if (typeof input !== 'string') {
            return input;
        }

        const roleStats = ROLE_DEFINITIONS[input];
        const roleNameCN = input === 'tank' ? '前锋' : input === 'sniper' ? '狙击' : '医疗';
        const namePool = ['王大力', '李静远', '林小雅', '赵铁柱', '陈锐', '周慧心', '张伟', '刘芳', '杨静', '黄磊'];
        const randomName = namePool[Math.floor(Math.random() * namePool.length)];
        return {
            id: `companion_${input}_${Date.now()}`,
            name: `${randomName}(${roleNameCN})`,
            level: 1,
            promotionTier: 0,
            role: input,
            textureKey: input === 'tank'
                ? 'companion_tank'
                : input === 'sniper'
                    ? 'companion_sniper'
                    : 'companion_medic',
            bulletEffect: {
                type: input === 'sniper' ? 'piercing' : input === 'tank' ? 'explosive' : 'homing',
                damage: input === 'sniper' ? 35 : 15,
                speed: input === 'tank' ? 380 : 450,
                color: roleStats.color,
                size: input === 'tank' ? 1.2 : 0.9,
                explosionRadius: input === 'tank' ? 60 : undefined,
                pierceCount: input === 'sniper' ? 3 : undefined,
                homingStrength: input === 'medic' ? 0.08 : undefined
            },
            stats: {
                damage: input === 'sniper' ? 30 : 12,
                fireRate: roleStats.fireRate,
                range: roleStats.range,
                health: roleStats.hp,
                speed: roleStats.speed
            },
            specialAbility: input === 'medic'
                ? { id: 'medic_heal', name: 'Combat Medic', cooldown: 5000, effect: 'heal-lowest-ally' }
                : undefined
        };
    }

    private getAdvancedClassDef(config: CompanionConfig): AdvancedClassDef | null {
        const role = config.role || 'tank';
        const pool = ROLE_ADVANCED_CLASSES[role] || ROLE_ADVANCED_CLASSES.tank;
        if (config.advancedClass) {
            const matched = pool.find(item => item.nameCN === config.advancedClass);
            if (matched) return matched;
        }
        return null;
    }

    private promoteCompanion(comp: CompanionInstance): void {
        const role = comp.config.role || 'tank';
        const pool = ROLE_ADVANCED_CLASSES[role] || ROLE_ADVANCED_CLASSES.tank;
        const promoted = pool[Phaser.Math.Between(0, pool.length - 1)];
        comp.config.advancedClass = promoted.nameCN;
        comp.config.promotionTier = 1;
        comp.config.textureKey = this.resolveCompanionTextureKey(comp.config);
    }

    private resolveCompanionTextureKey(config: CompanionConfig): string {
        const role = config.role || 'tank';
        const has = (key: string): boolean => this.scene.textures.exists(key);
        const advanced = !!config.advancedClass || config.promotionTier === 1;
        const preferred = ((): string[] => {
            if (role === 'tank') {
                return advanced
                    ? ['companion_raider', 'companion_tank', 'companion_engineer', 'companion']
                    : ['companion_tank', 'companion_engineer', 'companion'];
            }
            if (role === 'sniper') {
                return advanced
                    ? ['companion_raider', 'companion_sniper', 'companion_tank', 'companion']
                    : ['companion_sniper', 'companion_raider', 'companion'];
            }
            return advanced
                ? ['companion_support', 'companion_medic', 'companion_engineer', 'companion']
                : ['companion_medic', 'companion_support', 'companion'];
        })();
        const explicit = config.textureKey;
        if (explicit && has(explicit)) return explicit;
        const found = preferred.find((key) => has(key));
        return found || 'companion';
    }

    private refreshCompanionVisual(comp: CompanionInstance): void {
        const resolved = this.resolveCompanionTextureKey(comp.config);
        const fallbackKey = this.scene.textures.exists(comp.baseTextureKey) ? comp.baseTextureKey : 'companion';
        const key = this.scene.textures.exists(resolved) ? resolved : fallbackKey;
        comp.config.textureKey = key;
        if (comp.sprite.texture?.key !== key) {
            comp.sprite.setTexture(key);
        }
        comp.sprite.setScale(key === 'companion' ? 2.15 : 2.25);
        if (key === 'companion') {
            comp.sprite.setTint(comp.config.bulletEffect.color ?? comp.baseBulletColor);
        } else {
            comp.sprite.clearTint();
        }
    }

    private getFormationAnchor(
        comp: CompanionInstance,
        index: number,
        total: number,
        isNight: boolean
    ): { x: number; y: number; desiredRadius: number } {
        const maxPerRing = 8;
        const ring = Math.floor(index / maxPerRing);
        const inRing = index % maxPerRing;
        const ringSize = Math.max(1, Math.min(maxPerRing, total - ring * maxPerRing));
        const phase = ((comp.id.length * 37) % 360) * (Math.PI / 180);
        const baseRadius = isNight ? 84 : 58;
        const ringGap = isNight ? 28 : 18;
        const roleOffset = comp.config.role === 'tank' ? -8 : comp.config.role === 'sniper' ? 10 : 2;
        const radius = baseRadius + ring * ringGap + roleOffset;
        const angle = (inRing / ringSize) * Math.PI * 2 + phase;
        return {
            x: this.player.x + Math.cos(angle) * radius,
            y: this.player.y + Math.sin(angle) * radius,
            desiredRadius: radius,
        };
    }

    private updateMovement(
        comp: CompanionInstance,
        index: number,
        total: number,
        isNight: boolean
    ): void {
        const stats = comp.config.stats;
        const anchor = this.getFormationAnchor(comp, index, total, isNight);
        const distToAnchor = Phaser.Math.Distance.Between(
            comp.sprite.x,
            comp.sprite.y,
            anchor.x,
            anchor.y
        );
        const desired = anchor.desiredRadius;
        const maxFollowDistance = isNight ? desired + 64 : desired + 42;
        const chaseSpeed = Math.max(120, (stats.speed || 120));

        if (distToAnchor > maxFollowDistance) {
            this.scene.physics.moveTo(comp.sprite, anchor.x, anchor.y, chaseSpeed);
            return;
        }

        if (distToAnchor > 12) {
            this.scene.physics.moveTo(comp.sprite, anchor.x, anchor.y, Math.max(80, chaseSpeed * 0.72));
            return;
        }

        const body = comp.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(body.velocity.x * 0.65, body.velocity.y * 0.65);
    }

    private ensureFollow(
        comp: CompanionInstance,
        index: number,
        total: number,
        isNight: boolean
    ): void {
        const anchor = this.getFormationAnchor(comp, index, total, isNight);
        const distToPlayer = Phaser.Math.Distance.Between(comp.sprite.x, comp.sprite.y, this.player.x, this.player.y);
        const distToAnchor = Phaser.Math.Distance.Between(comp.sprite.x, comp.sprite.y, anchor.x, anchor.y);
        if (distToPlayer > 320 || distToAnchor > 280) {
            const nx = anchor.x + Phaser.Math.Between(-18, 18);
            const ny = anchor.y + Phaser.Math.Between(-18, 18);
            comp.sprite.setPosition(nx, ny);
            comp.sprite.setVelocity(0, 0);
            return;
        }

        if (distToAnchor > 96) {
            const body = comp.sprite.body as Phaser.Physics.Arcade.Body;
            const speed = Math.hypot(body.velocity.x, body.velocity.y);
            if (speed < 18) {
                this.scene.physics.moveTo(comp.sprite, anchor.x, anchor.y, Math.max(150, comp.config.stats.speed || 150));
            }
        }
    }

    private handleSupportAbilities(comp: CompanionInstance, now: number): void {
        if (comp.config.role !== 'medic' && comp.config.specialAbility?.id !== 'medic_heal') {
            return;
        }

        if (now - comp.lastHeal < (comp.config.specialAbility?.cooldown ?? 5000)) {
            return;
        }

        comp.lastHeal = now;
        const healAmount = 8 + comp.config.level * 2;
        events.emit(GameEvents.PLAYER_HEAL_REQUEST, {
            amount: healAmount,
            source: comp.config.name
        });
        this.showHealPulse(comp);
    }

    private findTarget(
        comp: CompanionInstance,
        enemies: Phaser.Physics.Arcade.Group
    ): Phaser.Physics.Arcade.Sprite | null {
        const range = Math.max(comp.config.stats.range || 200, 600);
        let target: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDist = range;

        enemies.children.each(gameObject => {
            const enemy = gameObject as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active) return true;

            const distance = Phaser.Math.Distance.Between(comp.sprite.x, comp.sprite.y, enemy.x, enemy.y);
            if (distance < closestDist) {
                closestDist = distance;
                target = enemy;
            }
            return true;
        });

        if (target) return target;

        // Fallback: target nearest enemy around player to avoid "idle" companions
        let fallback: Phaser.Physics.Arcade.Sprite | null = null;
        let fallbackDist = 800;
        enemies.children.each(gameObject => {
            const enemy = gameObject as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active) return true;
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < fallbackDist) {
                fallbackDist = distance;
                fallback = enemy;
            }
            return true;
        });

        return fallback;
    }

    private fireAt(
        comp: CompanionInstance,
        target: Phaser.Physics.Arcade.Sprite,
        bullets: Phaser.Physics.Arcade.Group,
        damageBonus: number
    ): void {
        const effect = comp.config.bulletEffect;
        const role = comp.config.role || 'tank';
        const level = Math.max(1, comp.config.level || 1);
        const levelBurstBonus = Math.floor(Math.max(0, level - 1) / 5);
        const promotionBonus = comp.config.promotionTier === 1 ? 1 : 0;
        const basePellets = effect.type === 'scatter' ? effect.scatterCount ?? 5 : 1;
        const rolePelletBonus = role === 'tank'
            ? Math.floor(level / 12) + promotionBonus
            : role === 'sniper'
                ? (level >= 14 ? 1 : 0) + promotionBonus
                : (level >= 10 ? 1 : 0) + promotionBonus;
        const pellets = Math.min(11, Math.max(1, basePellets + levelBurstBonus + rolePelletBonus));
        let spreadDeg = effect.type === 'scatter'
            ? 25 + levelBurstBonus * 3
            : (levelBurstBonus > 0 ? 8 + levelBurstBonus * 2 : 0);
        if (role === 'tank') spreadDeg += 10 + promotionBonus * 4;
        if (role === 'sniper') spreadDeg = Math.max(2, spreadDeg * 0.56);
        if (role === 'medic') spreadDeg += 6;
        const spread = Phaser.Math.DegToRad(spreadDeg);
        const baseAngle = Phaser.Math.Angle.Between(comp.sprite.x, comp.sprite.y, target.x, target.y);

        for (let i = 0; i < pellets; i++) {
            const bullet = this.acquireBullet(bullets, comp.sprite.x, comp.sprite.y);
            if (!bullet) continue;

            const clonedEffect: BulletEffect = {
                ...effect,
                damage: effect.damage + damageBonus + levelBurstBonus * 3
            };
            if (role === 'tank') {
                clonedEffect.type = 'explosive';
                clonedEffect.explosionRadius = Math.max(56, (clonedEffect.explosionRadius || 56) + Math.floor(level * 0.9));
                clonedEffect.speed = Math.max(260, Math.round((clonedEffect.speed || 360) * 0.9));
                clonedEffect.damage = Math.round(clonedEffect.damage * 1.2);
            } else if (role === 'sniper') {
                clonedEffect.type = 'piercing';
                clonedEffect.pierceCount = Math.min(14, Math.max(2, (clonedEffect.pierceCount || 2) + Math.floor(level / 6)));
                clonedEffect.speed = Math.max(420, Math.round((clonedEffect.speed || 460) * 1.22));
                clonedEffect.damage = Math.round(clonedEffect.damage * (1.18 + Math.min(0.28, level * 0.005)));
            } else {
                if (level >= 20 && i % 3 === 2) {
                    clonedEffect.type = 'chain';
                    clonedEffect.chainCount = Math.max(2, (clonedEffect.chainCount || 2) + Math.floor(level / 16));
                } else {
                    clonedEffect.type = 'homing';
                    clonedEffect.homingStrength = Math.min(0.36, (clonedEffect.homingStrength || 0.09) + level * 0.0034);
                }
                clonedEffect.speed = Math.max(320, Math.round((clonedEffect.speed || 380) * 1.06));
                clonedEffect.damage = Math.round(clonedEffect.damage * 1.1);
            }

            bullet.enableBody(true, comp.sprite.x, comp.sprite.y, true, true);
            bullet.setActive(true);
            bullet.setVisible(true);
            const texture = this.getTextureByEffect(clonedEffect.type);
            bullet.setTexture(texture);
            bullet.setAlpha(1);
            const scale = texture === 'bullet_cannon' ? 3 : texture === 'bullet_pierce' ? 2.2 : 2;
            bullet.setScale(scale);
            bullet.setTint(clonedEffect.color ?? 0xffffff);
            bullet.setBlendMode(Phaser.BlendModes.ADD);
            bullet.setDepth(10);

            (bullet as any).bulletEffect = clonedEffect;
            (bullet as any).damage = clonedEffect.damage;
            (bullet as any).pierceLeft = clonedEffect.pierceCount ?? 0;
            (bullet as any).ownerType = 'companion';
            (bullet as any).ownerId = comp.id;

            if (clonedEffect.type === 'homing') {
                (bullet as any).homingTarget = target;
                (bullet as any).homingStrength = clonedEffect.homingStrength ?? 0.05;
                (bullet as any).isHoming = true;
            } else {
                (bullet as any).isHoming = false;
            }

            const pelletAngle = spread > 0 && pellets > 1
                ? baseAngle - spread / 2 + (spread / (pellets - 1)) * i + Phaser.Math.FloatBetween(-0.05, 0.05)
                : baseAngle;

            const speed = (clonedEffect.speed || 400) * (1 + Math.min(0.35, level * 0.012));
            const body = bullet.body as Phaser.Physics.Arcade.Body;
            body.reset(comp.sprite.x, comp.sprite.y);
            body.setAllowGravity(false);
            const radius = Math.max(4, Math.min(7, Math.floor(4 * scale)));
            body.setCircle(radius, bullet.width / 2 - radius, bullet.height / 2 - radius);
            body.setBounce(0, 0);
            body.setDrag(0, 0);
            const velocityX = Math.cos(pelletAngle) * speed;
            const velocityY = Math.sin(pelletAngle) * speed;
            body.setVelocity(velocityX, velocityY);
            bullet.setRotation(pelletAngle + Math.PI / 2);

            const anyBullet = bullet as any;
            anyBullet.bulletTextureKey = texture;
            anyBullet.baseVelocityX = velocityX;
            anyBullet.baseVelocityY = velocityY;
            const dynamicType = String(clonedEffect.type || '');
            const swayAmp = role === 'sniper'
                ? 6 + Math.min(10, level * 0.3)
                : role === 'tank'
                    ? 4 + Math.min(8, level * 0.2)
                    : dynamicType === 'chain' || dynamicType === 'laser'
                        ? 16
                        : dynamicType === 'burning'
                            ? 11
                            : dynamicType === 'homing'
                                ? 6
                    : 0;
            anyBullet.swayAmplitude = swayAmp;
            anyBullet.swayFrequency = swayAmp > 0 ? (dynamicType === 'burning' ? 0.02 : 0.013) : 0;
            anyBullet.swayPhase = Math.random() * Math.PI * 2;
            if (anyBullet.lifetimeTimer) {
                anyBullet.lifetimeTimer.remove();
                anyBullet.lifetimeTimer = null;
            }

            const lifetime = (comp.config.stats.range || 300) / speed * 1000;
            anyBullet.spawnTime = this.scene.time.now;
            anyBullet.maxLifetime = lifetime + 200;
            anyBullet.lifetimeTimer = this.scene.time.delayedCall(lifetime, () => {
                anyBullet.lifetimeTimer = null;
                if (bullet.active) this.disableBullet(bullet);
            });
        }

        const burstCooldownBase = role === 'sniper' ? 980 : role === 'tank' ? 1180 : 900;
        const burstCooldown = Math.max(260, burstCooldownBase - level * 14);
        if (comp.config.level >= 14 && this.scene.time.now - comp.lastPattern > burstCooldown) {
            comp.lastPattern = this.scene.time.now;
            const burstCount = Math.min(15, (role === 'tank' ? 6 : role === 'sniper' ? 5 : 8) + Math.floor(level / 10) + promotionBonus);
            const burstSpread = role === 'sniper' ? 26 : 68;
            for (let j = 0; j < burstCount; j++) {
                const extra = this.acquireBullet(bullets, comp.sprite.x, comp.sprite.y);
                if (!extra) continue;
                const extraAngle = baseAngle + Phaser.Math.DegToRad(-burstSpread / 2 + (burstSpread / Math.max(1, burstCount - 1)) * j);
                const burstEffect: BulletEffect = {
                    ...effect,
                    type: role === 'tank' ? 'explosive' : role === 'sniper' ? 'piercing' : 'chain',
                    damage: Math.round(effect.damage + damageBonus + level * 2.8),
                    speed: Math.round((effect.speed || 420) * (role === 'sniper' ? 1.25 : role === 'tank' ? 0.88 : 1.05)),
                    explosionRadius: role === 'tank' ? Math.max(72, (effect.explosionRadius || 56) + 24) : effect.explosionRadius,
                    pierceCount: role === 'sniper' ? Math.max(4, (effect.pierceCount || 3) + 1) : effect.pierceCount,
                    chainCount: role === 'medic' ? Math.max(3, (effect.chainCount || 2) + 1) : effect.chainCount,
                };
                extra.enableBody(true, comp.sprite.x, comp.sprite.y, true, true);
                extra.setActive(true).setVisible(true);
                const extraTexture = this.getTextureByEffect(burstEffect.type);
                extra.setTexture(extraTexture);
                extra.setScale(extraTexture === 'bullet_cannon' ? 3 : 2);
                extra.setTint(burstEffect.color ?? 0xffffff);
                extra.setBlendMode(Phaser.BlendModes.ADD);
                extra.setDepth(10);
                const body = extra.body as Phaser.Physics.Arcade.Body;
                body.reset(comp.sprite.x, comp.sprite.y);
                body.setAllowGravity(false);
                const burstScale = extraTexture === 'bullet_cannon' ? 3 : 2;
                const radius = Math.max(4, Math.min(7, Math.floor(4 * burstScale)));
                body.setCircle(radius, extra.width / 2 - radius, extra.height / 2 - radius);
                const velocityX = Math.cos(extraAngle) * (burstEffect.speed || 420);
                const velocityY = Math.sin(extraAngle) * (burstEffect.speed || 420);
                body.setVelocity(velocityX, velocityY);
                extra.setRotation(extraAngle + Math.PI / 2);
                const anyExtra = extra as any;
                anyExtra.bulletEffect = burstEffect;
                anyExtra.damage = burstEffect.damage;
                anyExtra.pierceLeft = burstEffect.pierceCount ?? 0;
                anyExtra.ownerType = 'companion';
                anyExtra.ownerId = comp.id;
                anyExtra.isHoming = false;
                anyExtra.homingTarget = null;
                anyExtra.homingStrength = null;
                anyExtra.bulletTextureKey = extraTexture;
                anyExtra.baseVelocityX = velocityX;
                anyExtra.baseVelocityY = velocityY;
                anyExtra.swayAmplitude = role === 'medic' ? 22 : 14;
                anyExtra.swayFrequency = role === 'medic' ? 0.017 : 0.013;
                anyExtra.swayPhase = Math.random() * Math.PI * 2;
                const lifetime = (comp.config.stats.range || 300) / Math.max(120, burstEffect.speed || 420) * 1000;
                anyExtra.spawnTime = this.scene.time.now;
                anyExtra.maxLifetime = lifetime + 180;
                if (anyExtra.lifetimeTimer) anyExtra.lifetimeTimer.remove();
                anyExtra.lifetimeTimer = this.scene.time.delayedCall(lifetime, () => {
                    anyExtra.lifetimeTimer = null;
                    if (extra.active) this.disableBullet(extra);
                });
            }

            if (level >= 24) {
                const novaCount = Math.min(18, 8 + Math.floor(level / 3) + promotionBonus * 2);
                for (let k = 0; k < novaCount; k++) {
                    const nova = this.acquireBullet(bullets, comp.sprite.x, comp.sprite.y);
                    if (!nova) continue;
                    const radialAngle = (Math.PI * 2 * k) / Math.max(1, novaCount) + Phaser.Math.FloatBetween(-0.08, 0.08);
                    const novaEffect: BulletEffect = {
                        ...effect,
                        type: role === 'tank' ? 'explosive' : role === 'sniper' ? 'piercing' : 'chain',
                        damage: Math.round(effect.damage + damageBonus + level * 3.6),
                        speed: Math.round((effect.speed || 420) * (role === 'tank' ? 0.92 : role === 'sniper' ? 1.26 : 1.08)),
                        explosionRadius: role === 'tank' ? Math.max(84, (effect.explosionRadius || 60) + 32) : effect.explosionRadius,
                        pierceCount: role === 'sniper' ? Math.max(4, (effect.pierceCount || 3) + 2) : effect.pierceCount,
                        chainCount: role !== 'sniper' ? Math.max(3, (effect.chainCount || 2) + 1) : effect.chainCount,
                    };
                    nova.enableBody(true, comp.sprite.x, comp.sprite.y, true, true);
                    nova.setActive(true).setVisible(true);
                    const novaTexture = this.getTextureByEffect(novaEffect.type);
                    nova.setTexture(novaTexture);
                    nova.setScale(novaTexture === 'bullet_cannon' ? 3.2 : novaTexture === 'bullet_pierce' ? 2.25 : 2.1);
                    nova.setTint(novaEffect.color ?? 0xffffff);
                    nova.setBlendMode(Phaser.BlendModes.ADD);
                    nova.setDepth(10);
                    const body = nova.body as Phaser.Physics.Arcade.Body;
                    body.reset(comp.sprite.x, comp.sprite.y);
                    body.setAllowGravity(false);
                    const novaScale = novaTexture === 'bullet_cannon' ? 3.2 : novaTexture === 'bullet_pierce' ? 2.25 : 2.1;
                    const radius = Math.max(4, Math.min(7, Math.floor(4 * novaScale)));
                    body.setCircle(radius, nova.width / 2 - radius, nova.height / 2 - radius);
                    const speedMul = 0.9 + Math.min(0.4, level * 0.01);
                    const velocityX = Math.cos(radialAngle) * (novaEffect.speed || 420) * speedMul;
                    const velocityY = Math.sin(radialAngle) * (novaEffect.speed || 420) * speedMul;
                    body.setVelocity(velocityX, velocityY);
                    nova.setRotation(radialAngle + Math.PI / 2);
                    const anyNova = nova as any;
                    anyNova.bulletEffect = novaEffect;
                    anyNova.damage = novaEffect.damage;
                    anyNova.pierceLeft = novaEffect.pierceCount ?? 0;
                    anyNova.ownerType = 'companion';
                    anyNova.ownerId = comp.id;
                    anyNova.isHoming = false;
                    anyNova.homingTarget = null;
                    anyNova.homingStrength = null;
                    anyNova.bulletTextureKey = novaTexture;
                    anyNova.baseVelocityX = velocityX;
                    anyNova.baseVelocityY = velocityY;
                    anyNova.swayAmplitude = role === 'tank' ? 10 : role === 'sniper' ? 8 : 20;
                    anyNova.swayFrequency = role === 'medic' ? 0.018 : 0.013;
                    anyNova.swayPhase = (Math.PI * 2 * k) / Math.max(1, novaCount);
                    const lifetime = (comp.config.stats.range || 300) / Math.max(120, (novaEffect.speed || 420) * speedMul) * 1000;
                    anyNova.spawnTime = this.scene.time.now;
                    anyNova.maxLifetime = lifetime + 180;
                    if (anyNova.lifetimeTimer) anyNova.lifetimeTimer.remove();
                    anyNova.lifetimeTimer = this.scene.time.delayedCall(lifetime, () => {
                        anyNova.lifetimeTimer = null;
                        if (nova.active) this.disableBullet(nova);
                    });
                }
            }
        }
    }

    private acquireBullet(
        bullets: Phaser.Physics.Arcade.Group,
        x: number,
        y: number
    ): Phaser.Physics.Arcade.Sprite | null {
        let bullet = bullets.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
        if (!bullet) {
            const recycle = this.findOldestActiveBullet(bullets);
            if (recycle) this.disableBullet(recycle);
            bullet = bullets.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
        }
        return bullet;
    }

    private findOldestActiveBullet(bullets: Phaser.Physics.Arcade.Group): Phaser.Physics.Arcade.Sprite | null {
        let oldest: Phaser.Physics.Arcade.Sprite | null = null;
        let oldestTime = Infinity;
        bullets.getChildren().forEach(child => {
            const b = child as Phaser.Physics.Arcade.Sprite;
            if (!b.active) return;
            const t = (b as any).spawnTime ?? 0;
            if (t < oldestTime) {
                oldestTime = t;
                oldest = b;
            }
        });
        return oldest;
    }

    private disableBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
        const anyBullet = bullet as any;
        if (anyBullet.lifetimeTimer) {
            anyBullet.lifetimeTimer.remove();
            anyBullet.lifetimeTimer = null;
        }
        anyBullet.bulletEffect = null;
        anyBullet.damage = null;
        anyBullet.isHoming = false;
        anyBullet.homingTarget = null;
        anyBullet.homingStrength = null;
        anyBullet.pierceLeft = null;
        anyBullet.ownerType = null;
        anyBullet.ownerId = null;
        anyBullet.bulletTextureKey = null;
        anyBullet.baseVelocityX = null;
        anyBullet.baseVelocityY = null;
        anyBullet.swayAmplitude = null;
        anyBullet.swayFrequency = null;
        anyBullet.swayPhase = null;
        anyBullet.spawnTime = null;
        anyBullet.maxLifetime = null;
        bullet.setVelocity(0, 0);
        bullet.disableBody(true, true);
    }

    private getTextureByEffect(effectType: BulletEffect['type']): string {
        if (effectType === 'scatter') return 'bullet_scatter';
        if (effectType === 'burning') return 'bullet_flame';
        if (effectType === 'piercing') return 'bullet_pierce';
        if (effectType === 'explosive') return 'bullet_cannon';
        if (effectType === 'chain') return 'bullet_chain';
        if (effectType === 'frozen') return 'bullet_frost';
        if (effectType === 'laser' || effectType === 'homing') return 'bullet_pulse';
        return 'bullet';
    }

    private inferBaseValue(current: number, level: number, growthPerLevel: number): number {
        if (!Number.isFinite(current) || current <= 0) return 1;
        const lv = Math.max(1, level || 1);
        return current / Math.pow(growthPerLevel, lv - 1);
    }

    private getKillsToNextLevel(level: number): number {
        const lv = Math.max(1, level || 1);
        if (lv < COMPANION_PROMOTION_LEVEL) {
            return Math.floor(3 + Math.pow(lv, 1.12) * 1.8);
        }
        const postLv = lv - COMPANION_PROMOTION_LEVEL + 1;
        return Math.floor(14 + Math.pow(postLv + 2, 1.3) * 4.5);
    }

    private applyLevelScaling(comp: CompanionInstance): void {
        const level = Phaser.Math.Clamp(Math.max(1, comp.config.level), 1, COMPANION_MAX_LEVEL);
        comp.config.level = level;
        const role = comp.config.role || 'tank';
        const roleDamageMul = role === 'tank' ? 1.16 : role === 'sniper' ? 1.22 : 1.14;
        const roleFireRateMul = role === 'tank' ? 0.982 : role === 'sniper' ? 0.988 : 0.978;
        const roleRangeMul = role === 'tank' ? 1.012 : role === 'sniper' ? 1.038 : 1.024;
        const preLevel = Math.max(0, Math.min(level, COMPANION_PROMOTION_LEVEL) - 1);
        const postLevel = Math.max(0, level - COMPANION_PROMOTION_LEVEL);
        let damageMul = Math.pow(1.07 * roleDamageMul, preLevel) * Math.pow(1.128, postLevel);
        let fireRateMul = Math.pow(0.992 * roleFireRateMul, preLevel) * Math.pow(0.974, postLevel);
        let rangeMul = Math.pow(1.015 * roleRangeMul, preLevel) * Math.pow(1.026, postLevel);
        let hpMul = Math.pow(1.04, preLevel) * Math.pow(1.09, postLevel);
        let speedMul = 1 + Math.min(0.52, preLevel * 0.006 + postLevel * 0.012);
        let bonusPierce = 0;
        let bonusExplosionRadius = 0;
        let bonusHoming = 0;
        const milestone = getCompanionMilestoneBonuses(role, level);

        const advanced = this.getAdvancedClassDef(comp.config);
        if (advanced) {
            damageMul *= advanced.damageMul;
            fireRateMul *= advanced.fireRateMul;
            rangeMul *= advanced.rangeMul;
            hpMul *= advanced.hpMul;
            speedMul *= advanced.speedMul;
            bonusPierce += advanced.bonusPierce || 0;
            bonusExplosionRadius += advanced.bonusExplosionRadius || 0;
            bonusHoming += advanced.bonusHoming || 0;
        }

        damageMul *= milestone.damageMul;
        fireRateMul *= milestone.fireRateMul;
        rangeMul *= milestone.rangeMul;
        hpMul *= milestone.healthMul;
        bonusPierce += milestone.bonusPierce;
        bonusExplosionRadius += milestone.bonusExplosionRadius;
        bonusHoming += milestone.bonusHoming;

        const speedBonus = role === 'sniper' ? 1.0 : role === 'medic' ? 0.85 : 0.55;
        comp.config.stats.damage = Math.max(1, Math.round(comp.baseDamage * damageMul));
        comp.config.stats.fireRate = Math.max(95, Math.round(comp.baseFireRate * fireRateMul));
        comp.config.stats.range = Math.min(1700, Math.round(comp.baseRange * rangeMul));
        comp.config.stats.health = Math.max(120, Math.round(comp.baseHealth * hpMul));
        comp.config.stats.speed = Math.min(330, Math.round((comp.config.stats.speed || 140) + speedBonus * level * speedMul + milestone.speedFlat));
        comp.config.bulletEffect.damage = Math.max(1, Math.round(comp.baseBulletDamage * damageMul * 1.34));
        if (role === 'tank') {
            comp.config.bulletEffect.explosionRadius = 56 + Math.min(130, level * 3 + bonusExplosionRadius);
            comp.config.bulletEffect.size = Math.min(2.2, (comp.config.bulletEffect.size || 1.2) + 0.025 * level);
        } else if (role === 'sniper') {
            const basePierce = Math.max(1, comp.config.bulletEffect.pierceCount || 2);
            comp.config.bulletEffect.pierceCount = Math.min(15, basePierce + Math.floor(level / 4) + bonusPierce);
        } else if (role === 'medic') {
            comp.config.bulletEffect.homingStrength = Math.min(0.42, 0.1 + level * 0.006 + bonusHoming);
            if (comp.config.specialAbility) {
                comp.config.specialAbility.cooldown = Math.max(2200, 5000 - level * 85);
            }
        }
        comp.config.bulletEffect.color = LEVEL_COLOR_CYCLE[(level - 1) % LEVEL_COLOR_CYCLE.length] ?? comp.baseBulletColor;
        this.refreshCompanionVisual(comp);
        const spriteData = comp.sprite as any;
        spriteData.maxHealth = comp.config.stats.health;
        const current = Number.isFinite(spriteData.health) ? spriteData.health : comp.config.stats.health;
        spriteData.health = Math.min(comp.config.stats.health, current);
    }

    private resolveCompanionProgress(comp: CompanionInstance): CompanionProgressResult {
        if (comp.config.level >= COMPANION_MAX_LEVEL) {
            return {
                leveledUp: false,
                level: COMPANION_MAX_LEVEL,
                name: comp.config.name,
                tint: comp.config.bulletEffect.color ?? 0xffffff,
                reachedMax: true,
                advancedClass: comp.config.advancedClass,
            };
        }
        let leveledUp = false;
        let promoted = false;
        let milestoneLevel: number | undefined;
        let milestoneTitleCN: string | undefined;
        let milestoneDetailCN: string | undefined;
        while (comp.config.level < COMPANION_MAX_LEVEL && comp.killCount >= comp.nextLevelKills) {
            const previousLevel = comp.config.level;
            comp.config.level += 1;
            leveledUp = true;
            const reachedMilestone = getReachedCompanionMilestone(comp.config.role || 'tank', previousLevel, comp.config.level);
            if (reachedMilestone) {
                milestoneLevel = reachedMilestone.level;
                milestoneTitleCN = reachedMilestone.titleCN;
                milestoneDetailCN = reachedMilestone.detailCN;
            }
            if (comp.config.level >= COMPANION_PROMOTION_LEVEL && comp.config.promotionTier !== 1) {
                this.promoteCompanion(comp);
                promoted = true;
            }
            comp.nextLevelKills += this.getKillsToNextLevel(comp.config.level);
            this.applyLevelScaling(comp);
        }
        const reachedMax = comp.config.level >= COMPANION_MAX_LEVEL;
        if (reachedMax) {
            comp.config.level = COMPANION_MAX_LEVEL;
            comp.nextLevelKills = Number.MAX_SAFE_INTEGER;
            this.applyLevelScaling(comp);
        }
        return {
            leveledUp,
            level: comp.config.level,
            name: comp.config.name,
            tint: comp.config.bulletEffect.color ?? 0xffffff,
            milestoneLevel,
            milestoneTitleCN,
            milestoneDetailCN,
            promoted,
            advancedClass: comp.config.advancedClass,
            reachedMax,
        };
    }

    private showHealPulse(companion: CompanionInstance): void {
        const pulse = this.scene.add.circle(companion.sprite.x, companion.sprite.y, 10, 0xf43f5e, 0.35);
        pulse.setDepth(1400);
        this.scene.tweens.add({
            targets: pulse,
            radius: 60,
            alpha: 0,
            duration: 350,
            onComplete: () => pulse.destroy()
        });

        const text = this.scene.add.text(companion.sprite.x, companion.sprite.y - 30, '+HEAL', {
            fontSize: '10px',
            color: '#f472b6',
            fontFamily: 'Courier New',
            fontStyle: 'bold'
        });
        text.setOrigin(0.5);
        text.setDepth(1500);
        this.scene.tweens.add({
            targets: text,
            y: text.y - 15,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy()
        });
    }
}
