/**
 * Convert paisa (bigint string or number) to formatted rupee string.
 * Example: "1234500" -> "12,345.00"
 */
export function paisaToRupees(paisa: string | number | bigint): string {
  const p = typeof paisa === 'string' ? parseInt(paisa, 10) : Number(paisa);
  if (isNaN(p)) return '0.00';
  const rupees = p / 100;
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format as Indian Rupee currency string.
 */
export function formatRupees(paisa: string | number | bigint): string {
  return `₹${paisaToRupees(paisa)}`;
}

/**
 * Convert rupee amount (user input) to paisa for API.
 */
export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Generate a random idempotency key.
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
