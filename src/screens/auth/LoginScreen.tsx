import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSelector } from 'react-redux'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { useLoginMutation } from '@/features/auth/authApi'
import { loginRequestSchema } from '@/lib/schemas/auth'
import type { RootState } from '@/store/store'
import type { AuthScreenProps } from '@/navigation/types'
import { colors, spacing } from '@/theme'

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const [login, { isLoading }] = useLoginMutation()
  const signedOutNotice = useSelector((s: RootState) => s.auth.signedOutNotice)

  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  async function onSubmit() {
    setFormError(null)
    const parsed = loginRequestSchema.safeParse({
      restaurant_slug: slug,
      email,
      password,
      remember_me: rememberMe,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    try {
      // On success the auth slice flips isAuthenticated and the root navigator
      // swaps to the role's home — no manual navigation needed here.
      await login(parsed.data).unwrap()
    } catch (e) {
      const status = (e as { status?: number }).status
      setFormError(
        status === 401
          ? 'Invalid restaurant, email, or password.'
          : 'Sign-in failed. Check your connection and try again.',
      )
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Reva Staff</Text>
          <Text style={styles.subtitle}>Sign in to your restaurant</Text>

          {signedOutNotice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                You were signed out. This can happen if the account signed in on another device.
              </Text>
            </View>
          ) : null}

          {formError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{formError}</Text>
            </View>
          ) : null}

          <Field
            label="Restaurant slug"
            value={slug}
            onChangeText={setSlug}
            placeholder="e.g. acme-cafe"
            error={errors['restaurant_slug']}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@restaurant.com"
            keyboardType="email-address"
            error={errors['email']}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            error={errors['password']}
          />

          <Button
            title={rememberMe ? '☑  Keep me signed in' : '☐  Keep me signed in'}
            variant="secondary"
            onPress={() => setRememberMe((v) => !v)}
          />
          <View style={{ height: spacing.md }} />
          <Button title="Sign in" onPress={onSubmit} loading={isLoading} />
          <View style={{ height: spacing.sm }} />
          <Button
            title="Forgot password?"
            variant="secondary"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingTop: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.xl },
  notice: {
    backgroundColor: colors.warning + '18',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: { color: colors.warning, fontSize: 13 },
  errorBox: {
    backgroundColor: colors.danger + '14',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBoxText: { color: colors.danger, fontSize: 13 },
})
