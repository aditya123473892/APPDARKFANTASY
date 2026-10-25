import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Avatar, Text } from '@/components/ui';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const MAX_PEOPLE = 12;

/**
 * Discovery inside the feed: people from the existing discover query (shared cache with the
 * Discover tab). Renders nothing while loading, on error, or when there is nobody to show.
 */
export function PeopleStrip(): React.JSX.Element | null {
  const router = useRouter();
  const { theme } = useTheme();
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const { data } = useDiscoverProfiles();
  const people = data?.slice(0, MAX_PEOPLE) ?? [];
  if (!people.length) return null;
  return (
    <View style={[styles.root, { borderBottomColor: theme.colors.divider }]}>
      <View style={styles.header}>
        <Text variant="label">People to meet</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See everyone in Discover"
          hitSlop={10}
          onPress={() => router.push('/discover')}
        >
          <Text variant="label" color="primary">
            See all
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {people.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${person.name}'s profile`}
            onPress={() => router.push(`/profile/${person.id}`)}
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}
          >
            <Avatar
              uri={person.avatarUri}
              label={person.name}
              size={56}
              ring
              online={showPresence && Boolean(person.presence?.online)}
            />
            <Text variant="caption" color="secondary" numberOfLines={1} style={styles.name}>
              {person.name.split(/\s+/)[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  row: { gap: spacing.md, paddingRight: spacing.screen },
  person: { width: 68, alignItems: 'center', gap: spacing.xs },
  name: { maxWidth: 68 },
  pressed: { opacity: 0.7 },
});
