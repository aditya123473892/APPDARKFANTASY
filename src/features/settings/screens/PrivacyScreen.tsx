import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { usePreferences } from '../store/preferencesStore';

export function PrivacyScreen(): React.JSX.Element {
  const showDistance = usePreferences((state) => state.showDistance);
  const showActiveStatus = usePreferences((state) => state.showActiveStatus);
  const readReceipts = usePreferences((state) => state.readReceipts);
  const set = usePreferences((state) => state.set);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Privacy" back backFallback="/settings" />
      <View style={styles.content}>
        <SettingsGroup title="Your visibility">
          <SettingsRow
            icon="navigate-outline"
            title="Show approximate distance"
            subtitle="Show distance on profiles instead of only neighbourhoods"
            value={showDistance}
            onValueChange={(value) => set('showDistance', value)}
          />
          <SettingsRow
            icon="pulse-outline"
            title="Show active status"
            subtitle="When off, you also won't see when others are online"
            value={showActiveStatus}
            onValueChange={(value) => set('showActiveStatus', value)}
          />
          <SettingsRow
            icon="checkmark-done-outline"
            title="Read receipts"
            subtitle="When off, you also won't see when your messages are read"
            value={readReceipts}
            onValueChange={(value) => set('readReceipts', value)}
            last
          />
        </SettingsGroup>
        <Text variant="caption" color="muted" style={styles.note}>
          These settings are saved on this device. Active status and read receipts work both ways so
          nobody sees more than they share.
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingVertical: spacing.lg },
  note: { paddingHorizontal: spacing.xs },
});
