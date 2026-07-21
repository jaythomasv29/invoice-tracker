import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useStore } from '../../store/useStore';
import { Colors } from '../../constants/Colors';

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 10, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{toast}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 96, alignSelf: 'center',
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.textPrimary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
    zIndex: 100,
  },
  text: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#fff', textAlign: 'center' },
});
