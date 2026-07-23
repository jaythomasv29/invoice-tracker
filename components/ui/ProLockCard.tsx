import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';

// Upsell shown where a Pro-only feature would render for free orgs (Home's spend
// tracking, the Alerts tab). Tapping opens the paywall. Pass `stat`/`statLabel`
// to tease the user's OWN real number behind the lock ("3 price increases this
// month") — far more persuasive than generic copy.
export default function ProLockCard({
  title,
  body,
  stat,
  statLabel,
  compact,
}: {
  title: string;
  body: string;
  stat?: string;
  statLabel?: string;
  compact?: boolean;
}) {
  const router = useRouter();

  const openPaywall = () => {
    Haptics.selectionAsync();
    router.push('/paywall');
  };

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={openPaywall}
      activeOpacity={0.85}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PRO</Text>
      </View>
      {stat != null && (
        <View style={styles.statRow}>
          <Text style={styles.stat}>{stat}</Text>
          {statLabel != null && <Text style={styles.statLabel}>{statLabel}</Text>}
          <Text style={styles.statLock}>🔒</Text>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Unlock with Pro</Text>
        <Text style={styles.ctaChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 6,
  },
  cardCompact: { padding: 14 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'Manrope_800ExtraBold', color: Colors.primaryDark, letterSpacing: 1 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  stat: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.6 },
  statLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, flexShrink: 1 },
  statLock: { fontSize: 13 },
  title: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  body: { fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ctaText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  ctaChevron: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.primary },
});
