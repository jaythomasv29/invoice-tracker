import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';

// First onboarding step: campaign-facing audience split (business vs. home),
// per PRD 6.1. Same product and data model either way — a restaurant and a
// household both land on /onboarding/organization and create the same kind
// of Clerk Organization underneath. This screen only decides which copy
// (restaurant/vendors vs. household/stores) that next screen shows, via the
// `audience` param — it is not a functional fork.
export default function AudienceScreen() {
  const router = useRouter();

  const choose = (audience: 'business' | 'home') => {
    Haptics.selectionAsync();
    router.push({ pathname: '/onboarding/organization', params: { audience } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>What are you tracking invoices for?</Text>
        <Text style={styles.subtitle}>
          We'll tailor a few things based on your answer — you can always change this later.
        </Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => choose('business')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🍽️</Text>
          <Text style={styles.cardTitle}>My restaurant or business</Text>
          <Text style={styles.cardSub}>
            Track vendor invoices, catch price creep, and reconcile deliveries.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => choose('home')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🏠</Text>
          <Text style={styles.cardTitle}>My home</Text>
          <Text style={styles.cardSub}>
            Track grocery and household receipts, and catch prices creeping up over time.
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 14 },
  title: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  cardEmoji: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  cardSub: { fontSize: 13.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 4, lineHeight: 19 },
});
