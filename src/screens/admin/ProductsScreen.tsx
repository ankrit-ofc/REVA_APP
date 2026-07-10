import { useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { FormModal } from '@/components/FormModal'
import { QueryState } from '@/components/QueryState'
import {
  useListProductsQuery,
  useListCategoriesQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useSoftDeleteProductMutation,
  useUploadProductImageMutation,
} from '@/features/admin/adminApi'
import { API_BASE_URL } from '@/lib/config'
import { errDetail } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import type { FoodType } from '@/lib/schemas/admin'
import { colors, radius, spacing } from '@/theme'

const FOOD_TYPES: FoodType[] = ['VEG', 'NON_VEG', 'EGG', 'BEVERAGE', 'SMOKE']

/** Resolves a possibly-relative image_url from the backend to an absolute URL. */
function imageUri(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

export function ProductsScreen() {
  const productsQ = useListProductsQuery()
  const categoriesQ = useListCategoriesQuery()
  const [createProduct, { isLoading: creating }] = useCreateProductMutation()
  const [updateProduct] = useUpdateProductMutation()
  const [softDelete] = useSoftDeleteProductMutation()
  const [uploadImage] = useUploadProductImageMutation()

  const [modalOpen, setModalOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [tax, setTax] = useState('0')
  const [foodType, setFoodType] = useState<FoodType>('VEG')
  const [available, setAvailable] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const categories = (categoriesQ.data ?? []).filter((c) => c.is_active)
  const products = (productsQ.data ?? []).filter((p) => p.is_active)

  async function create() {
    setErr(null)
    if (!categoryId) {
      setErr('Pick a category first.')
      return
    }
    try {
      await createProduct({
        category_id: categoryId,
        name: name.trim(),
        description: null,
        base_price: parseFloat(price) || 0,
        tax_rate: parseFloat(tax) || 0,
        food_type: foodType,
        is_available: available,
        has_variants: false,
        allows_addons: false,
      }).unwrap()
      setName('')
      setPrice('0')
      setTax('0')
      setModalOpen(false)
    } catch (e) {
      setErr(errDetail(e))
    }
  }

  async function pickImage(productId: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase()
    await uploadImage({
      productId,
      asset: {
        uri: asset.uri,
        name: asset.fileName ?? `photo.${ext}`,
        type: asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      },
    })
  }

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={productsQ.isFetching}
            onRefresh={() => {
              productsQ.refetch()
              categoriesQ.refetch()
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="+ Add product" onPress={() => setModalOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              {item.image_url ? (
                <Image source={{ uri: imageUri(item.image_url) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Text style={styles.thumbEmptyText}>No image</Text>
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {formatMoney(item.base_price)} · {item.food_type} ·{' '}
                  {item.is_available ? 'Available' : 'Hidden'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button title="Image" variant="secondary" onPress={() => pickImage(item.id)} />
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={styles.flex}>
                <Button
                  title={item.is_available ? 'Hide' : 'Show'}
                  variant="secondary"
                  onPress={() => updateProduct({ id: item.id, is_available: !item.is_available })}
                />
              </View>
              <View style={{ width: spacing.sm }} />
              <Button title="Delete" variant="danger" onPress={() => softDelete(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={productsQ.isLoading}
            error={productsQ.isError}
            empty={!productsQ.isLoading && !productsQ.isError}
            emptyText="No products yet."
          />
        }
      />

      <FormModal visible={modalOpen} title="New product" onClose={() => setModalOpen(false)}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[styles.chip, categoryId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <Field label="Base price" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Field label="Tax rate (%)" value={tax} onChangeText={setTax} keyboardType="numeric" />
        <Text style={styles.label}>Food type</Text>
        <View style={styles.chips}>
          {FOOD_TYPES.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFoodType(f)}
              style={[styles.chip, foodType === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, foodType === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Available</Text>
          <Switch value={available} onValueChange={setAvailable} />
        </View>
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
  thumb: { width: 52, height: 52, borderRadius: radius.sm, marginRight: spacing.md },
  thumbEmpty: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { fontSize: 9, color: colors.textMuted },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchLabel: { fontSize: 14, color: colors.text },
  err: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
})
