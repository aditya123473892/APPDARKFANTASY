import { Stack } from 'expo-router';
export default function AppLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
