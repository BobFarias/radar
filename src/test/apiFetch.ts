import { vi } from "vitest";
import { POST as respondPost } from "@/app/api/respond/route";
import { POST as reviewTasksPost } from "@/app/api/review-tasks/route";
import { GET as sourceGet } from "@/app/api/sources/[source_id]/route";

/**
 * Routes browser fetch calls to the real Next route handlers, so UI tests
 * exercise the actual API + validation path. The jsdom AbortSignal is not
 * forwarded to Node's Request (incompatible realms); aborts are honoured here.
 */
export function installApiFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://localhost");
    const request = new Request(url, { method: init?.method ?? "GET", headers: init?.headers, body: init?.body });

    if (url.pathname === "/api/respond") return respondPost(request);
    if (url.pathname === "/api/review-tasks") return reviewTasksPost(request);
    const source = url.pathname.match(/^\/api\/sources\/(.+)$/);
    if (source?.[1]) {
      return sourceGet(request, { params: Promise.resolve({ source_id: decodeURIComponent(source[1]) }) });
    }
    return new Response("Not found", { status: 404 });
  });
}
