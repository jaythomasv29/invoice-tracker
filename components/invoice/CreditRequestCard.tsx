import { View, Text, StyleSheet } from 'react-native';
import TouchableOpacity from '../ui/MotionTouchable';
import Spinner from '../ui/Spinner';
import { Colors } from '../../constants/Colors';
import { Design } from '../../constants/Design';
import { money2 } from '../../lib/money';
import type { CreditStatus } from '../../lib/creditRequest';

type Props = {
  count: number;
  total: number;
  // Aggregate state of the missing lines: null when any line still needs
  // follow-up, 'requested' when all were requested, 'credited' when all came back.
  status: CreditStatus | null;
  // Mixed case: some lines were already requested, `newCount` were marked since.
  newCount: number;
  newTotal: number;
  requestedCount: number;
  busy: boolean;
  onRequest: () => void;
  onMarkCredited: () => void;
  onUndoCredited: () => void;
};

// Shown on a Business invoice with lines marked missing: the shortfall, a
// one-tap credit request to the vendor's rep, and a place to close it out
// once the credit shows up — so shorted product doesn't silently stay paid for.
export default function CreditRequestCard({ count, total, status, newCount, newTotal, requestedCount, busy, onRequest, onMarkCredited, onUndoCredited }: Props) {
  const plural = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
  const items = plural(count);
  const mixed = status === null && requestedCount > 0 && newCount > 0;
  const title = status === 'credited' ? 'Credit received'
    : status === 'requested' ? 'Credit requested'
    : mixed ? `${newCount} more item${newCount === 1 ? "" : "s"} missing`
    : `${items} missing`;
  const sub = status === 'credited' ? `$${money2(total)} back for ${items} that never arrived.`
    : status === 'requested' ? `Waiting on $${money2(total)} from the vendor. Mark it once it shows on an invoice or statement.`
    : mixed ? `$${money2(newTotal)} not requested yet. ${plural(requestedCount)} already requested; $${money2(total)} outstanding in all.`
    : `You were billed $${money2(total)} for product that didn't arrive. Ask the vendor for a credit.`;
  const tone = status === 'credited' ? Colors.primaryDark : status === 'requested' ? Colors.warning : Colors.danger;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: tone }]}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <Text style={[styles.total, { color: tone }]}>${money2(total)}</Text>
      </View>
      {busy ? (
        <View style={styles.busy}><Spinner size={16} /></View>
      ) : status === 'credited' ? (
        <TouchableOpacity onPress={onUndoCredited} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="Undo credit received">
          <Text style={styles.link}>Undo</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, status === 'requested' ? styles.btnGhost : styles.btnPrimary]} onPress={onRequest}
            accessibilityRole="button" accessibilityLabel={status === 'requested' ? 'Send the credit request again' : mixed ? `Request a credit for ${plural(newCount)}` : 'Request a credit from the vendor'}>
            <Text style={[styles.btnText, status === 'requested' ? styles.btnGhostText : styles.btnPrimaryText]}>
              {status === 'requested' ? 'Resend request' : mixed ? `Request ${plural(newCount)}` : 'Request credit'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onMarkCredited}
            accessibilityRole="button" accessibilityLabel="Mark the credit as received">
            <Text style={[styles.btnText, styles.btnGhostText]}>Credit received</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontFamily: 'Manrope_700Bold', letterSpacing: -0.2 },
  sub: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  total: { fontSize: 19, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -0.4 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: Colors.textPrimary },
  btnPrimaryText: { color: '#fff' },
  btnGhost: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textPrimary },
  btnText: { fontSize: 13, fontFamily: 'Manrope_700Bold' },
  busy: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkBtn: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  link: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primary },
});
