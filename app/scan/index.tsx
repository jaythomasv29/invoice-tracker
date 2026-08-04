import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { useNetworkState } from 'expo-network';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { createDraftInvoice, uploadInvoiceImages, extractInvoice, deleteInvoice, formatDate } from '../../lib/invoicePipeline';
import { ExtractionLimitError, DuplicateInvoiceError } from '../../lib/entitlements';
import { useExtractionUsage } from '../../hooks/useExtractionUsage';
import Toast from '../../components/ui/Toast';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { organization } = useOrganization();
  const supabase = useSupabase();
  const network = useNetworkState();
  const cameraRef = useRef<CameraView>(null);
  const { remaining, refresh: refreshUsage } = useExtractionUsage();
  const {
    scanStage, setScanStage,
    setCurrentInvoice, showToast,
  } = useStore();

  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Pages captured with the in-app camera, awaiting a single batch extraction.
  // Each shutter press appends one; "Scan N pages" runs the pipeline once over
  // all of them (same multi-image path the library import uses). Empty means
  // no batch in progress — the UI shows the plain single-shot affordances.
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  // Set when the edge function flags a likely duplicate (HTTP 409). Drives the
  // "possible duplicate" confirmation modal — a warn-and-override, not a block.
  // Carries the abandoned draft's id + images (needed to delete it or force it
  // through) alongside the existing invoice's details to show/link.
  const [duplicateInfo, setDuplicateInfo] = useState<{
    draftInvoiceId: string;
    jpegUris: string[];
    existingInvoiceId: string;
    vendorName: string | null;
    invoiceDate: string | null;
    total: number | null;
  } | null>(null);

  const isOffline = network.isConnected === false || network.isInternetReachable === false;

  const spin = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    if (scanStage === 'processing') {
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(spin);
    }
  }, [scanStage, spin]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const shutterFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // Multi-page invoices are supported from both entry points: the library
  // import passes every selected photo at once, and the camera batches pages
  // via `capturedPages` (each shutter appends one, then "Scan N pages" calls
  // this). Either way `uris` is the full page set for ONE invoice — they upload
  // as {orgId}/{invoiceId}/{n}.jpg and the edge function sends them to Claude in
  // a single request, returning one merged set of line items.
  const processImages = async (uris: string[]) => {
    if (!organization) {
      showToast('No restaurant selected');
      return;
    }
    // Client-side pre-check: orgs already over their tier's monthly cap go
    // straight to the paywall, so we don't waste an upload. The edge function
    // enforces the same limit server-side, so this is UX, not the security
    // boundary. `remaining` is tier-aware (Free 10 / Plus 300 / Pro 500).
    if (remaining <= 0) {
      router.push('/paywall');
      return;
    }
    setScanStage('processing');
    // Hoisted so the catch block can reference the draft invoice / images when
    // the server flags a duplicate (to delete it or force it through later).
    let invoiceId: string | undefined;
    let jpegUris: string[] = [];
    try {
      // Photos from the library can come back as HEIC (Apple's default) or
      // other formats — Claude's vision API only accepts jpeg/png/gif/webp,
      // so every image is re-encoded to a guaranteed-real JPEG regardless of
      // source format before it ever gets uploaded.
      jpegUris = await Promise.all(
        uris.map(async (uri) => {
          const result = await manipulateAsync(uri, [], { compress: 0.85, format: SaveFormat.JPEG });
          return result.uri;
        })
      );
      invoiceId = await createDraftInvoice(supabase, organization.id);
      await uploadInvoiceImages(supabase, organization.id, invoiceId, jpegUris);
      const invoice = await extractInvoice(supabase, invoiceId);
      refreshUsage();
      setCurrentInvoice({ ...invoice, imageUris: jpegUris });
      router.replace('/scan/review');
    } catch (err: any) {
      // Server said the free cap is used up (e.g. a teammate extracted since we
      // loaded the meter) — send them to the paywall, not a dead-end toast.
      // The draft invoice created above is abandoned either way (a retry after
      // upgrading starts a fresh scan) — clean it up so it doesn't linger as an
      // orphaned 'pending' row with uploaded images nothing ever revisits.
      if (err instanceof ExtractionLimitError) {
        if (invoiceId) deleteInvoice(supabase, invoiceId).catch(() => {});
        router.push('/paywall');
        return;
      }
      // Server thinks this is a duplicate — surface the confirm modal instead
      // of a dead-end toast; the user decides whether to view or force it.
      if (err instanceof DuplicateInvoiceError && invoiceId) {
        setDuplicateInfo({
          draftInvoiceId: invoiceId,
          jpegUris,
          existingInvoiceId: err.existingInvoiceId,
          vendorName: err.vendorName,
          invoiceDate: err.invoiceDate,
          total: err.total,
        });
        return;
      }
      console.error('[scan] processImages failed:', err);
      showToast(err?.message ?? 'Could not process invoice');
      // Any other failure (bad photo, transient network/API error) also
      // abandons this draft — best-effort cleanup rather than leaving it
      // stuck in 'pending' forever.
      if (invoiceId) deleteInvoice(supabase, invoiceId).catch(() => {});
    } finally {
      setScanStage('idle');
    }
  };

  // "View existing invoice" — drop the abandoned draft, then navigate to the
  // invoice this one duplicates.
  const handleViewExisting = async () => {
    const info = duplicateInfo;
    setDuplicateInfo(null);
    if (!info) return;
    try {
      await deleteInvoice(supabase, info.draftInvoiceId);
    } catch {
      // Best-effort cleanup — don't block navigation on a failed delete.
    }
    router.push(`/invoice/${info.existingInvoiceId}`);
  };

  // "Continue anyway" — force this scan through the full extraction, skipping
  // both dedup layers, then proceed exactly like the normal success path.
  const handleContinueAnyway = async () => {
    const info = duplicateInfo;
    setDuplicateInfo(null);
    if (!info) return;
    setScanStage('processing');
    try {
      const invoice = await extractInvoice(supabase, info.draftInvoiceId, { skipDuplicateCheck: true });
      refreshUsage();
      setCurrentInvoice({ ...invoice, imageUris: info.jpegUris });
      router.replace('/scan/review');
    } catch (err: any) {
      if (err instanceof ExtractionLimitError) {
        router.push('/paywall');
        return;
      }
      console.error('[scan] continue anyway failed:', err);
      showToast(err?.message ?? 'Could not process invoice');
    } finally {
      setScanStage('idle');
    }
  };

  // Cancel/close — discard the abandoned draft and return to the camera.
  const handleDismissDuplicate = async () => {
    const info = duplicateInfo;
    setDuplicateInfo(null);
    if (!info) return;
    try {
      await deleteInvoice(supabase, info.draftInvoiceId);
    } catch {
      // Best-effort cleanup.
    }
  };

  const renderDuplicateModal = () => {
    if (!duplicateInfo) return null;
    const { vendorName, invoiceDate, total } = duplicateInfo;
    const dateLabel = formatDate(invoiceDate);
    const totalLabel = total != null ? `$${total.toFixed(2)}` : null;
    const detail = [dateLabel, totalLabel].filter(Boolean).join(' · ');
    return (
      <Modal visible transparent animationType="fade" onRequestClose={handleDismissDuplicate}>
        <View style={styles.dupBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismissDuplicate} />
          <View style={styles.dupCard}>
            <Text style={styles.dupTitle}>Possible duplicate</Text>
            <Text style={styles.dupSubtitle}>
              This looks like an invoice you already have:
            </Text>
            <View style={styles.dupExisting}>
              <Text style={styles.dupVendor}>{vendorName ?? 'Unknown vendor'}</Text>
              {!!detail && <Text style={styles.dupDetail}>{detail}</Text>}
            </View>
            <TouchableOpacity style={styles.dupPrimaryBtn} onPress={handleViewExisting} activeOpacity={0.85}>
              <Text style={styles.dupPrimaryText}>View existing invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dupSecondaryBtn} onPress={handleContinueAnyway} activeOpacity={0.85}>
              <Text style={styles.dupSecondaryText}>Continue anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dupCancelBtn} onPress={handleDismissDuplicate} activeOpacity={0.7}>
              <Text style={styles.dupCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Shutter appends a page to the pending batch rather than processing
  // immediately, so a multi-page invoice can be shot page-by-page. Nothing is
  // uploaded or sent to the model until "Scan N pages" (handleProcessPages).
  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady || scanStage === 'processing') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashOpacity.value = withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 220 }));
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      setCapturedPages((prev) => [...prev, photo.uri]);
    } catch (err: any) {
      console.error('[scan] capture failed:', err);
      showToast(err?.message ?? 'Could not take photo');
    }
  };

  // Send every captured page through as one invoice. processImages navigates
  // away to review on success (this screen unmounts, discarding the batch); on
  // failure it stays put and the batch is preserved so the user can retry.
  const handleProcessPages = async () => {
    if (capturedPages.length === 0 || scanStage === 'processing') return;
    await processImages(capturedPages);
  };

  const removePage = (index: number) => {
    Haptics.selectionAsync();
    setCapturedPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Photo library access needed to import');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets.length > 0) {
        await processImages(result.assets.map((a) => a.uri));
      }
    } catch (err: any) {
      console.error('[scan] import failed:', err);
      showToast(err?.message ?? 'Could not import photos');
    }
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ProcessingSpinner variant="light" style={spinnerStyle} />
      </View>
    );
  }

  // Permission denied — show import-only fallback
  if (!permission.granted) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan invoice</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <Text style={styles.permDeniedTitle}>Camera access needed</Text>
          <Text style={styles.permDeniedSub}>
            Allow camera access to scan invoices, or import photos from your library.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permBtnText}>Allow camera access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtn} onPress={handleImport} activeOpacity={0.85}>
            <Text style={styles.importBtnText}>Import from library</Text>
          </TouchableOpacity>
        </View>
        {renderDuplicateModal()}
        <Toast />
      </View>
    );
  }

  const processing = scanStage === 'processing';

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CloseIcon />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan invoice</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinder}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => showToast('Could not start the camera')}
        />

        {/* Corner guides */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        <Text style={styles.alignHint}>
          {capturedPages.length > 0
            ? `Page ${capturedPages.length + 1} — align and shoot, or tap Scan`
            : 'Align invoice within frame'}
        </Text>

        {/* Real connectivity banner — no manual toggle, reflects actual network state */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>No signal · will retry when reconnected</Text>
          </View>
        )}

        {/* Shutter flash */}
        <Animated.View pointerEvents="none" style={[styles.shutterFlash, shutterFlashStyle]} />

        {/* Processing overlay */}
        {processing && (
          <View style={styles.processingOverlay}>
            <ProcessingSpinner style={spinnerStyle} />
            <Text style={styles.processingText}>Reading invoice…</Text>
          </View>
        )}
      </View>

      {/* Captured-pages tray — thumbnails + the single-shot process CTA. Only
          shown once at least one camera page is in the pending batch. */}
      {capturedPages.length > 0 && (
        <View style={styles.trayZone}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trayContent}
          >
            {capturedPages.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>{i + 1}</Text>
                </View>
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removePage(i)}
                  hitSlop={6}
                  disabled={processing}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove page ${i + 1}`}
                >
                  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 5 19 19M19 5 5 19" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.scanAllBtn, processing && styles.scanAllBtnDisabled]}
            onPress={handleProcessPages}
            activeOpacity={0.85}
            disabled={processing}
            accessibilityRole="button"
            accessibilityLabel={`Scan ${capturedPages.length} page${capturedPages.length > 1 ? 's' : ''}`}
          >
            <Text style={styles.scanAllText}>
              {processing
                ? 'Reading…'
                : `Scan ${capturedPages.length} page${capturedPages.length > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setTorchOn((v) => !v); }}
          activeOpacity={0.7}
          style={styles.bottomSideBtn}
          accessibilityRole="button"
          accessibilityLabel={torchOn ? 'Turn flash off' : 'Turn flash on'}
        >
          <FlashIcon active={torchOn} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureRing}
          onPress={handleCapture}
          activeOpacity={0.85}
          disabled={processing || !cameraReady}
          accessibilityRole="button"
          accessibilityLabel={capturedPages.length > 0 ? 'Add another page' : 'Take photo'}
        >
          <View style={[styles.captureBtn, (!cameraReady || processing) && styles.captureBtnDisabled]} />
          {capturedPages.length > 0 && (
            <View style={styles.captureCount}>
              <Text style={styles.captureCountText}>{capturedPages.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {capturedPages.length > 0 ? (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setCapturedPages([]); }}
            activeOpacity={0.7}
            style={styles.bottomSideBtn}
            disabled={processing}
            accessibilityRole="button"
            accessibilityLabel="Clear captured pages"
          >
            <Text style={[styles.bottomSideBtnText, { textAlign: 'right' }]}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleImport} activeOpacity={0.7} style={styles.bottomSideBtn}>
            <Text style={[styles.bottomSideBtnText, { textAlign: 'right' }]}>Import</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderDuplicateModal()}
      <Toast />
    </View>
  );
}

