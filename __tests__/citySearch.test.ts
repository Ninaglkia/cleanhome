import { createCitySearchIndex, normalizeCityQuery, searchCitySuggestions, type ItalianCity } from "../lib/citySearch";

const city = (id: string, name: string, population: number, latitude: number, longitude: number): ItalianCity => ({
  id, name, population, latitude, longitude, province: "Provincia", provinceCode: "IT", region: "Italia",
});
const CITIES: ItalianCity[] = [
  city("015146", "Milano", 1371498, 45.4642, 9.19),
  city("083049", "Milazzo", 30632, 38.22, 15.24),
  city("027023", "Mira", 38000, 45.435, 12.128),
  city("037020", "Castel San Pietro Terme", 20700, 44.398, 11.589),
  city("021008", "Bolzano/Bozen", 107317, 46.499, 11.354),
  city("068012", "Città Sant’Angelo", 15000, 42.519, 14.06),
  city("066049", "L’Aquila", 69000, 42.3498, 13.3995),
  city("099025", "San Leo", 2855, 43.896, 12.343),
  city("087029", "Misterbianco", 49700, 37.518, 15.025),
  city("036022", "Mirandola", 24500, 44.885, 11.067),
  city("027024", "Mirano", 27000, 45.494, 12.108),
  city("100003", "Montemurlo", 18000, 43.927, 11.038),
];
const INDEX = createCitySearchIndex(CITIES);

describe("local Italian city suggestions", () => {
  it("handles case, accents, curly apostrophes and extra spacing", () => {
    expect(normalizeCityQuery("  CITTÀ  Sant’Angelo ")).toBe("citta sant angelo");
    expect(searchCitySuggestions("citta sant'angelo", INDEX)[0].name).toBe("Città Sant’Angelo");
    expect(searchCitySuggestions("laquila", INDEX)[0].name).toBe("L’Aquila");
  });

  it("puts Milano first for Mi and orders other prefix matches by population", () => {
    expect(searchCitySuggestions("Mi", INDEX).map((entry) => entry.name)).toEqual([
      "Milano", "Misterbianco", "Mira", "Milazzo", "Mirano", "Mirandola",
    ]);
  });

  it("puts an exact town above a more populous prefix match", () => {
    expect(searchCitySuggestions("Mira", INDEX).map((entry) => entry.name)).toEqual(["Mira", "Mirano", "Mirandola"]);
    expect(searchCitySuggestions("MILANO", INDEX)[0].id).toBe("015146");
  });

  it("recognizes bilingual names and later words without dropping small towns", () => {
    expect(searchCitySuggestions("Bozen", INDEX)[0].name).toBe("Bolzano/Bozen");
    expect(searchCitySuggestions("San", INDEX).map((entry) => entry.name)).toEqual([
      "San Leo", "Castel San Pietro Terme", "Città Sant’Angelo",
    ]);
    const selected = searchCitySuggestions("San Leo", INDEX)[0];
    expect([selected.latitude, selected.longitude]).toEqual([43.896, 12.343]);
    expect(selected).toBe(CITIES.find((entry) => entry.id === "099025"));
  });

  it("shows no fabricated results for short, empty or unknown queries", () => {
    expect(searchCitySuggestions("", INDEX)).toEqual([]);
    expect(searchCitySuggestions("m", INDEX)).toEqual([]);
    expect(searchCitySuggestions("zzzx", INDEX)).toEqual([]);
    expect(searchCitySuggestions("Mi", INDEX, 2)).toHaveLength(2);
  });
});
