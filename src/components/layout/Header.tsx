import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
export function Header({
  title,
  back = false,
  action,
}: {
  title: string;
  back?: boolean;
  action?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <View style={styles.base}>
      {back ? (
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.icon}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      ) : (
        <View style={styles.icon} />
      )}
      <Text variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.icon}>{action}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  base: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
});
