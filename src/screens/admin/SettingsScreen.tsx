import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { QueryState } from '@/components/QueryState'
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useRotateKotWorkerTokenMutation,
} from '@/features/admin/adminApi'
import type { SettingsResponse, SettingsUpdate } from '@/lib/schemas/admin'
import { errDetail } from '@/lib/errors'
import { colors, radius, spacing } from '@/theme'

type BoolKey =
  | 'enable_qr_payment'
  | 'waiter_can_accept_payment'
  | 'allow_order_reopen'
  | 'require_order_approval'
  | 'require_location'
  | 'print_kot_enabled'
  | 'print_bill_enabled'

const TOGGLES: { key: BoolKey; label: string; hint: string }[] = [
  { key: 'require_order_approval', label: 'Require order approval', hint: 'Waiter must approve each batch before the kitchen sees it.' },
  { key: 'waiter_can_accept_payment', label: 'Waiter can accept payment', hint: 'Enables the waiter billing screen.' },
  { key: 'allow_order_reopen', label: 'Allow order reopen', hint: 'Reopen a billed order to add items.' },
  { key: 'enable_qr_payment', label: 'Enable QR payment', hint: 'Online payment gateways for customers.' },
  { key: 'require_location', label: 'Require location', hint: 'Geofence customer sessions to the venue.' },
  { key: 'print_kot_enabled', label: 'Print KOT', hint: 'Print kitchen tickets on new orders.' },
  { key: 'print_bill_enabled', label: 'Print bill', hint: 'Print the bill on payment.' },
]

export function SettingsScreen() {
  const { data, isLoading, isError } = useGetSettingsQuery()
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation()
  const [rotateToken, { isLoading: rotating }] = useRotateKotWorkerTokenMutation()
  const [err, setErr] = useState<string | null>(null)
  const [printerName, setPrinterName] = useState<string | null>(null)

  if (isLoading || isError || !data) {
    return (
      <Screen>
        <QueryState loading={isLoading} error={isError} empty={false} />
      </Screen>
    )
  }

  const settings: SettingsResponse = data
  const printerValue = printerName ?? settings.kot_printer_name ?? ''

  async function patch(body: SettingsUpdate) {
    setErr(null)
    try {
      await updateSettings(body).unwrap()
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Card>
          {TOGGLES.map((t) => (
            <View key={t.key} style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.toggleLabel}>{t.label}</Text>
                <Text style={styles.toggleHint}>{t.hint}</Text>
              </View>
              <Switch
                value={settings[t.key]}
                onValueChange={(v) => patch({ [t.key]: v } as SettingsUpdate)}
                disabled={saving}
              />
            </View>
          ))}
        </Card>

        <Text style={styles.section}>Kitchen ticket (KOT) printing</Text>
        <Card>
          <Text style={styles.label}>Pipeline</Text>
          <View style={styles.chips}>
            {(['browser', 'worker'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => patch({ kot_print_mode: m })}
                style={[styles.chip, settings.kot_print_mode === m && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, settings.kot_print_mode === m && styles.chipTextActive]}
                >
                  {m === 'browser' ? 'Browser' : 'Worker'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Windows printer name"
            value={printerValue}
            onChangeText={setPrinterName}
            placeholder="e.g. POS-80"
          />
          <Button
            title="Save printer name"
            variant="secondary"
            onPress={() => patch({ kot_printer_name: printerValue })}
            loading={saving}
          />
        </Card>

        <Text style={styles.section}>Worker token</Text>
        <Card>
          <Text style={styles.tokenHint}>
            The print worker authenticates with this per-restaurant token. Rotating it
            invalidates the old one immediately.
          </Text>
          <Text style={styles.token} selectable>
            {settings.kot_worker_token ?? '— not set —'}
          </Text>
          <Button
            title="Regenerate token"
            variant="danger"
            onPress={() => rotateToken()}
            loading={rotating}
          />
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  flex: { flex: 1, marginRight: spacing.md },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  toggleHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginRight: spacing.sm,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  tokenHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  token: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
