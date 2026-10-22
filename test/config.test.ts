import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadOverlay, loadProviders, parseOverlay } from "../src/config.js";
import { HardError } from "../src/model.js";
import { ROOT } from "./helpers.js";

const entry = `
green-l:
  currency: EUR
  per: 1M_tokens
  input: 0.25
  source: https://docs.greenpt.ai/docs/pricing
  checked: 2026-10-22
`;

describe("overlay", () => {
  it("accepts a valid entry and keeps amounts as decimal strings", () => {
    expect(parseOverlay("greenpt.yaml", entry)["green-l"]).toMatchObject({ input: "0.25", checked: "2026-10-22" });
  });

  it("treats an empty file as no entries", () => {
    expect(parseOverlay("greenpt.yaml", "# nothing yet\n")).toEqual({});
  });

  it.each([
    ["source", entry.replace(/ {2}source:.*\n/, "")],
    ["checked", entry.replace(/ {2}checked:.*\n/, "")],
  ])("requires %s", (_, text) => {
    expect(() => parseOverlay("greenpt.yaml", text)).toThrow(HardError);
  });

  it("rejects unknown fields, units and currencies", () => {
    expect(() => parseOverlay("x.yaml", `${entry}  inptu: 1\n`)).toThrow(HardError);
    expect(() => parseOverlay("x.yaml", entry.replace("1M_tokens", "1M"))).toThrow(HardError);
    expect(() => parseOverlay("x.yaml", entry.replace("EUR", "GBP"))).toThrow(HardError);
  });

  it("accepts model facts without prices, but prices need a currency and unit", () => {
    const facts = "x:\n  license: MIT\n  open_weights: true\n  source: https://example.com\n  checked: 2026-10-22\n";
    expect(parseOverlay("x.yaml", facts).x).toMatchObject({ license: "MIT", open_weights: true });
    expect(() => parseOverlay("x.yaml", entry.replace(/ {2}currency:.*\n/, ""))).toThrow(HardError);
  });

  it("validates the committed overlay and providers.yaml", async () => {
    const providers = await loadProviders(path.join(ROOT, "providers.yaml"));
    expect(providers.regolo?.models_dev_id).toBe("regolo-ai");
    const overlay = await loadOverlay(path.join(ROOT, "overlay"), Object.keys(providers));
    expect(Object.keys(overlay).sort()).toEqual(["greenpt", "infomaniak", "mistral", "regolo"]);
  });
});
