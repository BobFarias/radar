import { describe, expect, it } from "vitest";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "./blocks";

const table = () => fixtureBlock("overview", "overview-table") as Record<string, unknown>;
const chart = () => fixtureBlock("overview", "overview-chart") as Record<string, unknown>;
const evidence = () => fixtureBlock("client_focus", "client-evidence") as Record<string, unknown>;
const form = () => fixtureBlock("client_focus", "client-review") as Record<string, unknown>;

describe("validateBlock — valid fixture blocks", () => {
  it.each([
    ["opportunity_table", table],
    ["bar_chart", chart],
    ["evidence_cards", evidence],
    ["review_form", form],
  ])("accepts the supplied %s block", (type, make) => {
    const result = validateBlock(make());
    expect(result.status).toBe("valid");
    if (result.status === "valid") expect(result.block.type).toBe(type);
  });

  it("accepts the partial_then_error table", () => {
    expect(validateBlock(fixtureBlock("partial_then_error", "refresh-table")).status).toBe("valid");
  });
});

describe("validateBlock — unknown types", () => {
  it("rejects the unsupported_block fixture as unsupported, keeping only id/type", () => {
    const result = validateBlock(fixtureBlock("unsupported_block", "future-block"));
    expect(result).toEqual({ status: "unsupported", id: "future-block", type: "future_component" });
  });

  it.each([[null], ["string"], [42], [[]], [{}], [{ type: 7 }]])("treats %j as unsupported", (raw) => {
    expect(validateBlock(raw).status).toBe("unsupported");
  });

  it("does not resolve inherited object keys as block types", () => {
    expect(validateBlock({ id: "x", type: "constructor", title: "t" }).status).toBe("unsupported");
  });
});

describe("validateBlock — invalid data for known types", () => {
  it("rejects the malformed_block chart (non-numeric value)", () => {
    const result = validateBlock(fixtureBlock("malformed_block", "invalid-chart"));
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.type).toBe("bar_chart");
      expect(result.title).toBe("Opportunities");
      expect(result.errors.join(" ")).toMatch(/series\/0\/value must be number/);
    }
  });

  it("rejects negative chart values", () => {
    const block = chart();
    block.series = [{ label: "High", value: -1 }];
    expect(validateBlock(block).status).toBe("invalid");
  });

  it.each(["id", "type", "title", "rows"])("rejects a table missing %s", (field) => {
    const block = table();
    delete block[field];
    expect(validateBlock(block).status).not.toBe("valid");
  });

  it.each(["subject", "body", "client_id", "opportunity_id"])("rejects a review form missing %s", (field) => {
    const block = form();
    delete block[field];
    expect(validateBlock(block).status).toBe("invalid");
  });

  it("rejects a row missing a required field", () => {
    const block = table();
    const rows = block.rows as Record<string, unknown>[];
    delete rows[0]!.status_note;
    expect(validateBlock(block).status).toBe("invalid");
  });

  it("rejects invalid priority values", () => {
    const block = table();
    (block.rows as Record<string, unknown>[])[0]!.priority = "Urgent";
    const result = validateBlock(block);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.errors.join(" ")).toMatch(/priority must be one of: High, Medium, Low/);
  });

  it("rejects invalid stage values", () => {
    const block = table();
    (block.rows as Record<string, unknown>[])[0]!.stage = "Done";
    expect(validateBlock(block).status).toBe("invalid");
  });

  it("rejects unexpected top-level properties (additionalProperties: false)", () => {
    const block = form();
    block.html = "<b>injected</b>";
    const result = validateBlock(block);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.errors.join(" ")).toMatch(/unexpected property "html"/);
  });

  it("rejects unexpected properties in chart points and evidence items", () => {
    const c = chart();
    (c.series as Record<string, unknown>[])[0]!.color = "red";
    expect(validateBlock(c).status).toBe("invalid");

    const e = evidence();
    (e.items as Record<string, unknown>[])[0]!.url = "javascript:alert(1)";
    expect(validateBlock(e).status).toBe("invalid");
  });

  it("allows extra row properties, because the official schema does not forbid them", () => {
    const block = table();
    (block.rows as Record<string, unknown>[])[0]!.extra = "ok";
    expect(validateBlock(block).status).toBe("valid");
  });
});

describe("validateBlock — empty arrays", () => {
  it.each([
    ["table rows", table, "rows"],
    ["chart series", chart, "series"],
    ["evidence items", evidence, "items"],
  ])("accepts schema-valid empty %s", (_label, make, field) => {
    const block = make();
    block[field] = [];
    expect(validateBlock(block).status).toBe("valid");
  });
});

describe("validateBlock — independence", () => {
  it("validates each block independently", () => {
    const results = [
      fixtureBlock("overview", "overview-table"),
      fixtureBlock("malformed_block", "invalid-chart"),
      fixtureBlock("unsupported_block", "future-block"),
      fixtureBlock("client_focus", "client-evidence"),
    ].map((b) => validateBlock(b).status);
    expect(results).toEqual(["valid", "invalid", "unsupported", "valid"]);
  });
});
