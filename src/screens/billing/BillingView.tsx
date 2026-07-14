import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { ReasonModal } from '@/components/ReasonModal'
import { QueryState } from '@/components/QueryState'
import {
  useGetCounterOrdersQuery,
  useGetCounterOpenOrdersQuery,
  useMarkMealFinishedMutation,
  useReopenCounterOrderMutation,
  useStartBillingMutation,
  useCloseUnpaidMutation,
  useQuickBillMutation,
  useGenerateInvoiceMutation,
  useGetInvoiceQuery,
  usePayInvoiceMutation,
  useManualOverrideMutation,
  type CounterPayMethod,
} from '@/features/counter/counterApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { errDetail } from '@/lib/errors'
import { formatMoney, newIdempotencyKey } from '@/lib/money'
import type { CounterOrderSummary } from '@/lib/schemas/order'
import type { Role } from '@/types'
import { colors, radius, spacing } from '@/theme'

const CURRENCY = 'NPR'
const PAY_METHODS: CounterPayMethod[] = ['CASH', 'CARD', 'COUNTER_WALLET']
const PAY_LABEL: Record<CounterPayMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  COUNTER_WALLET: 'Wallet',
}

/**
 * The full counter-billing flow, shared by the COUNTER and WAITER surfaces:
 *   Open Tables → Ready-for-billing queue → Invoice + payment.
 * Printing is intentionally omitted on mobile (handled by the KOT/print worker).
 */
export function BillingView({ role }: { role: Role | null }) {
  const [invoiceId, setInvoiceId] = useState<string | null>(null)

  if (invoiceId) {
    return <InvoiceView invoiceId={invoiceId} role={role} onReset={() => setInvoiceId(null)} />
  }
  return <OrdersView onInvoice={setInvoiceId} />
}

// ── Open tables + billing queue ───────────────────────────────────────────────

