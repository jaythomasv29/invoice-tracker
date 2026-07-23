import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth, useOrganization, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useExtractionUsage } from '../../hooks/useExtractionUsage';
import { useSupabase } from '../../lib/supabase';
import { openBillingPortal } from '../../lib/billing';
import { fetchAllInvoices } from '../../lib/invoicePipeline';
import { exportInvoicesCsv } from '../../lib/csvExport';
import { initialsFor } from '../../lib/initials';
import { PRIVACY_POLICY_URL, openLegalUrl } from '../../constants/legal';
import Toast from '../../components/ui/Toast';

export default function MoreScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { signOut } = useAuth();
  const { organization } = useOrganization();
  const { user } = useUser();
  const { isPro } = useEntitlement();
  const { used, cap } = useExtractionUsage();
  const { showToast } = useStore();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const restaurantName = organization?.name ?? '';
  const userInitials = initialsFor(restaurantName);
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); router.replace('/(auth)'); } },
    ]);
  };

  const handleExport = async () => {
    if (!organization?.id || exporting) return;
    setExporting(true);
    try {
      const invoices = await fetchAllInvoices(supabase, organization.id);
      if (invoices.length === 0) {
        showToast('No invoices to export yet');
        return;
      }
      await exportInvoicesCsv(invoices);
    } catch (err: any) {
      showToast(err?.message ?? 'Could not export CSV');
    } finally {
      setExporting(false);
    }
  };
  const handleManageSubscription = async () => {
    try {
      await openBillingPortal(supabase);
    } catch (err: any) {
      showToast(err?.message ?? 'Could not open billing portal');
    }
  };

  const handleDeleteAccount = () => {
    if (deleting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and sign-in access. This can’t be undone. Your organization’s invoice data is not affected and stays with any remaining team members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await user?.delete();
              router.replace('/(auth)');
            } catch (err: any) {
              setDeleting(false);
              showToast(err?.errors?.[0]?.message ?? err?.message ?? 'Could not delete account');
            }
          },
        },
      ]
    );
  };

  type Row = { label: string; detail?: string; onPress?: () => void; accent?: boolean };
  const sections: { header: string; rows: Row[] }[] = [
    {
      header: 'Intelligence',
      rows: [
        {
          label: 'Recipe costing',
          detail: isPro ? 'New' : 'Pro',
          accent: !isPro,
          onPress: () => router.push(isPro ? '/recipes' : '/paywall'),
        },
        { label: 'Export to CSV', detail: exporting ? 'Exporting…' : undefined, onPress: handleExport },
      ],
    },
    {
      header: 'Organization',
      rows: [
        { label: 'Restaurant name', detail: restaurantName },
        { label: 'Email', detail: email || 'you@restaurant.com' },
        {
          label: 'Plan',
          detail: isPro ? 'Pro' : 'Free',
          accent: isPro,
          onPress: () => router.push('/paywall'),
        },
        ...(isPro
          ? [{ label: 'Manage subscription', onPress: handleManageSubscription } as Row]
          : [{ label: 'Extractions this month', detail: `${used} of ${cap} used` } as Row]),
        { label: 'Invite staff', onPress: () => showToast('Staff invite — coming soon') },
      ],
    },
    {
      header: 'App',
      rows: [
        { label: 'Notification settings', onPress: () => showToast('Notification settings — coming soon') },
        { label: 'Alert sensitivity', detail: 'Custom per category', onPress: () => showToast('Alert settings — coming soon') },
        {
          label: 'Privacy & data',
          onPress: () => openLegalUrl(PRIVACY_POLICY_URL, () => showToast('Privacy policy coming soon')),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        <View>
          <Text style={styles.restaurantName}>{restaurantName}</Text>
          <Text style={styles.email}>{email || 'you@restaurant.com'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.header} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.header}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={row.onPress ? () => { Haptics.selectionAsync(); row.onPress!(); } : undefined}
                  activeOpacity={row.onPress ? 0.7 : 1}
                >
                  <Text style={[styles.rowLabel, row.accent && styles.rowLabelAccent]}>{row.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {row.detail && <Text style={styles.rowDetail}>{row.detail}</Text>}
                    {row.onPress && <Text style={styles.rowChevron}>›</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          disabled={deleting}
        >
          <Text style={styles.deleteText}>{deleting ? 'Deleting account…' : 'Delete account'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Sift v1.0.0</Text>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 15,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  avatarText: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 0.5 },
  restaurantName: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  email: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  scroll: { padding: 16, gap: 6, paddingBottom: 120 },
  section: { gap: 6 },
  sectionHeader: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary, paddingHorizontal: 4, marginTop: 10, marginBottom: 2,
  },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  rowLabel: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  rowLabelAccent: { color: Colors.primary },
  rowDetail: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  rowChevron: { fontSize: 18, color: Colors.textTertiary },
  signOutBtn: {
    backgroundColor: Colors.dangerLight, borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  signOutText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 6 },
  deleteText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, textDecorationLine: 'underline' },
  version: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, textAlign: 'center', marginTop: 8 },
});
