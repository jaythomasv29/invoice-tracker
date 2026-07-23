import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/Colors';

// Prominent Home entry point for the flagship Recipe Costing feature. Filled in
// the brand color so it reads as a highlight, not just another list row. Pro
// orgs go to the feature; free orgs go to the paywall (it's a conversion hook).
function PlateIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export default function RecipeCostingCard({ isPro, onPress }: { isPro: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.iconWrap}>
        <PlateIcon />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Recipe costing</Text>
          {!isPro && (
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.sub}>See what each dish truly costs — priced from your real invoices.</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.primary, borderRadius: 18, padding: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  iconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: -0.2 },
  proPill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  proPillText: { fontSize: 9, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 0.8 },
  sub: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: 'rgba(255,255,255,0.9)', marginTop: 2, lineHeight: 17 },
  chevron: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: 'rgba(255,255,255,0.9)', flexShrink: 0 },
});
