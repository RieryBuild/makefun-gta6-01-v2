// Autosave: the story's progress in localStorage.
// One job: persist cash, health, missions, postcards and position, and
// restore them on Continue. A corrupt or missing save reads as no save.

import { SAVE_KEY } from './settings.js';

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    // Storage full or blocked: the game plays on without saving.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Nothing to clear, or nothing to clear it with.
  }
}
