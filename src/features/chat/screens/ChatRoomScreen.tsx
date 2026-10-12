import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Header, KeyboardAvoidingScreen, Screen } from '@/components/layout';
import { Avatar, Text } from '@/components/ui';
import { mockChats, mockMessages, type Message } from '@/mocks/chats';
import { mockUsers } from '@/mocks/users';
import { ChatInput } from '../components/ChatInput';
import { DateDivider } from '../components/DateDivider';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
export function ChatRoomScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listRef = useRef<FlatList<Message>>(null);
  const chat = mockChats.find((item) => item.id === id) ?? mockChats[0]!;
  const user = mockUsers.find((item) => item.id === chat.participantId) ?? mockUsers[0]!;
  const initial = useMemo(
    () => mockMessages.filter((message) => message.chatId === chat.id),
    [chat.id],
  );
  const [messages, setMessages] = useState(initial);
  const send = (text: string): void => {
    setMessages((items) => [
      ...items,
      {
        id: `local-${Date.now()}`,
        chatId: chat.id,
        senderId: 'me',
        text,
        createdAt: new Date().toISOString(),
        status: 'sent',
      },
    ]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };
  return (
    <KeyboardAvoidingScreen>
      <Screen padded={false}>
        <View style={styles.header}>
          <Header title="" back />
          <View pointerEvents="none" style={styles.person}>
            <Avatar uri={user.avatarUri} label={user.name} online={chat.online} size={40} />
            <View>
              <Text weight="bold">{user.name}</Text>
              <Text variant="caption" color={chat.online ? 'primary' : 'muted'}>
                {chat.online ? 'Online now' : 'Recently active'}
              </Text>
            </View>
          </View>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={<DateDivider label="Today" />}
          ListFooterComponent={chat.typing ? <TypingIndicator name={user.name} /> : null}
          renderItem={({ item }) => <MessageBubble message={item} sent={item.senderId === 'me'} />}
        />
        <ChatInput onSend={send} />
      </Screen>
    </KeyboardAvoidingScreen>
  );
}
const styles = StyleSheet.create({
  header: { position: 'relative' },
  person: {
    position: 'absolute',
    left: 72,
    right: 60,
    top: 8,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  list: { padding: 16, gap: 10 },
});
