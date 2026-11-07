import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { ensureAiConsent, withdrawAiConsent } from '../../lib/aiConsent';
import { syncSubscription } from '../../lib/subscriptionSync';
import { useState, useCallback, useRef } from 'react';
import { subscriptionStatusText } from '../../lib/subscriptionStatus';
import { View, Text, ScrollView, StyleSheet, Alert, AppState } from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useExtractionUsage } from '../../hooks/useExtractionUsage';
import { useSupabase } from '../../lib/supabase';
import { manageSubscription, restorePurchases, getSubscriptionEntitlement } from '../../lib/purchases';
import { fetchAllInvoices } from '../../lib/invoicePipeline';
import { exportInvoicesCsv } from '../../lib/csvExport';
import { initialsFor } from '../../lib/initials';
import { PRIVACY_POLICY_URL, openLegalUrl } from '../../constants/legal';
import Toast from '../../components/ui/Toast';
import { useTour } from '../../components/tour/TourProvider';

export default function MoreScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { signOut } = useAuth();
  const { organization, accountType, isPersonal, personalId, select } = useWorkspace();
  const { user } = useUser();
  const { plan, isPaid } = useEntitlement();
  const { used, cap } = useExtractionUsage();
  const { showToast, debugPlan, setDebugPlan } = useStore();
  const { start: startTour } = useTour();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [billingLabel, setBillingLabel] = useState('Checking Apple subscription…');
  const activeOrg = useRef(organization);
  activeOrg.current = organization;
  const refreshBilling = useCallback(async () => {
    const current = activeOrg.current;
    if (!current) return;
    const id = current.id;
    try {
      const info = await getSubscriptionEntitlement(current.billingCustomerId, accountType);
      if (activeOrg.current?.id !== id) return;
      setBillingLabel(subscriptionStatusText(info, Date.now(), info?.identifier === 'plus' ? 'Plus' : 'Pro') + (info?.isSandbox ? ' · TestFlight sandbox' : ''));
      try {
        await syncSubscription(supabase);
        if (activeOrg.current?.id === id) await current.reload();
      } catch { /* A parallel server sync must not hide a freshly verified Apple end date. */ }
    } catch {
      if (activeOrg.current?.id === id) setBillingLabel('Could not refresh status · check Manage subscription');
    }
  }, [supabase, accountType]);
  useFocusEffect(useCallback(() => {
    setBillingLabel('Checking Apple subscription…');
    void refreshBilling();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refreshBilling(); });
    return () => listener.remove();
  }, [refreshBilling]));

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
        showToast(isPersonal ? 'No receipts to export yet' : 'No invoices to export yet');
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
      // Opens the native App Store subscription-management sheet. Cancels/changes
      // flow back through the revenuecat-webhook, which updates the plan flag.
      await manageSubscription();
      await refreshBilling();
    } catch (err: any) {
      showToast(err?.message ?? 'Could not open subscription settings');
    }
  };

  const handleRestore = async () => {
    try {
      if (!organization?.id) return;
      if(!organization.canPurchase)throw new Error('Only the workspace billing owner can restore purchases.');
      await restorePurchases(organization.billingCustomerId,accountType);
      const restoredPlan = await syncSubscription(supabase);
      await organization.reload();
      await refreshBilling();
      showToast(restoredPlan !== 'free' ? `Restored — you're on ${restoredPlan}` : 'No active subscription found');
    } catch (err: any) {
      showToast(err?.message ?? 'Could not restore purchases');
    }
  };

  const handleDeleteAccount = () => {
    if (deleting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete account',
      'This permanently deletes your account. Your household and businesses where you are the only member, including receipt, invoice and recipe photos, will be erased. Shared restaurant records stay with the remaining members. Apple subscriptions are not cancelled by account deletion: cancel first in Manage subscription. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
              if (error) {
                let detail = 'Could not complete deletion. Please retry.';
                try { detail = (await error.context.json()).error ?? detail; } catch { /* network error */ }
                throw new Error(detail);
              }
              if (!data?.deleted) throw new Error('Deletion is pending. Please retry.');
              useStore.setState(useStore.getInitialState(), true);
              await signOut();
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

  const planLabel = plan === 'pro' ? (isPersonal ? 'Personal Pro' : 'Pro') : plan === 'plus' ? 'Plus' : 'Free';

  type Row = { label: string; detail?: string; onPress?: () => void; accent?: boolean; stacked?: boolean };
  const sections: { header: string; rows: Row[] }[] = [
    {header:'Workspaces',rows:[
      {label:isPersonal?'Personal · household':'Business · restaurant',detail:'Current'},
      ...(!isPersonal&&personalId?[{label:'Switch to Personal',onPress:()=>{void select(personalId).catch(e=>showToast(e.message));}}]:[]),
      ...(isPersonal?(user?.organizationMemberships??[]).map(m=>({label:`Switch to ${m.organization.name}`,onPress:()=>{void select(m.organization.id).catch(e=>showToast(e.message));}})):[]),
      {label:'Add or switch workspace',onPress:()=>router.push({pathname:'/onboarding/organization',params:{add:'1'}})},
    ]},
    {
      header: 'Intelligence',
      rows: [
        {label:'Products & prices',detail:'Search items',onPress:()=>router.push('/products')},
        ...(!isPersonal?[{
          label: 'Recipe costing',
          detail: isPaid ? 'New' : 'Pro',
          accent: !isPaid,
          onPress: () => router.push(isPaid ? '/recipes' : '/paywall'),
        }]:[]),
        { label: 'Export to CSV', detail: exporting ? 'Exporting…' : undefined, onPress: handleExport },
      ],
    },
    {
      header: isPersonal?'Household':'Business',
      rows: [
        { label: isPersonal?'Household name':'Business name', detail: restaurantName },
        { label: 'Email', detail: email || 'Not set' },
        {
          label: 'Plan',
          detail: planLabel,
          accent: isPaid,
          onPress: () => router.push('/paywall'),
        },
        { label: 'Apple subscription', stacked: true, detail: billingLabel, onPress: handleManageSubscription },
        { label: isPersonal ? 'Receipt scans this month' : 'Extractions this month', detail: `${used} of ${cap} used` },
        ...(isPaid
          ? [{ label: 'Manage subscription', onPress: handleManageSubscription } as Row]
          : []),
        { label: 'Restore purchases', onPress: handleRestore },
      ],
    },
    {
      header: 'App',
      rows: [
        { label: 'Allow Smart Sift processing', onPress: async () => { try { if (await ensureAiConsent(supabase)) showToast('Smart Sift processing allowed'); } catch (e) { showToast((e as Error).message); } } },
        { label: 'Withdraw Smart Sift permission', onPress: () => Alert.alert('Withdraw Smart Sift permission?', isPersonal ? 'New receipt scans will pause. Saved receipts remain available.' : 'New invoice scans and Smart Sift recipe drafts will pause. Saved records remain available.', [{ text: 'Keep permission', style: 'cancel' }, { text: 'Withdraw', onPress: async () => { try { await withdrawAiConsent(supabase); showToast('Smart Sift processing permission withdrawn'); } catch (e) { showToast((e as Error).message); } } }]) },
        {
          label: 'Privacy & data',
          onPress: () => openLegalUrl(PRIVACY_POLICY_URL, () => showToast('Privacy policy coming soon')),
        },
        ...(!isPersonal?[{ label: 'Replay product tour', onPress: () => { router.push('/(tabs)'); startTour(); } }]:[]),
      ],
    },
    // Dev-only QA tier-switcher — overrides the effective plan client-side so
    // gating can be verified at every level without a real purchase. Stripped
    // from production builds. The server still enforces the org's real plan.
    ...(__DEV__
      ? [{
          header: 'Developer · QA tier',
          rows: ([
            { key: null, label: 'Use real plan' },
            { key: 'free', label: 'Force Free' },
                        { key: 'pro', label: 'Force Pro' },
          ] as { key: 'free' | 'plus' | 'pro' | null; label: string }[]).map((opt) => ({
            label: opt.label,
            detail: debugPlan === opt.key ? '✓ active' : undefined,
            accent: debugPlan === opt.key,
            onPress: () => { setDebugPlan(opt.key); showToast(opt.key ? `Forcing ${opt.key}` : 'Using real plan'); },
          })),
        }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        <View>
          <Text style={styles.restaurantName}>{restaurantName}</Text>
          {!!email && <Text style={styles.email}>{email}</Text>}
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
                  style={[styles.row, i > 0 && styles.rowBorder, row.stacked && {flexDirection: 'column', alignItems: 'flex-start', gap: 8}]}
                  onPress={row.onPress ? () => { Haptics.selectionAsync(); row.onPress!(); } : undefined}
                  activeOpacity={row.onPress ? 0.7 : 1}
                  accessibilityRole={row.onPress ? 'button' : 'text'}
                  accessibilityLabel={row.detail ? `${row.label}, ${row.detail}` : row.label}
                >
                  <Text style={[styles.rowLabel, row.accent && styles.rowLabelAccent]}>{row.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, ...(row.stacked ? {width: '100%' as const} : {}) }}>
                    {row.detail && <Text style={[styles.rowDetail, row.stacked && {flex: 1, lineHeight: 22}]}>{row.detail}</Text>}
                    {row.onPress && <Text style={styles.rowChevron}>›</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityHint="Permanently deletes your account and data"
          accessibilityState={{ disabled: deleting, busy: deleting }}
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
    width: 52, height: 52, borderRadius: Design.radius.pill,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0,
  },
  avatarText: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 0.5 },
  restaurantName: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  email: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  section: { gap: 6 },
  sectionHeader: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary, paddingHorizontal: 4, marginTop: 10, marginBottom: 2,
  },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: Design.radius.card, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  rowLabel: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  rowLabelAccent: { color: Colors.primary },
  rowDetail: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  rowChevron: { fontSize: 18, color: Colors.textTertiary },
  signOutBtn: {
    backgroundColor: Colors.dangerLight, borderRadius: Design.radius.pill, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  signOutText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 6 },
  deleteText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, textDecorationLine: 'underline' },
  version: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, textAlign: 'center', marginTop: 8 },
});
