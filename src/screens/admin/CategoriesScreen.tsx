import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useSoftDeleteCategoryMutation,
} from '@/features/admin/adminApi'
import { errDetail } from '@/lib/errors'
import { colors, spacing } from '@/theme'

export function CategoriesScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useListCategoriesQuery()
  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation()
  const [updateCategory] = useUpdateCategoryMutation()
  const [softDelete] = useSoftDeleteCategoryMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [order, setOrder] = useState('0')
  const [err, setErr] = useState<string | null>(null)

  const active = (data ?? []).filter((c) => c.is_active)

  async function create() {
    setErr(null)
    try {
      await createCategory({
        name: name.trim(),
        display_order: parseInt(order, 10) || 0,
        is_available: true,
      }).unwrap()
      setName('')
      setOrder('0')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <FlatList
        data={active}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add category" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  Order {item.display_order} · {item.is_available ? 'Available' : 'Hidden'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button
                  title={item.is_available ? 'Hide' : 'Show'}
                  variant="secondary"
                  onPress={() => updateCategory({ id: item.id, is_available: !item.is_available })}
                />
              </View>
              <View style={{ width: spacing.sm }} />
              <Button title="Delete" variant="danger" onPress={() => softDelete(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No categories yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New category" onClose={() => setModalOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <Field label="Display order" value={order} onChangeText={setOrder} keyboardType="numeric" />
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
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
