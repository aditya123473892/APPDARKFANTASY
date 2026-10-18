import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import {
  isSessionCurrent,
  registerSessionTeardown,
  sessionIdentity,
} from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { serviceError, unwrap } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { acceptMessage } from '../services/chatState';
import type { BackendMessage } from '../services/chatPayload';
import type { ChatMedia } from '../types';
import { ChatPhotoViewer } from './ChatPhotoViewer';

export function ViewOnceAttachment({
  media,
  messageId,
  mine,
  viewedAt,
  viewDurationSeconds,
}: {
  media: ChatMedia;
  messageId: string;
  mine: boolean;
  viewedAt?: string;
  viewDurationSeconds?: number;
}): React.JSX.Element {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(viewDurationSeconds ?? 0);
  const [initialTime] = useState(() => Date.now());
  const request = useRef(0);
  const pending = useRef(false);
  const used = useRef(false);
  const loaded = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const unavailable = Boolean(
    viewedAt ||
    consumed ||
    (media.status && media.status !== 'active') ||
    (media.expiresAt && Date.parse(media.expiresAt) <= initialTime),
  );
  const mode = viewDurationSeconds ? `${viewDurationSeconds}s photo` : 'View-once photo';
  useScreenshotProtection(`chat-photo:${messageId}`, visible);

  const close = useCallback(() => {
    request.current++;
    controller.current?.abort();
    controller.current = null;
    pending.current = false;
    setUri(null);
    setVisible(false);
    setLoading(false);
    setDeadline(null);
  }, []);
  useEffect(() => {
    const unsubscribe = registerSessionTeardown(close);
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') close();
    });
    return () => {
      unsubscribe();
      listener.remove();
      close();
    };
  }, [close]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (!left) close();
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [deadline, close]);

  const open = async () => {
    // Refs block double taps before React has committed the loading state.
    if (mine || unavailable || pending.current || used.current) return;
    pending.current = true;
    loaded.current = false;
    const sequence = ++request.current;
    const scope = sessionIdentity.generation;
    const valid = () => request.current === sequence && isSessionCurrent(scope);
    const abort = new AbortController();
    controller.current = abort;
    setVisible(true);
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/chats/messages/${messageId}/media/${media._id}/open`,
        undefined,
        { signal: abort.signal, timeout: 60_000 },
      );
      if (!valid()) return;
      used.current = true;
      setConsumed(true);
      const value = unwrap<{ dataUri: string; message: BackendMessage }>(response.data);
      acceptMessage(value.message);
      if (
        typeof value.dataUri !== 'string' ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.dataUri)
      )
        throw new Error('Invalid photo response');
      // Only this component holds the bytes. No reusable URL or filesystem copy.
      setUri(value.dataUri);
    } catch (error) {
      if (!valid()) return;
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        used.current = true;
        setConsumed(true);
        toast.error('This photo was already opened or has expired.');
      } else toast.error(describeError(serviceError(error), 'Could not open this photo.'));
      close();
    } finally {
      if (valid()) pending.current = false;
    }
  };
  const onLoad = () => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(false);
    if (viewDurationSeconds) {
      setRemaining(viewDurationSeconds);
      setDeadline(Date.now() + viewDurationSeconds * 1000);
    }
  };
  const label = `${mode} · ${unavailable ? 'Opened or expired' : mine ? 'Not opened yet' : 'Tap to open'}`;
  const tint = mine ? theme.colors.onPrimary : theme.colors.text;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: mine || unavailable || loading }}
        disabled={mine || unavailable || loading}
        onPress={() => void open()}
        style={[styles.chip, { borderColor: tint, opacity: unavailable ? 0.6 : 1 }]}
      >
        <Ionicons
          name={viewDurationSeconds ? 'timer-outline' : 'radio-button-on'}
          size={20}
          color={tint}
        />
        <Text style={{ color: tint }}>{label}</Text>
      </Pressable>
      <ChatPhotoViewer
        visible={visible}
        uri={uri}
        loading={loading}
        label={
          viewDurationSeconds && !loading ? `${remaining}s remaining` : `${mode} · one opening`
        }
        onClose={close}
        onLoad={onLoad}
        onError={() => {
          toast.error('This photo could not be displayed.');
          close();
        }}
      />
    </>
  );
}
const styles = StyleSheet.create({
  chip: {
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
});
