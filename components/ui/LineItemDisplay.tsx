import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { LineItem } from '../../store/useStore';

interface LineItemDisplayProps {
  item: LineItem;
  // Interactive controls (confirm banner, mark-missing toggle, note field)
  // only render when onToggleMissing is provided — the read-only
  // invoice-detail screen omits it and gets the plain card (with the note
  // shown as static text, if one was left).
  onToggleExpand?: () => void;
  onConfirm?: () => void;
  onToggleMissing?: () => void;
  onChangeNote?: (note: string) => void;
  // Invoice-detail screen only — lets you correct a saved item's
  // description/quantity/unit price after the fact.
  onEdit?: () => void;
  // Invoice-detail screen only — reversible remove/restore. Voided items
  // stay visible (greyed out) but drop out of the invoice's totals.
  onToggleVoid?: () => void;
}

export default function LineItemDisplay({
  item, onToggleExpand, onConfirm, onToggleMissing, onChangeNote, onEdit, onToggleVoid,
}: LineItemDisplayProps) {
  const isMissing = item.verification === 'missing';

  return (
    <View style={[styles.itemCard, item.voided && styles.itemCardVoided]}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.catBadge, { backgroundColor: item.catColor + '20' }]}>
              <Text style={[styles.catBadgeText, { color: item.catColor }]}>{item.category}</Text>
            </View>
            {item.voided && (
              <View style={styles.voidedBadge}>
                <Text style={styles.voidedBadgeText}>REMOVED</Text>
              </View>
            )}
          </View>
          <Text style={[styles.itemDesc, item.voided && styles.itemTextVoided]}>{item.desc}</Text>
          {item.rawDesc && (
            <Text style={styles.itemRawDesc} numberOfLines={1}>Printed as: {item.rawDesc}</Text>
          )}
          <Text style={[styles.itemMeta, item.voided && styles.itemTextVoided]}>
            {item.qty} {item.unit} @ ${item.unitPrice.toFixed(2)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[styles.itemExt, item.voided && styles.itemTextVoided]}>${item.ext.toFixed(2)}</Text>
          <View style={styles.actionLinkRow}>
            {onEdit && !item.voided && (
              <TouchableOpacity onPress={onEdit} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
            {onToggleVoid && (
              <TouchableOpacity onPress={onToggleVoid} activeOpacity={0.7} hitSlop={8}>
                <Text style={item.voided ? styles.restoreLink : styles.removeLink}>
                  {item.voided ? 'Restore' : 'Remove'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {onToggleMissing && (
        <>
          {item.needsConfirm && !item.confirmed && (
            <TouchableOpacity style={styles.confirmBanner} onPress={onToggleExpand} activeOpacity={0.85}>
              <View style={styles.confirmDot} />
              <Text style={styles.confirmTitle}>Quick check needed</Text>
              <Text style={styles.confirmChevron}>›</Text>
            </TouchableOpacity>
          )}
          {item.expanded && item.needsConfirm && !item.confirmed && (
            <View style={styles.confirmExpanded}>
              <Text style={styles.confirmNote}>{item.confirmNote}</Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.confirmed && item.needsConfirm && (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>✓ Confirmed</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.missingBtn, isMissing && styles.missingBtnActive]}
            onPress={onToggleMissing}
            activeOpacity={0.85}
          >
            <Text style={[styles.missingBtnText, isMissing && styles.missingBtnTextActive]}>
              {isMissing ? '✓ Marked missing' : 'Mark missing'}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.noteInput}
            value={item.note ?? ''}
            onChangeText={onChangeNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </>
      )}

      {!onToggleMissing && item.note && (
        <View style={styles.noteDisplay}>
          <Text style={styles.noteDisplayLabel}>Note</Text>
          <Text style={styles.noteDisplayText}>{item.note}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 15, gap: 11,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  itemCardVoided: { opacity: 0.55 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  catBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  voidedBadge: {
    alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: Colors.textTertiary + '25',
  },
  voidedBadgeText: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
  },
  itemDesc: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  itemRawDesc: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2 },
  itemMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 3 },
  itemExt: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  itemTextVoided: { textDecorationLine: 'line-through' },
  actionLinkRow: { flexDirection: 'row', gap: 12 },
  editLink: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  removeLink: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  restoreLink: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.primary },

  confirmBanner: {
    backgroundColor: Colors.warningLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  confirmDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.warning },
  confirmTitle: { flex: 1, fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.warning },
  confirmChevron: { fontSize: 18, color: Colors.warningMuted },
  confirmExpanded: { gap: 9, marginTop: -4 },
  confirmNote: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, lineHeight: 19 },
  confirmBtn: {
    alignSelf: 'flex-start', backgroundColor: Colors.textPrimary, borderRadius: 9,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  confirmBtnText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#fff' },
  confirmedBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primaryLight,
    borderRadius: 8, paddingHorizontal: 11, paddingVertical: 5,
  },
  confirmedText: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },

  missingBtn: {
    alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: Colors.background,
  },
  missingBtnActive: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger + '40' },
  missingBtnText: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  missingBtnTextActive: { color: Colors.danger },

  noteInput: {
    backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 9, minHeight: 40,
    fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textPrimary,
  },

  noteDisplay: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 11, gap: 2,
  },
  noteDisplayLabel: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
  },
  noteDisplayText: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 18 },
});
