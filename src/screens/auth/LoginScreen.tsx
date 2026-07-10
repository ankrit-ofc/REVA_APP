import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSelector } from 'react-redux'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { useLoginMutation } from '@/features/auth/authApi'
import { loginRequestSchema } from '@/lib/schemas/auth'
import type { RootState } from '@/store/store'
import type { AuthScreenProps } from '@/navigation/types'
import { colors, radius, spacing } from '@/theme'

/** Remembers the last restaurant so staff don't retype the slug each sign-in. */
const SLUG_KEY = 'last_restaurant_slug'

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const [login, { isLoading }] = useLoginMutation()
  const signedOutNotice = useSelector((s: RootState) => s.auth.signedOutNotice)

  const [slug, setSlug] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [editingSlug, setEditingSlug] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Prefill the restaurant slug from the last successful sign-in.
  useEffect(() => {
    AsyncStorage.getItem(SLUG_KEY)
      .then((v) => {
        if (v) {
          setSlug(v)
          setSavedSlug(v)
        }
      })
      .catch(() => {
        /* no saved slug — leave the field empty */
      })
  }, [])

  // Show the compact "remembered restaurant" chip only when we have a saved
  // slug and the user hasn't chosen to change it.
  const showSlugChip = savedSlug != null && !editingSlug

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
      // A slug error is only visible when the field is showing.
      if (fieldErrors['restaurant_slug']) setEditingSlug(true)
      return
    }
    setErrors({})
    try {
      // On success the auth slice flips isAuthenticated and the root navigator
      // swaps to the role's home — no manual navigation needed here.
      await login(parsed.data).unwrap()
      // Remember this restaurant for next time.
      AsyncStorage.setItem(SLUG_KEY, parsed.data.restaurant_slug).catch(() => {})
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>R</Text>
            </View>
            <Text style={styles.title}>Reva Staff</Text>
            <Text style={styles.subtitle}>
              {savedSlug ? 'Welcome back — sign in to continue' : 'Sign in to your restaurant'}
            </Text>
          </View>

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

          <View style={styles.card}>
            {showSlugChip ? (
              <View style={styles.chipWrap}>
                <Text style={styles.label}>Restaurant</Text>
                <View style={styles.chip}>
                  <Text style={styles.chipValue} numberOfLines={1}>
                    {savedSlug}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setEditingSlug(true)}
                  >
                    <Text style={styles.chipAction}>Change</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Field
                label="Restaurant slug"
                value={slug}
                onChangeText={setSlug}
                placeholder="e.g. acme-cafe"
                error={errors['restaurant_slug']}
              />
            )}

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

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setRememberMe((v) => !v)}
              hitSlop={6}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>Keep me signed in</Text>
            </Pressable>

            <View style={{ height: spacing.md }} />
            <Button title="Sign in" onPress={onSubmit} loading={isLoading} />
          </View>

          <Pressable
            style={styles.forgot}
            hitSlop={8}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: { color: colors.primaryText, fontSize: 32, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    // Subtle lift so the form reads as a distinct surface.
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notice: {
    backgroundColor: colors.warning + '18',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: { color: colors.warning, fontSize: 13 },
  errorBox: {
    backgroundColor: colors.danger + '14',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBoxText: { color: colors.danger, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  chipWrap: { marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chipValue: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: spacing.md },
  chipAction: { fontSize: 14, fontWeight: '600', color: colors.primary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.primaryText, fontSize: 14, fontWeight: '800' },
  checkboxLabel: { fontSize: 14, color: colors.text },
  forgot: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
  forgotText: { fontSize: 14, fontWeight: '600', color: colors.primary },
})
