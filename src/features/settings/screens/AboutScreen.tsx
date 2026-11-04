import { Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { Header, Screen } from '@/components/layout';
import { BrandLogo } from '@/components/BrandLogo';
import { Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { publicPageUrl, type PublicPage } from '@/config/publicPages';
import { spacing } from '@/theme';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';

export function AboutScreen() {
  const open = async (page: PublicPage) => {
    const url = publicPageUrl(page);
    if (!url) {
      toast.error('This page is unavailable right now. Please try again later.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Could not open this page. Please try again.');
    }
  };
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="About DARKFANTASY" back backFallback="/welcome" />
      <View style={{ gap: spacing.xl, paddingVertical: spacing.xl }}>
        <BrandLogo size={88} wordmark />
        <Text center color="muted">
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        <SettingsGroup title="Information and support">
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            external
            onPress={() => void open('privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of use"
            external
            onPress={() => void open('terms')}
          />
          <SettingsRow
            icon="help-circle-outline"
            title="Contact support"
            external
            onPress={() => void open('support')}
          />
          <SettingsRow
            icon="trash-outline"
            title="Account deletion information"
            external
            onPress={() => void open('deletion')}
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
