import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../../constants/Colors';
import { useSupabase } from '../../../lib/supabase';
import { useStore } from '../../../store/useStore';
import Spinner from '../../../components/ui/Spinner';
import BackButton from '../../../components/ui/BackButton';
import Toast from '../../../components/ui/Toast';
import {
  fetchRecipe, resolveIngredientCost, computeRecipeCost, updateIngredient, deleteIngredient,
  addIngredient, draftRecipe, confidenceHint,
  searchItems, createItem, saveRecipeRollup, isWeightUnit, toGrams,
  Recipe, RecipeIngredient, RecipeCost, ItemMatch,
} from '../../../lib/recipeCosting';

const UNIT_OPTIONS = ['g', 'oz', 'lb', 'ml', 'floz', 'cup', 'tbsp', 'tsp', 'each'];

// Phase 1 only prices weight-based ingredients (g/oz/lb) — resolveCost /
// computeRecipeCost fall back to the AI's cost-share estimate for anything
// else (counts, volumes, "to taste", ...). Those ingredients render a muted
// "needs weight unit" / "no price data" label instead of a dollar figure;
// they never throw, just stay unresolved until re-entered in a weight unit.

function formatQty(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// Sensible default step: ~10% of the current quantity, floored so it's never
// a no-op. Whole grams for gram quantities; a tenth-unit for oz/lb/other.
function stepFor(qty: number, unit: string): number {
  const raw = qty * 0.1;
  if (unit === 'g') return Math.max(Math.round(raw), 1);
  return Math.max(Math.round(raw * 10) / 10, 0.1);
}

function confidenceTier(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High confidence', color: Colors.primary };
  if (confidence >= 0.4) return { label: 'Medium confidence', color: Colors.warning };
  return { label: 'Low confidence', color: Colors.textTertiary };
}

function costIndicator(ing: RecipeIngredient): { text: string; tone: 'positive' | 'muted' | 'neutral' } {
  if (!ing.itemId) {
    if (ing.aiEstUnitCost != null) {
      return { text: `~$${(ing.qty * ing.aiEstUnitCost).toFixed(2)} estimated — tap to match`, tone: 'muted' };
    }
    return { text: 'Tap to match', tone: 'neutral' };
  }
  if (ing.costPerGram === undefined) return { text: 'Checking price…', tone: 'muted' };
  if (!isWeightUnit(ing.unit)) return { text: 'Matched — needs price data', tone: 'muted' };
  if (ing.costPerGram == null) return { text: 'No price history', tone: 'muted' };
  const grams = toGrams(ing.qty, ing.unit);
  if (grams == null) return { text: 'No price history', tone: 'muted' };
  const n = ing.sampleSize ?? 0;
  const sampleNote = n > 0 ? ` (${n} purchase${n === 1 ? '' : 's'})` : '';
  return { text: `✓ $${(grams * ing.costPerGram).toFixed(2)}${sampleNote}`, tone: 'positive' };
}

function ghostLabel(ing: RecipeIngredient): string | null {
  const { aiQty, aiUnit } = ing;
  if (aiQty == null || aiUnit == null) return null;
  if (aiQty === ing.qty && aiUnit === ing.unit) return null;
  return `AI suggested ${formatQty(aiQty)}${aiUnit}`;
}

export default function RecipeReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization } = useOrganization();
  const supabase = useSupabase();
  const showToast = useStore((s) => s.showToast);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const [matchIngredientId, setMatchIngredientId] = useState<string | null>(null);
  const [matchQuery, setMatchQuery] = useState('');
  const [matchResults, setMatchResults] = useState<ItemMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [autoCosting, setAutoCosting] = useState(false);
  const [autoCostProError, setAutoCostProError] = useState(false);

  const [menuPriceInput, setMenuPriceInput] = useState('');
  const [savingMenuPrice, setSavingMenuPrice] = useState(false);

  const qtyDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => {
    Object.values(qtyDebounce.current).forEach(clearTimeout);
  }, []);

  // Load the recipe once, then resolve costs for ingredients that already
  // have a matched item (newly-matched ones resolve themselves inline).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const r = await fetchRecipe(supabase, id);
        if (cancelled) return;
        setRecipe(r);
        setIngredients(r.ingredients);
        setMenuPriceInput(r.menuPrice != null ? String(r.menuPrice) : '');
        setLoading(false);

        const withItems = r.ingredients.filter(
          (ing): ing is RecipeIngredient & { itemId: string } => ing.itemId != null
        );
        if (withItems.length === 0) return;
        const results = await Promise.all(
          withItems.map((ing) => resolveIngredientCost(supabase, ing.itemId).catch(() => null))
        );
        if (cancelled) return;
        const costById = new Map(withItems.map((ing, i) => [ing.id, results[i]]));
        setIngredients((prev) => prev.map((ing) => {
          if (!costById.has(ing.id)) return ing;
          const res = costById.get(ing.id) ?? null;
          return { ...ing, costPerGram: res?.costPerGram ?? null, sampleSize: res?.sampleSize ?? 0 };
        }));
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message ?? 'Could not load recipe');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, supabase]);

  const cost: RecipeCost = useMemo(() => computeRecipeCost(ingredients), [ingredients]);

  const handleQtyChange = useCallback((ingId: string, qty: number) => {
    setIngredients((prev) => prev.map((ing) => (ing.id === ingId ? { ...ing, qty } : ing)));
    if (qtyDebounce.current[ingId]) clearTimeout(qtyDebounce.current[ingId]);
    qtyDebounce.current[ingId] = setTimeout(() => {
      updateIngredient(supabase, ingId, { qty }).catch(() => showToast('Could not save quantity'));
    }, 500);
  }, [supabase, showToast]);

  const handleDeleteIngredient = useCallback((ingId: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== ingId));
    if (qtyDebounce.current[ingId]) {
      clearTimeout(qtyDebounce.current[ingId]);
      delete qtyDebounce.current[ingId];
    }
    deleteIngredient(supabase, ingId).catch(() => showToast('Could not remove ingredient'));
  }, [supabase, showToast]);

  const handleToggleConfirm = useCallback((ingId: string) => {
    setIngredients((prev) => prev.map((ing) => {
      if (ing.id !== ingId) return ing;
      const confirmed = !ing.confirmed;
      updateIngredient(supabase, ingId, { confirmed }).catch(() => showToast('Could not save confirmation'));
      return { ...ing, confirmed };
    }));
  }, [supabase, showToast]);

  const openMatchSheet = (ing: RecipeIngredient) => {
    setMatchIngredientId(ing.id);
    setMatchQuery(ing.rawName);
  };
  const closeMatchSheet = () => {
    setMatchIngredientId(null);
    setMatchQuery('');
    setMatchResults([]);
  };

  // Debounced item search while the match sheet is open.
  useEffect(() => {
    if (!matchIngredientId || !organization?.id) return;
    let cancelled = false;
    setMatchLoading(true);
    const t = setTimeout(() => {
      searchItems(supabase, organization.id as string, matchQuery)
        .then((res) => { if (!cancelled) setMatchResults(res); })
        .catch(() => { if (!cancelled) setMatchResults([]); })
        .finally(() => { if (!cancelled) setMatchLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [matchQuery, matchIngredientId, organization?.id, supabase]);

  const handleSelectItem = useCallback(async (ingId: string, item: ItemMatch) => {
    closeMatchSheet();
    setIngredients((prev) => prev.map((ing) => (
      ing.id === ingId ? { ...ing, itemId: item.id, costPerGram: undefined, sampleSize: undefined } : ing
    )));
    try {
      await updateIngredient(supabase, ingId, { item_id: item.id });
      const resolved = await resolveIngredientCost(supabase, item.id);
      setIngredients((prev) => prev.map((ing) => (
        ing.id === ingId ? { ...ing, costPerGram: resolved?.costPerGram ?? null, sampleSize: resolved?.sampleSize ?? 0 } : ing
      )));
    } catch (err: any) {
      showToast(err?.message ?? 'Could not match item');
    }
  }, [supabase, showToast]);

  const orgId = organization?.id;
  const handleCreateItem = useCallback(async (ingId: string, name: string) => {
    if (!orgId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreatingItem(true);
    try {
      const newId = await createItem(supabase, orgId, trimmed);
      await handleSelectItem(ingId, { id: newId, canonicalName: trimmed, category: null });
    } catch (err: any) {
      showToast(err?.message ?? 'Could not create item');
    } finally {
      setCreatingItem(false);
    }
  }, [supabase, orgId, showToast, handleSelectItem]);

  const handleAddIngredient = useCallback(async (rawName: string, qty: number, unit: string) => {
    if (!orgId || !id) return;
    setAddSaving(true);
    try {
      const created = await addIngredient(supabase, orgId, id, { rawName, qty, unit }, ingredients.length);
      setIngredients((prev) => [...prev, created]);
      setAddOpen(false);
    } catch (err: any) {
      showToast(err?.message ?? 'Could not add ingredient');
    } finally {
      setAddSaving(false);
    }
  }, [supabase, orgId, id, ingredients.length, showToast]);

  // draft-recipe fully replaces the ingredient list server-side, so this is
  // safe to call whether the recipe is empty or already has ingredients.
  const handleAutoCost = useCallback(async () => {
    if (!id) return;
    setAutoCosting(true);
    setAutoCostProError(false);
    try {
      await draftRecipe(supabase, id);
      const r = await fetchRecipe(supabase, id);
      setRecipe(r);
      setIngredients(r.ingredients);
    } catch (err: any) {
      const msg = err?.message ?? 'Could not auto-cost this dish';
      if (/pro feature/i.test(msg)) setAutoCostProError(true);
      showToast(msg);
    } finally {
      setAutoCosting(false);
    }
  }, [supabase, id, showToast]);

  // Entry point for the always-visible header button — confirms first if it
  // would discard ingredients the operator already has (manual or a prior
  // draft). The empty-state buttons call handleAutoCost directly since
  // there's nothing to lose.
  const handleAutoCostPress = useCallback(() => {
    if (autoCosting) return;
    if (ingredients.length === 0) {
      handleAutoCost();
      return;
    }
    Alert.alert(
      'Replace ingredients with AI draft?',
      'Auto Cost will discard the current ingredient list and generate a new one to review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: handleAutoCost },
      ]
    );
  }, [autoCosting, ingredients.length, handleAutoCost]);

  const handleMenuPriceCommit = async () => {
    if (!recipe || !id) return;
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
      await saveRecipeRollup(supabase, id, { menu_price: value });
      setRecipe({ ...recipe, menuPrice: value });
    } catch (err: any) {
      showToast(err?.message ?? 'Could not save dish price');
    } finally {
      setSavingMenuPrice(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await saveRecipeRollup(supabase, id, { cost_estimate: cost.estimate, confidence: cost.confidence });
      // dismissTo (not replace) so this collapses the whole create/edit
      // sub-stack back to the list in one step, instead of stacking a second
      // detail screen on top of the one the list already pushed.
      router.dismissTo('/recipes');
    } catch (err: any) {
      setSaving(false);
      showToast(err?.message ?? 'Could not save recipe cost');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Review draft</Text>
        </View>
        <View style={styles.empty}><Spinner /></View>
      </SafeAreaView>
    );
  }

  if (loadError || !recipe) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Review draft</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load recipe</Text>
          <Text style={styles.emptySub}>{loadError || 'Recipe not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const foodCostPct = recipe.menuPrice && recipe.menuPrice > 0 ? (cost.estimate / recipe.menuPrice) * 100 : null;
  const marginPct = recipe.menuPrice && recipe.menuPrice > 0 ? ((recipe.menuPrice - cost.estimate) / recipe.menuPrice) * 100 : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.name}</Text>
          <Text style={styles.headerSub}>
            {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerAutoCostBtn}
          onPress={handleAutoCostPress}
          disabled={autoCosting}
          activeOpacity={0.7}
        >
          {autoCosting ? (
            <Spinner size={14} />
          ) : (
            <Text style={styles.headerAutoCostBtnText}>Auto Cost</Text>
          )}
        </TouchableOpacity>
      </View>

      {autoCostProError && (
        <TouchableOpacity
          style={styles.headerProBanner}
          onPress={() => router.push('/paywall')}
          activeOpacity={0.7}
        >
          <Text style={styles.headerProBannerText}>Recipe costing is a Pro feature — see plans</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CostHeaderCard
          cost={cost}
          menuPriceInput={menuPriceInput}
          onChangeMenuPrice={setMenuPriceInput}
          onCommitMenuPrice={handleMenuPriceCommit}
          savingMenuPrice={savingMenuPrice}
          foodCostPct={foodCostPct}
          marginPct={marginPct}
        />

        <Text style={styles.sectionLabel}>Ingredients</Text>
        {ingredients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptySub}>
              Add the ingredients that make up this dish, or let AI draft a starting template you can adjust.
            </Text>
            {autoCosting ? (
              <View style={styles.emptyLoading}><Spinner size={20} /></View>
            ) : (
              <>
                <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => setAddOpen(true)} activeOpacity={0.85}>
                  <Text style={styles.emptyPrimaryBtnText}>+ Add ingredient</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptySecondaryBtn} onPress={handleAutoCost} activeOpacity={0.7}>
                  <Text style={styles.emptySecondaryBtnText}>Auto Cost with AI</Text>
                </TouchableOpacity>
                {autoCostProError && (
                  <TouchableOpacity onPress={() => router.push('/paywall')} activeOpacity={0.7}>
                    <Text style={styles.emptyProLink}>See Pro plans</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        ) : (
          <>
            {ingredients.map((ing) => (
              <IngredientCard
                key={ing.id}
                ingredient={ing}
                onQtyChange={handleQtyChange}
                onToggleConfirm={handleToggleConfirm}
                onPressMatch={() => openMatchSheet(ing)}
                onDelete={() => handleDeleteIngredient(ing.id)}
              />
            ))}
            <TouchableOpacity style={styles.addRow} onPress={() => setAddOpen(true)} activeOpacity={0.7}>
              <Text style={styles.addRowText}>+ Add ingredient</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <View style={styles.saveBtnContent}>
              <Spinner size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Saving…</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Save recipe cost</Text>
          )}
        </TouchableOpacity>
      </View>

      <AddIngredientSheet
        visible={addOpen}
        saving={addSaving}
        onSubmit={handleAddIngredient}
        onClose={() => setAddOpen(false)}
      />

      <ItemMatchSheet
        visible={matchIngredientId != null}
        query={matchQuery}
        onChangeQuery={setMatchQuery}
        results={matchResults}
        loading={matchLoading}
        creating={creatingItem}
        onSelect={(item) => matchIngredientId && handleSelectItem(matchIngredientId, item)}
        onCreate={() => matchIngredientId && handleCreateItem(matchIngredientId, matchQuery)}
        onClose={closeMatchSheet}
      />

      <Toast />
    </SafeAreaView>
  );
}

function CostHeaderCard({
  cost, menuPriceInput, onChangeMenuPrice, onCommitMenuPrice, savingMenuPrice, foodCostPct, marginPct,
}: {
  cost: RecipeCost;
  menuPriceInput: string;
  onChangeMenuPrice: (v: string) => void;
  onCommitMenuPrice: () => void;
  savingMenuPrice: boolean;
  foodCostPct: number | null;
  marginPct: number | null;
}) {
  const tier = confidenceTier(cost.confidence);
  return (
    <View style={styles.costCard}>
      <Text style={styles.costLabel}>Estimated dish cost</Text>
      <Text style={styles.costEstimate}>${cost.estimate.toFixed(2)}</Text>
      <Text style={styles.costRange}>${cost.low.toFixed(2)} – ${cost.high.toFixed(2)} range</Text>
      <View style={styles.confidenceTrack}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${Math.round(cost.confidence * 100)}%`, backgroundColor: tier.color },
          ]}
        />
      </View>
      <Text style={[styles.confidenceText, { color: tier.color }]}>{tier.label}</Text>
      <Text style={styles.confidenceHint}>{confidenceHint(cost.confidence)}</Text>

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
        <Text style={styles.menuPriceLabel}>Dish price</Text>
        <View style={styles.menuPriceInputWrap}>
          <Text style={styles.menuPriceDollar}>$</Text>
          <TextInput
            style={styles.menuPriceInput}
            value={menuPriceInput}
            onChangeText={onChangeMenuPrice}
            onBlur={onCommitMenuPrice}
            onSubmitEditing={onCommitMenuPrice}
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          {savingMenuPrice && <Spinner size={14} />}
        </View>
      </View>
    </View>
  );
}

function IngredientCard({
  ingredient, onQtyChange, onToggleConfirm, onPressMatch, onDelete,
}: {
  ingredient: RecipeIngredient;
  onQtyChange: (id: string, qty: number) => void;
  onToggleConfirm: (id: string) => void;
  onPressMatch: () => void;
  onDelete: () => void;
}) {
  const [qtyText, setQtyText] = useState(formatQty(ingredient.qty));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setQtyText(formatQty(ingredient.qty));
  }, [ingredient.qty]);

  const step = stepFor(ingredient.qty, ingredient.unit);
  const indicator = costIndicator(ingredient);
  const ghost = ghostLabel(ingredient);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n < 0) {
      setQtyText(formatQty(ingredient.qty));
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    setQtyText(formatQty(rounded));
    onQtyChange(ingredient.id, rounded);
  };

  const bump = (delta: number) => {
    const next = Math.max(0, Math.round((ingredient.qty + delta) * 100) / 100);
    setQtyText(formatQty(next));
    onQtyChange(ingredient.id, next);
  };

  return (
    <View style={[styles.ingCard, ingredient.confirmed && styles.ingCardConfirmed]}>
      <View style={styles.ingTopRow}>
        <TouchableOpacity style={styles.ingNameWrap} onPress={onPressMatch} activeOpacity={0.7}>
          <Text style={styles.ingName} numberOfLines={1}>{ingredient.rawName}</Text>
          <Text
            style={[
              styles.ingIndicator,
              indicator.tone === 'positive' && styles.ingIndicatorPositive,
              indicator.tone === 'muted' && styles.ingIndicatorMuted,
            ]}
          >
            {indicator.text}
          </Text>
        </TouchableOpacity>
        <View style={styles.ingActions}>
          <TouchableOpacity
            style={[styles.confirmBtn, ingredient.confirmed && styles.confirmBtnActive]}
            onPress={() => onToggleConfirm(ingredient.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.confirmBtnText, ingredient.confirmed && styles.confirmBtnTextActive]}>
              {ingredient.confirmed ? '✓ Confirmed' : 'Confirm'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} hitSlop={8}>
            <Text style={styles.removeLink}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-step)} activeOpacity={0.7}>
          <Text style={styles.stepBtnText}>–</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.qtyInput}
          value={qtyText}
          onChangeText={setQtyText}
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; commit(qtyText); }}
          onSubmitEditing={() => commit(qtyText)}
          keyboardType="decimal-pad"
        />
        <Text style={styles.qtyUnit}>{ingredient.unit}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => bump(step)} activeOpacity={0.7}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {ghost && <Text style={styles.ghostText}>{ghost}</Text>}
    </View>
  );
}

function AddIngredientSheet({
  visible, saving, onSubmit, onClose,
}: {
  visible: boolean;
  saving: boolean;
  onSubmit: (rawName: string, qty: number, unit: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [unit, setUnit] = useState('g');

  useEffect(() => {
    if (visible) {
      setName('');
      setQtyText('');
      setUnit('g');
    }
  }, [visible]);

  const qty = parseFloat(qtyText);
  const canAdd = name.trim().length > 0 && !Number.isNaN(qty) && qty > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Add ingredient</Text>
          <TextInput
            style={styles.sheetInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Boneless chicken thigh"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          <TextInput
            style={[styles.sheetInput, { marginTop: 10 }]}
            value={qtyText}
            onChangeText={setQtyText}
            placeholder="Quantity"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
          />
          <View style={styles.unitRow}>
            {UNIT_OPTIONS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitChip, unit === u && styles.unitChipActive]}
                onPress={() => setUnit(u)}
                activeOpacity={0.7}
              >
                <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.addSubmitBtn, !canAdd && styles.addSubmitBtnDisabled]}
            onPress={() => canAdd && onSubmit(name.trim(), qty, unit)}
            disabled={!canAdd}
            activeOpacity={0.85}
          >
            {saving ? (
              <Spinner size={16} color="#fff" />
            ) : (
              <Text style={styles.addSubmitBtnText}>Add</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ItemMatchSheet({
  visible, query, onChangeQuery, results, loading, creating, onSelect, onCreate, onClose,
}: {
  visible: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  results: ItemMatch[];
  loading: boolean;
  creating: boolean;
  onSelect: (item: ItemMatch) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const trimmed = query.trim();
  const exactMatch = results.some((r) => r.canonicalName.toLowerCase() === trimmed.toLowerCase());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Match ingredient</Text>
          <TextInput
            style={styles.sheetInput}
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search items…"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.sheetLoading}><Spinner size={18} /></View>
            ) : (
              <>
                {results.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.sheetRow}
                    onPress={() => onSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sheetRowText}>{item.canonicalName}</Text>
                    {!!item.category && <Text style={styles.sheetRowCategory}>{item.category}</Text>}
                  </TouchableOpacity>
                ))}
                {results.length === 0 && (
                  <Text style={styles.sheetEmpty}>No matching items yet.</Text>
                )}
              </>
            )}
          </ScrollView>
          {trimmed.length > 0 && !exactMatch && (
            <TouchableOpacity style={styles.createBtn} onPress={onCreate} disabled={creating} activeOpacity={0.85}>
              {creating ? (
                <Spinner size={16} color={Colors.primaryDark} />
              ) : (
                <Text style={styles.createBtnText} numberOfLines={1}>Create &quot;{trimmed}&quot; as a new item</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  headerAutoCostBtn: {
    paddingHorizontal: 14, height: 36, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerAutoCostBtnText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  headerProBanner: {
    backgroundColor: Colors.primaryLight, paddingVertical: 10, paddingHorizontal: 18,
  },
  headerProBannerText: {
    fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark, textAlign: 'center',
  },

  scroll: { padding: 16, gap: 10, paddingBottom: 24 },

  costCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 18, alignItems: 'center',
  },
  costLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary, marginBottom: 4,
  },
  costEstimate: { fontSize: 34, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.8 },
  costRange: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2, marginBottom: 12 },
  confidenceTrack: {
    width: '100%', height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden',
  },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceText: { fontSize: 12, fontFamily: 'Manrope_700Bold', marginTop: 7 },
  confidenceHint: {
    fontSize: 11.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary,
    textAlign: 'center', lineHeight: 16, marginTop: 4, paddingHorizontal: 8,
  },

  pctRow: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  pctTile: {
    flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.background,
    borderRadius: 12, paddingVertical: 10,
  },
  pctValue: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  pctLabel: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  menuPriceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, width: '100%',
  },
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
    textTransform: 'uppercase', color: Colors.textTertiary,
    marginTop: 6, marginBottom: 2,
  },

  ingCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10,
  },
  ingCardConfirmed: { borderColor: Colors.primaryMuted, backgroundColor: Colors.primaryLight },

  ingTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ingNameWrap: { flex: 1, minWidth: 0 },
  ingName: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  ingIndicator: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.primaryDark, marginTop: 2 },
  ingIndicatorPositive: { color: Colors.primaryDark },
  ingIndicatorMuted: { color: Colors.textTertiary },

  ingActions: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  confirmBtn: {
    paddingHorizontal: 12, height: 32, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  confirmBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  confirmBtnText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  confirmBtnTextActive: { color: '#fff' },
  removeLink: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, marginTop: -1 },
  qtyInput: {
    flex: 1, height: 34, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary,
  },
  qtyUnit: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, width: 26 },

  ghostText: { fontSize: 11.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, fontStyle: 'italic' },

  footer: {
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 18, paddingBottom: 28,
  },
  saveBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12, alignItems: 'stretch',
  },
  emptyLoading: { paddingVertical: 12, alignItems: 'center' },
  emptyPrimaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyPrimaryBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
  emptySecondaryBtn: {
    borderRadius: 12, height: 48, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emptySecondaryBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptyProLink: {
    fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary,
    textDecorationLine: 'underline', textAlign: 'center',
  },

  addRow: {
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  addRowText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  unitChip: {
    paddingHorizontal: 12, height: 34, borderRadius: 10,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  unitChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unitChipText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  unitChipTextActive: { color: '#fff' },
  addSubmitBtn: {
    marginTop: 14, height: 48, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addSubmitBtnDisabled: { opacity: 0.5 },
  addSubmitBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(10,10,16,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  sheetCard: {
    width: '100%', maxWidth: 380, maxHeight: '75%', backgroundColor: Colors.surface,
    borderRadius: 18, padding: 18, gap: 4,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, marginBottom: 6 },
  sheetInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 11,
    paddingHorizontal: 13, height: 44,
    fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary,
  },
  sheetList: { marginTop: 10, maxHeight: 260 },
  sheetLoading: { paddingVertical: 24, alignItems: 'center' },
  sheetRow: {
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  },
  sheetRowText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary, flexShrink: 1 },
  sheetRowCategory: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  sheetEmpty: {
    fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary,
    textAlign: 'center', paddingVertical: 24,
  },
  createBtn: {
    marginTop: 10, height: 46, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  createBtnText: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },
  sheetCancelBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  sheetCancelBtnText: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
});
