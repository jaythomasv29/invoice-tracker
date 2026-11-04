import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
const Surface=Animated.createAnimatedComponent(SafeAreaView);
/** A short native reveal complements navigation without moving safe-area content. */
export default function Screen(props:SafeAreaViewProps) {
 return <Surface {...props} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} />;
}
