// CleanHome Pricing Engine
// Formula: prezzo = max(MIN_ORDER, mq × RATE_PER_SQM)
// Client pays: base × 1.09 | Cleaner receives: base × 0.91

const RATE_PER_SQM = 1.3;
const MIN_ORDER = 50;
const FEE_RATE = 0.09;

export interface PriceBreakdown {
  sqm: number;
  basePrice: number;
  clientFee: number;
  cleanerFee: number;
  totalClient: number;
  cleanerReceives: number;
  platformRevenue: number;
}

export function calculatePrice(sqm: number): PriceBreakdown {
  const raw = sqm * RATE_PER_SQM;
  const basePrice = Math.max(MIN_ORDER, Math.round(raw * 100) / 100);
  const clientFee = Math.round(basePrice * FEE_RATE * 100) / 100;
  const cleanerFee = Math.round(basePrice * FEE_RATE * 100) / 100;

  return {
    sqm,
    basePrice,
    clientFee,
    cleanerFee,
    totalClient: basePrice + clientFee,
    cleanerReceives: basePrice - cleanerFee,
    platformRevenue: clientFee + cleanerFee,
  };
}

export function formatPrice(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export { RATE_PER_SQM, MIN_ORDER, FEE_RATE };
