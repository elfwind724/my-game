import Phaser from 'phaser';

export class AnimationSystem {
    private scene: Phaser.Scene;
    private isPlayingRecoil: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    private getBaseScale(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): { x: number; y: number } {
        let baseX = Number((target as any).getData?.('baseScaleX'));
        let baseY = Number((target as any).getData?.('baseScaleY'));
        if (!Number.isFinite(baseX) || baseX <= 0) baseX = target.scaleX || 1;
        if (!Number.isFinite(baseY) || baseY <= 0) baseY = target.scaleY || 1;
        (target as any).setData?.('baseScaleX', baseX);
        (target as any).setData?.('baseScaleY', baseY);
        return { x: baseX, y: baseY };
    }

    /**
     * Plays a one-shot recoil animation (squash).
     * Uses stored base scale to avoid compounding scale errors.
     */
    public playRecoil(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, factor: number = 0.2): void {
        if (this.isPlayingRecoil) return; // Prevent stacking
        this.isPlayingRecoil = true;
        const base = this.getBaseScale(target);

        // Kill any existing tweens on this target to prevent conflicts
        this.scene.tweens.killTweensOf(target);

        target.scaleX = base.x;
        target.scaleY = base.y;

        this.scene.tweens.add({
            targets: target,
            scaleX: base.x * (1 + factor),
            scaleY: base.y * (1 - factor),
            duration: 50,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                target.scaleX = base.x;
                target.scaleY = base.y;
                this.isPlayingRecoil = false;
            }
        });
    }

    /**
     * Hit flash effect (tint white/red and mini-shake).
     * Does NOT modify scale to avoid conflicts with squash-and-stretch.
     */
    public playHitEffect(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): void {
        target.setTint(0xffaaaa);
        target.setAlpha(0.7);

        this.scene.time.delayedCall(80, () => {
            if (target.active) {
                target.clearTint();
                target.setAlpha(1);
            }
        });
    }

    /**
     * Dynamic squash and stretch based on velocity.
     * Skipped when recoil is playing to prevent conflicts.
     */
    public updateSquashAndStretch(target: Phaser.Physics.Arcade.Sprite): void {
        if (!target.body) return;
        if (this.isPlayingRecoil) return; // Don't fight with recoil tween
        const base = this.getBaseScale(target);

        const speed = target.body.velocity.length();

        if (speed > 10) {
            // Walking bob
            const t = this.scene.time.now / 100;
            const stretch = Math.sin(t * 1.5) * 0.05; // Reduced from 0.1 to 0.05 for subtlety

            // Face direction
            if (target.body.velocity.x < 0) {
                target.setFlipX(true);
            } else if (target.body.velocity.x > 0) {
                target.setFlipX(false);
            }

            target.scaleY = base.y * (1 + stretch);
            target.scaleX = base.x * (1 - stretch * 0.5);
        } else {
            // Return to normal smoothly
            const diffY = base.y - target.scaleY;
            const diffX = base.x - target.scaleX;
            if (Math.abs(diffY) > 0.01 || Math.abs(diffX) > 0.01) {
                target.scaleY += diffY * 0.2;
                target.scaleX += diffX * 0.2;
            } else {
                target.scaleY = base.y;
                target.scaleX = base.x;
            }
        }
    }
}
