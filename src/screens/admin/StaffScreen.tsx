import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  type StaffCreate,
} from '@/features/admin/adminApi'
import { errDetail } from '@/lib/errors'
import { colors, radius, spacing } from '@/theme'

const ROLES: StaffCreate['role'][] = ['ADMIN', 'KITCHEN', 'WAITER', 'COUNTER', 'COUNTER_DISPLAY']

export function StaffScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useListStaffQuery()
  const [createStaff, { isLoading: creating }] = useCreateStaffMutation()
  const [updateStaff] = useUpdateStaffMutation()
  const [deleteStaff] = useDeleteStaffMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffCreate['role']>('WAITER')
  const [err, setErr] = useState<string | null>(null)

  const active = (data ?? []).filter((s) => s.is_active)

  async function create() {
    setErr(null)
    try {
      await createStaff({ email: email.trim(), password, role }).unwrap()
      setEmail('')
      setPassword('')
      setRole('WAITER')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  return (
    <Screen>
      <FlatList
        data={active}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add staff" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.email}</Text>
                <Text style={styles.meta}>{item.role}</Text>
              </View>
            </View>
            {item.role !== 'SUPERADMIN' ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    title="Deactivate"
                    variant="secondary"
                    onPress={() => updateStaff({ id: item.id, is_active: false })}
                  />
                </View>
                <View style={{ width: spacing.sm }} />
                <Button title="Delete" variant="danger" onPress={() => deleteStaff(item.id)} />
              </View>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No staff yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New staff member" onClose={() => setModalOpen(false)}>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={styles.label}>Role</Text>
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.chip, role === r && styles.chipActive]}
            >
              <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Button
          title="Create"
          onPress={create}
          loading={creating}
          disabled={!email.trim() || password.length < 8}
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
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
