import Phaser from 'phaser';

export class EventBus extends Phaser.Events.EventEmitter {
    private static instance: EventBus;

    private constructor() {
        super();
    }

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
}

// Global instance for simple access, though dependency injection is preferred in systems
export const events = EventBus.getInstance();

export enum GameEvents {
    // Game State
    GAME_START = 'game-start',
    GAME_OVER = 'game-over',
    PAUSE = 'pause',
    RESUME = 'resume',

    // Time/Wave
    DAY_START = 'day-start',
    NIGHT_START = 'night-start',
    WAVE_START = 'wave-start',
    WAVE_COMPLETE = 'wave-complete',
    TIME_UPDATE = 'time-update', // payload: { timeOfDay: number, day: number }

    // Entities
    PLAYER_HIT = 'player-hit', // payload: { damage: number }
    PLAYER_HEALTH_CHANGE = 'player-health-change', // payload: { current: number, max: number }
    PLAYER_LEVEL_UP = 'player-level-up', // payload: { level: number }
    PLAYER_EXP_CHANGE = 'player-exp-change', // payload: { current: number, max: number }
    PLAYER_HEAL_REQUEST = 'player-heal-request', // payload: { amount: number, source?: string }

    // Combat
    WEAPON_CHANGED = 'weapon-changed', // payload: { weapon: WeaponType }
    ENEMY_KILLED = 'enemy-killed', // payload: { enemyType: string, reward: number }
    LOOT_COLLECTED = 'loot-collected', // payload: { type: string, amount: number }

    // Building
    BUILD_MODE_TOGGLED = 'build-mode-toggled', // payload: { active: boolean, type?: string }
    BUILDING_PLACED = 'building-placed', // payload: { type: string, x: number, y: number }

    // Companions
    COMPANION_ADDED = 'companion-added', // payload: { role: string }
    COMPANION_COUNT_CHANGE = 'companion-count-change', // payload: { count: number }
    COMPANION_ROSTER_UPDATED = 'companion-roster-updated', // payload: { configs: CompanionConfig[] }

    // Base
    BASE_UPDATED = 'base-updated', // payload: BaseState
}
