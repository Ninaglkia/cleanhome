export interface CompletedBookingRow {
  id: string;
  cleaner_id: string;
  base_price: number;
  cleaner_fee: number;
  stripe_account_id: string | null;
}

export interface PayoutGroup {
  cleanerId: string;
  stripeAccountId: string;
  bookingIds: string[];
  totalGross: number;
  commissionDeducted: number;
  netAmount: number;
}

export function buildWeeklyPayouts(bookings: CompletedBookingRow[]): PayoutGroup[] {
  const map = new Map<string, PayoutGroup>();

  for (const b of bookings) {
    if (!b.stripe_account_id) continue;
    const existing = map.get(b.cleaner_id);
    const cleanerNet = b.base_price - b.cleaner_fee;

    if (existing) {
      existing.bookingIds.push(b.id);
      existing.totalGross += b.base_price;
      existing.commissionDeducted += b.cleaner_fee;
      existing.netAmount += cleanerNet;
    } else {
      map.set(b.cleaner_id, {
        cleanerId: b.cleaner_id,
        stripeAccountId: b.stripe_account_id,
        bookingIds: [b.id],
        totalGross: b.base_price,
        commissionDeducted: b.cleaner_fee,
        netAmount: cleanerNet,
      });
    }
  }

  return Array.from(map.values());
}
