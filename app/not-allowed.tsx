import { spacing } from '@/theme';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text } from '@/components/ui';
export default function NotAllowed() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Text>You are not permitted to access this screen.</Text>
      <Button label="Go home" onPress={() => router.replace('/home')} />
    </View>
  );
}
