/**
 * In-memory last-known-good store. Process-local only (no disk).
 */

const store = new Map<string, unknown>();

export function remember<T>(key: string, value: T): T {
  store.set(key, value);
  return value;
}

export function recall<T>(key: string): T | null {
  if (!store.has(key)) return null;
  return store.get(key) as T;
}
