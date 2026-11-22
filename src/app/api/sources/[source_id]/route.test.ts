import { describe, expect, it } from "vitest";
import sources from "@data/sources.json";
import { GET } from "./route";

function call(sourceId: string): Promise<Response> {
  return GET(new Request(`http://test/api/sources/${sourceId}`), {
    params: Promise.resolve({ source_id: sourceId }),
  });
}

describe("GET /api/sources/:source_id", () => {
  it.each(Object.keys(sources))("returns the supplied record for %s", async (id) => {
    const res = await call(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(sources[id as keyof typeof sources]);
  });

  it.each(["SRC999", "src001", "", "constructor", "__proto__"])("returns 404 for %j", async (id) => {
    const res = await call(id);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("source_not_found");
  });
});
