/**
 * Parse a price string to micro-units (integer).
 * Decimal presence (contains '.') means USDC dollars -> multiply by 1_000_000.
 * No decimal means raw micro-units.
 * Per D-06 from 02-CONTEXT.md.
 */
export function parsePrice(raw: string): number {
  if (raw.includes('.')) {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid price: "${raw}". Must be a positive number.`);
    }
    return Math.round(parsed * 1_000_000);
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid price: "${raw}". Must be a positive integer (micro-units).`);
  }
  return parsed;
}

/**
 * Format micro-units to human-readable USDC string.
 * Example: 1000000 -> "$1.00 USDC"
 */
export function formatPrice(microUnits: number): string {
  return `$${(microUnits / 1_000_000).toFixed(2)} USDC`;
}
