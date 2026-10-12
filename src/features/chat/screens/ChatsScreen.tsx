import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { Input, Skeleton, Text } from '@/components/ui';
import { mockChats } from '@/mocks/chats';
import { mockUsers } from '@/mocks/users';
import { ChatListItem } from '../components/ChatListItem';
import { EmptyState } from '@/components/feedback/EmptyState';
export function ChatsScreen(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const chats = useMemo(
    () =>
      mockChats.filter((chat) =>
        mockUsers
          .find((user) => user.id === chat.participantId)
          ?.name.toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search],
  );
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Messages</Text>
        <Text color="muted">Conversations worth staying up for.</Text>
      </View>
      <Input
        accessibilityLabel="Search messages"
        icon="search-outline"
        placeholder="Search"
        value={search}
        onChangeText={setSearch}
      />
      {false ? (
        <View style={styles.loading}>
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations"
              message="Your chats will appear here after a match."
            />
          }
          renderItem={({ item }) => {
            const user = mockUsers.find((candidate) => candidate.id === item.participantId);
            return user ? (
              <ChatListItem
                chat={item}
                user={user}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            ) : null;
          }}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { gap: 4, paddingVertical: 20 },
  list: { paddingVertical: 10, paddingBottom: 90 },
  loading: { gap: 12, paddingTop: 20 },
  skeleton: { height: 72 },
});
