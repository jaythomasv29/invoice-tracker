import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';

// Branded pre-load screen shown while fonts load and while Clerk hydrates the
// session — bridges the gap between the native splash hiding and real app
// content, so there's never a blank frame. Uses the splash background color so
// the handoff from the native splash is seamless. Kept deliberately minimal
// (no wordmark/logo) until a final app icon/brand mark is settled.
export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ActivityIndicator size="small" color={Colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
