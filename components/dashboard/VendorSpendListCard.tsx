import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { DayData, SpendPeriod, Vendor, vendorAmountFromBars } from '../../store/useStore';
import { spendPeriodShortLabel } from '../../hooks/useSpendPeriod';
import SpendPeriodPicker from './SpendPeriodPicker';
import Spinner from '../ui/Spinner';

interface VendorSpendListCardProps {
  vendors: Vendor[];
  period: SpendPeriod;
  onChangePeriod: (period: SpendPeriod) => void;
  yearsBack: number;
  onChangeYears: (n: number) => void;
  maxYears: number;
  periodBarData: DayData[];
  onPressVendor: (vendorId: string) => void;
  isLoading?: boolean;
}

export default function VendorSpendListCard({
  vendors, period, onChangePeriod, yearsBack, onChangeYears, maxYears,
  periodBarData, onPressVendor, isLoading,
}: VendorSpendListCardProps) {
  const shortLabel = spendPeriodShortLabel(period, yearsBack);
  const totalInvoices = vendors.reduce((sum, v) => sum + v.invoiceCount, 0);

  const rows = useMemo(() => {
    return vendors
      .map((v) => ({ vendor: v, amount: vendorAmountFromBars(periodBarData, v.id) }))
      .sort((a, b) => b.amount - a.amount);
  }, [vendors, periodBarData]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Total Invoices</Text>
            {isLoading && <Spinner size={12} color={Colors.textSecondary} />}
          </View>
          <Text style={styles.subtitle}>
            {vendors.length} vendor{vendors.length === 1 ? '' : 's'}, {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'}
          </Text>
        </View>
        <SpendPeriodPicker
          period={period}
          onChangePeriod={onChangePeriod}
          yearsBack={yearsBack}
          onChangeYears={onChangeYears}
          maxYears={maxYears}
        />
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No vendors yet — scan an invoice to get started.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map(({ vendor: v, amount }) => (
            <TouchableOpacity
              key={v.id}
              style={styles.row}
              onPress={() => onPressVendor(v.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: v.color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.vendorName} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.invoiceCount}>
                  {v.invoiceCount} invoice{v.invoiceCount === 1 ? '' : 's'} total
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillAmount}>${amount.toLocaleString()}</Text>
                <Text style={styles.pillLabel}>{shortLabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 2 },
  empty: {
    fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    marginTop: 14, lineHeight: 19,
  },

  list: { marginTop: 14, gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  vendorName: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invoiceCount: { fontSize: 11.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1 },

  pill: {
    backgroundColor: Colors.background, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 7, alignItems: 'flex-end',
  },
  pillAmount: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  pillLabel: { fontSize: 9.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 1 },
});
