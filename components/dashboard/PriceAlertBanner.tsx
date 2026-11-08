import { Design } from '../../constants/Design';
import TouchableOpacity from '../ui/MotionTouchable';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { PriceAlert } from '../../store/useStore';
import { useWorkspace } from '../../lib/workspaceContext';
import { money2 } from '../../lib/money';

export default function PriceAlertBanner({ alert, onPress }: { alert: PriceAlert; onPress: () => void }) {
  const { isPersonal } = useWorkspace();
  const change = isPersonal && alert.absChange < 1 ? alert.absChange.toFixed(4) : money2(alert.absChange);
  const since = isPersonal ? 'since last purchase' : 'since last order';
  return (
    <TouchableOpacity style={styles.alertCard} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Price increase: ${alert.itemName} at ${alert.vendorName}, up $${change} per ${alert.unit || 'unit'}, ${Math.round(alert.pctChange)}% ${since}`}>
      <View style={styles.alertIconWrap}>
        <Text style={styles.alertIconText}>!</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.alertEyebrow}>Price increase</Text>
        <Text style={styles.alertTitle} numberOfLines={1}>
          {alert.itemName} · {alert.vendorName.split(' ')[0]}
        </Text>
        <Text style={styles.alertSub}>
          up ${change}/{alert.unit} ({Math.round(alert.pctChange)}%) {since}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: 15, flexDirection: 'row', gap: 13, alignItems: 'center', shadowOpacity: 0,
  },
  alertIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center',
  },
  alertIconText: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.warning },
  alertEyebrow: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.warning, marginBottom: 2,
  },
  alertTitle: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  alertSub: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.warning, marginTop: 1 },
  chevron: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },
});
