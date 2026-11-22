"use client";

import { useSyncExternalStore } from "react";
import type { HistoryState, SnapshotStore } from "./snapshotStore";

/** Reads a snapshot store; renders `loading` on the server and during hydration. */
export function useSnapshotHistory<T>(store: SnapshotStore<T>): HistoryState<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
