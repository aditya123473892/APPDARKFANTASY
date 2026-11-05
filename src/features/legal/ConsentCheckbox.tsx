import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { MINIMUM_AGE } from './legalContent';

/** Required at signup: confirms the person is an adult and accepts the Terms and Privacy Policy. */
export function ConsentCheckbox({
  checked,
  onChange,
  error,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled }}
          accessibilityLabel={`I am ${MINIMUM_AGE} or older and agree to the Terms of Use and Privacy Policy`}
          hitSlop={8}
          disabled={disabled}
          onPress={() => onChange(!checked)}
        >
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={24}
            color={
              error ? theme.colors.danger : checked ? theme.colors.primary : theme.colors.textMuted
            }
          />
        </Pressable>
        <Text color="secondary" style={styles.text} onPress={() => !disabled && onChange(!checked)}>
          I confirm I am {MINIMUM_AGE} or older and agree to the{' '}
          <Text
            color="primary"
            accessibilityRole="link"
            onPress={() => router.push('/legal/terms' as Href)}
          >
            Terms of Use
          </Text>{' '}
          and{' '}
          <Text
            color="primary"
            accessibilityRole="link"
            onPress={() => router.push('/legal/privacy' as Href)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export const CONSENT_REQUIRED = `Confirm you are ${MINIMUM_AGE} or older and accept the Terms to continue.`;

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, lineHeight: 22 },
});
