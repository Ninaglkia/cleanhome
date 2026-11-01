/** Local city search: build once, then scan small pre-ranked buckets per query. */
export interface ItalianCity {
  id: string;
  name: string;
  province: string;
  provinceCode: string;
  region: string;
  latitude: number;
  longitude: number;
  population: number;
}

export interface IndexedCity {
  readonly city: ItalianCity;
  readonly name: string;
  readonly compactName: string;
  readonly words: readonly string[];
}

export function normalizeCityQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[’‘ʼ'`´]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createCitySearchIndex(cities: readonly ItalianCity[]): readonly IndexedCity[] {
  return cities
    .map((city) => {
      const name = normalizeCityQuery(city.name);
      return { city, name, compactName: name.replace(/\s/g, ""), words: name.split(" ") };
    })
    .sort((a, b) => b.city.population - a.city.population || a.city.name.localeCompare(b.city.name, "it"));
}

/** Exact names outrank prefixes, which outrank word matches; population breaks ties. */
export function searchCitySuggestions(
  query: string,
  index: readonly IndexedCity[],
  limit = 6,
): ItalianCity[] {
  const normalized = normalizeCityQuery(query);
  if (normalized.length < 2) return [];
  const count = Math.max(0, Math.min(6, Math.floor(limit)));
  if (count === 0) return [];
  const compact = normalized.replace(/\s/g, "");
  const words = normalized.split(" ");
  const buckets: ItalianCity[][] = [[], [], []];

  for (const entry of index) {
    let rank: number;
    if (entry.name === normalized || entry.compactName === compact) {
      rank = 0;
    } else if (entry.name.startsWith(normalized) || entry.compactName.startsWith(compact)) {
      rank = 1;
    } else if (words.every((word) => entry.words.some((candidate) => candidate.startsWith(word)))) {
      rank = 2;
    } else {
      continue;
    }
    if (buckets[rank].length < count) buckets[rank].push(entry.city);
  }

  return buckets.flat().slice(0, count);
}
