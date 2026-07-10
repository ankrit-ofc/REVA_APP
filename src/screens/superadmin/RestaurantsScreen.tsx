import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListRestaurantsQuery,
  useCreateRestaurantMutation,
  useUpdateRestaurantMutation,
} from '@/features/superadmin/superadminApi'
import { errDetail } from '@/lib/errors'
import { colors, spacing } from '@/theme'

export function RestaurantsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useListRestaurantsQuery()
  const [createRestaurant, { isLoading: creating }] = useCreateRestaurantMutation()
  const [updateRestaurant] = useUpdateRestaurantMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    setErr(null)
    try {
      await createRestaurant({
        name: name.trim(),
        slug: slug.trim(),
        admin_email: email.trim(),
        admin_password: password,
      }).unwrap()
      setName('')
      setSlug('')
      setEmail('')
      setPassword('')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add restaurant" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  /{item.slug} · {item.is_active ? 'Active' : 'Inactive'}
                </Text>
                {item.admins.map((a) => (
                  <Text key={a.id} style={styles.admin}>
                    {a.email}
                  </Text>
                ))}
              </View>
            </View>
            <View style={{ height: spacing.sm }} />
            <Button
              title={item.is_active ? 'Deactivate' : 'Activate'}
              variant={item.is_active ? 'danger' : 'success'}
              onPress={() => updateRestaurant({ id: item.id, is_active: !item.is_active })}
            />
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No restaurants yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New restaurant" onClose={() => setModalOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Slug" value={slug} onChangeText={setSlug} placeholder="acme-cafe" />
        <Field label="Admin email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Admin password" value={password} onChangeText={setPassword} secureTextEntry />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button
          title="Create"
          onPress={create}
          loading={creating}
          disabled={!name.trim() || !slug.trim() || !email.trim() || password.length < 8}
        />
        <View style={{ height: spacing.sm }} />
        <Button title="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
      </FormModal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  admin: { fontSize: 12, color: colors.primary, marginTop: 2 },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
