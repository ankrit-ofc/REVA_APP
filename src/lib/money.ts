/** Formats a numeric amount with a currency code (default NPR — Nepal market). */
export function formatMoney(amount: number, currency = 'NPR'): string {
  const n = Number.isFinite(amount) ? amount : 0
  return `${currency} ${n.toFixed(2)}`
}

/** A random idempotency key for payment requests (replayed pay must not double-apply). */
export function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
