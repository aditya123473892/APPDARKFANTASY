import { useState } from 'react';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { SettingsRow } from '../components/SettingsRow';
export function PrivacyScreen(): React.JSX.Element {
  const [distance, setDistance] = useState(true);
  const [activity, setActivity] = useState(true);
  const [readReceipts, setReadReceipts] = useState(false);
  return (
    <Screen>
      <Header title="Privacy" back />
      <Text variant="label" color="muted">
        YOUR VISIBILITY
      </Text>
      <SettingsRow
        icon="navigate-outline"
        title="Show approximate distance"
        value={distance}
        onValueChange={setDistance}
      />
      <SettingsRow
        icon="pulse-outline"
        title="Show active status"
        value={activity}
        onValueChange={setActivity}
      />
      <SettingsRow
        icon="checkmark-done-outline"
        title="Read receipts"
        value={readReceipts}
        onValueChange={setReadReceipts}
      />
      <SettingsRow
        icon="ban-outline"
        title="Blocked profiles"
        subtitle="Review people you have blocked"
        onPress={() => undefined}
      />
    </Screen>
  );
}
