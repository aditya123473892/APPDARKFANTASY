import { useRouter, type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { ListRow, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { View } from 'react-native';

export default function HelpScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <Header title="Help" back backFallback="/profile" />
      <View style={{ gap: spacing.xl, paddingVertical: spacing.xl }}>
        <Text color="secondary">Find guidance, manage your privacy, or check a report.</Text>
        <View>
          <ListRow
            icon="sparkles-outline"
            title="Ask the app guide"
            onPress={() => router.push('/god-chat')}
          />
          <ListRow
            icon="shield-checkmark-outline"
            title="Privacy controls"
            onPress={() => router.push('/settings/privacy')}
          />
          <ListRow
            icon="flag-outline"
            title="My reports"
            onPress={() => router.push('/settings/my-reports')}
          />
          <ListRow
            icon="mail-outline"
            title="Contact support"
            onPress={() => router.push('/legal/support' as Href)}
          />
          <ListRow
            icon="shield-outline"
            title="Privacy policy"
            onPress={() => router.push('/legal/privacy' as Href)}
          />
          <ListRow
            icon="document-text-outline"
            title="Terms of use"
            onPress={() => router.push('/legal/terms' as Href)}
            divider={false}
          />
        </View>
      </View>
    </Screen>
  );
}
