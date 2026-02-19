import Phaser from 'phaser';

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow';

interface WeatherPerfOptions {
    lowPerfMode?: boolean;
    ultraLowPerfMode?: boolean;
}

export class WeatherSystem {
    private scene: Phaser.Scene;
    private currentWeather: WeatherType = 'clear';
    private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private weatherTimer: Phaser.Time.TimerEvent | null = null;
    private lightningOverlay: Phaser.GameObjects.Rectangle | null = null;
    private isStorming: boolean = false;
    private lowPerfMode: boolean = false;
    private ultraLowPerfMode: boolean = false;

    constructor(scene: Phaser.Scene, options: WeatherPerfOptions = {}) {
        this.scene = scene;
        this.lowPerfMode = !!options.lowPerfMode;
        this.ultraLowPerfMode = !!options.ultraLowPerfMode;
        this.createAssets();
    }

    private createAssets(): void {
        if (!this.scene.textures.exists('weather_particle')) {
            const canvas = this.scene.textures.createCanvas('weather_particle', 4, 10);
            if (canvas) {
                const ctx = canvas.getContext();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 4, 10);
                canvas.refresh();
            }
        }
    }

    public enable(): void {
        this.scheduleNextWeather();

        // Use a simple rectangle for lightning flash (cleaner than Graphics)
        const cam = this.scene.cameras.main;
        this.lightningOverlay = this.scene.add.rectangle(
            cam.width / 2, cam.height / 2,
            cam.width, cam.height,
            0xffffff, 0
        );
        this.lightningOverlay.setScrollFactor(0);
        this.lightningOverlay.setDepth(2000);
        this.lightningOverlay.setAlpha(0); // Start fully invisible
    }

    private scheduleNextWeather(): void {
        const delay = Phaser.Math.Between(40000, 80000); // Less frequent
        this.weatherTimer = this.scene.time.delayedCall(delay, () => {
            this.changeWeather();
            this.scheduleNextWeather();
        });
    }

    public changeWeather(forceType?: WeatherType): void {
        if (this.emitter) {
            this.emitter.stop();
            this.emitter.destroy();
            this.emitter = null;
        }

        // Ensure lightning overlay is hidden when weather changes
        if (this.lightningOverlay) {
            this.scene.tweens.killTweensOf(this.lightningOverlay);
            this.lightningOverlay.setAlpha(0);
        }

        if (forceType) {
            this.currentWeather = forceType;
        } else {
            const roll = Math.random();
            if (roll < 0.5) this.currentWeather = 'clear';
            else if (roll < 0.75) this.currentWeather = 'rain';
            else if (roll < 0.9) this.currentWeather = 'storm';
            else this.currentWeather = 'snow';
        }

        this.isStorming = this.currentWeather === 'storm';

        if (this.currentWeather !== 'clear') {
            this.startWeatherEffect();
        }
    }

    private startWeatherEffect(): void {
        const width = this.scene.cameras.main.width;

        let speedY = 0;
        let speedX = 0;
        let lifelong = 0;
        let frequency = 0;
        let alpha = 1;
        let scale = 1;
        let tint = 0xffffff;

        switch (this.currentWeather) {
            case 'rain':
                speedY = 400;
                speedX = -50;
                lifelong = 1000;
                frequency = 10;
                alpha = 0.5;
                tint = 0xaaaaff;
                scale = 1;
                break;
            case 'storm':
                speedY = 600;
                speedX = -200;
                lifelong = 800;
                frequency = 5;
                alpha = 0.7;
                tint = 0x8888aa;
                scale = 1;
                break;
            case 'snow':
                speedY = 100;
                speedX = -20;
                lifelong = 3000;
                frequency = 50;
                alpha = 0.7;
                tint = 0xffffff;
                scale = 0.5;
                break;
        }
        if (this.lowPerfMode) {
            frequency = Math.round(frequency * 1.8);
            alpha *= 0.8;
            scale *= 0.9;
        }
        if (this.ultraLowPerfMode) {
            frequency = Math.round(frequency * 2.8);
            alpha *= 0.7;
            scale *= 0.8;
        }

        this.emitter = this.scene.add.particles(0, -50, 'weather_particle', {
            x: { min: -100, max: width + 100 },
            y: -50,
            lifespan: lifelong,
            speedY: { min: speedY * 0.8, max: speedY * 1.2 },
            speedX: { min: speedX - 20, max: speedX + 20 },
            quantity: this.ultraLowPerfMode ? 1 : this.lowPerfMode ? 1 : 2,
            frequency: frequency,
            alpha: { start: alpha, end: 0 },
            scale: scale,
            tint: tint,
            blendMode: 'ADD'
        });

        this.emitter.setDepth(1500);
        this.emitter.setScrollFactor(0);

        if (this.isStorming) {
            this.scheduleLightning();
        }
    }

    private scheduleLightning(): void {
        if (!this.isStorming) return;

        this.scene.time.delayedCall(Phaser.Math.Between(4000, 12000), () => {
            if (this.isStorming) {
                this.flashLightning();
                this.scheduleLightning();
            }
        });
    }

    private flashLightning(): void {
        if (!this.lightningOverlay) return;

        // Kill any existing tween to prevent stacking
        this.scene.tweens.killTweensOf(this.lightningOverlay);

        // Flash: quick bright flash then fade out
        this.lightningOverlay.setAlpha(0.25);

        if (!this.ultraLowPerfMode) {
            this.scene.cameras.main.shake(this.lowPerfMode ? 50 : 80, this.lowPerfMode ? 0.002 : 0.003);
        }

        this.scene.tweens.add({
            targets: this.lightningOverlay,
            alpha: 0,
            duration: 180,
            ease: 'Quad.easeOut'
            // No need for onComplete cleanup — alpha is already 0
        });
    }

    public update(): void {
        // Dynamic updates if needed
    }

    public destroy(): void {
        if (this.weatherTimer) {
            this.weatherTimer.remove();
            this.weatherTimer = null;
        }
        if (this.emitter) {
            this.emitter.stop();
            this.emitter.destroy();
            this.emitter = null;
        }
        if (this.lightningOverlay) {
            this.scene.tweens.killTweensOf(this.lightningOverlay);
            this.lightningOverlay.destroy();
            this.lightningOverlay = null;
        }
    }
}
