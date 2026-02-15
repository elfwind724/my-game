import Phaser from 'phaser';
import { BaseSystem } from '../systems/BaseSystem';
import { gameState } from '../state/GameState';
import { events } from '../utils/EventBus';

interface LeisureActivityDef {
  id: 'card' | 'music' | 'ar_duel';
  title: string;
  desc: string;
  color: string;
}

type RoundResult = 'perfect' | 'good' | 'poor';
type MiniMode = 'timing' | 'qte';

interface MiniGameState {
  activity: LeisureActivityDef;
  mode: MiniMode;
  round: number;
  totalRounds: number;
  bonusRound: number;
  hardRound: number;
  reverseRound: number;
  luckyRound: number;
  glitchRound: number;
  score: number;
  perfect: number;
  good: number;
  poor: number;
  streak: number;
  maxStreak: number;
}

const ACTIVITIES: LeisureActivityDef[] = [
  {
    id: 'card',
    title: '牌局时间',
    desc: '节奏判定越准，牌局收益越高',
    color: '#fbbf24',
  },
  {
    id: 'music',
    title: '篝火音乐会',
    desc: '按准节拍，提升医疗与净水产出',
    color: '#38bdf8',
  },
  {
    id: 'ar_duel',
    title: 'AR战术对练',
    desc: '战术判定越高，训练奖励越强',
    color: '#a78bfa',
  },
];

