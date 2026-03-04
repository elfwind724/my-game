import Phaser from 'phaser';
import { gameState } from '../state/GameState';
import { getWeaponAtLevel } from '../data/weapons';

export type WeaponType = 'pistol' | 'shotgun' | 'rifle' | 'flamethrower' | 'laser' | 'rocket' | 'orbit' | 'holy_water' | 'lightning_ring' | 'boomerang';

export interface WeaponConfig {
    name: string;
    nameCN: string;
    damage: number;
    fireRate: number; // ms between shots
    range: number;
    spread: number; // angle in degrees
    projectileCount: number;
    speed: number;
    color: number;
    auto: boolean;
    special?: 'none' | 'burn' | 'explode' | 'pierce' | 'chain';
}

export interface WeaponFireModifiers {
    fireRateMul?: number;
    damageMul?: number;
    projectileBonus?: number;
    speedMul?: number;
    spreadMul?: number;
    forceSpecial?: 'chain' | 'burn' | 'pierce';
    tintColor?: number;
    homing?: boolean;
    patternPower?: number;
    signatureRateMul?: number;
    extraChainChance?: number;
    signatureDamageMul?: number;
    signatureSpeedMul?: number;
    orbitAmpMul?: number;
}

interface SignatureMotionOptions {
    swayAmplitude?: number;
    swayFrequency?: number;
    swayPhase?: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponConfig> = {
    pistol: {
        name: 'AR Basic',
        nameCN: '基础激光',
        damage: 30,
        fireRate: 300,
        range: 400,
        spread: 5,
        projectileCount: 1,
        speed: 460,
        color: 0x0ea5e9,
        auto: false
    },
    shotgun: {
        name: 'Scatter Beam',
        nameCN: '散射光波',
        damage: 20,
        fireRate: 560,
        range: 250,
        spread: 30,
        projectileCount: 6,
        speed: 390,
        color: 0x38bdf8,
        auto: false
    },
    rifle: {
        name: 'Pulse Burst',
        nameCN: '脉冲连射',
        damage: 22,
        fireRate: 110,
        range: 600,
        spread: 8,
        projectileCount: 1,
        speed: 660,
        color: 0x06b6d4,
        auto: true
    },
    flamethrower: {
        name: 'Flame Ray',
        nameCN: '烈焰射线',
        damage: 5,
        fireRate: 40,
        range: 200,
        spread: 15,
        projectileCount: 1,
        speed: 220,
        color: 0xff4400,
        auto: true,
        special: 'burn'
    },
    laser: {
        name: 'Pierce Beam',
        nameCN: '穿透光束',
        damage: 45,
        fireRate: 450,
        range: 800,
        spread: 0,
        projectileCount: 1,
        speed: 1080,
        color: 0x22d3ee,
        auto: false,
        special: 'pierce'
    },
    rocket: {
        name: 'Energy Cannon',
        nameCN: '能量炮',
        damage: 92,
        fireRate: 1080,
        range: 1000,
        spread: 2,
        projectileCount: 1,
        speed: 330,
        color: 0xa855f7,
        auto: false,
        special: 'explode'
    },
    orbit: {
        name: 'Orbit Blade',
        nameCN: '环绕刀刃',
        damage: 18,
        fireRate: 280,
        range: 200,
        spread: 360,
        projectileCount: 3,
        speed: 320,
        color: 0xf472b6,
        auto: true,
    },
    holy_water: {
        name: 'Holy Water',
        nameCN: '圣水',
        damage: 12,
        fireRate: 600,
        range: 300,
        spread: 45,
        projectileCount: 1,
        speed: 180,
        color: 0x60a5fa,
        auto: true,
        special: 'burn'
    },
    lightning_ring: {
        name: 'Lightning Ring',
        nameCN: '闪电环',
        damage: 20,
        fireRate: 500,
        range: 250,
        spread: 360,
        projectileCount: 4,
        speed: 500,
        color: 0xfbbf24,
        auto: true,
        special: 'chain'
    },
    boomerang: {
        name: 'Boomerang',
        nameCN: '回旋镖',
        damage: 22,
        fireRate: 450,
        range: 350,
        spread: 15,
        projectileCount: 1,
        speed: 400,
        color: 0x34d399,
        auto: true,
        special: 'pierce'
    }
};

export class WeaponSystem {
    private scene: Phaser.Scene;
    private currentWeapon: WeaponType = 'pistol';
    private lastFired: number = 0;
    private weaponShotCounter: Record<WeaponType, number> = {
        pistol: 0,
        shotgun: 0,
        rifle: 0,
        flamethrower: 0,
        laser: 0,
        rocket: 0,
        orbit: 0,
        holy_water: 0,
        lightning_ring: 0,
        boomerang: 0,
    };
    private bullets: Phaser.Physics.Arcade.Group;
    private obstacleGroups: Phaser.GameObjects.Group[];
    private obstacleSprites: Phaser.Physics.Arcade.Sprite[];

