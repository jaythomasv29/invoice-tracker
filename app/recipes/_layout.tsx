import { Redirect, Slot } from 'expo-router';
import { useWorkspace } from '../../lib/workspaceContext';
export default function BusinessRecipeLayout() {
  const { isPersonal } = useWorkspace();
  return isPersonal ? <Redirect href="/(tabs)" /> : <Slot />;
}
