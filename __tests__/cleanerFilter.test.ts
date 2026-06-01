import { filterCleaners, CleanerFilters } from "../lib/cleanerFilter";

type C = { id: string; hourly_rate?: number | null; services?: string[] | null };

const CLEANERS: C[] = [
  { id: "a", hourly_rate: 20, services: ["Pulizia ordinaria"] },
  { id: "b", hourly_rate: 28, services: ["Pulizia ordinaria", "Stiro"] },
  { id: "c", hourly_rate: 35, services: ["Pulizia profonda"] },
  { id: "d", hourly_rate: null, services: ["Pulizia ordinaria"] },
  { id: "e", hourly_rate: 30, services: null },
];

const NONE: CleanerFilters = { priceFilter: null, serviceFilters: [] };

describe("filterCleaners — search/filter flow", () => {
  it("returns the original array (no-op) when no filter is active", () => {
    expect(filterCleaners(CLEANERS, NONE)).toBe(CLEANERS);
  });

  it("filters by inclusive price range", () => {
    const r = filterCleaners(CLEANERS, { priceFilter: { min: 25, max: 30 }, serviceFilters: [] });
    expect(r.map((c) => c.id)).toEqual(["b", "e"]); // 28 and 30, inclusive
  });

  it("drops cleaners with no rate when a price filter is active", () => {
    const r = filterCleaners(CLEANERS, { priceFilter: { min: 0, max: 100 }, serviceFilters: [] });
    expect(r.find((c) => c.id === "d")).toBeUndefined();
  });

  it("keeps no-rate cleaners when only a service filter is active", () => {
    const r = filterCleaners(CLEANERS, { priceFilter: null, serviceFilters: ["Pulizia ordinaria"] });
    expect(r.map((c) => c.id).sort()).toEqual(["a", "b", "d"]);
  });

  it("requires ALL selected services (logical AND)", () => {
    const r = filterCleaners(CLEANERS, {
      priceFilter: null,
      serviceFilters: ["Pulizia ordinaria", "Stiro"],
    });
    expect(r.map((c) => c.id)).toEqual(["b"]);
  });

  it("combines price AND service filters", () => {
    const r = filterCleaners(CLEANERS, {
      priceFilter: { min: 25, max: 40 },
      serviceFilters: ["Pulizia ordinaria"],
    });
    expect(r.map((c) => c.id)).toEqual(["b"]); // 28 + has ordinaria (c is profonda, e has null services)
  });

  it("treats a cleaner with null services as having none", () => {
    const r = filterCleaners(CLEANERS, { priceFilter: null, serviceFilters: ["Pulizia profonda"] });
    expect(r.map((c) => c.id)).toEqual(["c"]);
  });
});
