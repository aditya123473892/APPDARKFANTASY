import type { NotificationResponse } from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { type Href, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { queryClient } from '@/services/queryClient';
import { connectSocket } from '@/features/chat/services/socketSession';
import { rememberPushToken } from './pushRegistration';
import { notificationTarget, type NotificationNavigation } from './notificationTarget';
import { usePushStatus, type PushState } from './pushStatus';
import { whileExternal } from '@/services/externalActivity';

export function useNotificationLifecycle(unlocked: boolean) {
  const owner = useAuthStore((s) => s.currentUser?._id);
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.session?.accessToken);
  const registrationRevision = usePushStatus((s) => s.revision);
  const router = useRouter();
  const [pending, setPending] = useState<{ id: string; data: NotificationNavigation } | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    const subscriptions: { remove(): void }[] = [];
    void import('expo-notifications')
      .then(async (Notifications) => {
        if (!alive) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        const respond = (response: NotificationResponse | null) => {
          if (alive && response)
            setPending({
              id: response.notification.request.identifier,
              data: response.notification.request.content.data as NotificationNavigation,
            });
        };
        subscriptions.push(Notifications.addNotificationResponseReceivedListener(respond));
        subscriptions.push(
          Notifications.addNotificationReceivedListener(() => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            void queryClient.invalidateQueries({ queryKey: ['requests'] });
          }),
        );
        respond(await Notifications.getLastNotificationResponseAsync());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      subscriptions.forEach((s) => s.remove());
    };
  }, []);
  useEffect(() => {
    if (!owner || status !== 'authenticated') return;
    const generation = sessionIdentity.generation;
    let alive = true;
    let registering = false,
      registeredAt = 0,
      asked = false,
      tokenChanged = false;
    let tokenListener: { remove(): void } | undefined;
    const current = () => alive && generation === sessionIdentity.generation;
    const report = (status: PushState, message: string) => {
      if (current()) usePushStatus.setState({ status, message });
    };
    const refresh = () => {
      if (!current() || AppState.currentState !== 'active') return;
      void connectSocket().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void register().catch(() => undefined);
    };
    refresh();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // Fallback for a missed event or a different API process. Paused in the background.
    const timer = setInterval(refresh, 60_000);
    async function register() {
      if (registering) return;
      if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
        report('unavailable', 'Phone notifications need an installed Android or iOS build.');
        return;
      }
      registering = true;
      try {
        const Notifications = await import('expo-notifications');
        if (!current()) return;
        tokenListener ??= Notifications.addPushTokenListener(() => {
          registeredAt = 0;
          if (registering) {
            tokenChanged = true;
            return;
          }
          void register().catch(() => undefined);
        });
        if (Platform.OS === 'android')
          await Notifications.setNotificationChannelAsync('social', {
            name: 'Messages and follow requests',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
          });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && !asked && permission.canAskAgain) {
          asked = true;
          permission = await whileExternal(() => Notifications.requestPermissionsAsync());
        }
        if (!current()) return;
        if (!permission.granted) {
          registeredAt = 0;
          report('denied', 'Notifications are turned off. Enable them in your phone settings.');
          return;
        }
        if (registeredAt && Date.now() - registeredAt < 15 * 60_000) {
          report('ready', 'Notifications are on for this phone.');
          return;
        }
        report('checking', 'Connecting notifications…');
        const projectId =
          Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          report(
            'unavailable',
            'Notifications are not configured in this app build. Install the latest version.',
          );
          return;
        }
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!current()) return;
        await apiClient.put('/notifications/push-token', { token: result.data });
        if (current()) {
          rememberPushToken(result.data);
          registeredAt = Date.now();
          report('ready', 'Notifications are on for this phone.');
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        report(
          /Firebase|google-services|SERVICE_NOT_AVAILABLE|Default FirebaseApp/i.test(message)
            ? 'unavailable'
            : 'error',
          /Firebase|google-services|Default FirebaseApp/i.test(message)
            ? 'Notifications are not configured in this app build. Install the latest version.'
            : 'Could not connect notifications. Check your connection and try again.',
        );
      } finally {
        registering = false;
        if (tokenChanged && current()) {
          tokenChanged = false;
          registeredAt = 0;
          void register();
        }
      }
    }
    return () => {
      alive = false;
      app.remove();
      clearInterval(timer);
      tokenListener?.remove();
    };
  }, [owner, status, accessToken, registrationRevision]);
  useEffect(() => {
    if (!pending || !unlocked || status !== 'authenticated' || handled.current === pending.id)
      return;
    handled.current = pending.id;
    const target =
      !pending.data.recipientId || pending.data.recipientId === owner
        ? notificationTarget(pending.data)
        : undefined;
    setPending(null);
    if (target) router.push(target as Href);
    void import('expo-notifications')
      .then((n) => n.clearLastNotificationResponseAsync())
      .catch(() => undefined);
  }, [pending, unlocked, status, router, owner]);
}
