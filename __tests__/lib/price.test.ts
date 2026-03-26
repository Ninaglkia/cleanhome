import { describe, it, expect } from "vitest";
import {
  calculateBookingPrice,
  estimateHours,
  isAdvanceBookingValid,
  calculateCleanerDeadline,
} from "@/lib/stripe/price";

describe("estimateHours", () => {
  it("returns minimum 2 hours for 1 room", () => {
    expect(estimateHours(1)).toBe(2);
  });
  it("returns 3 hours for 2 rooms", () => {
    expect(estimateHours(2)).toBe(3);
  });
  it("returns 6 hours for 4 rooms", () => {
    expect(estimateHours(4)).toBe(6);
  });
});

describe("calculateBookingPrice", () => {
  it("correctly calculates price breakdown", () => {
    // hourlyRate=20, numRooms=2 → estimatedHours=3 → base=60
    const result = calculateBookingPrice(20, 2);
    expect(result.basePrice).toBe(60);
    expect(result.clientFee).toBe(5.4);
    expect(result.totalPrice).toBe(65.4);
    expect(result.cleanerNet).toBe(54.6);
    expect(result.platformMargin).toBe(10.8);
  });

  it("handles minimum 2 hours", () => {
    const result = calculateBookingPrice(15, 1);
    expect(result.basePrice).toBe(30);
    expect(result.totalPrice).toBe(32.7);
  });
});

describe("isAdvanceBookingValid", () => {
  it("returns false for booking in less than 8h", () => {
    const soon = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const dateStr = soon.toISOString().split("T")[0];
    const timeStr = `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
    expect(isAdvanceBookingValid(dateStr, timeStr)).toBe(false);
  });

  it("returns true for booking 10h in the future", () => {
    const future = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const dateStr = future.toISOString().split("T")[0];
    const timeStr = `${String(future.getHours()).padStart(2, "0")}:${String(future.getMinutes()).padStart(2, "0")}`;
    expect(isAdvanceBookingValid(dateStr, timeStr)).toBe(true);
  });
});

describe("calculateCleanerDeadline", () => {
  it("returns 8 hours before service time", () => {
    const deadline = calculateCleanerDeadline("2026-04-01", "10:00");
    expect(deadline.getHours()).toBe(2);
  });
});
