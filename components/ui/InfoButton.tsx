import { TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';

// Small top-right "i" affordance that reopens a screen's onboarding explainer
// once real content has replaced the empty state.
export default function InfoButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={10}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="How this works"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={Colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 16v-4" />
        <Path d="M12 8h.01" />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
