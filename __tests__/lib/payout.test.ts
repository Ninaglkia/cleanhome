import { describe, it, expect } from "vitest";
import { buildWeeklyPayouts } from "@/lib/stripe/payout";
import type { CompletedBookingRow } from "@/lib/stripe/payout";

describe("buildWeeklyPayouts", () => {
  it("groups multiple bookings per cleaner", () => {
    const bookings: CompletedBookingRow[] = [
      { id: "b1", cleaner_id: "c1", base_price: 60, cleaner_fee: 5.4, stripe_account_id: "acct_1" },
      { id: "b2", cleaner_id: "c1", base_price: 80, cleaner_fee: 7.2, stripe_account_id: "acct_1" },
      { id: "b3", cleaner_id: "c2", base_price: 40, cleaner_fee: 3.6, stripe_account_id: "acct_2" },
    ];
    const result = buildWeeklyPayouts(bookings);
    expect(result).toHaveLength(2);
    const c1 = result.find((r) => r.cleanerId === "c1")!;
    expect(c1.bookingIds).toEqual(["b1", "b2"]);
    expect(c1.totalGross).toBe(140);
    expect(c1.netAmount).toBeCloseTo(127.4);
  });

  it("skips bookings without a stripe account", () => {
    const bookings: CompletedBookingRow[] = [
      { id: "b1", cleaner_id: "c1", base_price: 60, cleaner_fee: 5.4, stripe_account_id: null },
    ];
    expect(buildWeeklyPayouts(bookings)).toHaveLength(0);
  });
});
