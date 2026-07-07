import { defaultState, type GameState } from '../simulation/state';

const key = 'yilintopia.save.v1';

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state: GameState) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetState(): GameState {
  localStorage.removeItem(key);
  return structuredClone(defaultState);
}
