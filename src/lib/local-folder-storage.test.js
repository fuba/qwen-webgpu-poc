import { describe, expect, it } from 'vitest';
import {
  clearLocalFolderSummary,
  loadLocalFolderSummary,
  localFolderStorageKey,
  saveLocalFolderSummary,
} from './local-folder-storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe('local-folder-storage', () => {
  it('saves and loads summary', () => {
    const storage = createMemoryStorage();
    saveLocalFolderSummary({ count: 10, totalMB: '100.0', foundTokenizer: true, foundOnnx: true }, storage);

    const loaded = loadLocalFolderSummary(storage);
    expect(loaded.count).toBe(10);
    expect(loaded.totalMB).toBe('100.0');
    expect(Boolean(loaded.savedAt)).toBe(true);
  });

  it('clears saved summary', () => {
    const storage = createMemoryStorage();
    saveLocalFolderSummary({ count: 1, totalMB: '1.0', foundTokenizer: false, foundOnnx: true }, storage);

    clearLocalFolderSummary(storage);
    expect(loadLocalFolderSummary(storage)).toBe(null);
  });

  it('exposes stable storage key', () => {
    expect(localFolderStorageKey()).toBe('qwen_webgpu_saved_local_folder');
  });
});
