import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { useResetPasswordMutation } from '@/features/auth/authApi'
import { resetPasswordSchema } from '@/lib/schemas/auth'
import type { AuthScreenProps } from '@/navigation/types'
import { colors, spacing } from '@/theme'

export function ResetPasswordScreen({ route, navigation }: AuthScreenProps<'ResetPassword'>) {
  const [reset, { isLoading }] = useResetPasswordMutation()
  const [token, setToken] = useState(route.params?.token ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  async function onSubmit() {
    const fe: Record<string, string> = {}
    if (password !== confirm) fe['confirm'] = 'Passwords do not match'
    const parsed = resetPasswordSchema.safeParse({ token, new_password: password })
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? '')
        if (k && !fe[k]) fe[k] = i.message
      }
    }
    if (Object.keys(fe).length) {
      setErrors(fe)
      return
    }
    setErrors({})
    try {
      await reset(parsed.data!).unwrap()
      setDone(true)
    } catch {
      setErrors({ token: 'This reset link is invalid or has expired.' })
    }
  }

  if (done) {
    return (
      <Screen>
        <View style={styles.content}>
          <Text style={styles.title}>Password reset</Text>
          <Text style={styles.subtitle}>You can now sign in with your new password.</Text>
          <Button title="Back to sign in" onPress={() => navigation.navigate('Login')} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Paste the token from your reset email.</Text>
        <Field label="Reset token" value={token} onChangeText={setToken} error={errors['token']} />
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={errors['new_password']}
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          error={errors['confirm']}
        />
        <Button title="Reset password" onPress={onSubmit} loading={isLoading} />
        <View style={{ height: spacing.sm }} />
        <Button title="Back to sign in" variant="secondary" onPress={() => navigation.navigate('Login')} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xl },
})
