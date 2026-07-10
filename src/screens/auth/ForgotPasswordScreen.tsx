import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { useForgotPasswordMutation } from '@/features/auth/authApi'
import { forgotPasswordSchema } from '@/lib/schemas/auth'
import type { AuthScreenProps } from '@/navigation/types'
import { colors, spacing } from '@/theme'

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const [forgot, { isLoading }] = useForgotPasswordMutation()
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit() {
    const parsed = forgotPasswordSchema.safeParse({ restaurant_slug: slug, email })
    if (!parsed.success) {
      const fe: Record<string, string> = {}
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? '')
        if (k && !fe[k]) fe[k] = i.message
      }
      setErrors(fe)
      return
    }
    setErrors({})
    try {
      const res = await forgot(parsed.data).unwrap()
      setMessage(res.message)
    } catch {
      // Backend returns a generic message either way; show the same to avoid leaks.
      setMessage('If an account matches those details, a reset link has been sent.')
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>We’ll email a reset link if the account exists.</Text>

        {message ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>{message}</Text>
          </View>
        ) : null}

        <Field
          label="Restaurant slug"
          value={slug}
          onChangeText={setSlug}
          error={errors['restaurant_slug']}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          error={errors['email']}
        />
        <Button title="Send reset link" onPress={onSubmit} loading={isLoading} />
        <View style={{ height: spacing.sm }} />
        <Button
          title="Back to sign in"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
        <View style={{ height: spacing.sm }} />
        <Button
          title="I have a reset token"
          variant="secondary"
          onPress={() => navigation.navigate('ResetPassword')}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xl },
  info: {
    backgroundColor: colors.success + '14',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoText: { color: colors.success, fontSize: 13 },
})
