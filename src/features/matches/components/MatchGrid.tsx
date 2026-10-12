import { FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Match } from '@/mocks/matches';
import type { User } from '@/features/auth/types';
import { MatchCard } from './MatchCard';
export function MatchGrid({
  matches,
  users,
}: {
  matches: Match[];
  users: User[];
}): React.JSX.Element {
  const router = useRouter();
  return (
    <FlatList
      data={matches}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
      renderItem={({ item }) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        return user ? (
          <MatchCard
            user={user}
            isNew={item.isNew}
            onPress={() => router.push(`/profile/${user.id}`)}
          />
        ) : null;
      }}
    />
  );
}
const styles = StyleSheet.create({ list: { gap: 12 }, row: { gap: 12 } });
