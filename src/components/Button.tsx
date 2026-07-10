import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, shadow, spacing } from '@/theme'

type Variant = 'primary' | 'secondary' | 'danger' | 'success'

interface Props {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
}

const bg: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.danger,
  success: colors.success,
}

export function Button({ title, onPress, variant = 'primary', disabled, loading }: Props) {
  const isSecondary = variant === 'secondary'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg[variant], opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        isSecondary ? styles.secondaryBorder : shadow.button,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : colors.primaryText} />
      ) : (
        <Text style={[styles.label, { color: isSecondary ? colors.text : colors.primaryText }]}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryBorder: { borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: '600' },
})
