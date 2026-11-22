/**
 * Small, reusable history store over localStorage.
 *
 * - Every read is validated item by item (`parseItem`); unreadable items are
 *   skipped and counted, corrupt JSON is treated as an empty history.
 * - If storage is unavailable or a write fails (private mode, quota), the
 *   store keeps working in memory for this tab and reports `persistent: false`.
 * - The server snapshot is `loading`, so hydration never depends on storage.
 */

export type HistoryState<T> =
  | { status: "loading" }
  | { status: "ready"; items: T[]; skipped: number; persistent: boolean };

export interface SnapshotStore<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): HistoryState<T>;
  getServerSnapshot(): HistoryState<T>;
  /** Adds an item (newest first) unless one with the same dedupe key exists. Returns whether it was added. */
  add(item: T): boolean;
}

export interface SnapshotStoreOptions<T> {
  /** localStorage key; include a version, e.g. `radar.history.opportunities.v1`. */
  key: string;
  parseItem: (raw: unknown) => T | null;
  /** Identity used to avoid duplicates (e.g. the originating request id). */
  dedupeKey: (item: T) => string;
  /** Oldest items beyond this count are dropped. */
  limit?: number;
  getStorage?: () => Storage | null;
}

const LOADING = { status: "loading" } as const;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createSnapshotStore<T>({
  key,
  parseItem,
  dedupeKey,
  limit = 30,
  getStorage = browserStorage,
}: SnapshotStoreOptions<T>): SnapshotStore<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; state: HistoryState<T> } | null = null;
  /** In-memory history once storage has proved unusable. */
  let memory: HistoryState<T> | null = null;

  const emit = () => listeners.forEach((l) => l());

  function parse(raw: string | null): HistoryState<T> {
    if (raw === null) return { status: "ready", items: [], skipped: 0, persistent: true };
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { status: "ready", items: [], skipped: 1, persistent: true };
    }
    if (!Array.isArray(data)) return { status: "ready", items: [], skipped: 1, persistent: true };
    const items: T[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    for (const entry of data) {
      const item = parseItem(entry);
      if (item === null || seen.has(dedupeKey(item))) {
        skipped += 1;
        continue;
      }
      seen.add(dedupeKey(item));
      items.push(item);
    }
    return { status: "ready", items: items.slice(0, limit), skipped, persistent: true };
  }

  function getSnapshot(): HistoryState<T> {
    if (memory) return memory;
    const storage = getStorage();
    let raw: string | null;
    try {
      if (!storage) throw new Error("Storage unavailable");
      raw = storage.getItem(key);
    } catch {
      memory = { status: "ready", items: [], skipped: 0, persistent: false };
      return memory;
    }
    if (cache && cache.raw === raw) return cache.state;
    cache = { raw, state: parse(raw) };
    return cache.state;
  }

  function add(item: T): boolean {
    const current = getSnapshot();
    if (current.status !== "ready") return false;
    if (current.items.some((existing) => dedupeKey(existing) === dedupeKey(item))) return false;
    const items = [item, ...current.items].slice(0, limit);

    if (!memory) {
      try {
        const storage = getStorage();
        if (!storage) throw new Error("Storage unavailable");
        storage.setItem(key, JSON.stringify(items));
        emit();
        return true;
      } catch {
        // Fall through to memory for the rest of this session.
      }
    }
    memory = { status: "ready", items, skipped: current.skipped, persistent: false };
    emit();
    return true;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot,
    getServerSnapshot: () => LOADING,
    add,
  };
}
