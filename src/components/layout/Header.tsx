import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** Goes back when there is history, otherwise replaces with a sensible parent (e.g. after a deep link). */
export function useSafeBack(fallback: Href = '/home'): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}

export function Header({
  title,
  subtitle,
  back = false,
  backFallback,
  action,
  content,
  onBack,
  align = 'left',
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  backFallback?: Href;
  action?: React.ReactNode;
  content?: React.ReactNode;
  onBack?: () => void;
  align?: 'center' | 'left';
}): React.JSX.Element {
  const { theme } = useTheme();
  const goBack = useSafeBack(backFallback);
  return (
    <View style={styles.base}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={6}
          onPress={onBack ?? goBack}
          style={({ pressed }) => [
            styles.icon,
            pressed && { backgroundColor: theme.colors.surfacePressed },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      ) : align === 'center' ? (
        <View style={styles.icon} />
      ) : null}
      <View style={[styles.titleWrap, align === 'left' && styles.left]}>
        {content ?? (
          <>
            <Text
              variant={align === 'left' ? 'title' : 'subheading'}
              numberOfLines={1}
              accessibilityRole="header"
              center={align === 'center'}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                variant="caption"
                color="secondary"
                numberOfLines={1}
                center={align === 'center'}
              >
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={[styles.icon, styles.action]}>{action}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: spacing.header, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignItems: 'flex-end' },
  titleWrap: { flex: 1, justifyContent: 'center' },
  left: { minWidth: 0 },
});
