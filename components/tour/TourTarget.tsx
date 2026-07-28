import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTourTarget } from './TourProvider';

// Wraps a screen element so the product tour can measure and spotlight it.
// `collapsable={false}` keeps the View in the native tree on Android so
// measureInWindow returns real coordinates.
export function TourTarget({
  id, children, style,
}: { id: string; children: ReactNode; style?: ViewStyle }) {
  const { ref, onLayout } = useTourTarget(id);
  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={style}>
      {children}
    </View>
  );
}
