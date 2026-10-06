import crypto from 'crypto';

/**
 * Generates an order number adhering to SRS-ORD-01:
 * Format: ORD-YYMM-XXXX where XXXX is a randomized 4-digit token.
 * Example: ORD-2610-4081
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomDigits = crypto.randomInt(1000, 9999).toString();

  return `ORD-${year}${month}-${randomDigits}`;
}
