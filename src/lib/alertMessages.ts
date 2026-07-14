import type { RealtimeEvent } from '@/types'

/**
 * Maps a realtime staff event to notification copy. Shared by the foreground
 * in-app alerts (`useStaffAlerts`) and the background foreground-service runner
 * so both surfaces present identical wording from a single source of truth.
 */

/** Read a string field off an event, or undefined when absent/non-string. */
function str(ev: RealtimeEvent, key: string): string | undefined {
  const v = ev[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** `Table 12` / a fallback when the table is unknown. */
function tableLabel(ev: RealtimeEvent, fallback: string): string {
  const table = str(ev, 'table_name')
  return table ? `Table ${table}` : fallback
}

/** ` (order #7)` when the event carries an order number, else ''. */
function orderSuffix(ev: RealtimeEvent): string {
  const n = ev['order_number']
  return typeof n === 'number' || typeof n === 'string' ? ` (order #${n})` : ''
}

/** Human-readable alert copy per event type, or null to ignore the event. */
export function messageFor(ev: RealtimeEvent): { title: string; body: string } | null {
  switch (ev.type) {
    case 'waiter.called':
      return { title: 'Waiter called', body: `${tableLabel(ev, 'A table')} needs a waiter.` }
    case 'order.created':
      return { title: 'New order', body: `${tableLabel(ev, 'A table')} placed an order${orderSuffix(ev)}.` }
    case 'order.approval_requested':
      return {
        title: 'Approval needed',
        body: `${tableLabel(ev, 'A table')} placed an order${orderSuffix(ev)} — approve or reject it.`,
      }
    case 'bill.requested':
      return { title: 'Bill requested', body: `${tableLabel(ev, 'A table')} asked for the bill${orderSuffix(ev)}.` }
    case 'order_item.status_changed':
      return ev['status'] === 'READY'
        ? { title: 'Item ready', body: `An item is ready to serve.` }
        : null
    default:
      return null
  }
}
