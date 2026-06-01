import {
  calculatePrice,
  formatPrice,
  RATE_PER_SQM,
  MIN_ORDER,
  FEE_RATE,
} from "../lib/pricing";

describe("pricing engine — calculatePrice", () => {
  it("applies the minimum order floor for small surfaces", () => {
    // 20 mq * 1.30 = 26 -> below the €50 floor
    const p = calculatePrice(20);
    expect(p.basePrice).toBe(MIN_ORDER);
  });

  it("uses mq * rate above the floor", () => {
    const p = calculatePrice(100);
    expect(p.basePrice).toBe(Math.round(100 * RATE_PER_SQM * 100) / 100); // 130
  });

  it("charges the client +9% and pays the cleaner -9%", () => {
    const p = calculatePrice(100); // base 130
    const expectedFee = Math.round(130 * FEE_RATE * 100) / 100; // 11.7
    expect(p.clientFee).toBe(expectedFee);
    expect(p.cleanerFee).toBe(expectedFee);
    expect(p.totalClient).toBe(130 + expectedFee); // 141.7
    expect(p.cleanerReceives).toBe(130 - expectedFee); // 118.3
  });

  it("platform revenue equals both fees combined (~18% of base)", () => {
    const p = calculatePrice(100);
    expect(p.platformRevenue).toBeCloseTo(p.clientFee + p.cleanerFee, 2);
    expect(p.platformRevenue).toBeCloseTo(130 * FEE_RATE * 2, 2);
  });

  it("never charges below the floor + its fee, even at 0 mq", () => {
    const p = calculatePrice(0);
    expect(p.basePrice).toBe(MIN_ORDER);
    expect(p.totalClient).toBeGreaterThanOrEqual(MIN_ORDER);
  });

  it("rounds money to 2 decimals", () => {
    const p = calculatePrice(77); // 77*1.3 = 100.1
    expect(p.basePrice).toBe(100.1);
    expect(Number.isInteger(p.clientFee * 100)).toBe(true);
  });
});

describe("pricing engine — formatPrice", () => {
  it("formats euro with two decimals", () => {
    expect(formatPrice(130)).toBe("€130.00");
    expect(formatPrice(141.7)).toBe("€141.70");
  });
});
