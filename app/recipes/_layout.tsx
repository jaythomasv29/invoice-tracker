import { Redirect, Slot } from "expo-router";
import { useWorkspace } from "../../lib/workspaceContext";
import { useEntitlement } from "../../hooks/useEntitlement";
export default function BusinessRecipeLayout() {
  const { isPersonal } = useWorkspace();
  const { isPaid } = useEntitlement();
  return isPersonal ? (
    <Redirect href="/(tabs)" />
  ) : !isPaid ? (
    <Redirect href="/paywall" />
  ) : (
    <Slot />
  );
}
