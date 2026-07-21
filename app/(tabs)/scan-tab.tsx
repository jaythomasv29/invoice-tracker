// Placeholder — tab bar button overrides this to go to /scan modal
import { Redirect } from 'expo-router';
export default function ScanTab() {
  return <Redirect href="/scan" />;
}
