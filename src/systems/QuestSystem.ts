/**
 * QuestSystem - Quest tracking, objectives, NPC traders
 */
import { gameState, QuestProgress } from '../state/GameState';
import { QUEST_DEFS, getAvailableQuests, NPC_TRADERS } from '../data/quests';
import type { QuestDef, QuestObjective, QuestReward } from '../data/quests';
import { events } from '../utils/EventBus';
import { BUILDING_DEFS } from '../data/buildings';

export class QuestSystem {
  static readonly MAX_ACTIVE_QUESTS = 3;

  static getMaxActiveQuests(): number {
    return QuestSystem.MAX_ACTIVE_QUESTS;
  }

  static getActiveQuestCount(): number {
    return gameState.data.activeQuests.filter(q => q.status === 'active').length;
  }

  static getQuestDef(questId: string): QuestDef | null {
    return QUEST_DEFS[questId] || null;
  }

  /**
   * Get quests available to accept
   */
  static getAvailable(): QuestDef[] {
    const state = gameState.data;
    return getAvailableQuests(state.currentDay, state.completedQuestIds);
  }

  /**
   * Accept a quest
   */
  static acceptQuest(questId: string): boolean {
    const def = QUEST_DEFS[questId];
    if (!def) return false;
    if (QuestSystem.getActiveQuestCount() >= QuestSystem.MAX_ACTIVE_QUESTS) return false;

    // Check if already active
    if (gameState.data.activeQuests.some(q => q.questId === questId)) return false;

    const progress: QuestProgress = {
      questId,
      status: 'active',
      objectives: {},
      startDay: gameState.data.currentDay,
    };

    // Initialize objective progress
    for (const obj of def.objectives) {
      // Quests start from 0 progress to avoid instant-complete on accept.
      progress.objectives[obj.id] = 0;
    }

    gameState.data.activeQuests.push(progress);
    events.emit('quest-updated');
    return true;
  }

  /**
   * NPC gives one random quest (simple 7DTD-style loop)
   */
  static acceptRandomQuestFromGiver(giverId: string): {
    ok: boolean;
    message: string;
    quest?: QuestDef;
  } {
    if (QuestSystem.getActiveQuestCount() >= QuestSystem.MAX_ACTIVE_QUESTS) {
      return { ok: false, message: `任务已满（最多${QuestSystem.MAX_ACTIVE_QUESTS}个）` };
    }

    const currentDay = gameState.data.currentDay;
    const all = getAvailableQuests(currentDay, gameState.data.completedQuestIds).filter(q => q.giver === giverId);

    const activeIds = new Set(gameState.data.activeQuests.map(q => q.questId));
    let pool = all.filter(q => !activeIds.has(q.id));
    if (pool.length <= 0) {
      // Fallback pool: repeatable quests can be accepted repeatedly as long as they are not active.
      pool = Object.values(QUEST_DEFS).filter(q =>
        q.giver === giverId &&
        q.isRepeatable &&
        q.unlockDay <= currentDay &&
        !activeIds.has(q.id) &&
        (!q.prerequisiteQuest || gameState.data.completedQuestIds.includes(q.prerequisiteQuest))
      );
    }
    if (pool.length <= 0) {
      return { ok: false, message: '当前没有可派发的新任务' };
    }

    // Prefer non-trivial, non-story tasks to avoid instant/simple completions.
    const scored = pool.map(q => {
      const objectiveTotal = q.objectives.reduce((sum, o) => sum + o.targetCount, 0);
      const nonTrivial = q.objectives.some(o => o.targetCount >= 3);
      let score = q.tier * 100 + objectiveTotal * 6;
      if (q.type === 'story') score -= 25;
      if (q.isRepeatable) score += 8;
      if (!nonTrivial) score -= 30;
      return { q, score };
    }).sort((a, b) => b.score - a.score);

    const pickFrom = scored.slice(0, Math.max(1, Math.ceil(scored.length / 2))).map(s => s.q);
    pool = pickFrom.length > 0 ? pickFrom : pool;

    const choice = pool[Math.floor(Math.random() * pool.length)];
    const ok = QuestSystem.acceptQuest(choice.id);
    if (!ok) {
      return { ok: false, message: '任务派发失败，请稍后重试' };
    }
    return { ok: true, message: `新任务：${choice.nameCN}`, quest: choice };
  }

