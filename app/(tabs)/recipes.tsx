import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { fetchRecipes, RecipeListItem } from '../../lib/recipeCosting';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useStore } from '../../store/useStore';
import { buildDemoRecipes } from '../../lib/demoData';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTour } from '../../components/tour/TourProvider';
import Spinner from '../../components/ui/Spinner';
import ProLockCard from '../../components/ui/ProLockCard';
import InfoButton from '../../components/ui/InfoButton';
import {
  OnboardingExplainer, OnboardingExplainerSheet, type ExplainerConfig,
} from '../../components/ui/OnboardingExplainerSheet';
import { RecipeCostPreview } from '../../components/onboarding/PreviewCards';

const RECIPE_EXPLAINER: ExplainerConfig = {
  eyebrow: 'RECIPE COSTING',
  title: 'Know what every\ndish really costs',
  subtitle: 'Name a dish or snap a photo and AI drafts its ingredients. Confirm the quantities and Sift prices the plate from your real invoice history — updated as vendor prices move.',
  Illustration: RecipeCostPreview,
  ctaLabel: 'Start a dish',
};

function confidenceMeta(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'Data-backed', color: Colors.primary };
  if (confidence >= 0.4) return { label: 'Estimated', color: Colors.warning };
  return { label: 'Needs data', color: Colors.textTertiary };
}

function marginLabel(costEstimate: number | null, menuPrice: number | null): string | null {
  if (costEstimate == null || menuPrice == null || menuPrice <= 0) return null;
  const margin = ((menuPrice - costEstimate) / menuPrice) * 100;
  return `${Math.round(margin)}% margin`;
}

// Ingredient cost's share of the menu price, clamped to a real 0-100 bar —
// null (no bar rendered) when there's no menu price to measure it against.
function foodCostPct(costEstimate: number | null, menuPrice: number | null): number | null {
  if (costEstimate == null || menuPrice == null || menuPrice <= 0) return null;
  return Math.min(100, Math.max(0, (costEstimate / menuPrice) * 100));
}

function CostMarginBar({ pct }: { pct: number }) {
  return (
    <View style={styles.breakdownTrack}>
      <View style={[styles.breakdownCostFill, { flex: pct }]} />
      <View style={[styles.breakdownMarginFill, { flex: 100 - pct }]} />
    </View>
  );
}

export default function RecipesTabScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { isPro } = useEntitlement();
  const demoMode = useStore((s) => s.demoMode);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  const { registerScroller } = useTour();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  useEffect(() => {
    registerScroller('recipes', {
      scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
      getOffset: () => scrollOffset.current,
    });
    return () => registerScroller('recipes', null);
  }, [registerScroller]);

  useFocusEffect(
    useCallback(() => {
      if (demoMode) { setRecipes(buildDemoRecipes()); setLoading(false); return; }
      if (!isPro || !organization?.id) return;
      setLoading(true);
      fetchRecipes(supabase, organization.id)
        .then(setRecipes)
        .catch(() => setRecipes([]))
        .finally(() => setLoading(false));
    }, [isPro, organization?.id, supabase, demoMode])
  );

  const goToNew = () => {
    Haptics.selectionAsync();
    router.push('/recipes/new');
  };

  // Free orgs get the pitch instead of an empty list.
  if (!isPro) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Recipe costing</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ProLockCard
            title="Know what every dish really costs"
            body="Photograph a dish, confirm the ingredients, and see its true cost priced from your own invoices — updated automatically as vendor prices move."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipe costing</Text>
        {recipes.length > 0 && <InfoButton onPress={() => setInfoOpen(true)} />}
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <Spinner />
        </View>
      ) : recipes.length === 0 ? (
        <OnboardingExplainer config={RECIPE_EXPLAINER} onCta={goToNew} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollOffset.current = e.nativeEvent.contentOffset.y;
          }}
        >
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerLabel}>HOW COSTING WORKS</Text>
            <Text style={styles.infoBannerBody}>
              AI drafts each dish's ingredients, you confirm the quantities, and Sift prices the plate from your invoice history. Cost and margin sharpen as you match more ingredients and upload more invoices.
            </Text>
          </View>

          <TouchableOpacity style={styles.cta} onPress={goToNew} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Start a dish</Text>
          </TouchableOpacity>

          {recipes.some((r) => foodCostPct(r.costEstimate, r.menuPrice) != null) && (
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.legendText}>Ingredient cost</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Margin</Text>
              </View>
            </View>
          )}

          <TourTarget id="recipes-list" style={styles.recipeList}>
            {recipes.map((recipe) => {
              const confidence = confidenceMeta(recipe.confidence);
              const margin = marginLabel(recipe.costEstimate, recipe.menuPrice);
              const pct = foodCostPct(recipe.costEstimate, recipe.menuPrice);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/recipes/${recipe.id}`);
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{recipe.name}</Text>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardCost}>
                        {recipe.costEstimate != null ? `$${recipe.costEstimate.toFixed(2)}` : '—'}
                      </Text>
                      {margin && <Text style={styles.cardMargin}>{margin}</Text>}
                    </View>
                    {pct != null && <CostMarginBar pct={pct} />}
                  </View>
                  <View style={[styles.badge, { backgroundColor: confidence.color + '20' }]}>
                    <Text style={[styles.badgeText, { color: confidence.color }]}>{confidence.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </TourTarget>
        </ScrollView>
      )}

      <OnboardingExplainerSheet
        visible={infoOpen}
        config={RECIPE_EXPLAINER}
        onClose={() => setInfoOpen(false)}
        onCta={goToNew}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  title: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10, paddingBottom: 90 },

  scroll: { padding: 16, gap: 10, paddingBottom: 120 },
  recipeList: { gap: 10 },

  infoBanner: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 6,
  },
  infoBannerLabel: { fontSize: 11, fontFamily: 'Manrope_800ExtraBold', color: Colors.textTertiary, letterSpacing: 1 },
  infoBannerBody: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 19 },

  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardName: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  cardCost: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  cardMargin: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  breakdownTrack: {
    flexDirection: 'row', height: 5, borderRadius: 2.5, overflow: 'hidden',
    backgroundColor: Colors.surface, marginTop: 8, gap: 2,
  },
  breakdownCostFill: { backgroundColor: Colors.warning },
  breakdownMarginFill: { backgroundColor: Colors.primary },

  legendRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 2, marginTop: -2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
});
