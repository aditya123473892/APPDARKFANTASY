import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useVaultNetwork } from '@/features/vault/sync';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
export default function VaultLayout() {
  const offline = useVaultNetwork((s) => s.offline);
  return (
    <View style={{ flex: 1 }}>
      {offline && <OfflineBanner message="Offline. Vault changes are saved on this device." />}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
