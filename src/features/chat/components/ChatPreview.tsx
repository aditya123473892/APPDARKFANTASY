import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar, Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { mockSocialUsers } from '@/features/feed/mockSocial';
import { DateDivider } from './DateDivider';
import { MessageBubble } from './MessageBubble';
import { AttachmentCard } from './AttachmentCard';
import { ChatInput } from './ChatInput';
import { ChatPhotoViewer } from './ChatPhotoViewer';
import type { ChatMessage } from '../hooks/useChat';

/** Isolated presentation preview. Sending and opening photos never call the backend. */
export function ChatPreview() {
  const { theme } = useTheme();
  const [opened, setOpened] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'chat-preview-1',
      conversationId: 'preview',
      senderId: 'preview-peer',
      text: 'A quieter corner of the internet. How was your day?',
      createdAt: new Date().toISOString(),
      status: 'read',
      local: false,
    },
    {
      id: 'chat-preview-2',
      conversationId: 'preview',
      senderId: 'preview-me',
      text: 'Better now ✨ Taking the scenic route home.',
      createdAt: new Date().toISOString(),
      status: 'read',
      local: false,
    },
    {
      id: 'chat-preview-3',
      conversationId: 'preview',
      senderId: 'preview-peer',
      text: 'Sending you a little moment from today.',
      createdAt: new Date().toISOString(),
      status: 'sent',
      local: false,
    },
  ]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chatBackground }}>
      <View
        style={{
          padding: spacing.md,
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Avatar uri={mockSocialUsers[0]!.avatarUri} label="Maya" size={44} />
        <View>
          <Text weight="semibold" style={{ fontSize: 16 }}>
            Maya Chen
          </Text>
          <Text variant="caption" weight="regular" color="muted">
            Preview conversation
          </Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        <DateDivider label="Today" />
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={message.senderId === 'preview-me'}
            first
            last
            group={false}
            onRetry={() => {}}
            onResync={() => {}}
            onActions={() => {}}
          />
        ))}
        <View
          style={{
            alignSelf: 'flex-start',
            padding: spacing.sm,
            borderRadius: 18,
            backgroundColor: theme.colors.bubbleIn,
          }}
        >
          <AttachmentCard
            title={opened ? 'Opened photo' : 'Photo'}
            description={opened ? 'This photo cannot be opened again' : 'View once · Tap to open'}
            label="Open mock view-once photo"
            icon={opened ? 'checkmark-done' : 'eye-off-outline'}
            once
            disabled={opened}
            onPress={() => {
              setOpened(true);
              setLoading(true);
              setViewing(true);
            }}
          />
        </View>
      </ScrollView>
      <ChatInput
        bottomInset={0}
        canSendMessages
        onSend={(text) =>
          setMessages((current) => [
            ...current,
            {
              id: `chat-preview-${Date.now()}`,
              conversationId: 'preview',
              senderId: 'preview-me',
              text,
              status: 'sent',
              local: false,
              createdAt: new Date().toISOString(),
            },
          ])
        }
      />
      <ChatPhotoViewer
        visible={viewing}
        uri={
          viewing
            ? 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1080&q=85'
            : null
        }
        loading={loading}
        label="View once · Preview photo"
        onClose={() => setViewing(false)}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setViewing(false);
        }}
      />
    </View>
  );
}
