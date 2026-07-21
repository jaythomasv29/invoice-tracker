import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useStore, DisputeEntry } from '../store/useStore';
import Toast from '../components/ui/Toast';

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  vendorColor: string;
  vendorContactName?: string;
  vendorContactPhone?: string;
  items: DisputeEntry[];
  total: number;
}

export default function DisputesScreen() {
  const router = useRouter();
  const { disputedItems } = useStore();

  const total = disputedItems.reduce((a, d) => a + d.amount, 0);

  const groups: VendorGroup[] = [];
  const groupByVendor = new Map<string, VendorGroup>();
  for (const d of disputedItems) {
    let group = groupByVendor.get(d.vendorId);
    if (!group) {
      group = {
        vendorId: d.vendorId, vendorName: d.vendorName, vendorColor: d.vendorColor,
        vendorContactName: d.vendorContactName, vendorContactPhone: d.vendorContactPhone,
        items: [], total: 0,
      };
      groupByVendor.set(d.vendorId, group);
      groups.push(group);
    }
    group.items.push(d);
    group.total += d.amount;
  }
  groups.sort((a, b) => b.total - a.total);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Disputes</Text>
          <Text style={styles.headerSub}>${total.toFixed(0)} across {disputedItems.length} items</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups.map((g) => (
          <VendorGroupCard key={g.vendorId} group={g} onCallVendor={() => {
            if (g.vendorContactPhone) {
              Haptics.selectionAsync();
              Linking.openURL(`tel:${g.vendorContactPhone}`);
            }
          }} />
        ))}

        {disputedItems.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No disputes</Text>
            <Text style={styles.emptySub}>Everything you've been billed for has arrived.</Text>
          </View>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

function VendorGroupCard({ group: g, onCallVendor }: { group: VendorGroup; onCallVendor: () => void }) {
  return (
    <View style={styles.vendorGroup}>
      <View style={styles.vendorGroupHeader}>
        <View style={styles.vendorRow}>
          <View style={[styles.vendorDot, { backgroundColor: g.vendorColor }]} />
          <Text style={styles.vendorName} numberOfLines={1}>{g.vendorName}</Text>
        </View>
        <Text style={styles.vendorTotal}>${g.total.toFixed(2)}</Text>
      </View>

      {(g.vendorContactName || g.vendorContactPhone) && (
        <View style={styles.contactCard}>
          {g.vendorContactName && <Text style={styles.contactItem}>Rep: {g.vendorContactName}</Text>}
          {g.vendorContactPhone && (
            <TouchableOpacity onPress={onCallVendor}>
              <Text style={styles.contactPhone}>{g.vendorContactPhone}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        {g.items.map((d) => (
          <DisputeRow key={d.id} entry={d} />
        ))}
      </View>
    </View>
  );
}

function DisputeRow({ entry: d }: { entry: DisputeEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemName} numberOfLines={1}>{d.itemName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{d.date}</Text>
      </View>
      <Text style={styles.amount}>${d.amount.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: {
    width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.textPrimary, transform: [{ rotate: '-45deg' }], marginLeft: 3,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  scroll: { padding: 16, gap: 18, paddingBottom: 40 },

  vendorGroup: { gap: 10 },
  vendorGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  vendorDot: { width: 9, height: 9, borderRadius: 4.5 },
  vendorName: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, flexShrink: 1 },
  vendorTotal: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.danger },

  contactCard: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 4,
  },
  contactItem: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  contactPhone: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.primary, textDecorationLine: 'underline' },

  row: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.danger },
  itemName: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  amount: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.danger },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