    constructor(
        scene: Phaser.Scene,
        bulletGroup: Phaser.Physics.Arcade.Group,
        obstacleGroups: Phaser.GameObjects.Group[] = [],
        obstacleSprites: Phaser.Physics.Arcade.Sprite[] = []
    ) {
        this.scene = scene;
        this.bullets = bulletGroup;
        this.obstacleGroups = obstacleGroups;
        this.obstacleSprites = obstacleSprites;
    }

    public switchWeapon(type: WeaponType): void {
        if (WEAPON_DEFINITIONS[type]) {
            this.currentWeapon = type;
        }
    }

    public getCurrentWeapon(): WeaponConfig {
        return WEAPON_DEFINITIONS[this.currentWeapon];
    }

    public getCurrentWeaponType(): WeaponType {
        return this.currentWeapon;
    }

    /**
     * Attempts to fire. Returns true if a bullet was actually created (rate limit passed).
     */
    public fire(x: number, y: number, targetX: number, targetY: number, modifiers?: WeaponFireModifiers): boolean {
        const config = WEAPON_DEFINITIONS[this.currentWeapon];
        const scaled = this.getScaledConfig(config, this.currentWeapon);
        const mod = modifiers || {};
        const adjustedFireRate = Math.max(30, scaled.fireRate / Math.max(0.3, mod.fireRateMul || 1));
        const now = this.scene.time.now;

        if (now < this.lastFired) {
            this.lastFired = now - adjustedFireRate;
        }

        if (now - this.lastFired < adjustedFireRate) return false;

        this.lastFired = now;

        // Calculate angle to target
        const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);

        const projectileCount = Math.max(1, scaled.projectileCount + (mod.projectileBonus || 0));
        const spreadValue = scaled.spread * (mod.spreadMul || 1);
        const speedValue = scaled.speed * (mod.speedMul || 1);
        const damageValue = scaled.damage * (mod.damageMul || 1);
        const specialValue = ((mod.forceSpecial as WeaponConfig['special']) || scaled.special || 'none');
        const weaponType = this.currentWeapon;
        this.weaponShotCounter[weaponType] += 1;
        const shotIndex = this.weaponShotCounter[weaponType];

        // Fire projectiles
        for (let i = 0; i < projectileCount; i++) {
            // Calculate spread
            let spreadAngle = 0;
            if (projectileCount > 1) {
                const step = Phaser.Math.DegToRad(spreadValue) / Math.max(1, projectileCount - 1);
                spreadAngle = -Phaser.Math.DegToRad(spreadValue) / 2 + step * i;
            } else if (spreadValue > 0) {
                spreadAngle = Phaser.Math.DegToRad(Phaser.Math.Between(-spreadValue / 2, spreadValue / 2));
            }

            const finalAngle = angle + spreadAngle;
            const spawnPoint = this.getSafeSpawnPoint(x, y, finalAngle);
            const spawnX = spawnPoint.x;
            const spawnY = spawnPoint.y;
            const velocityX = Math.cos(finalAngle) * speedValue;
            const velocityY = Math.sin(finalAngle) * speedValue;

            this.createBullet(
                spawnX,
                spawnY,
                velocityX,
                velocityY,
                scaled,
                damageValue,
                specialValue,
                mod.tintColor,
                !!mod.homing,
                weaponType
            );
        }

        this.maybeFireSignaturePattern(
            weaponType,
            shotIndex,
            x,
            y,
            angle,
            scaled,
            mod,
            specialValue
        );

        return true;
    }

