import { useEffect, useRef, useState } from 'react';
import {
  sessionIdentity,
  isSessionCurrent,
  registerSessionTeardown,
} from '@/features/auth/sessionRuntime';
import { Pressable, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { RemoteMedia } from '@/components/ui/RemoteMedia';
import { toast } from '@/components/ui/Toast';
import { apiClient } from '@/services/api/apiClient';
import { unwrap, serviceError } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import type { ChatMedia } from '../types';
export function ChatAttachment({ media, messageId }: { media: ChatMedia; messageId: string }) {
  const mounted = useRef(true);
  const request = useRef(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now] = useState(() => Date.now());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const invalidate = () => {
      request.current++;
    };
    const clear = () => {
      invalidate();
      setUrl(null);
      setLoading(false);
    };
    const unsubscribe = registerSessionTeardown(clear);
    return () => {
      mounted.current = false;
      invalidate();
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!media.expiresAt) return;
    const remaining = Date.parse(media.expiresAt) - Date.now();
    if (remaining > 2147483647) return;
    const timer = setTimeout(
      () => {
        setUrl(null);
        setExpired(true);
      },
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [media.expiresAt]);
  const unavailable =
    (media.status && media.status !== 'active') ||
    expired ||
    (media.expiresAt && Date.parse(media.expiresAt) <= now);
  const open = async () => {
    if (loading || unavailable) return;
    const scope = sessionIdentity.generation;
    const sequence = ++request.current;
    const valid = () => mounted.current && request.current === sequence && isSessionCurrent(scope);
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/chats/messages/${messageId}/media/${media._id}/access-url`,
      );
      if (!valid()) return;
      const value = unwrap<{ url: unknown }>(response.data).url;
      if (typeof value !== 'string') return;
      const target = new URL(value);
      if (
        !['https:', ...(__DEV__ ? ['http:'] : [])].includes(target.protocol) ||
        target.username ||
        target.password
      )
        return;
      if (media.expiresAt && Date.parse(media.expiresAt) <= Date.now()) return;
      setUrl(value);
    } catch (error) {
      if (!valid()) return;
      toast.error(describeError(serviceError(error), 'This attachment is unavailable or expired.'));
    } finally {
      if (valid()) setLoading(false);
    }
  };
  return (
    <View style={{ gap: 8, marginTop: 8, maxWidth: '100%' }}>
      {url && !unavailable ? (
        <Pressable onPress={() => setUrl(null)} accessibilityLabel="Close attachment">
          <RemoteMedia uri={url} mimetype={media.mimetype} width={220} height={180} privateMedia />
        </Pressable>
      ) : (
        <Button
          label={
            unavailable
              ? 'Attachment unavailable'
              : media.mimetype?.startsWith('video/')
                ? 'Open video'
                : 'Open photo'
          }
          disabled={Boolean(unavailable)}
          loading={loading}
          size="sm"
          variant="secondary"
          onPress={() => void open()}
        />
      )}
      {media.originalname ? (
        <Text variant="caption" numberOfLines={1}>
          {media.originalname}
        </Text>
      ) : null}
    </View>
  );
}
