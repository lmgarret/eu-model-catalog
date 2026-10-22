import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type Rates, bifrostField, toUsdPerUnit, usdPer } from "../src/money.js";
import { parseEcb } from "../src/sources/ecb.js";
import { FIXTURES } from "./helpers.js";

const rates: Rates = { date: "2026-10-21", base: "EUR", rates: { USD: "1.1234", CHF: "0.9256" }, source: "test" };

describe("ECB rates", () => {
  it("parses the daily XML", () => {
    expect(parseEcb(readFileSync(path.join(FIXTURES, "ecb.xml"), "utf8"))).toEqual({
      date: "2026-10-21",
      base: "EUR",
      rates: { USD: "1.1234", CHF: "0.9256" },
      source: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    });
  });

  it("rejects a response without USD", () => {
    expect(() => parseEcb("<Cube time='2026-10-21'><Cube currency='CHF' rate='0.9'/></Cube>")).toThrow();
  });
});

describe("toUsdPerUnit", () => {
  it("converts EUR per 1M tokens to USD per token exactly", () => {
    expect(toUsdPerUnit("0.25", "EUR", "1M_tokens", rates).toString()).toBe("2.8085e-7");
  });

  it("converts CHF through EUR", () => {
    expect(usdPer("CHF", rates).toFixed(10)).toBe("1.2136992221");
    expect(toUsdPerUnit("0.7", "CHF", "1M_tokens", rates).toSignificantDigits(6).toString()).toBe("8.49589e-7");
  });

  it("scales time units to seconds", () => {
    expect(toUsdPerUnit("0.003", "USD", "minute", rates).toString()).toBe("0.00005");
    expect(toUsdPerUnit("3.6", "USD", "hour", rates).toString()).toBe("0.001");
  });

  it("keeps per-token prices unscaled", () => {
    expect(toUsdPerUnit("4e-7", "EUR", "token", rates).toString()).toBe("4.4936e-7");
  });
});

describe("bifrostField", () => {
  it("maps units to Bifrost fields", () => {
    expect(bifrostField("1M_tokens", "cached_input")).toBe("cache_read_input_token_cost");
    expect(bifrostField("page", "input")).toBe("ocr_cost_per_page");
    expect(bifrostField("hour", "input")).toBe("input_cost_per_second");
    expect(bifrostField("character", "input")).toBe("input_cost_per_character");
    expect(bifrostField("page", "output")).toBeUndefined();
  });
});
