import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { fetchRecipes, RecipeListItem } from '../../lib/recipeCosting';
import { useEntitlement } from '../../hooks/useEntitlement';
import Spinner from '../../components/ui/Spinner';
import ProLockCard from '../../components/ui/ProLockCard';

function confidenceMeta(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High', color: Colors.primary };
  if (confidence >= 0.4) return { label: 'Medium', color: Colors.warning };
  return { label: 'Low', color: Colors.textTertiary };
}

function marginLabel(costEstimate: number | null, menuPrice: number | null): string | null {
  if (costEstimate == null || menuPrice == null || menuPrice <= 0) return null;
  const margin = ((menuPrice - costEstimate) / menuPrice) * 100;
  return `${Math.round(margin)}% margin`;
}

export default function RecipesTabScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { isPro } = useEntitlement();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!isPro || !organization?.id) return;
      setLoading(true);
      fetchRecipes(supabase, organization.id)
        .then(setRecipes)
        .catch(() => setRecipes([]))
        .finally(() => setLoading(false));
    }, [isPro, organization?.id, supabase])
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
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <Spinner />
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyTitle}>Cost out your first dish</Text>
          <Text style={styles.emptySub}>
            Snap a photo of a recipe or plated dish and we&apos;ll estimate its ingredient cost from your invoice history.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={goToNew} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Start a dish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.cta} onPress={goToNew} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Start a dish</Text>
          </TouchableOpacity>

          {recipes.map((recipe) => {
            const confidence = confidenceMeta(recipe.confidence);
            const margin = marginLabel(recipe.costEstimate, recipe.menuPrice);
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
                </View>
                <View style={[styles.badge, { backgroundColor: confidence.color + '20' }]}>
                  <Text style={[styles.badgeText, { color: confidence.color }]}>{confidence.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  title: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10, paddingBottom: 90 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: {
    fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 8,
  },

  scroll: { padding: 16, gap: 10, paddingBottom: 120 },

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

  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: 'Manrope_700Bold' },
});
