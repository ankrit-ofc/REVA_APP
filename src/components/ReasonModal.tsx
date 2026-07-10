import { useState } from 'react'
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native'
import { Button } from './Button'
import { colors, radius, spacing } from '@/theme'

interface Props {
  visible: boolean
  title: string
  hint: string
  confirmLabel: string
  busy?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}

/** Modal that collects a required reason (min 3 chars) for audited actions. */
export function ReasonModal({ visible, title, hint, confirmLabel, busy, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('')
  const ok = reason.trim().length >= 3

  function close() {
    setReason('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={3}
            maxLength={500}
            placeholder="Reason (required, min 3 chars)…"
            placeholderTextColor={colors.textMuted}
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, 500))}
          />
          <Text style={styles.count}>{reason.length}/500</Text>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" onPress={close} />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={styles.flex}>
              <Button
                title={confirmLabel}
                variant="danger"
                disabled={!ok}
                loading={busy}
                onPress={() => onConfirm(reason.trim())}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
  },
  count: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  flex: { flex: 1 },
})
