import { Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../store/useStore';
import { Colors } from '../../constants/Colors';
import { markTourSeen } from '../../lib/tourFlag';
import { useTour } from './TourProvider';

// Persistent "you're viewing sample data" pill, shown once the guided overlay
// is dismissed (via Skip) but the demo fixture is still loaded, so the user can
// explore freely and exit when ready. Hidden while the tour overlay is active
// (it covers the screen anyway).
export default function DemoBanner() {
  const demoMode = useStore((s) => s.demoMode);
  const endDemo = useStore((s) => s.endDemo);
  const { active } = useTour();
  const insets = useSafeAreaInsets();

  if (!demoMode || active) return null;

  const exit = () => {
    Haptics.selectionAsync();
    markTourSeen();
    endDemo();
  };

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[styles.wrap, { bottom: 84 + insets.bottom }]}>
      <Pressable style={styles.pill} onPress={exit}>
        <Text style={styles.text}>Sample data</Text>
        <Text style={styles.exit}>Tap to exit ›</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 90 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.textPrimary, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  text: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#fff' },
  exit: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primaryMuted },
});