export class LeisurePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private open = false;
  private width = 420;

  private miniLayer: Phaser.GameObjects.Container | null = null;
  private miniState: MiniGameState | null = null;
  private miniBar: Phaser.GameObjects.Rectangle | null = null;
  private miniZone: Phaser.GameObjects.Rectangle | null = null;
  private miniDangerZone: Phaser.GameObjects.Rectangle | null = null;
  private miniPointer: Phaser.GameObjects.Rectangle | null = null;
  private miniTween: Phaser.Tweens.Tween | null = null;
  private miniTimeout: Phaser.Time.TimerEvent | null = null;
  private miniHintText: Phaser.GameObjects.Text | null = null;
  private miniRoundText: Phaser.GameObjects.Text | null = null;
  private miniResultText: Phaser.GameObjects.Text | null = null;
  private miniStreakText: Phaser.GameObjects.Text | null = null;
  private miniEventText: Phaser.GameObjects.Text | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private onSpaceDown = () => this.judgeMiniRound();
  private qtePromptText: Phaser.GameObjects.Text | null = null;
  private qteTimerBg: Phaser.GameObjects.Rectangle | null = null;
  private qteTimerBar: Phaser.GameObjects.Rectangle | null = null;
  private qteTween: Phaser.Tweens.Tween | null = null;
  private qteDeadlineAt: number = 0;
  private qteExpectedKey: number | null = null;
  private qteRoundStartedAt: number = 0;
  private qteSequence: number[] = [];
  private qteSequenceLabels: string[] = [];
  private qteStepIndex: number = 0;
  private onQteKeyDown = (event: KeyboardEvent) => this.handleQteKey(event);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getIsOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    const h = this.scene.cameras.main.height;

    this.container = this.scene.add.container(-this.width, 0).setScrollFactor(0).setDepth(2900);
    const bg = this.scene.add.rectangle(this.width / 2, h / 2, this.width, h, 0x111827, 0.95);
    bg.setStrokeStyle(2, 0x38bdf8, 0.9);
    bg.setInteractive();
    this.container.add(bg);

    const title = this.scene.add.text(20, 16, '基地休闲活动', {
      fontSize: '22px',
      color: '#38bdf8',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    });
    this.container.add(title);

    const close = this.scene.add.text(this.width - 18, 14, '✕', {
      fontSize: '20px',
      color: '#ef4444',
      fontFamily: 'Courier New',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    this.container.add(close);

    const stateText = this.scene.add.text(20, 52, this.getStatusText(), {
      fontSize: '12px',
      color: '#cbd5e1',
      fontFamily: 'Courier New',
    });
    this.container.add(stateText);

    let y = 110;
    ACTIVITIES.forEach(activity => {
      const card = this.scene.add.rectangle(this.width / 2, y + 36, this.width - 30, 72, 0x0f172a, 0.95);
      card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(activity.color).color, 0.9);
      this.container!.add(card);

      this.container!.add(this.scene.add.text(26, y + 10, activity.title, {
        fontSize: '16px',
        color: activity.color,
        fontFamily: 'Courier New',
        fontStyle: 'bold',
      }));

      this.container!.add(this.scene.add.text(26, y + 34, activity.desc, {
        fontSize: '12px',
        color: '#94a3b8',
        fontFamily: 'Courier New',
      }));

      const btn = this.scene.add.text(this.width - 30, y + 24, '挑战', {
        fontSize: '13px',
        color: '#0f172a',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
        backgroundColor: activity.color,
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        if (!BaseSystem.canPlayLeisureToday()) {
          this.showToast(gameState.data.isNight ? '夜晚无法进行休闲活动' : '今天已进行过活动', '#ef4444');
          stateText.setText(this.getStatusText());
          return;
        }
        this.startMiniGame(activity, stateText);
      });
      this.container!.add(btn);

      y += 88;
    });

    this.scene.tweens.add({
      targets: this.container,
      x: 0,
      duration: 260,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    if (!this.open || !this.container) return;
    this.open = false;
    this.teardownMiniGame();
    this.scene.tweens.add({
      targets: this.container,
      x: -this.width - 10,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container?.destroy();
        this.container = null;
      },
    });
  }

  private startMiniGame(activity: LeisureActivityDef, stateText: Phaser.GameObjects.Text): void {
    if (!this.container || this.miniLayer) return;
    const mode: MiniMode = activity.id === 'ar_duel' ? 'qte' : 'timing';
    const h = this.scene.cameras.main.height;
    this.miniState = {
      activity,
      mode,
      round: 1,
      totalRounds: 5,
      bonusRound: Phaser.Math.Between(2, 5),
      hardRound: Phaser.Math.Between(1, 5),
      reverseRound: mode === 'qte' ? Phaser.Math.Between(2, 5) : -1,
      luckyRound: Phaser.Math.Between(1, 5),
      glitchRound: Phaser.Math.Between(1, 5),
      score: 0,
      perfect: 0,
      good: 0,
      poor: 0,
      streak: 0,
      maxStreak: 0,
    };
    if (this.miniState.hardRound === this.miniState.bonusRound) {
      this.miniState.hardRound = this.miniState.hardRound >= 5 ? 1 : this.miniState.hardRound + 1;
    }
    if (this.miniState.reverseRound === this.miniState.bonusRound) {
      this.miniState.reverseRound = this.miniState.reverseRound >= 5 ? 1 : this.miniState.reverseRound + 1;
    }
    if (this.miniState.luckyRound === this.miniState.bonusRound) {
      this.miniState.luckyRound = this.miniState.luckyRound >= 5 ? 1 : this.miniState.luckyRound + 1;
    }
    if (this.miniState.glitchRound === this.miniState.bonusRound || this.miniState.glitchRound === this.miniState.luckyRound) {
      this.miniState.glitchRound = this.miniState.glitchRound >= 5 ? 1 : this.miniState.glitchRound + 1;
    }

    this.miniLayer = this.scene.add.container(14, h - 268).setDepth(2995);
    this.container.add(this.miniLayer);
    const panelW = this.width - 28;
    const panelH = 248;

    const panelBg = this.scene.add.rectangle(panelW / 2, panelH / 2, panelW, panelH, 0x0b1220, 0.97);
    panelBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(activity.color).color, 0.9);
    panelBg.setInteractive();
    this.miniLayer.add(panelBg);

    const title = this.scene.add.text(14, 12, `${activity.title} · 判定挑战`, {
      fontSize: '16px',
      color: activity.color,
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    });
    this.miniLayer.add(title);

    this.miniRoundText = this.scene.add.text(14, 34, '第1/5轮', {
      fontSize: '12px',
      color: '#e2e8f0',
      fontFamily: 'Courier New',
    });
    this.miniLayer.add(this.miniRoundText);

    const hint = mode === 'qte'
      ? '按提示方向键，越快越准奖励越高'
      : '让光标停在亮区，点击“判定”或按 Space';
    this.miniHintText = this.scene.add.text(14, 54, hint, {
      fontSize: '11px',
      color: '#94a3b8',
      fontFamily: 'Courier New',
    });
    this.miniLayer.add(this.miniHintText);

    this.miniStreakText = this.scene.add.text(panelW - 14, 54, '连击 x0', {
      fontSize: '11px',
      color: '#a7f3d0',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.miniLayer.add(this.miniStreakText);

    this.miniEventText = this.scene.add.text(14, 72, '', {
      fontSize: '11px',
      color: '#fde68a',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
    });
    this.miniLayer.add(this.miniEventText);

    const barX = 18;
    const barY = 108;
    const barW = panelW - 36;
    const barH = 26;
    if (mode === 'timing') {
      this.miniBar = this.scene.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x111827, 1).setOrigin(0.5);
      this.miniBar.setStrokeStyle(1, 0x334155, 1);
      this.miniLayer.add(this.miniBar);

      this.miniZone = this.scene.add.rectangle(barX + 80, barY + barH / 2, 26, barH - 6, 0x22c55e, 0.7).setOrigin(0.5);
      this.miniLayer.add(this.miniZone);
      this.miniDangerZone = this.scene.add.rectangle(barX + 130, barY + barH / 2, 22, barH - 8, 0xef4444, 0.5).setOrigin(0.5);
      this.miniLayer.add(this.miniDangerZone);

      this.miniPointer = this.scene.add.rectangle(barX + 20, barY + barH / 2, 6, barH + 4, 0xf8fafc, 0.95).setOrigin(0.5);
      this.miniLayer.add(this.miniPointer);
    } else {
      this.qtePromptText = this.scene.add.text(panelW / 2, 120, '←', {
        fontSize: '56px',
        color: '#f8fafc',
        fontFamily: 'Courier New',
        fontStyle: 'bold',
        stroke: '#0b1220',
        strokeThickness: 4,
      }).setOrigin(0.5);
      this.miniLayer.add(this.qtePromptText);

      this.qteTimerBg = this.scene.add.rectangle(barX + barW / 2, 164, barW, 16, 0x111827, 1).setOrigin(0.5);
      this.qteTimerBg.setStrokeStyle(1, 0x334155, 1);
      this.miniLayer.add(this.qteTimerBg);

      this.qteTimerBar = this.scene.add.rectangle(barX, 164, barW, 10, 0x38bdf8, 0.9).setOrigin(0, 0.5);
      this.miniLayer.add(this.qteTimerBar);
    }

    this.miniResultText = this.scene.add.text(panelW / 2, 158, '', {
      fontSize: '16px',
      color: '#f8fafc',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.miniLayer.add(this.miniResultText);

    const judgeLabel = mode === 'qte' ? '方向键判定 [↑↓←→]' : '判定  [SPACE]';
    const judgeBtn = this.scene.add.text(panelW / 2, 194, judgeLabel, {
      fontSize: '13px',
      color: '#0b1220',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      backgroundColor: mode === 'qte' ? '#38bdf8' : '#22c55e',
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    judgeBtn.on('pointerdown', () => {
      if (mode === 'timing') this.judgeMiniRound();
    });
    this.miniLayer.add(judgeBtn);

    const cancelBtn = this.scene.add.text(panelW - 14, 14, '放弃', {
      fontSize: '12px',
      color: '#ef4444',
      fontFamily: 'Courier New',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => {
      this.teardownMiniGame();
      this.showToast('已取消休闲挑战', '#94a3b8');
    });
    this.miniLayer.add(cancelBtn);

    if (mode === 'timing') {
      this.spaceKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) || null;
      this.spaceKey?.on('down', this.onSpaceDown);
      this.startMiniRound();
    } else {
      this.scene.input.keyboard?.on('keydown', this.onQteKeyDown);
      this.startQteRound();
    }

    const oldSetText = stateText.setText.bind(stateText);
    oldSetText(this.getStatusText());
  }

  private startMiniRound(): void {
    if (!this.miniState || !this.miniBar || !this.miniZone || !this.miniPointer || !this.miniRoundText) return;
    const state = this.miniState;
    this.miniRoundText.setText(`第${state.round}/${state.totalRounds}轮`);
    this.miniStreakText?.setText(`连击 x${state.streak}`);
    this.miniResultText?.setText('');
    const isBonusRound = state.round === state.bonusRound;
    const isHardRound = state.round === state.hardRound;
    const isLuckyRound = state.round === state.luckyRound;
    const isGlitchRound = state.round === state.glitchRound;
    this.miniEventText?.setText(
      isBonusRound
        ? '奖励回合：本轮判定得分翻倍'
        : isLuckyRound
          ? '欧皇回合：成功判定追加奖励'
          : isGlitchRound
            ? '干扰回合：失误将扣分'
        : isHardRound
          ? '高压回合：危险区更宽，指针更快'
          : '普通回合：保持节奏稳定发挥'
    );

    const left = this.miniBar.x - this.miniBar.width / 2 + 10;
    const right = this.miniBar.x + this.miniBar.width / 2 - 10;
    const zoneX = Phaser.Math.Between(Math.floor(left + 30), Math.floor(right - 30));
    this.miniZone.x = zoneX;
    this.miniZone.width = isBonusRound ? Phaser.Math.Between(18, 24) : Phaser.Math.Between(20, 28);
    this.miniZone.setFillStyle(0x22c55e, 0.75);
    if (this.miniDangerZone) {
      let dangerX = zoneX;
      const dangerW = isHardRound ? Phaser.Math.Between(24, 32) : Phaser.Math.Between(16, 24);
      for (let i = 0; i < 8; i += 1) {
        dangerX = Phaser.Math.Between(Math.floor(left + 24), Math.floor(right - 24));
        if (Math.abs(dangerX - zoneX) > (this.miniZone.width + dangerW) * 0.65) break;
      }
      this.miniDangerZone.x = dangerX;
      this.miniDangerZone.width = dangerW;
      this.miniDangerZone.setFillStyle(0xef4444, 0.52);
    }
    this.miniPointer.x = left;

    this.miniTween?.remove();
    const speedBase = Phaser.Math.Clamp(980 - state.round * 110 - state.streak * 36, 320, 980);
    const speed = isHardRound ? Math.max(250, Math.round(speedBase * 0.82)) : speedBase;
    this.miniTween = this.scene.tweens.add({
      targets: this.miniPointer,
      x: right,
      duration: speed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.miniTimeout?.remove(false);
    this.miniTimeout = this.scene.time.delayedCall(2450, () => this.judgeMiniRound(true));
  }

  private startQteRound(): void {
    if (!this.miniState || !this.qtePromptText || !this.qteTimerBar || !this.miniRoundText) return;
    const state = this.miniState;
    this.miniRoundText.setText(`第${state.round}/${state.totalRounds}轮`);
    this.miniStreakText?.setText(`连击 x${state.streak}`);
    this.miniResultText?.setText('');
    const isBonusRound = state.round === state.bonusRound;
    const isReverseRound = state.round === state.reverseRound;
    const isLuckyRound = state.round === state.luckyRound;
    const isGlitchRound = state.round === state.glitchRound;
    this.miniEventText?.setText(
      isBonusRound
        ? '奖励回合：本轮判定得分翻倍'
        : isLuckyRound
          ? '欧皇回合：成功判定追加奖励'
          : isGlitchRound
            ? '干扰回合：失误将扣分'
        : isReverseRound
          ? '逆向回合：输入提示方向的相反键'
          : '普通回合：输入提示方向键'
    );

    const candidates = [
      { key: Phaser.Input.Keyboard.KeyCodes.UP, label: '↑' },
      { key: Phaser.Input.Keyboard.KeyCodes.DOWN, label: '↓' },
      { key: Phaser.Input.Keyboard.KeyCodes.LEFT, label: '←' },
      { key: Phaser.Input.Keyboard.KeyCodes.RIGHT, label: '→' },
    ];
    const chainLen = state.round >= 4 ? 3 : state.round >= 2 ? 2 : 1;
    this.qteSequence = [];
    this.qteSequenceLabels = [];
    this.qteStepIndex = 0;
    for (let i = 0; i < chainLen; i += 1) {
      const pick = candidates[Phaser.Math.Between(0, candidates.length - 1)];
      this.qteSequence.push(pick.key);
      this.qteSequenceLabels.push(pick.label);
    }
    this.qteExpectedKey = this.qteSequence[0] || null;
    this.qtePromptText.setText(this.formatQtePrompt());
    this.qtePromptText.setColor('#f8fafc');
    this.miniHintText?.setText(
      isReverseRound
        ? `逆向输入连段 ${this.qteSequenceLabels.join(' ')}（按相反方向）`
        : `输入连段 ${this.qteSequenceLabels.join(' ')}，越快奖励越高`
    );

    this.qteTween?.remove();
    const lifeBase = Phaser.Math.Clamp(1450 - state.round * 120, 720, 1450);
    const lifetime = isBonusRound ? Math.round(lifeBase * 0.92) : lifeBase;
    this.qteRoundStartedAt = this.scene.time.now;
    this.qteDeadlineAt = this.qteRoundStartedAt + lifetime;
    this.qteTimerBar.width = this.qteTimerBg?.width || this.qteTimerBar.width;
    this.qteTimerBar.setFillStyle(0x38bdf8, 0.9);
    this.qteTween = this.scene.tweens.add({
      targets: this.qteTimerBar,
      width: 0,
      duration: lifetime,
      ease: 'Linear',
      onComplete: () => this.judgeQteRound('timeout'),
    });
  }

  private handleQteKey(event: KeyboardEvent): void {
    if (!this.miniState || this.miniState.mode !== 'qte') return;
    if (!this.qteExpectedKey) return;
    if (this.scene.time.now > this.qteDeadlineAt) {
      this.judgeQteRound('timeout');
      return;
    }
    const keyCode = event.keyCode;
    if (
      keyCode !== Phaser.Input.Keyboard.KeyCodes.UP
      && keyCode !== Phaser.Input.Keyboard.KeyCodes.DOWN
      && keyCode !== Phaser.Input.Keyboard.KeyCodes.LEFT
      && keyCode !== Phaser.Input.Keyboard.KeyCodes.RIGHT
    ) {
      return;
    }

    const inputKey = this.mapQteInputByRound(keyCode);
    if (inputKey !== this.qteExpectedKey) {
      this.judgeQteRound('wrong');
      return;
    }
    this.qteStepIndex += 1;
    if (this.qteStepIndex >= this.qteSequence.length) {
      this.judgeQteRound('hit');
      return;
    }
    this.qteExpectedKey = this.qteSequence[this.qteStepIndex];
    this.qtePromptText?.setText(this.formatQtePrompt()).setColor('#fde68a');
    this.miniResultText?.setColor('#38bdf8').setText(`连段 ${this.qteStepIndex}/${this.qteSequence.length}`);
  }

  private mapQteInputByRound(input: number): number {
    if (!this.miniState) return input;
    if (this.miniState.round !== this.miniState.reverseRound) return input;
    if (input === Phaser.Input.Keyboard.KeyCodes.UP) return Phaser.Input.Keyboard.KeyCodes.DOWN;
    if (input === Phaser.Input.Keyboard.KeyCodes.DOWN) return Phaser.Input.Keyboard.KeyCodes.UP;
    if (input === Phaser.Input.Keyboard.KeyCodes.LEFT) return Phaser.Input.Keyboard.KeyCodes.RIGHT;
    if (input === Phaser.Input.Keyboard.KeyCodes.RIGHT) return Phaser.Input.Keyboard.KeyCodes.LEFT;
    return input;
  }

  private formatQtePrompt(): string {
    if (this.qteSequenceLabels.length <= 0) return '';
    return this.qteSequenceLabels.map((label, idx) => (idx === this.qteStepIndex ? `[${label}]` : label)).join(' ');
  }

  private judgeQteRound(resultType: 'hit' | 'wrong' | 'timeout'): void {
    if (!this.miniState || this.miniState.mode !== 'qte') return;
    if (!this.qteExpectedKey) return;

    this.qteTween?.remove();
    this.qteTween = null;
    const elapsed = Math.max(0, this.scene.time.now - this.qteRoundStartedAt);
    let result: RoundResult = 'poor';
    if (resultType === 'hit') {
      if (elapsed <= 360) result = 'perfect';
      else result = 'good';
    }

    this.applyRoundResult(result, resultType === 'timeout' ? '超时' : resultType === 'wrong' ? '错误按键' : undefined);
  }

  private judgeMiniRound(fromTimeout: boolean = false): void {
    if (!this.miniState || !this.miniPointer || !this.miniZone) return;
    if (!this.miniTween) return;

    this.miniTween.remove();
    this.miniTween = null;
    this.miniTimeout?.remove(false);
    this.miniTimeout = null;

    const diff = Math.abs(this.miniPointer.x - this.miniZone.x);
    const half = this.miniZone.width / 2;
    const dangerDiff = this.miniDangerZone ? Math.abs(this.miniPointer.x - this.miniDangerZone.x) : Number.POSITIVE_INFINITY;
    const dangerHalf = this.miniDangerZone ? this.miniDangerZone.width / 2 : 0;

    let result: RoundResult = 'poor';
    if (!fromTimeout && dangerDiff > dangerHalf + 2) {
      if (diff <= Math.max(3, half * 0.35)) result = 'perfect';
      else if (diff <= Math.max(8, half * 1.2)) result = 'good';
    }

    const poorReason = fromTimeout ? '超时' : dangerDiff <= dangerHalf + 2 ? '命中危险区' : undefined;
    this.applyRoundResult(result, poorReason);
  }

  private applyRoundResult(result: RoundResult, poorReason?: string): void {
    if (!this.miniState) return;
    const isBonusRound = this.miniState.round === this.miniState.bonusRound;
    const isHardRound = this.miniState.round === this.miniState.hardRound;
    const isLuckyRound = this.miniState.round === this.miniState.luckyRound;
    const isGlitchRound = this.miniState.round === this.miniState.glitchRound;

    const streakBonus = Math.min(2.2, 1 + this.miniState.streak * 0.14);
    let basePoints = result === 'perfect' ? 3 : result === 'good' ? 2 : 0;
    if (isHardRound && result === 'perfect') basePoints += 1;
    if (isLuckyRound && result !== 'poor') basePoints += 2;
    if (isBonusRound && result !== 'poor') basePoints *= 2;
    if (result === 'perfect') {
      this.miniState.score += Math.round(basePoints * streakBonus);
      this.miniState.perfect += 1;
      this.miniState.streak += 1;
      this.miniState.maxStreak = Math.max(this.miniState.maxStreak, this.miniState.streak);
      this.miniResultText?.setColor('#22c55e').setText(
        isBonusRound ? '完美! 奖励翻倍' : isLuckyRound ? '完美! 欧皇加分' : '完美!'
      );
    } else if (result === 'good') {
      this.miniState.score += Math.round(basePoints * Math.max(1, streakBonus * 0.8));
      this.miniState.good += 1;
      this.miniState.streak += 1;
      this.miniState.maxStreak = Math.max(this.miniState.maxStreak, this.miniState.streak);
      this.miniResultText?.setColor('#38bdf8').setText(
        isBonusRound ? '稳定 · 奖励翻倍' : isLuckyRound ? '稳定 · 欧皇加分' : '稳定'
      );
    } else {
      this.miniState.poor += 1;
      this.miniState.streak = 0;
      if (isGlitchRound) {
        this.miniState.score = Math.max(0, this.miniState.score - 1);
        this.miniResultText?.setColor('#ef4444').setText(`${poorReason || '偏离'} · 干扰扣分`);
      } else {
        this.miniResultText?.setColor('#f97316').setText(poorReason || '偏离');
      }
    }
    this.miniStreakText?.setText(`连击 x${this.miniState.streak}`);

    if (this.miniState.mode === 'timing' && this.miniZone) {
      this.scene.tweens.add({
        targets: this.miniZone,
        scaleX: 1.18,
        scaleY: 1.18,
        yoyo: true,
        duration: 120,
      });
    }

    if (this.miniState.round >= this.miniState.totalRounds) {
      this.scene.time.delayedCall(360, () => this.finishMiniGame());
      return;
    }

    this.miniState.round += 1;
    this.scene.time.delayedCall(420, () => {
      if (!this.miniState) return;
      if (this.miniState.mode === 'qte') this.startQteRound();
      else this.startMiniRound();
    });
  }

  private finishMiniGame(): void {
    if (!this.miniState) return;
    const state = this.miniState;
    const perfectThreshold = state.mode === 'qte' ? 14 : 12;
    const goodThreshold = state.mode === 'qte' ? 9 : 8;
    const performance: RoundResult = state.score >= perfectThreshold ? 'perfect' : state.score >= goodThreshold ? 'good' : 'poor';

    const result = BaseSystem.playLeisureActivity(state.activity.id, performance);
    const extraRewardText = this.applyStreakBonus(state);
    const rewardText = this.formatRewards(result.rewards, result.bonusExp);
    const roundFlags: string[] = [`奖励回合#${state.bonusRound}`, `高压回合#${state.hardRound}`];
    if (state.mode === 'qte' && state.reverseRound > 0) roundFlags.push(`逆向回合#${state.reverseRound}`);
    roundFlags.push(`欧皇回合#${state.luckyRound}`);
    roundFlags.push(`干扰回合#${state.glitchRound}`);
    const summary = `判定：完美${state.perfect} 稳定${state.good} 偏离${state.poor} · 连击峰值x${state.maxStreak}\n事件：${roundFlags.join('  ')}`;

    if (result.ok) {
      events.emit('update-resources', gameState.data.resources);
      this.showToast(`${result.message}\n${summary}\n${rewardText}${extraRewardText ? `\n${extraRewardText}` : ''}`, '#4ade80');
    } else {
      this.showToast(result.message, '#ef4444');
    }
    this.teardownMiniGame();
  }

  private applyStreakBonus(state: MiniGameState): string {
    if (state.maxStreak < 4) return '';
    if (state.activity.id === 'card') {
      const btc = Math.round((0.03 + Math.random() * 0.07) * 1000) / 1000;
      gameState.addResource('bitcoin', btc);
      return `连击奖励：比特币 +${btc.toFixed(3)}`;
    }
    if (state.activity.id === 'music') {
      const food = Phaser.Math.Between(1, 2);
      const water = Phaser.Math.Between(1, 2);
      gameState.addResource('food', food);
      gameState.addResource('water', water);
      return `连击奖励：食物 +${food}  净水 +${water}`;
    }
    const ammo = Phaser.Math.Between(2, 4);
    const scrap = Phaser.Math.Between(1, 2);
    gameState.addResource('ammo', ammo);
    gameState.addResource('scrap', scrap);
    return `连击奖励：弹药 +${ammo}  零件 +${scrap}`;
  }

  private teardownMiniGame(): void {
    this.miniTween?.remove();
    this.miniTween = null;
    this.qteTween?.remove();
    this.qteTween = null;
    this.miniTimeout?.remove(false);
    this.miniTimeout = null;
    this.spaceKey?.off('down', this.onSpaceDown);
    this.spaceKey = null;
    this.scene.input.keyboard?.off('keydown', this.onQteKeyDown);
    this.qteExpectedKey = null;
    this.qteDeadlineAt = 0;
    this.qteRoundStartedAt = 0;
    this.qteSequence = [];
    this.qteSequenceLabels = [];
    this.qteStepIndex = 0;
    this.miniLayer?.destroy();
    this.miniLayer = null;
    this.miniState = null;
    this.miniBar = null;
    this.miniZone = null;
    this.miniDangerZone = null;
    this.miniPointer = null;
    this.qtePromptText = null;
    this.qteTimerBg = null;
    this.qteTimerBar = null;
    this.miniHintText = null;
    this.miniRoundText = null;
    this.miniResultText = null;
    this.miniStreakText = null;
    this.miniEventText = null;
  }

  private getStatusText(): string {
    const day = gameState.data.currentDay;
    if (gameState.data.isNight) return `第${day}天 · 夜晚战斗中\n白天可进行休闲活动`;
    if (!BaseSystem.canPlayLeisureToday()) return `第${day}天 · 今日已完成休闲活动`;
    return `第${day}天 · 白天基地时段\n完成挑战可获得更高奖励`;
  }

  private formatRewards(rewards: Record<string, number | undefined>, exp: number): string {
    const map: Record<string, string> = {
      wood: '木材',
      metal: '金属',
      food: '食物',
      water: '净水',
      scrap: '废件',
      medical: '医疗',
      ammo: '弹药',
      energyCore: '能量核',
    };
    const parts: string[] = [];
    Object.entries(rewards).forEach(([k, v]) => {
      if (v && v > 0) parts.push(`${map[k] || k}+${v}`);
    });
    if (exp > 0) parts.push(`经验+${exp}`);
    return parts.join('  ');
  }

  private showToast(message: string, color: string): void {
    const x = this.scene.cameras.main.width / 2;
    const y = 140;
    const text = this.scene.add.text(x, y, message, {
      fontSize: '16px',
      color,
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4000);
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 2000,
      onComplete: () => text.destroy(),
    });
  }
}
