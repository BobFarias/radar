"use client";

import { useEffect, useState } from "react";
import type { SourceRecord } from "@/contracts/api";
import { parseSourceRecord } from "@/validation/source";

export type SourceResult =
  | { status: "loading" }
  | { status: "loaded"; source: SourceRecord }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function fetchSource(sourceId: string, signal?: AbortSignal): Promise<SourceResult> {
  const res = await fetch(`/api/sources/${encodeURIComponent(sourceId)}`, { signal });
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) return { status: "error", message: `The source could not be loaded (HTTP ${res.status}).` };
  const source = parseSourceRecord(await res.json().catch(() => null));
  return source ? { status: "loaded", source } : { status: "error", message: "The source response was not valid." };
}

/** Loads a source; results are keyed by request so a slow earlier fetch never shows for a newer one. */
export function useSource(sourceId: string | null): { result: SourceResult; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState<{ key: string; result: SourceResult } | null>(null);
  const key = `${sourceId}#${attempt}`;

  useEffect(() => {
    if (!sourceId) return;
    const abort = new AbortController();
    fetchSource(sourceId, abort.signal)
      .then((result) => setEntry({ key, result }))
      .catch(() => {
        if (!abort.signal.aborted) {
          setEntry({ key, result: { status: "error", message: "The source could not be loaded." } });
        }
      });
    return () => abort.abort();
  }, [sourceId, key]);

  return {
    result: entry?.key === key ? entry.result : { status: "loading" },
    reload: () => setAttempt((n) => n + 1),
  };
}