  /**
   * Update quest progress for a specific objective type
   */
  static updateProgress(type: string, targetId?: string, amount: number = 1): void {
    let changed = false;
    for (const quest of gameState.data.activeQuests) {
      if (quest.status !== 'active') continue;

      const def = QUEST_DEFS[quest.questId];
      if (!def) continue;

      for (const obj of def.objectives) {
        if (obj.type !== type) continue;
        if (!this.matchesObjectiveTarget(obj, type, targetId)) continue;

        const next = Math.min(
          (quest.objectives[obj.id] || 0) + amount,
          obj.targetCount
        );
        if (next !== (quest.objectives[obj.id] || 0)) changed = true;
        quest.objectives[obj.id] = next;
      }

      // Check if quest is complete
      if (QuestSystem.isQuestComplete(quest, def)) {
        QuestSystem.completeQuest(quest, def);
      }
    }
    if (changed) events.emit('quest-updated');
  }

  private static matchesObjectiveTarget(obj: QuestObjective, type: string, targetId?: string): boolean {
    if (!obj.targetId) return true;
    if (!targetId) return false;
    if (obj.targetId === targetId) return true;

    if (type === 'kill') {
      if (obj.targetId === 'elite') {
        return ['elite', 'tank', 'heavy', 'ranged', 'stealth', 'exploder', 'healer'].includes(targetId);
      }
      if (obj.targetId === 'boss') {
        return ['boss', 'tyrant', 'necro', 'devourer'].includes(targetId);
      }
    }

    if (type === 'build') {
      const def = BUILDING_DEFS[targetId];
      if (!def) return false;
      if (obj.targetId === 'wall') return def.category === 'defense';
      if (obj.targetId === 'turret') return def.category === 'turret';
    }

    return false;
  }

  private static isQuestComplete(progress: QuestProgress, def: QuestDef): boolean {
    for (const obj of def.objectives) {
      if ((progress.objectives[obj.id] || 0) < obj.targetCount) return false;
    }
    return true;
  }

  private static completeQuest(progress: QuestProgress, def: QuestDef): void {
    progress.status = 'completed';
    gameState.data.completedQuestIds.push(progress.questId);
    gameState.data.stats.questsCompleted++;

    const payout: QuestReward = {
      resources: { ...(def.rewards.resources || {}) },
      xp: def.rewards.xp,
      skillPoints: def.rewards.skillPoints,
      items: def.rewards.items,
      unlocks: def.rewards.unlocks,
    };

    // Small BTC bonus on every quest completion. Keeps rewards meaningful but controlled.
    const bitcoinReward = this.rollBitcoinReward(def.tier);
    payout.resources = payout.resources || {};
    payout.resources.bitcoin = Number(((payout.resources.bitcoin || 0) + bitcoinReward).toFixed(2));

    // Apply rewards
    if (payout.resources) {
      for (const [key, amount] of Object.entries(payout.resources)) {
        gameState.addResource(key as any, amount);
      }
    }
    if (payout.xp) {
      gameState.addExperience(payout.xp);
    }
    if (payout.skillPoints) {
      gameState.data.skillPoints += payout.skillPoints;
    }

    // Remove from active
    const idx = gameState.data.activeQuests.indexOf(progress);
    if (idx >= 0) gameState.data.activeQuests.splice(idx, 1);

    events.emit('update-resources', gameState.data.resources);
    events.emit('quest-completed', { questId: progress.questId, rewards: payout });
    events.emit('quest-updated');
  }

  private static rollBitcoinReward(tier: number): number {
    const ranges: Record<number, { min: number; max: number }> = {
      1: { min: 0.05, max: 0.28 },
      2: { min: 0.18, max: 0.58 },
      3: { min: 0.4, max: 0.95 },
    };
    const range = ranges[tier] || ranges[1];
    const reward = range.min + Math.random() * (range.max - range.min);
    return Math.min(0.99, Number(reward.toFixed(2)));
  }

  /**
   * Get active quests with progress info
   */
  static getActiveQuests(): Array<{ def: QuestDef; progress: QuestProgress; objectives: Array<{ obj: QuestObjective; current: number; target: number }> }> {
    return gameState.data.activeQuests
      .filter(q => q.status === 'active')
      .slice(0, QuestSystem.MAX_ACTIVE_QUESTS)
      .map(q => {
        const def = QUEST_DEFS[q.questId];
        if (!def) return null;
        return {
          def,
          progress: q,
          objectives: def.objectives.map(obj => ({
            obj,
            current: q.objectives[obj.id] || 0,
            target: obj.targetCount,
          })),
        };
      })
      .filter(Boolean) as any[];
  }

  /**
   * Get NPC trader info
   */
  static getTrader(id: string) {
    return (NPC_TRADERS as any)[id] || null;
  }

  /**
   * Get all traders
   */
  static getAllTraders() {
    return Object.values(NPC_TRADERS);
  }
}
