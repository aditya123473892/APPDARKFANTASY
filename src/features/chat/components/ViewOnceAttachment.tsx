import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
import { acceptMessage } from '../services/chatState';
import type { BackendMessage } from '../services/chatPayload';
import type { ChatMedia } from '../types';
import { ChatPhotoViewer } from './ChatPhotoViewer';
import { AttachmentCard } from './AttachmentCard';

export function ViewOnceAttachment({
  media,
  messageId,
  mine,
  viewedAt,
  viewDurationSeconds,
  deliveryStatus = 'sent',
}: {
  media: ChatMedia;
  messageId: string;
  mine: boolean;
  viewedAt?: string;
  viewDurationSeconds?: number;
  deliveryStatus?: string;
}): React.JSX.Element {
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
  const mode = viewDurationSeconds ? `View Once · ${viewDurationSeconds}s photo` : 'View Once · Photo';
  const sentLabel = deliveryStatus === 'sending' ? 'Sending' : deliveryStatus === 'uncertain' ? 'Delivery unconfirmed'
    : deliveryStatus === 'failed-definitive' ? 'Not sent' : 'Sent';
  // The sender can look at their own photo until it is opened, once the server has it.
  const previewable = mine && (deliveryStatus === 'sent' || deliveryStatus === 'read') && !unavailable;
  const timer = viewDurationSeconds ? `${viewDurationSeconds}s · ` : '';
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
    if ((mine && !previewable) || unavailable || pending.current || used.current) return;
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
      if (mine) {
        // Preview only: it never uses the recipient's opening.
        const response = await apiClient.post(
          `/chats/messages/${messageId}/media/${media._id}/preview`,
          undefined,
          { signal: abort.signal, timeout: 60_000 },
        );
        if (!valid()) return;
        const value = unwrap<{ dataUri: string }>(response.data);
        if (
          typeof value.dataUri !== 'string' ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.dataUri)
        )
          throw new Error('Invalid photo response');
        setUri(value.dataUri);
        return;
      }
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
        toast.error(
          mine
            ? 'This photo was opened or has expired, so it is gone.'
            : 'This photo was already opened or has expired.',
        );
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
    // The sender's preview has no countdown.
    if (viewDurationSeconds && !mine) {
      setRemaining(viewDurationSeconds);
      setDeadline(Date.now() + viewDurationSeconds * 1000);
    }
  };
  const opened = Boolean(viewedAt || consumed);
  const label = `${mode} · ${
    unavailable ? 'Opened or expired' : previewable ? 'Not opened yet · Tap to see your photo' : mine ? sentLabel : 'Tap to open'
  }`;
  const title = mine
    ? unavailable
      ? viewedAt ? 'Opened' : 'Photo gone'
      : previewable ? 'Your View Once photo' : `${sentLabel} photo · View Once`
    : unavailable ? (opened ? 'Opened photo' : 'Photo unavailable') : 'View Once · Photo';
  const description = mine
    ? unavailable
      ? viewedAt ? 'They opened it · The photo is gone' : 'Opened or expired · The photo is gone'
      : previewable ? `${timer}Not opened yet · Tap to see it` : `${timer}${sentLabel}`
    : unavailable
      ? (opened ? 'Opened · This photo cannot be opened again' : 'Expired · Photo unavailable')
      : `${timer}View once · Tap to open`;
  return (
    <>
      <AttachmentCard
        label={label}
        title={title}
        description={description}
        icon={
          unavailable ? 'checkmark-done' : previewable ? 'eye-outline' : viewDurationSeconds ? 'timer-outline' : 'eye-off-outline'
        }
        mine={mine}
        once
        loading={loading}
        disabled={(mine && !previewable) || unavailable || loading}
        onPress={() => void open()}
      />
      <ChatPhotoViewer
        reportTarget={mine ? undefined : { messageId, mediaId: media._id }}
        visible={visible}
        uri={uri}
        loading={loading}
        label={
          mine
            ? 'Only you see this preview · It does not use their view'
            : viewDurationSeconds && !loading ? `${remaining}s remaining` : `${mode} · one opening`
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
