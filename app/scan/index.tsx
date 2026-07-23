import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
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
import { createDraftInvoice, uploadInvoiceImages, extractInvoice } from '../../lib/invoicePipeline';
import { ExtractionLimitError } from '../../lib/entitlements';
import { useEntitlement } from '../../hooks/useEntitlement';
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
  const { isPro } = useEntitlement();
  const { remaining, refresh: refreshUsage } = useExtractionUsage();
  const {
    scanStage, setScanStage,
    setCurrentInvoice, showToast,
  } = useStore();

  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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

  // Multi-page support today means "select several photos of one invoice
  // from the library" (result.assets -> one invoice's pages). A true
  // multi-shot camera batch flow (fire the shutter N times, then process
  // once) is PRD 6.2 scope not built yet, so the live-shutter path always
  // produces a single-page invoice — the removed "Batch" toggle used to
  // imply otherwise without doing anything.
  const processImages = async (uris: string[]) => {
    if (!organization) {
      showToast('No restaurant selected');
      return;
    }
    // Client-side pre-check: free orgs already over the monthly cap go straight
    // to the paywall, so we don't waste an upload. The edge function enforces
    // the same limit server-side, so this is UX, not the security boundary.
    if (!isPro && remaining <= 0) {
      router.push('/paywall');
      return;
    }
    setScanStage('processing');
    try {
      // Photos from the library can come back as HEIC (Apple's default) or
      // other formats — Claude's vision API only accepts jpeg/png/gif/webp,
      // so every image is re-encoded to a guaranteed-real JPEG regardless of
      // source format before it ever gets uploaded.
      const jpegUris = await Promise.all(
        uris.map(async (uri) => {
          const result = await manipulateAsync(uri, [], { compress: 0.85, format: SaveFormat.JPEG });
          return result.uri;
        })
      );
      const invoiceId = await createDraftInvoice(supabase, organization.id);
      await uploadInvoiceImages(supabase, organization.id, invoiceId, jpegUris);
      const invoice = await extractInvoice(supabase, invoiceId);
      refreshUsage();
      setCurrentInvoice({ ...invoice, imageUris: jpegUris });
      router.replace('/scan/review');
    } catch (err: any) {
      // Server said the free cap is used up (e.g. a teammate extracted since we
      // loaded the meter) — send them to the paywall, not a dead-end toast.
      if (err instanceof ExtractionLimitError) {
        router.push('/paywall');
        return;
      }
      console.error('[scan] processImages failed:', err);
      showToast(err?.message ?? 'Could not process invoice');
    } finally {
      setScanStage('idle');
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashOpacity.value = withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 220 }));
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (!photo) return;
    await processImages([photo.uri]);
  };

  const handleImport = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      await processImages(result.assets.map((a) => a.uri));
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
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
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
        <Toast />
      </View>
    );
  }

  const processing = scanStage === 'processing';

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
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

        <Text style={styles.alignHint}>Align invoice within frame</Text>

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

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setTorchOn((v) => !v); }}
          activeOpacity={0.7}
          style={styles.bottomSideBtn}
        >
          <FlashIcon active={torchOn} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureRing}
          onPress={handleCapture}
          activeOpacity={0.85}
          disabled={processing || !cameraReady}
        >
          <View style={[styles.captureBtn, (!cameraReady || processing) && styles.captureBtnDisabled]} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleImport} activeOpacity={0.7} style={styles.bottomSideBtn}>
          <Text style={[styles.bottomSideBtnText, { textAlign: 'right' }]}>Import</Text>
        </TouchableOpacity>
      </View>

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

  permDeniedTitle: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, textAlign: 'center' },
  permDeniedSub: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
  importBtn: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center',
  },
  importBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
});
