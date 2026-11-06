import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/Colors';

/** A restrained system material for controls. Financial content stays opaque. */
export default function GlassSurface() {
  // Start opaque until accessibility preferences are known; never flash transparency.
  const [opaque, setOpaque] = useState(true);
  useEffect(() => {
    let mounted = true;
    let reduced = true;
    let contrast = true;
    const update = () => { if (mounted) setOpaque(reduced || contrast); };
    if (Platform.OS === 'ios') {
      void Promise.all([
        AccessibilityInfo.isReduceTransparencyEnabled(),
        AccessibilityInfo.isDarkerSystemColorsEnabled(),
      ]).then(([r, c]) => { reduced = r; contrast = c; update(); }).catch(() => {});
    }
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => { reduced = value; update(); });
    const darker = AccessibilityInfo.addEventListener('darkerSystemColorsChanged', value => { contrast = value; update(); });
    return () => { mounted = false; transparency.remove(); darker.remove(); };
  }, []);
  return <View pointerEvents="none" accessible={false} style={[styles.clip, opaque && styles.opaque]}>
    {!opaque && <BlurView tint="systemMaterialLight" intensity={70} style={StyleSheet.absoluteFill} />}
    {!opaque && <View style={[StyleSheet.absoluteFill, styles.wash]} />}
    <View style={[StyleSheet.absoluteFill, styles.edge]} />
  </View>;
}
const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, borderRadius: 9999, overflow: 'hidden' },
  opaque: { backgroundColor: Colors.surface },
  wash: { backgroundColor: 'rgba(245,245,240,0.45)' },
  edge: { borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
});
