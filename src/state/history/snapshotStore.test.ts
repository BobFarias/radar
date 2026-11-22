import { describe, expect, it, vi } from "vitest";
import { createSnapshotStore } from "./snapshotStore";

interface Item {
  id: string;
  n: number;
}

/** Minimal in-memory Storage; can be made to throw. */
function fakeStorage({ failWrites = false, failReads = false } = {}) {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (k: string) => {
        if (failReads) throw new Error("SecurityError");
        return data.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (failWrites) throw new Error("QuotaExceededError");
        data.set(k, v);
      },
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      length: 0,
    } as Storage,
  };
}

const parseItem = (raw: unknown): Item | null =>
  typeof raw === "object" && raw !== null && typeof (raw as Item).id === "string" && typeof (raw as Item).n === "number"
    ? { id: (raw as Item).id, n: (raw as Item).n }
    : null;

function store(storage: Storage | null, limit?: number) {
  return createSnapshotStore<Item>({ key: "k", parseItem, dedupeKey: (i) => i.id, limit, getStorage: () => storage });
}

describe("createSnapshotStore", () => {
  it("is loading on the server and empty when nothing is stored", () => {
    const s = store(fakeStorage().storage);
    expect(s.getServerSnapshot()).toEqual({ status: "loading" });
    expect(s.getSnapshot()).toEqual({ status: "ready", items: [], skipped: 0, persistent: true });
  });

  it("adds newest first, persists, and returns a stable snapshot between changes", () => {
    const { storage, data } = fakeStorage();
    const s = store(storage);
    expect(s.add({ id: "a", n: 1 })).toBe(true);
    expect(s.add({ id: "b", n: 2 })).toBe(true);
    const snap = s.getSnapshot();
    expect(snap).toMatchObject({ items: [{ id: "b" }, { id: "a" }] });
    expect(s.getSnapshot()).toBe(snap);
    expect(JSON.parse(data.get("k")!)).toHaveLength(2);
    // A fresh store over the same storage (a reload) sees the same items.
    expect(store(storage).getSnapshot()).toMatchObject({ items: [{ id: "b" }, { id: "a" }] });
  });

  it("does not add a duplicate", () => {
    const s = store(fakeStorage().storage);
    s.add({ id: "a", n: 1 });
    expect(s.add({ id: "a", n: 99 })).toBe(false);
    expect(s.getSnapshot()).toMatchObject({ items: [{ id: "a", n: 1 }] });
  });

  it("keeps only the newest items up to the limit", () => {
    const s = store(fakeStorage().storage, 2);
    ["a", "b", "c"].forEach((id, n) => s.add({ id, n }));
    expect(s.getSnapshot()).toMatchObject({ items: [{ id: "c" }, { id: "b" }] });
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a non-array", '{"id":"a"}'],
  ])("treats %s as an empty history and reports it", (_, raw) => {
    const { storage, data } = fakeStorage();
    data.set("k", raw);
    expect(store(storage).getSnapshot()).toEqual({ status: "ready", items: [], skipped: 1, persistent: true });
  });

  it("skips invalid and duplicate items but keeps valid ones", () => {
    const { storage, data } = fakeStorage();
    data.set("k", JSON.stringify([{ id: "a", n: 1 }, { id: 5 }, null, "x", { id: "a", n: 2 }, { id: "b", n: 3 }]));
    expect(store(storage).getSnapshot()).toMatchObject({ items: [{ id: "a", n: 1 }, { id: "b" }], skipped: 4 });
  });

  it("replaces corrupted data with valid data on the next save", () => {
    const { storage, data } = fakeStorage();
    data.set("k", "{not json");
    const s = store(storage);
    s.add({ id: "a", n: 1 });
    expect(JSON.parse(data.get("k")!)).toEqual([{ id: "a", n: 1 }]);
  });

  it("falls back to memory when storage is unavailable", () => {
    const s = store(null);
    expect(s.getSnapshot()).toMatchObject({ items: [], persistent: false });
    s.add({ id: "a", n: 1 });
    expect(s.getSnapshot()).toMatchObject({ items: [{ id: "a" }], persistent: false });
  });

  it("falls back to memory when reading throws", () => {
    const s = store(fakeStorage({ failReads: true }).storage);
    expect(s.getSnapshot()).toMatchObject({ persistent: false });
  });

  it("keeps the item in memory and reports it when a write fails", () => {
    const s = store(fakeStorage({ failWrites: true }).storage);
    expect(s.add({ id: "a", n: 1 })).toBe(true);
    expect(s.getSnapshot()).toMatchObject({ items: [{ id: "a" }], persistent: false });
  });

  it("notifies subscribers on add and unsubscribes cleanly", () => {
    const s = store(fakeStorage().storage);
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    s.add({ id: "a", n: 1 });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    s.add({ id: "b", n: 2 });
    expect(listener).toHaveBeenCalledOnce();
  });
});
