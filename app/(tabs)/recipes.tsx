import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { fetchRecipes, RecipeListItem } from '../../lib/recipeCosting';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useStore } from '../../store/useStore';
import { averageIngredientCostShare } from '../../lib/recipeMetrics';
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
  subtitle: 'Name a dish or snap a photo and Smart Sift drafts its ingredients. Confirm the quantities and Sift prices the plate from your real invoice history — updated as vendor prices move.',
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
  return `${Math.round(margin)}% ingredient margin`;
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
  const { organization, isPersonal } = useWorkspace();
  const { isPaid: paidPlan } = useEntitlement();
  const isPaid=paidPlan&&!isPersonal;
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
      if (!isPaid || !organization?.id) return;
      setLoading(true);
      fetchRecipes(supabase, organization.id)
        .then(setRecipes)
        .catch(() => setRecipes([]))
        .finally(() => setLoading(false));
    }, [isPaid, organization?.id, supabase, demoMode])
  );

  const {average: averageFoodCost} = averageIngredientCostShare(recipes);

  const goToNew = () => {
    Haptics.selectionAsync();
    router.push('/recipes/new');
  };

  if(isPersonal)return <Redirect href="/(tabs)"/>;
  // Free orgs get the pitch instead of an empty list.
  if (!isPaid) {
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
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}><Text style={styles.summaryNumber}>{recipes.length}</Text><Text style={styles.summaryLabel}>Recipes in your menu</Text></View>
            <View style={styles.summaryStat}><Text style={styles.summaryNumber}>{averageFoodCost == null ? '—' : `${Math.round(averageFoodCost)}%`}</Text><Text style={styles.summaryLabel}>Avg. ingredient cost share</Text></View>
          </View>
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerLabel}>FROM YOUR INVOICES TO YOUR MENU</Text>
            <Text style={styles.infoBannerBody}>
              Confirm the ingredients drafted by Smart Sift and quantities. Match invoice prices to refine each dish’s ingredient cost.
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
                <Text style={styles.legendText}>Ingredient margin</Text>
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
                    if (useStore.getState().demoMode) { useStore.getState().showToast('Dish details open with your own recipes'); return; }
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
  summaryRow:{flexDirection:'row',gap:12},
  summaryStat:{flex:1,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius: Design.radius.card,padding:18,gap:6},
  summaryNumber:{fontFamily:'Manrope_800ExtraBold',fontSize:30,letterSpacing:-1,color:Colors.textPrimary},
  summaryLabel:{fontFamily:'Manrope_500Medium',fontSize:12,lineHeight:18,color:Colors.textSecondary},
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  title: { fontSize: 32, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -1},

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10, paddingBottom: 90 },

  scroll: { padding: 20, gap: 16, paddingBottom: 120 },
  recipeList: { gap: 10 },

  infoBanner: {
    backgroundColor: Colors.primaryLight, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, gap: 8,
  },
  infoBannerLabel: { fontSize: 11, fontFamily: 'Manrope_800ExtraBold', color: Colors.textTertiary, letterSpacing: 1 },
  infoBannerBody: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 19 },

  cta: {
    backgroundColor: Colors.primary, borderRadius: Design.radius.pill, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0, elevation: 0,
  },
  ctaText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardName: { fontSize: 17, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', flexWrap:'wrap', alignItems: 'center', gap: 5, marginTop: 3 },
  cardCost: { fontSize: 19, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
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
  legendText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  badge: { borderRadius: Design.radius.pill, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
});
