import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { RemoteMedia } from '@/components/ui/RemoteMedia';
import { toast } from '@/components/ui/Toast';
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
import type { ChatMedia } from '../types';

const CAPTURE_KEY = 'view-once';

/**
 * A photo or video the recipient can open once. The server issues a single
 * short-lived URL and refuses any further request; nothing is cached here.
 * Screenshots and screen recordings cannot be fully prevented on every device.
 */
export function ViewOnceAttachment({
  media,
  messageId,
  mine,
  viewedAt,
}: {
  media: ChatMedia;
  messageId: string;
  mine: boolean;
  viewedAt?: string;
}): React.JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mounted = useRef(true);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const video = Boolean(media.mimetype?.startsWith('video/'));
  const kind = video ? 'video' : 'photo';
  const opened = Boolean(viewedAt) || consumed || (media.status && media.status !== 'active');
  useScreenshotProtection(CAPTURE_KEY, Boolean(url));

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = registerSessionTeardown(() => setUrl(null));
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const open = async () => {
    if (mine || opened || loading) return;
    const scope = sessionIdentity.generation;
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/chats/messages/${messageId}/media/${media._id}/access-url`,
      );
      if (!mounted.current || !isSessionCurrent(scope)) return;
      const value = unwrap<{ url: unknown }>(response.data).url;
      setConsumed(true);
      if (typeof value !== 'string') return;
      const target = new URL(value);
      if (
        !['https:', ...(__DEV__ ? ['http:'] : [])].includes(target.protocol) ||
        target.username ||
        target.password
      )
        return;
      setUrl(value);
    } catch (error) {
      if (!mounted.current || !isSessionCurrent(scope)) return;
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        setConsumed(true);
        toast.error(`This ${kind} was already opened.`);
      } else {
        toast.error(describeError(serviceError(error), `This ${kind} is unavailable.`));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const label = mine
    ? `View-once ${kind} · ${opened ? 'Opened' : 'Not opened yet'}`
    : opened
      ? 'Opened'
      : `View once ${kind}`;
  const tint = mine ? theme.colors.onPrimary : theme.colors.text;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          !mine && !opened ? `Opens the ${kind}. It can only be viewed once.` : undefined
        }
        accessibilityState={{ disabled: mine || Boolean(opened) }}
        disabled={mine || Boolean(opened) || loading}
        onPress={() => void open()}
        style={[styles.chip, { borderColor: tint, opacity: opened && !mine ? 0.6 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Ionicons name={opened ? 'radio-button-off' : 'radio-button-on'} size={18} color={tint} />
        )}
        <Text style={{ color: tint }}>{label}</Text>
      </Pressable>
      <Modal
        visible={Boolean(url)}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setUrl(null)}
      >
        <View
          style={[
            styles.viewer,
            {
              backgroundColor: theme.colors.mediaBackground,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {url ? (
            <RemoteMedia
              uri={url}
              mimetype={media.mimetype}
              width={width}
              height={height - insets.top - insets.bottom - 72}
              privateMedia
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${kind}`}
            onPress={() => setUrl(null)}
            style={styles.close}
          >
            <Ionicons name="close" size={22} color={theme.colors.onImage} />
            <Text style={{ color: theme.colors.onImage }}>Close · it can't be opened again</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginTop: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  viewer: { flex: 1, justifyContent: 'center' },
  close: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