function OrdersView({ onInvoice }: { onInvoice: (id: string) => void }) {
  const openQ = useGetCounterOpenOrdersQuery(undefined, { pollingInterval: 15_000 })
  const queueQ = useGetCounterOrdersQuery(undefined, { pollingInterval: 15_000 })
  const [markMealFinished] = useMarkMealFinishedMutation()
  const [startBilling] = useStartBillingMutation()
  const [reopenOrder, { isLoading: reopenBusy }] = useReopenCounterOrderMutation()
  const [closeUnpaid, { isLoading: closeBusy }] = useCloseUnpaidMutation()
  const [generateInvoice, { isLoading: genBusy }] = useGenerateInvoiceMutation()
  const [quickBill, { isLoading: billBusy }] = useQuickBillMutation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat')
  const [discountValue, setDiscountValue] = useState('0')
  const [reopenTarget, setReopenTarget] = useState<CounterOrderSummary | null>(null)
  const [closeTarget, setCloseTarget] = useState<CounterOrderSummary | null>(null)
  const [billTarget, setBillTarget] = useState<CounterOrderSummary | null>(null)
  const [billErr, setBillErr] = useState<string | null>(null)
  // Stable idempotency key per Bill & Clear attempt — reused if the confirm is retried.
  const billKey = useRef('')
  const [err, setErr] = useState<string | null>(null)

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (
          ev.type === 'order.created' ||
          ev.type === 'order.status_changed' ||
          ev.type === 'order.closed' ||
          ev.type === 'bill.requested'
        ) {
          openQ.refetch()
          queueQ.refetch()
        }
      },
      [openQ, queueQ],
    ),
  )

  const open = openQ.data ?? []
  const queue = queueQ.data ?? []

  async function generate() {
    if (!selectedId) return
    setErr(null)
    const discount = parseFloat(discountValue) || 0
    if (discount < 0 || (discountType === 'percent' && discount > 100)) {
      setErr('Invalid discount value.')
      return
    }
    try {
      const inv = await generateInvoice({
        order_id: selectedId,
        discount_type: discountType,
        discount_value: discount,
      }).unwrap()
      onInvoice(inv.id)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  function openBill(o: CounterOrderSummary) {
    billKey.current = newIdempotencyKey()
    setBillErr(null)
    setBillTarget(o)
  }

  async function confirmBill(method: CounterPayMethod) {
    if (!billTarget) return
    setBillErr(null)
    try {
      await quickBill({ orderId: billTarget.id, method, idempotencyKey: billKey.current }).unwrap()
      setBillTarget(null)
    } catch (e) {
      setBillErr(errDetail(e))
    }
  }

  const loading = openQ.isLoading || queueQ.isLoading

  return (
    <>
    <FlatList
      data={queue}
      keyExtractor={(o) => o.id}
      contentContainerStyle={styles.list}
      onRefresh={() => {
        openQ.refetch()
        queueQ.refetch()
      }}
      refreshing={openQ.isFetching || queueQ.isFetching}
      ListHeaderComponent={
        <View>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          {open.length > 0 ? (
            <>
              <Text style={styles.section}>Open Tables</Text>
              {open.map((o) => (
                <Card key={o.id}>
                  <View style={styles.rowTop}>
                    <Text style={styles.orderNo}>#{o.order_number}</Text>
                    <Text style={styles.table}>{o.table_name}</Text>
                    <View style={styles.flex} />
                    <Text style={styles.items}>
                      {o.item_count} item{o.item_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {o.bill_requested ? (
                    <Text style={styles.billRequested}>🔔 Bill requested</Text>
                  ) : (
                    <Text style={styles.muted}>Awaiting guest’s bill request</Text>
                  )}
                  {o.bill_requested ? (
                    <View style={styles.actions}>
                      <View style={styles.flex}>
                        <Button title="Bill & clear" variant="success" onPress={() => openBill(o)} />
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {!o.bill_requested ? (
                      <>
                        <View style={styles.flex}>
                          <Button
                            title="Start billing"
                            variant="secondary"
                            onPress={() => startBilling(o.id)}
                          />
                        </View>
                        <View style={{ width: spacing.sm }} />
                      </>
                    ) : null}
                    <View style={styles.flex}>
                      <Button
                        title="Move to billing"
                        variant="secondary"
                        disabled={!o.bill_requested}
                        onPress={() => markMealFinished(o.id)}
                      />
                    </View>
                    <View style={{ width: spacing.sm }} />
                    <Button title="Close" variant="danger" onPress={() => setCloseTarget(o)} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          <Text style={styles.section}>Ready for Billing</Text>
          {queue.length > 0 ? (
            <Card>
              <View style={styles.discountRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Discount</Text>
                  <View style={styles.toggle}>
                    <ToggleChip
                      label="Flat"
                      active={discountType === 'flat'}
                      onPress={() => setDiscountType('flat')}
                    />
                    <ToggleChip
                      label="%"
                      active={discountType === 'percent'}
                      onPress={() => setDiscountType('percent')}
                    />
                  </View>
                </View>
                <View style={{ width: spacing.md }} />
                <View style={styles.flex}>
                  <Field
                    label="Amount"
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Button
                title={selectedId ? 'Generate invoice' : 'Select an order below'}
                disabled={!selectedId}
                loading={genBusy}
                onPress={generate}
              />
            </Card>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => setSelectedId(item.id)}>
          <View style={[styles.queueRow, selectedId === item.id && styles.queueRowSelected]}>
            <Text style={styles.orderNo}>#{item.order_number}</Text>
            <Text style={styles.table}>{item.table_name}</Text>
            <View style={styles.flex} />
            <Text style={styles.items}>
              {item.item_count} item{item.item_count !== 1 ? 's' : ''}
            </Text>
            <View style={{ width: spacing.sm }} />
            <Pressable onPress={() => setReopenTarget(item)} hitSlop={6}>
              <Text style={styles.linkBtn}>Reopen</Text>
            </Pressable>
            <Pressable onPress={() => setCloseTarget(item)} hitSlop={6}>
              <Text style={[styles.linkBtn, { color: colors.danger }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <QueryState
          loading={loading}
          error={openQ.isError || queueQ.isError}
          empty={!loading && open.length === 0 && queue.length === 0}
          emptyText="No open or billable tables."
        />
      }
      ListFooterComponent={
        !loading && queue.length === 0 ? (
          <Text style={styles.muted}>No orders waiting for billing.</Text>
        ) : null
      }
    />
      <ReasonModal
        visible={!!reopenTarget}
        title={reopenTarget ? `Reopen #${reopenTarget.order_number}` : ''}
        hint="Returns the order to OPEN so more items can be added. Requires a reason; only available when reopening is enabled in settings."
        confirmLabel="Reopen"
        busy={reopenBusy}
        onConfirm={async (reason) => {
          if (!reopenTarget) return
          try {
            await reopenOrder({ orderId: reopenTarget.id, reason }).unwrap()
          } catch (e) {
            setErr(errDetail(e))
          }
          setReopenTarget(null)
        }}
        onClose={() => setReopenTarget(null)}
      />
      <ReasonModal
        visible={!!closeTarget}
        title={closeTarget ? `Close #${closeTarget.order_number} without payment` : ''}
        hint="Cancel / walkout / write-off — voids any invoice and closes the table with no payment recorded. This action is logged."
        confirmLabel="Close (no payment)"
        busy={closeBusy}
        onConfirm={async (reason) => {
          if (!closeTarget) return
          try {
            await closeUnpaid({ orderId: closeTarget.id, reason }).unwrap()
          } catch (e) {
            setErr(errDetail(e))
          }
          setCloseTarget(null)
        }}
        onClose={() => setCloseTarget(null)}
      />
      <MethodModal
        order={billTarget}
        busy={billBusy}
        error={billErr}
        onConfirm={confirmBill}
        onClose={() => setBillTarget(null)}
      />
    </>
  )
}

// ── Method picker (one-tap Bill & clear) ──────────────────────────────────────

function MethodModal({
  order,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  order: CounterOrderSummary | null
  busy: boolean
  error: string | null
  onConfirm: (method: CounterPayMethod) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState<CounterPayMethod>('CASH')

  return (
    <Modal visible={!!order} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>
            Bill &amp; clear{order ? ` #${order.order_number}` : ''}
          </Text>
          <Text style={styles.modalHint}>
            Records payment{order ? ` for ${order.table_name}` : ''} and clears the table. Choose how
            the guest paid.
          </Text>
          <View style={styles.methodRow}>
            {PAY_METHODS.map((m) => (
              <View key={m} style={styles.flex}>
                <ToggleChip label={PAY_LABEL[m]} active={method === m} onPress={() => setMethod(m)} />
              </View>
            ))}
          </View>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={styles.flex}>
              <Button
                title="Confirm & clear"
                variant="success"
                loading={busy}
                onPress={() => onConfirm(method)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Invoice + payment ─────────────────────────────────────────────────────────

function InvoiceView({
  invoiceId,
  role,
  onReset,
}: {
  invoiceId: string
  role: Role | null
  onReset: () => void
}) {
  const { data: invoice, isLoading, refetch } = useGetInvoiceQuery(invoiceId, {
    pollingInterval: 10_000,
  })
  const [payInvoice, { isLoading: payBusy }] = usePayInvoiceMutation()
  const [manualOverride, { isLoading: overrideBusy }] = useManualOverrideMutation()
  const [method, setMethod] = useState<CounterPayMethod>('CASH')
  const [payError, setPayError] = useState<string | null>(null)
  const [showOverride, setShowOverride] = useState(false)

  // Stable idempotency key — generated once per invoice view, reused on retries.
  const idempotencyKey = useRef(newIdempotencyKey()).current

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (ev.type === 'invoice.paid' || ev.type === 'order.closed') refetch()
      },
      [refetch],
    ),
  )

  if (isLoading || !invoice) {
    return (
      <View style={styles.center}>
        <QueryState loading empty={false} error={false} />
      </View>
    )
  }

  const isPaid = invoice.status === 'PAID'
  const isClosed = invoice.status === 'VOID' || invoice.status === 'REFUNDED'

  async function pay() {
    setPayError(null)
    try {
      await payInvoice({ invoiceId: invoice!.id, method, idempotencyKey }).unwrap()
    } catch (e) {
      setPayError(errDetail(e))
    }
  }

  return (
    <View style={styles.invoiceWrap}>
      <Button title="← Back to orders" variant="secondary" onPress={onReset} />
      <View style={{ height: spacing.md }} />
      <Card>
        <Text style={styles.invoiceNo}>{invoice.invoice_number}</Text>
        <Text style={styles.invoiceStatus}>{invoice.status}</Text>
        <View style={styles.divider} />
        <Row label="Subtotal" value={formatMoney(invoice.subtotal, CURRENCY)} />
        {invoice.discount > 0 ? (
          <Row label="Discount" value={`- ${formatMoney(invoice.discount, CURRENCY)}`} />
        ) : null}
        <Row label="Tax" value={formatMoney(invoice.tax_total, CURRENCY)} />
        <View style={styles.divider} />
        <Row label="TOTAL" value={formatMoney(invoice.total, CURRENCY)} bold />
      </Card>

      {isPaid ? (
        <View style={styles.paidBox}>
          <Text style={styles.paidText}>✓ Payment recorded — {invoice.payment_method}</Text>
        </View>
      ) : isClosed ? (
        <View style={styles.voidBox}>
          <Text style={styles.voidText}>Invoice {invoice.status.toLowerCase()}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Payment method</Text>
          <View style={styles.methodRow}>
            {PAY_METHODS.map((m) => (
              <View key={m} style={styles.flex}>
                <ToggleChip label={PAY_LABEL[m]} active={method === m} onPress={() => setMethod(m)} />
              </View>
            ))}
          </View>
          {payError ? <Text style={styles.err}>{payError}</Text> : null}
          <View style={{ height: spacing.sm }} />
          <Button
            title={`Collect ${formatMoney(invoice.total, CURRENCY)}`}
            variant="success"
            loading={payBusy}
            onPress={pay}
          />
          {role === 'ADMIN' ? (
            <>
              <View style={{ height: spacing.sm }} />
              <Button
                title="Manual override (Admin)"
                variant="secondary"
                onPress={() => setShowOverride(true)}
              />
            </>
          ) : null}
        </>
      )}

      <ReasonModal
        visible={showOverride}
        title="Manual override"
        hint="Records the invoice as settled outside the normal payment flow. Reason is required and audited."
        confirmLabel="Confirm override"
        busy={overrideBusy}
        onConfirm={async (reason) => {
          setPayError(null)
          try {
            await manualOverride({ invoiceId: invoice.id, reason }).unwrap()
            setShowOverride(false)
          } catch (e) {
            setPayError(errDetail(e))
          }
        }}
        onClose={() => setShowOverride(false)}
      />
    </View>
  )
}

// ── Small building blocks ─────────────────────────────────────────────────────

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.bold]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  flex: { flex: 1 },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 14, color: colors.text },
  items: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  billRequested: { fontSize: 13, color: colors.warning, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  discountRow: { flexDirection: 'row', marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  toggle: { flexDirection: 'row' },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  queueRowSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '0d' },
  linkBtn: { color: colors.primary, fontWeight: '600', fontSize: 13, marginLeft: spacing.md },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  center: { flex: 1 },
  invoiceWrap: { flex: 1, padding: spacing.lg },
  invoiceNo: { fontSize: 18, fontWeight: '800', color: colors.text },
  invoiceStatus: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, color: colors.text },
  bold: { fontWeight: '800', color: colors.text, fontSize: 16 },
  paidBox: {
    backgroundColor: colors.success + '14',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  paidText: { color: colors.success, fontWeight: '700' },
  voidBox: {
    backgroundColor: colors.textMuted + '14',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  voidText: { color: colors.textMuted, fontWeight: '700' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  overlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  modalHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
})
