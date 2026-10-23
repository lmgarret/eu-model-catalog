export type { Benchmark, Fields, Score as BenchmarkScore, Scores } from "../../../src/benchmarks.js";
export type { Catalog, CatalogInfo, CatalogModel, CatalogPrice } from "../../../src/catalog.js";
export type { ProviderFacts, SetupStep } from "../../../src/facts.js";
export type { Currency, Mode, Unit } from "../../../src/model.js";

import type { Catalog } from "../../../src/catalog.js";
export type CatalogLab = Catalog["labs"][string];
