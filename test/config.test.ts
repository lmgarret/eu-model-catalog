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

  it("validates the committed overlay and providers.yaml", async () => {
    const overlay = await loadOverlay(path.join(ROOT, "overlay"));
    expect(Object.keys(overlay).sort()).toEqual(["greenpt", "infomaniak", "mistral", "regolo"]);
    const providers = await loadProviders(path.join(ROOT, "providers.yaml"));
    expect(providers.regolo.models_dev_id).toBe("regolo-ai");
  });
});
