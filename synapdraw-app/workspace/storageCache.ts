// ============================================================================
// IN-MEMORY STORAGE CACHE LAYER
// Eliminates redundant synchronous JSON.parse calls on every store read
// while maintaining full localStorage persistence and cross-tab sync.
// ============================================================================

const jsonMemoryCache = new Map<string, unknown>();
const rawStringCache = new Map<string, string | null>();
let storageListenerAttached = false;

function ensureStorageListener(): void {
  if (storageListenerAttached || typeof window === "undefined") {
    return;
  }
  storageListenerAttached = true;
  window.addEventListener("storage", (event: StorageEvent) => {
    if (!event.key) {
      jsonMemoryCache.clear();
      rawStringCache.clear();
      return;
    }
    jsonMemoryCache.delete(event.key);
    rawStringCache.delete(event.key);
  });
}

export function readCachedJson<T>(
  key: string,
  ownerStorage: Storage = localStorage,
): T | null {
  ensureStorageListener();
  if (jsonMemoryCache.has(key)) {
    return jsonMemoryCache.get(key) as T;
  }
  try {
    const raw = ownerStorage.getItem(key);
    rawStringCache.set(key, raw);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as T;
    jsonMemoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedJson<T>(
  key: string,
  value: T,
  ownerStorage: Storage = localStorage,
): void {
  ensureStorageListener();
  jsonMemoryCache.set(key, value);
  try {
    const serialized = JSON.stringify(value);
    rawStringCache.set(key, serialized);
    ownerStorage.setItem(key, serialized);
  } catch (err) {
    console.warn(`[StorageCache] Failed to persist key "${key}":`, err);
  }
}

export function readCachedString(
  key: string,
  ownerStorage: Storage = localStorage,
): string | null {
  ensureStorageListener();
  if (rawStringCache.has(key)) {
    return rawStringCache.get(key) ?? null;
  }
  try {
    const val = ownerStorage.getItem(key);
    rawStringCache.set(key, val);
    return val;
  } catch {
    return null;
  }
}

export function writeCachedString(
  key: string,
  value: string,
  ownerStorage: Storage = localStorage,
): void {
  ensureStorageListener();
  rawStringCache.set(key, value);
  jsonMemoryCache.delete(key);
  try {
    ownerStorage.setItem(key, value);
  } catch {}
}

export function removeCachedKey(
  key: string,
  ownerStorage: Storage = localStorage,
): void {
  jsonMemoryCache.delete(key);
  rawStringCache.delete(key);
  try {
    ownerStorage.removeItem(key);
  } catch {}
}

export function invalidateStorageCache(key?: string): void {
  if (key) {
    jsonMemoryCache.delete(key);
    rawStringCache.delete(key);
  } else {
    jsonMemoryCache.clear();
    rawStringCache.clear();
  }
}