function ProcessingSpinner({ style, variant = 'dark' }: { style: any; variant?: 'dark' | 'light' }) {
  return <Animated.View style={[variant === 'light' ? styles.spinnerLight : styles.spinner, style]} />;
}

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5 19 19M19 5 5 19" stroke={Colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function FlashIcon({ active }: { active: boolean }) {
  const color = active ? Colors.primary : Colors.textSecondary;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill={color} />
      </Svg>
      <Text style={[styles.bottomSideBtnText, active && { color: Colors.primary }]}>
        {active ? 'On' : 'Off'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3,
  },
  topTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, letterSpacing: 0.2 },

  viewfinder: {
    flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 20,
    overflow: 'hidden', backgroundColor: Colors.darkSurface,
    borderWidth: 1, borderColor: Colors.border,
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 26, height: 26,
  },
  cornerTL: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderTopLeftRadius: 6 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderTopRightRadius: 6 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderBottomRightRadius: 6 },
  alignHint: {
    position: 'absolute', top: '48%', alignSelf: 'center',
    fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,0.45)', textAlign: 'center', width: 200,
  },
  offlineBanner: {
    position: 'absolute', top: 16, alignSelf: 'center',
    backgroundColor: 'rgba(20,20,40,0.9)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  offlineText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.warningMuted },
  shutterFlash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
  },
  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,17,27,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 15,
  },
  spinner: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 3.5, borderColor: 'rgba(255,255,255,0.18)',
    borderTopColor: Colors.primary,
  },
  spinnerLight: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 3.5, borderColor: Colors.border,
    borderTopColor: Colors.primary,
  },
  processingText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: '#fff' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 34, paddingTop: 6,
  },
  bottomSideBtn: { width: 78, alignItems: 'center' },
  bottomSideBtnText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  captureRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.primary },
  captureBtnDisabled: { backgroundColor: Colors.primary + '60' },
  captureCount: {
    position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.textPrimary, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, borderWidth: 2, borderColor: Colors.background,
  },
  captureCountText: { fontSize: 11, fontFamily: 'Manrope_800ExtraBold', color: '#fff' },

  // Captured-pages batch tray
  trayZone: { paddingTop: 2 },
  trayContent: { gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  thumbWrap: { width: 54, height: 72, position: 'relative' },
  thumb: {
    width: 54, height: 72, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  thumbBadge: {
    position: 'absolute', bottom: 3, left: 3, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(17,17,27,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  thumbBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: '#fff' },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.background,
  },
  scanAllBtn: {
    marginHorizontal: 16, marginBottom: 4, backgroundColor: Colors.primary,
    borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  scanAllBtnDisabled: { opacity: 0.6 },
  scanAllText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },

  permDeniedTitle: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, textAlign: 'center' },
  permDeniedSub: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
  importBtn: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center',
  },
  importBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  // Possible-duplicate confirmation modal — mirrors OnboardingExplainerSheet's
  // backdrop + centered card convention (Colors + Manrope tokens only).
  dupBackdrop: {
    flex: 1, backgroundColor: 'rgba(10,10,16,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  dupCard: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.background,
    borderRadius: 24, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 20,
  },
  dupTitle: {
    fontSize: 21, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -0.4, textAlign: 'center', marginBottom: 8,
  },
  dupSubtitle: {
    fontSize: 14.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    lineHeight: 21, textAlign: 'center', marginBottom: 16,
  },
  dupExisting: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
    alignItems: 'center',
  },
  dupVendor: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, textAlign: 'center' },
  dupDetail: { fontSize: 13.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 4 },
  dupPrimaryBtn: {
    width: '100%', backgroundColor: Colors.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  dupPrimaryText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
  dupSecondaryBtn: {
    width: '100%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  dupSecondaryText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  dupCancelBtn: { width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dupCancelText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
});
