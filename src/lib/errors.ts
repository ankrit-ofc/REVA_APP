/** Extracts a human-readable message from an RTK Query / axios error shape. */
export function errDetail(e: unknown): string {
  if (!e) return 'Unknown error'
  if (typeof e === 'object' && 'data' in e) {
    const d = (e as { data?: { detail?: unknown } }).data
    if (d && typeof d.detail === 'string') return d.detail
  }
  if (typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return 'Request failed'
}

/** HTTP status from an RTK Query error, if present. */
export function errStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}
