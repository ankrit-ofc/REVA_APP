import type { ReactNode } from 'react'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '@/theme'

interface Props {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Generic bottom-anchored modal sheet for create/edit forms. */
export function FormModal({ visible, title, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
})
