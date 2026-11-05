import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Header, Screen } from '@/components/layout';
import { Button, Chip, Text, TextField } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { SettingsGroup, SettingsRow } from '@/features/settings/components/SettingsRow';
import { SUPPORT_EMAIL } from '@/utils/constants';
import { spacing } from '@/theme';

const topics = [
  'Account & sign-in',
  'Premium & payments',
  'Safety or a report',
  'Privacy & my data',
  'Delete my account',
  'Bug or problem',
  'Something else',
] as const;

/** Contact support by email, with the topic and app details filled in for the team. */
export function SupportScreen(): React.JSX.Element {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const [topic, setTopic] = useState<(typeof topics)[number]>('Account & sign-in');
  const [message, setMessage] = useState('');
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const email = async () => {
    const details = [
      message.trim(),
      '',
      '---',
      `Topic: ${topic}`,
      `App version: ${version} (${Platform.OS} ${String(Platform.Version)})`,
      ...(userId ? [`Account ID: ${userId}`] : []),
    ].join('\n');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `DARKFANTASY support: ${topic}`,
    )}&body=${encodeURIComponent(details)}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(`No email app found. Write to us at ${SUPPORT_EMAIL}.`);
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    toast.success('Email address copied');
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Contact support" back backFallback={'/about' as Href} />
      <View style={styles.page}>
        <Text color="secondary">
          Our team usually replies within 2 business days. Never share your password or verification
          codes with anyone, including us.
        </Text>

        <View style={styles.block}>
          <Text variant="label">What do you need help with?</Text>
          <View style={styles.chips}>
            {topics.map((item) => (
              <Chip
                key={item}
                size="sm"
                label={item}
                selected={topic === item}
                onPress={() => setTopic(item)}
              />
            ))}
          </View>
        </View>
        <TextField
          label="Your message"
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us what happened and how we can help"
          multiline
          maxLength={2000}
        />
        <Button label="Email support" icon="mail-outline" onPress={() => void email()} />
        <Button
          label={`Copy ${SUPPORT_EMAIL}`}
          variant="ghost"
          icon="copy-outline"
          onPress={() => void copy()}
        />

        <SettingsGroup title="Quick help">
          {userId ? (
            <SettingsRow
              icon="flag-outline"
              title="My reports"
              subtitle="Check reports you have filed"
              onPress={() => router.push('/settings/my-reports' as Href)}
            />
          ) : null}
          <SettingsRow
            icon="trash-outline"
            title="Account deletion"
            onPress={() => router.push('/legal/account-deletion' as Href)}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            onPress={() => router.push('/legal/privacy' as Href)}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of use"
            onPress={() => router.push('/legal/terms' as Href)}
            last
          />
        </SettingsGroup>

        <Text variant="caption" color="muted">
          If you or someone else is in immediate danger, contact your local emergency services now.
          To report a member or post, use the menu on their profile, post or message.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg, paddingVertical: spacing.lg },
  block: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
