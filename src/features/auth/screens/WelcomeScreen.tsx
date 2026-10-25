import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout';
import { Button, Text, Wordmark } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { APP_NAME } from '@/utils/constants';
import { getPrimaryLoginStrategy } from '../strategies/loginStrategies';

export function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const strategy = getPrimaryLoginStrategy();
  return (
    <Screen scroll style={styles.root}>
      <Wordmark large />
      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}>
          <Ionicons name="heart-outline" size={30} color={theme.colors.primary} />
        </View>
        <Text variant="title" center>
          Closer starts with a conversation.
        </Text>
        <Text color="muted" center>
          Thoughtful profiles, genuine conversations, and space to be yourself.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={strategy.id === 'invite_code' ? 'Enter invite code' : 'Sign in'}
          onPress={() => router.push(strategy.route)}
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/register')}
        />
        <Text variant="caption" color="muted" center>
          By continuing, you agree to {APP_NAME}'s Terms and Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  root: { paddingVertical: spacing.xxl, justifyContent: 'space-between', gap: spacing.xxl },
  hero: {
    flex: 1,
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actions: { gap: spacing.md },
});
