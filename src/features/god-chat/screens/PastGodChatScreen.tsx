import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { describeError } from '@/services/errors';
import { spacing } from '@/theme';
import { GodChatBubble } from '../components/GodChatBubble';
import { loadPastGodChat } from '../godChatService';

/** A read-only transcript of one of the member's past chats. */
export function PastGodChatScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useQuery({
    queryKey: ['god-chat-past', id],
    queryFn: () => loadPastGodChat(id),
    enabled: Boolean(id),
  });
  const started = session.data?.createdAt ? new Date(session.data.createdAt).toLocaleString() : '';
  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Header
          title="Past chat"
          subtitle={started ? `Started ${started}` : undefined}
          back
          backFallback={'/god-history' as Href}
        />
      </View>
      {session.isPending ? (
        <ActivityIndicator style={styles.empty} />
      ) : session.isError || !session.data ? (
        <View style={styles.empty}>
          <Text color="danger" center>
            {session.isError ? describeError(session.error) : 'This chat could not be found.'}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => void session.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={session.data.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <GodChatBubble
              message={item}
              mine={item.role === 'user'}
              label={
                item.role === 'assistant'
                  ? item.by === 'staff'
                    ? 'DARKFANTASY team'
                    : 'God'
                  : undefined
              }
            />
          )}
          ListFooterComponent={
            session.data.open === false ? (
              <Text variant="caption" color="muted" center style={styles.footer}>
                This chat has ended. Start a new one from Chat with God.
              </Text>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.screen },
  list: { padding: spacing.screen, gap: spacing.md },
  footer: { marginTop: spacing.md },
  empty: { marginTop: spacing.huge, gap: spacing.md, alignItems: 'center' },
});
