import { useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Screen } from '@/components/layout';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useAgeConsent } from './ageConsentStore';
import { MINIMUM_AGE } from './legalContent';

/** Shown on first launch: the app is only for adults. */
export function AgeGateScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const confirm = useAgeConsent((state) => state.confirm);
  const [underage, setUnderage] = useState(false);

  const accept = async () => {
    await confirm();
    router.replace('/');
  };
  const leave = () => {
    setUnderage(true);
    if (Platform.OS === 'android') BackHandler.exitApp();
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <BrandLogo size={80} />
          <View style={[styles.badge, { borderColor: theme.colors.primary }]}>
            <Text weight="bold" color="primary" style={styles.badgeText}>
              {MINIMUM_AGE}+
            </Text>
          </View>
          <Text serif center accessibilityRole="header" style={styles.title}>
            Adults only
          </Text>
          <Text color="secondary" center>
            DARKFANTASY contains mature themes, including conversations about sex, fantasies and
            intimacy. You must be {MINIMUM_AGE} or older to use this app.
          </Text>
        </View>

        {underage ? (
          <View style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Text weight="semibold" center>
              Sorry, DARKFANTASY is only for adults.
            </Text>
            <Text color="secondary" center>
              You can close the app now.
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label={`I am ${MINIMUM_AGE} or older`}
              onPress={() => void accept()}
              style={styles.pill}
            />
            <Button
              label={`I am under ${MINIMUM_AGE}`}
              variant="secondary"
              onPress={leave}
              style={styles.pill}
            />
            <Text variant="caption" color="muted" center>
              By continuing, you confirm you are at least {MINIMUM_AGE} years old and agree to our{' '}
              <Text
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={() => router.push('/legal/terms' as Href)}
              >
                Terms of Use
              </Text>{' '}
              and{' '}
              <Text
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={() => router.push('/legal/privacy' as Href)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  badge: {
    borderWidth: 2,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  badgeText: { fontSize: 22 },
  title: { fontSize: 36, lineHeight: 44 },
  actions: { gap: spacing.md },
  pill: { borderRadius: radius.full },
  notice: { gap: spacing.xs, padding: spacing.lg, borderRadius: radius.md },
});
