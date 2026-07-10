import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListTablesQuery,
  useCreateTableMutation,
  useDeactivateTableMutation,
} from '@/features/admin/adminApi'
import { errDetail } from '@/lib/errors'
import { colors, spacing } from '@/theme'

export function TablesScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useListTablesQuery()
  const [createTable, { isLoading: creating }] = useCreateTableMutation()
  const [deactivate] = useDeactivateTableMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const active = (data ?? []).filter((t) => t.is_active)

  async function create() {
    setErr(null)
    try {
      await createTable({ name: name.trim() }).unwrap()
      setName('')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <FlatList
        data={active}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add table" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.scan_url}
                </Text>
              </View>
              <Button title="Deactivate" variant="danger" onPress={() => deactivate(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No tables yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New table" onClose={() => setModalOpen(false)}>
        <Field label="Name / number" value={name} onChangeText={setName} autoCapitalize="characters" />
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
  flex: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