    private maybeFireSignaturePattern(
        weaponType: WeaponType,
        shotIndex: number,
        x: number,
        y: number,
        baseAngle: number,
        scaled: WeaponConfig,
        mod: WeaponFireModifiers,
        fallbackSpecial: WeaponConfig['special']
    ): void {
        const damageMul = mod.damageMul || 1;
        const speedMul = mod.speedMul || 1;
        const spreadMul = mod.spreadMul || 1;
        const tint = mod.tintColor;
        const patternPower = Phaser.Math.Clamp(Math.floor(mod.patternPower || 0), 0, 10);
        const signatureRateMul = Math.max(0.55, mod.signatureRateMul || 1);
        const signatureDamageMul = Math.max(0.7, mod.signatureDamageMul || 1);
        const signatureSpeedMul = Math.max(0.7, mod.signatureSpeedMul || 1);
        const extraChainChance = Phaser.Math.Clamp(mod.extraChainChance || 0, 0, 0.55);
        const orbitAmpMul = Math.max(0.7, mod.orbitAmpMul || 1);
        const patternIntensity = 1 + patternPower * 0.22 + Math.max(0, signatureRateMul - 1) * 0.52;
        const cadence = (base: number): number => Math.max(1, Math.round(base / (signatureRateMul * patternIntensity * 1.06)));
        const resolveSpecial = (base: WeaponConfig['special']): WeaponConfig['special'] => {
            if (extraChainChance > 0 && Math.random() < extraChainChance) return 'chain';
            return base;
        };
        const emitArc = (
            count: number,
            spreadDeg: number,
            projectileSpeedMul: number,
            projectileDamageMul: number,
            special: WeaponConfig['special'],
            rangeMul: number = 1,
            motionFactory?: (index: number, total: number) => SignatureMotionOptions
        ): void => {
            const safeCount = Math.max(1, count);
            const safeSpread = Math.max(0, spreadDeg * spreadMul);
            const step = safeCount > 1 ? safeSpread / (safeCount - 1) : 0;
            for (let i = 0; i < safeCount; i += 1) {
                const spreadOffset = safeCount > 1
                    ? (-safeSpread / 2 + step * i)
                    : 0;
                const finalAngle = baseAngle + Phaser.Math.DegToRad(spreadOffset + Phaser.Math.FloatBetween(-2.6, 2.6));
                const shotSpeed = Math.max(120, scaled.speed * speedMul * projectileSpeedMul * signatureSpeedMul);
                const shotDamage = Math.max(1, scaled.damage * damageMul * projectileDamageMul * signatureDamageMul);
                const spawn = this.getSafeSpawnPoint(x, y, finalAngle);
                const tunedConfig: WeaponConfig = {
                    ...scaled,
                    range: Math.max(140, scaled.range * rangeMul),
                    speed: shotSpeed,
                    color: tint ?? scaled.color,
                    special,
                };
                this.createBullet(
                    spawn.x,
                    spawn.y,
                    Math.cos(finalAngle) * shotSpeed,
                    Math.sin(finalAngle) * shotSpeed,
                    tunedConfig,
                    shotDamage,
                    resolveSpecial(special),
                    tint,
                    false,
                    weaponType,
                    motionFactory ? motionFactory(i, safeCount) : undefined
                );
            }
        };
        const emitRadial = (
            count: number,
            projectileSpeedMul: number,
            projectileDamageMul: number,
            special: WeaponConfig['special'],
            rangeMul: number = 1,
            wobbleDeg: number = 3
        ): void => {
            const safeCount = Math.max(1, count);
            for (let i = 0; i < safeCount; i += 1) {
                const circleAngle = baseAngle + (Math.PI * 2 * i / safeCount);
                const finalAngle = circleAngle + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-wobbleDeg, wobbleDeg));
                const shotSpeed = Math.max(120, scaled.speed * speedMul * projectileSpeedMul * signatureSpeedMul);
                const shotDamage = Math.max(1, scaled.damage * damageMul * projectileDamageMul * signatureDamageMul);
                const spawn = this.getSafeSpawnPoint(x, y, finalAngle);
                const tunedConfig: WeaponConfig = {
                    ...scaled,
                    range: Math.max(140, scaled.range * rangeMul),
                    speed: shotSpeed,
                    color: tint ?? scaled.color,
                    special,
                };
                this.createBullet(
                    spawn.x,
                    spawn.y,
                    Math.cos(finalAngle) * shotSpeed,
                    Math.sin(finalAngle) * shotSpeed,
                    tunedConfig,
                    shotDamage,
                    resolveSpecial(special),
                    tint,
                    false,
                    weaponType,
                    {
                        swayAmplitude: (8 + patternPower * 2) * orbitAmpMul,
                        swayFrequency: 0.012 + patternPower * 0.0008,
                        swayPhase: (Math.PI * 2 * i) / safeCount,
                    }
                );
            }
        };

        if (weaponType === 'pistol' && shotIndex % cadence(5) === 0) {
            emitArc(
                3 + Math.min(3, patternPower),
                30 + patternPower * 6,
                1.3,
                0.94,
                fallbackSpecial === 'none' ? 'chain' : fallbackSpecial,
                1.05,
                (index, total) => ({
                    swayAmplitude: (12 + patternPower * 2) * orbitAmpMul,
                    swayFrequency: 0.013 + (index / Math.max(1, total)) * 0.002,
                })
            );
            if (patternPower >= 2 && shotIndex % cadence(8) === 0) {
                emitRadial(6 + Math.min(3, patternPower), 1.12, 0.8, 'chain', 1.04);
            }
            return;
        }
        if (weaponType === 'shotgun' && shotIndex % cadence(3) === 0) {
            emitArc(
                6 + Math.min(3, patternPower),
                86 + patternPower * 7,
                1.02,
                0.72,
                fallbackSpecial === 'none' ? 'burn' : fallbackSpecial,
                0.72,
                () => ({
                    swayAmplitude: (8 + patternPower * 2) * orbitAmpMul,
                    swayFrequency: 0.018,
                })
            );
            if (patternPower >= 2 && shotIndex % cadence(5) === 0) {
                emitArc(7 + patternPower, 46, 1.34, 0.64, 'chain', 0.96);
            }
            return;
        }
        if (weaponType === 'rifle' && shotIndex % cadence(5) === 0) {
            emitArc(
                5 + Math.min(3, Math.floor(patternPower / 2)),
                18 + patternPower * 3,
                1.6,
                1.02,
                'pierce',
                1.25,
                (index) => ({
                    swayAmplitude: 16 * orbitAmpMul,
                    swayFrequency: 0.013 + patternPower * 0.0006,
                    swayPhase: index % 2 === 0 ? 0 : Math.PI,
                })
            );
            if (patternPower >= 3 && shotIndex % cadence(8) === 0) {
                emitRadial(6 + patternPower, 1.18, 0.62, 'chain', 1.02, 5);
            }
            return;
        }
        if (weaponType === 'flamethrower' && shotIndex % cadence(8) === 0) {
            emitArc(
                6 + Math.min(4, patternPower),
                108 + patternPower * 8,
                0.94,
                0.74,
                'burn',
                0.9,
                (_index, total) => ({
                    swayAmplitude: (14 + patternPower * 3) * orbitAmpMul,
                    swayFrequency: 0.021 + (total * 0.0002),
                })
            );
            if (patternPower >= 2 && shotIndex % cadence(7) === 0) {
                emitRadial(7 + patternPower, 1.0, 0.62, 'burn', 0.94, 6);
            }
            return;
        }
        if (weaponType === 'laser' && shotIndex % cadence(3) === 0) {
            emitArc(5 + Math.min(3, patternPower), 24, 1.48, 1.14, 'pierce', 1.38);
            if (patternPower >= 2 && shotIndex % cadence(5) === 0) {
                emitArc(4 + Math.min(3, patternPower), 20, 1.34, 0.82, 'pierce', 1.2);
            }
            return;
        }
        if (weaponType === 'rocket' && shotIndex % cadence(4) === 0) {
            emitArc(
                7 + Math.min(4, patternPower),
                36 + patternPower * 4,
                1.2,
                0.86,
                'explode',
                1.16,
                (index, total) => ({
                    swayAmplitude: (7 + patternPower * 1.3) * orbitAmpMul,
                    swayFrequency: 0.011 + (index / Math.max(1, total)) * 0.0014,
                })
            );
            if (patternPower >= 1 && shotIndex % cadence(6) === 0) {
                emitRadial(6 + Math.min(4, patternPower), 1.02, 0.74, 'explode', 1.04, 5);
            }
        }
        if (weaponType === 'orbit' && shotIndex % cadence(2) === 0) {
            emitRadial(
                6 + Math.min(4, patternPower),
                0.9,
                0.85,
                'pierce',
                0.7,
                8,
            );
            if (patternPower >= 2 && shotIndex % cadence(4) === 0) {
                emitRadial(10 + patternPower, 1.1, 0.65, 'chain', 0.85, 6);
            }
            return;
        }
        if (weaponType === 'holy_water' && shotIndex % cadence(3) === 0) {
            emitArc(
                4 + Math.min(3, patternPower),
                90 + patternPower * 10,
                0.6,
                0.9,
                'burn',
                0.6,
                (_index, total) => ({
                    swayAmplitude: (20 + patternPower * 3) * orbitAmpMul,
                    swayFrequency: 0.025 + (total * 0.0003),
                })
            );
            return;
        }
        if (weaponType === 'lightning_ring' && shotIndex % cadence(2) === 0) {
            emitRadial(
                8 + Math.min(6, patternPower),
                1.2,
                0.78,
                'chain',
                1.1,
                5
            );
            if (patternPower >= 1 && shotIndex % cadence(4) === 0) {
                emitRadial(12 + patternPower, 0.9, 0.6, 'chain', 1.3, 3);
            }
            return;
        }
        if (weaponType === 'boomerang' && shotIndex % cadence(3) === 0) {
            emitArc(
                3 + Math.min(3, patternPower),
                40 + patternPower * 5,
                1.4,
                1.0,
                'pierce',
                1.2,
                (index, total) => ({
                    swayAmplitude: (25 + patternPower * 4) * orbitAmpMul,
                    swayFrequency: 0.015 + (index / Math.max(1, total)) * 0.003,
                    swayPhase: index * Math.PI * 0.5,
                })
            );
            return;
        }
        if (weaponType === 'pistol' && this.currentWeapon === ('frost' as any) && shotIndex % cadence(3) === 0) {
            emitRadial(
                5 + Math.min(4, patternPower),
                0.85,
                0.9,
                'none',
                0.8,
                6
            );
            if (patternPower >= 2 && shotIndex % cadence(6) === 0) {
                emitArc(4 + patternPower, 60, 1.1, 0.7, 'none', 0.9);
            }
            return;
        }
        if (weaponType === 'pistol' && this.currentWeapon === ('chain' as any) && shotIndex % cadence(3) === 0) {
            emitArc(
                4 + Math.min(3, patternPower),
                50 + patternPower * 6,
                1.3,
                0.85,
                'chain',
                1.1,
                (index) => ({
                    swayAmplitude: (15 + patternPower * 2) * orbitAmpMul,
                    swayFrequency: 0.016,
                    swayPhase: index * Math.PI * 0.7,
                })
            );
            return;
        }
        if (patternPower >= 2 && shotIndex % cadence(7) === 0) {
            emitRadial(
                8 + Math.min(6, patternPower),
                1.12,
                0.68 + patternPower * 0.03,
                fallbackSpecial === 'none' ? 'chain' : fallbackSpecial,
                1.04,
                4
            );
        }
    }

    private getScaledConfig(config: WeaponConfig, type: WeaponType): WeaponConfig {
        const slotMap: Record<WeaponType, string> = {
            pistol: 'ar_basic',
            shotgun: 'scatter',
            rifle: 'pulse',
            flamethrower: 'flame',
            laser: 'pierce',
            rocket: 'cannon',
            orbit: 'orbit',
            holy_water: 'holy_water',
            lightning_ring: 'lightning_ring',
            boomerang: 'boomerang',
        };
        const slotId = slotMap[type];
        const slot = gameState.data.weapons.find(w => w.id === slotId);
        const lv = Math.max(1, gameState.data.playerLevel || 1);
        const levelDamageMul = 1 + Math.min(2.55, (lv - 1) * 0.078);
        const levelFireRateMul = Math.max(0.36, 1 - (lv - 1) * 0.018);
        const ownedWeapons = Math.max(1, gameState.data.weapons.length);
        const evolvedWeapons = gameState.data.weapons.filter(w => w.evolved).length;
        const arsenalDamageMul = 1 + Math.min(1.24, ownedWeapons * 0.06 + evolvedWeapons * 0.16);
        const arsenalFireRateMul = Math.max(0.32, 1 - ownedWeapons * 0.022 - evolvedWeapons * 0.04);

        if (!slot) {
            const adaptiveProjectileBonus =
                (type === 'shotgun' && lv >= 8 ? 1 : 0) +
                (type === 'shotgun' && lv >= 16 ? 1 : 0) +
                (type === 'rifle' && lv >= 14 ? 1 : 0) +
                (type === 'pistol' && lv >= 8 ? 1 : 0) +
                (type === 'pistol' && lv >= 16 ? 1 : 0) +
                (type === 'laser' && lv >= 18 ? 1 : 0) +
                (type === 'laser' && lv >= 24 ? 1 : 0);
            const baseScaled: WeaponConfig = {
                ...config,
                damage: Math.max(1, Math.round(config.damage * levelDamageMul * arsenalDamageMul)),
                fireRate: Math.max(30, Math.round(config.fireRate * levelFireRateMul * arsenalFireRateMul)),
                projectileCount: Math.max(1, config.projectileCount + adaptiveProjectileBonus),
            };
            return this.applyGearBonuses(baseScaled, type);
        }

        const effectiveId = slot.evolved && slot.evolvedId ? slot.evolvedId : slot.id;
        const scaledDef = getWeaponAtLevel(effectiveId, slot.evolved ? 1 : slot.level);
        if (!scaledDef) return { ...config };

        const damageMul = config.damage > 0 ? (scaledDef.damage / config.damage) : 1;
        const fireRateMul = config.fireRate > 0 ? (scaledDef.fireRate / config.fireRate) : 1;

        const evolvedBonus = slot.evolved ? 1.24 : 1;
        const levelProjectileBonus = Math.floor((Math.max(1, slot.level) - 1) / 3);
        const projectileBonus = type === 'shotgun'
            ? levelProjectileBonus + (slot.level >= 7 ? 1 : 0) + (slot.level >= 12 ? 1 : 0)
            : (type === 'rifle'
                ? Math.floor((levelProjectileBonus + 1) / 2) + (slot.level >= 9 ? 1 : 0) + (slot.level >= 15 ? 1 : 0)
                : (type === 'pistol'
                    ? (slot.level >= 6 ? 1 : 0) + (slot.level >= 12 ? 1 : 0)
                    : (type === 'laser' && slot.level >= 10 ? 1 : 0)));
        const scaledConfig: WeaponConfig = {
            ...config,
            damage: Math.max(1, Math.round(config.damage * damageMul * levelDamageMul * evolvedBonus * arsenalDamageMul)),
            fireRate: Math.max(30, Math.round(config.fireRate * fireRateMul * levelFireRateMul * arsenalFireRateMul)),
            range: Math.round(config.range * (1 + (slot.level - 1) * 0.11)),
            speed: Math.round(config.speed * (1 + (slot.level - 1) * 0.08)),
            projectileCount: Math.max(1, config.projectileCount + projectileBonus),
        };
        return this.applyGearBonuses(scaledConfig, type);
    }

    private applyGearBonuses(config: WeaponConfig, type: WeaponType): WeaponConfig {
        const bonuses = gameState.getWeaponGearBonuses(type);
        const equipped = gameState.getEquippedGearForWeapon(type);
        return {
            ...config,
            damage: Math.max(1, Math.round(config.damage * Math.max(0.5, bonuses.damageMul || 1))),
            fireRate: Math.max(24, Math.round(config.fireRate / Math.max(0.45, bonuses.fireRateMul || 1))),
            speed: Math.max(80, Math.round(config.speed * Math.max(0.6, bonuses.speedMul || 1))),
            projectileCount: Math.max(1, config.projectileCount + Math.max(0, bonuses.projectileBonus || 0)),
            color: this.getGearRarityTint(equipped?.rarity) || config.color,
        };
    }

    private getGearRarityTint(rarity?: string): number | null {
        if (rarity === 'mythic') return 0xef4444;
        if (rarity === 'legendary') return 0xf59e0b;
        if (rarity === 'epic') return 0xa855f7;
        if (rarity === 'rare') return 0x10b981;
        if (rarity === 'magic') return 0x3b82f6;
        if (rarity === 'common') return 0x94a3b8;
        return null;
    }

    private createBullet(
        x: number,
        y: number,
        vx: number,
        vy: number,
        config: WeaponConfig,
        damageValue: number,
        specialValue: WeaponConfig['special'],
        brandTint?: number,
        homingEnabled?: boolean,
        weaponType?: WeaponType,
        motion?: SignatureMotionOptions
    ): void {
        let bullet = this.acquireBullet(x, y);
        if (!bullet) return;

        bullet.enableBody(true, x, y, true, true);
        const bulletTexture = this.getBulletTextureByWeapon(weaponType, specialValue);
        bullet.setTexture(bulletTexture);
        bullet.setBlendMode(Phaser.BlendModes.ADD);
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setAlpha(1);
        let tint = config.color;
        let bulletScale = this.getPixelBulletScale(bulletTexture);
        if (specialValue === 'burn') {
            tint = 0xff6b1a;
        } else if (specialValue === 'pierce') {
            tint = 0x7dd3fc;
        } else if (specialValue === 'explode') {
            tint = 0xa855f7;
            bulletScale = 3;
        } else if (specialValue === 'chain') {
            tint = 0xc084fc;
        } else if (brandTint != null) {
            tint = brandTint;
        }
        bullet.setTint(tint);
        bullet.setScale(bulletScale);
        bullet.setAlpha(0.96);
        bullet.setRotation(Math.atan2(vy, vx) + Math.PI / 2);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (!body) {
            this.disableBullet(bullet);
            return;
        }
        body.reset(x, y);
        body.setAllowGravity(false);
        const radius = Math.max(4, Math.min(7, Math.floor(4 * bulletScale)));
        body.setCircle(radius, bullet.width / 2 - radius, bullet.height / 2 - radius);
        body.setVelocity(vx, vy);
        body.setCollideWorldBounds(false);
        body.setBounce(0, 0);
        body.setDrag(0, 0);

        // Apply damage and other properties (reset both legacy and VS fields)
        const anyBullet = bullet as any;
        anyBullet.damage = damageValue;
        anyBullet.special = specialValue;
        anyBullet.weaponDamage = damageValue;
        anyBullet.weaponSpecial = specialValue;
        anyBullet.weaponType = weaponType || this.currentWeapon;
        anyBullet.isPlayerBullet = true;
        anyBullet.isHoming = !!homingEnabled;
        anyBullet.homingTarget = null;
        anyBullet.homingStrength = homingEnabled ? 0.16 : null;
        anyBullet.bulletTextureKey = bulletTexture;
        anyBullet.baseVelocityX = vx;
        anyBullet.baseVelocityY = vy;
        const swayAmp = bulletTexture === 'bullet_pulse'
            ? 18
            : bulletTexture === 'bullet_chain'
                ? 14
                : bulletTexture === 'bullet_flame'
                    ? 10
                    : 0;
        anyBullet.swayAmplitude = motion?.swayAmplitude ?? swayAmp;
        const fallbackFrequency = swayAmp > 0 ? (bulletTexture === 'bullet_flame' ? 0.02 : 0.013) : 0;
        anyBullet.swayFrequency = motion?.swayFrequency ?? fallbackFrequency;
        anyBullet.swayPhase = motion?.swayPhase ?? (Math.random() * Math.PI * 2);

        // Cleanup: disable for pooling
        if (anyBullet.lifetimeTimer) {
            anyBullet.lifetimeTimer.remove();
            anyBullet.lifetimeTimer = null;
        }
        if (anyBullet.vsLifetimeTimer) {
            anyBullet.vsLifetimeTimer.remove();
            anyBullet.vsLifetimeTimer = null;
        }

        const lifeTime = (config.range / config.speed) * 1000;
        anyBullet.lifetimeTimer = this.scene.time.delayedCall(lifeTime, () => {
            anyBullet.lifetimeTimer = null;
            if (bullet.active) {
                anyBullet.weaponDamage = null;
                anyBullet.weaponSpecial = null;
                anyBullet.damage = null;
                anyBullet.special = null;
                anyBullet.bulletEffect = null;
                anyBullet.isHoming = false;
                anyBullet.homingTarget = null;
                anyBullet.homingStrength = null;
                anyBullet.bulletTextureKey = null;
                anyBullet.baseVelocityX = null;
                anyBullet.baseVelocityY = null;
                anyBullet.swayAmplitude = null;
                anyBullet.swayFrequency = null;
                anyBullet.swayPhase = null;
                bullet.setVelocity(0, 0);
                bullet.disableBody(true, true);
            }
        });
        anyBullet.spawnTime = this.scene.time.now;
        anyBullet.maxLifetime = lifeTime + 200;
    }

    private getBulletTextureByWeapon(
      weaponType: WeaponType | undefined,
      specialValue: WeaponConfig['special']
    ): string {
      if (specialValue === 'burn') return 'bullet_flame';
      if (specialValue === 'pierce') return 'bullet_pierce';
      if (specialValue === 'explode') return 'bullet_cannon';
      if (specialValue === 'chain') return 'bullet_chain';
      if (weaponType === 'shotgun') return 'bullet_scatter';
      if (weaponType === 'rifle') return 'bullet_pulse';
      if (weaponType === 'flamethrower') return 'bullet_flame';
      if (weaponType === 'laser') return 'bullet_pierce';
      if (weaponType === 'rocket') return 'bullet_cannon';
      if (weaponType === 'orbit') return 'bullet_orbit';
      if (weaponType === 'holy_water') return 'bullet_holy';
      if (weaponType === 'lightning_ring') return 'bullet_chain';
      if (weaponType === 'boomerang') return 'bullet_boomerang';
      return 'bullet';
    }

    private getPixelBulletScale(textureKey: string): number {
        if (textureKey === 'bullet_cannon') return 3;
        return 2;
    }

    private acquireBullet(x: number, y: number): Phaser.Physics.Arcade.Sprite | null {
        let bullet = this.bullets.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
        if (!bullet) {
            const recycle = this.findOldestActiveBullet();
            if (recycle) this.disableBullet(recycle);
            bullet = this.bullets.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
        }
        return bullet;
    }

    private findOldestActiveBullet(): Phaser.Physics.Arcade.Sprite | null {
        let oldest: Phaser.Physics.Arcade.Sprite | null = null;
        let oldestTime = Infinity;
        for (const child of this.bullets.getChildren()) {
            const b = child as Phaser.Physics.Arcade.Sprite;
            if (!b.active) continue;
            const t = (b as any).spawnTime ?? 0;
            if (t < oldestTime) {
                oldestTime = t;
                oldest = b;
            }
        }
        return oldest;
    }

    private disableBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
        const anyBullet = bullet as any;
        if (anyBullet.lifetimeTimer) {
            anyBullet.lifetimeTimer.remove();
            anyBullet.lifetimeTimer = null;
        }
        if (anyBullet.vsLifetimeTimer) {
            anyBullet.vsLifetimeTimer.remove();
            anyBullet.vsLifetimeTimer = null;
        }
        anyBullet.weaponDamage = null;
        anyBullet.weaponSpecial = null;
        anyBullet.weaponType = null;
        anyBullet.damage = null;
        anyBullet.special = null;
        anyBullet.bulletEffect = null;
        anyBullet.isHoming = false;
        anyBullet.homingTarget = null;
        anyBullet.homingStrength = null;
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

    private getSafeSpawnPoint(originX: number, originY: number, angle: number): { x: number; y: number } {
        const maxDistance = 48;
        const step = 4;
        let distance = 18;
        let lastPoint = { x: originX, y: originY };

        while (distance <= maxDistance) {
            const testX = originX + Math.cos(angle) * distance;
            const testY = originY + Math.sin(angle) * distance;
            if (!this.pointInsideObstacle(testX, testY)) {
                return { x: testX, y: testY };
            }
            lastPoint = { x: testX, y: testY };
            distance += step;
        }

        return lastPoint;
    }

    private pointInsideObstacle(x: number, y: number): boolean {
        for (const group of this.obstacleGroups) {
            const children = group.getChildren() as Phaser.Physics.Arcade.Sprite[];
            for (const sprite of children) {
                if (!sprite || !sprite.active || !sprite.visible) continue;
                const bounds = sprite.getBounds();
                if (bounds.contains(x, y)) {
                    return true;
                }
            }
        }

        for (const sprite of this.obstacleSprites) {
            if (!sprite || !sprite.active || !sprite.visible) continue;
            const bounds = sprite.getBounds();
            if (bounds.contains(x, y)) {
                return true;
            }
        }

        return false;
    }
}
