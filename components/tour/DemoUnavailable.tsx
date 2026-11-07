import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { useWorkspace } from '../../lib/workspaceContext';
import { Colors } from '../../constants/Colors';

// Detail screens that read database rows can't open sample-data items (their
// ids aren't real). Shown in place of the screen while the tour fixture is loaded.
export default function DemoUnavailable({ what }: { what: string }) {
  const router = useRouter();
  const { isPersonal } = useWorkspace();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sample data</Text>
      <Text style={styles.body}>{what} opens once you scan your own {isPersonal ? 'receipts' : 'invoices'}.</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.btn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export function useDemoMode() {
  return useStore((s) => s.demoMode);
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.background },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 20, color: Colors.textPrimary, marginBottom: 8 },
  body: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnText: { fontFamily: 'Manrope_700Bold', color: '#fff', fontSize: 15 },
});
