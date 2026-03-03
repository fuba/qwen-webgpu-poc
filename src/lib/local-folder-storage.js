const STORAGE_KEY = 'qwen_webgpu_saved_local_folder';

function getStorage(storage) {
  if (storage) {
    return storage;
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function saveLocalFolderSummary(summary, storage) {
  const target = getStorage(storage);
  if (!target || !summary) {
    return;
  }

  const payload = {
    ...summary,
    savedAt: new Date().toISOString(),
  };
  target.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadLocalFolderSummary(storage) {
  const target = getStorage(storage);
  if (!target) {
    return null;
  }

  const raw = target.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalFolderSummary(storage) {
  const target = getStorage(storage);
  if (!target) {
    return;
  }
  target.removeItem(STORAGE_KEY);
}

export function localFolderStorageKey() {
  return STORAGE_KEY;
}
