import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../constants/Colors';
import { useSupabase } from '../../../lib/supabase';
import {
  fetchRecipe, resolveIngredientCost, computeRecipeCost, saveRecipeRollup, deleteRecipe,
  isWeightUnit, toGrams,
  Recipe, RecipeIngredient,
} from '../../../lib/recipeCosting';
import Spinner from '../../../components/ui/Spinner';
import BackButton from '../../../components/ui/BackButton';

function confidenceMeta(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High', color: Colors.primary };
  if (confidence >= 0.4) return { label: 'Medium', color: Colors.warning };
  return { label: 'Low', color: Colors.textTertiary };
}

// $ contribution of a single ingredient toward the dish total. Only
// resolvable for weight-based units with a known cost-per-gram; everything
// else shows a "needs price data" hint instead of guessing here (the AI
// cost-share estimate is used for the dish-level rollup, not per row).
function ingredientContribution(ing: RecipeIngredient): number | null {
  if (ing.costPerGram == null || !isWeightUnit(ing.unit)) return null;
  const grams = toGrams(ing.qty, ing.unit);
  if (grams == null) return null;
  return grams * ing.costPerGram;
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const supabase = useSupabase();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuPriceInput, setMenuPriceInput] = useState('');
  const [savingMenuPrice, setSavingMenuPrice] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const r = await fetchRecipe(supabase, id);
          if (cancelled) return;
          setRecipe(r);
          setMenuPriceInput(r.menuPrice != null ? String(r.menuPrice) : '');
          const resolved = await Promise.all(
            r.ingredients.map(async (ing) => {
              if (!ing.itemId) return ing;
              const resolvedCost = await resolveIngredientCost(supabase, ing.itemId);
              return resolvedCost
                ? { ...ing, costPerGram: resolvedCost.costPerGram, sampleSize: resolvedCost.sampleSize }
                : ing;
            })
          );
          if (cancelled) return;
          setIngredients(resolved);
        } catch {
          if (!cancelled) {
            setRecipe(null);
            setIngredients([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id, supabase])
  );

  const cost = useMemo(() => computeRecipeCost(ingredients), [ingredients]);

  const handleMenuPriceCommit = async () => {
    if (!recipe) return;
    const trimmed = menuPriceInput.trim();
    let value: number | null;
    if (trimmed === '') {
      value = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) return;
      value = Math.round(parsed * 100) / 100;
    }
    if (value === recipe.menuPrice) return;
    setSavingMenuPrice(true);
    try {
      await saveRecipeRollup(supabase, recipe.id, { menu_price: value });
      setRecipe({ ...recipe, menuPrice: value });
    } catch (err: any) {
      Alert.alert('Could not save menu price', err?.message ?? 'Please try again.');
    } finally {
      setSavingMenuPrice(false);
    }
  };

  const handleDelete = () => {
    if (!recipe || deleting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete dish', `Delete "${recipe.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRecipe(supabase, recipe.id);
            router.back();
          } catch (err: any) {
            setDeleting(false);
            Alert.alert('Could not delete dish', err?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centerFill}>
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Dish not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const confidence = confidenceMeta(cost.confidence);
  const foodCostPct = recipe.menuPrice && recipe.menuPrice > 0 ? (cost.estimate / recipe.menuPrice) * 100 : null;
  const marginPct = recipe.menuPrice && recipe.menuPrice > 0 ? ((recipe.menuPrice - cost.estimate) / recipe.menuPrice) * 100 : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{recipe.name}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/recipes/${recipe.id}/review`);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.costCard}>
            <View style={styles.costHeaderRow}>
              <Text style={styles.costLabel}>Estimated cost</Text>
              <View style={[styles.badge, { backgroundColor: confidence.color + '20' }]}>
                <Text style={[styles.badgeText, { color: confidence.color }]}>{confidence.label} confidence</Text>
              </View>
            </View>
            <Text style={styles.costValue}>${cost.estimate.toFixed(2)}</Text>
            <Text style={styles.costRange}>${cost.low.toFixed(2)}–${cost.high.toFixed(2)} range</Text>

            {(foodCostPct != null && marginPct != null) && (
              <View style={styles.pctRow}>
                <View style={styles.pctTile}>
                  <Text style={styles.pctValue}>{foodCostPct.toFixed(0)}%</Text>
                  <Text style={styles.pctLabel}>Food cost</Text>
                </View>
                <View style={styles.pctTile}>
                  <Text style={styles.pctValue}>{marginPct.toFixed(0)}%</Text>
                  <Text style={styles.pctLabel}>Margin</Text>
                </View>
              </View>
            )}

            <View style={styles.menuPriceRow}>
              <Text style={styles.menuPriceLabel}>Menu price</Text>
              <View style={styles.menuPriceInputWrap}>
                <Text style={styles.menuPriceDollar}>$</Text>
                <TextInput
                  style={styles.menuPriceInput}
                  value={menuPriceInput}
                  onChangeText={setMenuPriceInput}
                  onBlur={handleMenuPriceCommit}
                  onSubmitEditing={handleMenuPriceCommit}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                {savingMenuPrice && <Spinner size={14} />}
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Ingredients</Text>
          <View style={styles.ingredientsCard}>
            {ingredients.map((ing, i) => {
              const contribution = ingredientContribution(ing);
              return (
                <TouchableOpacity
                  key={ing.id}
                  style={[styles.ingredientRow, i > 0 && styles.ingredientRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/recipes/${recipe.id}/review`);
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.ingredientName} numberOfLines={1}>{ing.rawName}</Text>
                    <Text style={styles.ingredientQty}>{ing.qty} {ing.unit}</Text>
                  </View>
                  {contribution != null ? (
                    <Text style={styles.ingredientCost}>${contribution.toFixed(2)}</Text>
                  ) : (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.ingredientCostMissing}>—</Text>
                      <Text style={styles.ingredientHint}>needs price data</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {ingredients.length === 0 && (
              <View style={styles.ingredientRow}>
                <Text style={styles.ingredientHint}>No ingredients yet</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7} disabled={deleting}>
            <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete dish'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  editBtn: {
    paddingHorizontal: 14, height: 36, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 14, paddingBottom: 48 },

  costCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  costHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costLabel: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  costValue: { fontSize: 38, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.8, marginTop: 6 },
  costRange: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2 },

  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 11.5, fontFamily: 'Manrope_700Bold' },

  pctRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  pctTile: {
    flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.background,
    borderRadius: 12, paddingVertical: 10,
  },
  pctValue: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  pctLabel: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  menuPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  menuPriceLabel: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  menuPriceInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, height: 38, minWidth: 90,
  },
  menuPriceDollar: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  menuPriceInput: { flex: 1, fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, padding: 0 },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary, marginTop: 4, marginBottom: 2,
  },
  ingredientsCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  ingredientRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ingredientName: { fontSize: 14.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  ingredientQty: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 1 },
  ingredientCost: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  ingredientCostMissing: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },
  ingredientHint: { fontSize: 10.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 1 },

  deleteBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingVertical: 8 },
  deleteText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.danger, textDecorationLine: 'underline' },
});
