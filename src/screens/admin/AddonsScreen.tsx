import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListAddonsQuery,
  useCreateAddonMutation,
  useSoftDeleteAddonMutation,
} from '@/features/admin/adminApi'
import { errDetail } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { colors, spacing } from '@/theme'

export function AddonsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useListAddonsQuery()
  const [createAddon, { isLoading: creating }] = useCreateAddonMutation()
  const [softDelete] = useSoftDeleteAddonMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [err, setErr] = useState<string | null>(null)

  const active = (data ?? []).filter((a) => a.is_active)

  async function create() {
    setErr(null)
    try {
      await createAddon({ name: name.trim(), price: parseFloat(price) || 0 }).unwrap()
      setName('')
      setPrice('0')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <FlatList
        data={active}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add add-on" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{formatMoney(item.price)}</Text>
              </View>
              <Button title="Delete" variant="danger" onPress={() => softDelete(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No add-ons yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New add-on" onClose={() => setModalOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <Field label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button title="Create" onPress={create} loading={creating} disabled={!name.trim()} />
        <View style={{ height: spacing.sm }} />
        <Button title="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
      </FormModal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
