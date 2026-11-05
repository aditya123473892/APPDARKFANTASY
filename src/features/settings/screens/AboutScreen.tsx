import { View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { BrandLogo } from '@/components/BrandLogo';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';

export function AboutScreen() {
  const router = useRouter();
  const open = (path: string) => router.push(path as Href);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="About DARKFANTASY" back backFallback="/welcome" />
      <View style={{ gap: spacing.xl, paddingVertical: spacing.xl }}>
        <BrandLogo size={88} wordmark />
        <Text center color="muted">
          Version {Constants.expoConfig?.version ?? '1.0.0'} · For adults 18+ only
        </Text>
        <SettingsGroup title="Information and support">
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            onPress={() => open('/legal/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of use"
            onPress={() => open('/legal/terms')}
          />
          <SettingsRow
            icon="help-circle-outline"
            title="Contact support"
            onPress={() => open('/legal/support')}
          />
          <SettingsRow
            icon="trash-outline"
            title="Account deletion information"
            onPress={() => open('/legal/account-deletion')}
            last
          />
        </SettingsGroup>
        <Text color="secondary">
          You can report posts or messages and block accounts from their menus. To request account
          deletion, open Settings, Account, then Delete account.
        </Text>
      </View>
    </Screen>
  );
}
