import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Design } from '../../constants/Design';
import { DashboardOverviewPreview } from '../onboarding/PreviewCards';
import Touch from '../ui/MotionTouchable';

/**
 * The whole Home screen for a workspace with nothing saved yet: one explainer
 * in place of a stack of $0.00 tiles. Once the first scan is saved the regular
 * dashboard takes over and this copy lives behind the header info button.
 */
export default function HomeWelcomeCard({ isPersonal, onScan, onSample }: {
  isPersonal: boolean; onScan: () => void; onSample?: () => void;
}) {
  const doc = isPersonal ? 'receipt' : 'invoice';
  const steps = isPersonal
    ? ['Snap a grocery or household receipt.', 'Check the items Sift reads, then save.', 'See where your money goes, store by store.']
    : ['Snap a supplier invoice, every page.', 'Check the line items Sift reads, then save.', 'See spend by supplier and catch price increases.'];
  return <View style={s.card}>
    <View style={s.preview}><DashboardOverviewPreview active /></View>
    <Text style={s.eyebrow}>WELCOME TO SIFT</Text>
    <Text style={s.title} accessibilityRole="header">{isPersonal ? 'Your receipts, turned into a clear picture' : 'Your invoices, turned into true food cost'}</Text>
    <Text style={s.body}>{isPersonal
      ? 'Your spending overview fills in after your first saved receipt.'
      : 'Your spending overview, supplier breakdown and price alerts fill in after your first saved invoice.'}</Text>
    <View style={s.steps}>
      {steps.map((step, i) => <View key={step} style={s.step}>
        <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
        <Text style={s.stepText}>{step}</Text>
      </View>)}
    </View>
    <Touch onPress={onScan} accessibilityRole="button" accessibilityLabel={`Scan your first ${doc}`} style={s.cta}>
      <Text style={s.ctaText}>Scan your first {doc}</Text>
    </Touch>
    {onSample && <Touch onPress={onSample} accessibilityRole="button" accessibilityHint="Shows sample data. Your workspace is not changed." style={s.secondary}>
      <Text style={s.secondaryText}>{isPersonal ? 'Explore a sample household' : 'Take the sample tour'} ›</Text>
    </Touch>}
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 20, gap: 12, borderRadius: Design.radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  preview: { marginBottom: 6 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 1.5, color: Colors.primary },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 23, lineHeight: 29, letterSpacing: -0.5, color: Colors.textPrimary },
  body: { fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  steps: { gap: 10, marginVertical: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 12, color: Colors.primaryDark },
  stepText: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  cta: { minHeight: 52, borderRadius: Design.radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { fontFamily: 'Manrope_700Bold', fontSize: 16, color: Colors.textOnPrimary },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: Colors.primaryDark },
});
