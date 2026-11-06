import { useScanQueue } from '../../components/ScanQueueProvider';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { ensureAiConsent } from '../../lib/aiConsent';
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Image, ScrollView, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

import { useNetworkState } from 'expo-network';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { createDraftInvoice, uploadInvoiceImages } from '../../lib/invoicePipeline';
import { useExtractionUsage } from '../../hooks/useExtractionUsage';
import Toast from '../../components/ui/Toast';

export default function ScanScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const operation = useRef(false);
  const { start: startScan } = useScanQueue();
  const [processingStep, setProcessingStep] = useState('Preparing photos');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { organization, isPersonal } = useWorkspace();
  const supabase = useSupabase();
  const network = useNetworkState();
  const cameraRef = useRef<CameraView>(null);
  const { remaining } = useExtractionUsage();
  const {
    scanStage, setScanStage,
    showToast,
  } = useStore();

  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Pages captured with the in-app camera, awaiting a single batch extraction.
  // Each shutter press appends one; "Scan N pages" runs the pipeline once over
  // all of them (same multi-image path the library import uses). Empty means
  // no batch in progress — the UI shows the plain single-shot affordances.
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const isOffline = network.isConnected === false || network.isInternetReachable === false;
  const processing = scanStage === 'processing';
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !processing });
    if (!processing) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    const timer = setInterval(() => setElapsed(startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0), 1000);
    return () => { back.remove(); clearInterval(timer); };
  }, [processing, startedAt, navigation]);
  const renderProcessing = () => (
    <Modal visible={processing} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.busyBackdrop} accessibilityViewIsModal>
        <View style={styles.busyCard} accessibilityLiveRegion="polite">
          <ProcessingSpinner variant="light" style={spinnerStyle} />
          <Text style={styles.busyTitle}>{processingStep}</Text>
          <Text style={styles.busyBody}>{elapsed >= 60 ? 'Still uploading. Keep Sift open until your photos are safely uploaded.' : 'Uploading your photos. You can continue using Sift as soon as the upload finishes.'}</Text>
          <Text style={styles.busyElapsed}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed · Timing varies by invoice</Text>
          <Text style={styles.busySteps}>Prepare → Upload · Smart Sift will read the details in your scan inbox.</Text>
        </View>
      </View>
    </Modal>
  );


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
    // boundary. `remaining` uses the active workspace’s plan allowance.
    if (remaining <= 0) {
      router.push('/paywall');
      return;
    }
    if (uris.length > 5) { showToast('Import up to 5 pages per invoice.'); return; }
    if (operation.current) return;
    operation.current = true;
    const capturedScope = useStore.getState().activeScope;
    // Upload before leaving the camera; extraction belongs to the app-level queue.
    let invoiceId: string | undefined;
    let jpegUris: string[] = [];
    try {
      // Photos from the library can come back as HEIC (Apple's default) or
      // other formats — Claude's vision API only accepts jpeg/png/gif/webp,
      // so every image is re-encoded to a guaranteed-real JPEG regardless of
      // source format before it ever gets uploaded.
      if (!(await ensureAiConsent(supabase))) return;
      setStartedAt(Date.now()); setElapsed(0); setProcessingStep('Preparing photos');
      setScanStage('processing');
      jpegUris = await Promise.all(
        uris.map(async (uri) => {
          const result = await manipulateAsync(uri, [{ resize: { width: 2000 } }], { compress: 0.85, format: SaveFormat.JPEG });
          return result.uri;
        })
      );
      setProcessingStep('Uploading invoice photos');
      invoiceId = await createDraftInvoice(supabase, organization.id);
      await uploadInvoiceImages(supabase, organization.id, invoiceId, jpegUris);
      if (useStore.getState().activeScope !== capturedScope) return;
      startScan(invoiceId);
      setScanStage('idle');
      router.replace({pathname:'/(tabs)/vendors',params:{view:'invoices'}});
    } catch (err: any) {
      // Uploaded drafts are recoverable from the inbox. Never delete an uncertain result.
      if (useStore.getState().activeScope === capturedScope) showToast(err?.message ?? 'Could not upload invoice. Please try again.');
    } finally {
      operation.current = false;
      if (useStore.getState().activeScope === capturedScope) setScanStage('idle');
    }
  };

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
  // away to the inbox after upload (this screen unmounts); on
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
    if (operation.current || processing) return;
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
            onPress={() => { if (!operation.current) router.back(); }}
            disabled={processing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan {isPersonal?'receipt':'invoice'}</Text>
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
        {renderProcessing()}
        <Toast />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { if (!operation.current) router.back(); }}
            disabled={processing}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CloseIcon />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan {isPersonal?'receipt':'invoice'}</Text>
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

      {renderProcessing()}
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
  busyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  busyCard: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 28, backgroundColor: Colors.background, alignItems: 'center', gap: 16 },
  busyTitle: { fontFamily: 'Manrope_700Bold', fontSize: 21, color: Colors.textPrimary, textAlign: 'center' },
  busyBody: { fontFamily: 'Manrope_400Regular', fontSize: 16, lineHeight: 24, color: Colors.textSecondary, textAlign: 'center' },
  busyElapsed: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: Colors.textPrimary, textAlign: 'center' },
  busySteps: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center' },

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
