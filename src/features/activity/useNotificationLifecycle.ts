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

export function useNotificationLifecycle(unlocked: boolean) {
  const owner = useAuthStore(s => s.currentUser?._id);
  const status = useAuthStore(s => s.status);
  const router = useRouter();
  const [pending, setPending] = useState<{ id: string; data: NotificationNavigation } | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    const subscriptions: { remove(): void }[] = [];
    void import('expo-notifications').then(async Notifications => {
      if (!alive) return;
      Notifications.setNotificationHandler({ handleNotification: async () => ({
        shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
      }) });
      const respond = (response: NotificationResponse | null) => {
        if (alive && response) setPending({ id: response.notification.request.identifier,
          data: response.notification.request.content.data as NotificationNavigation });
      };
      subscriptions.push(Notifications.addNotificationResponseReceivedListener(respond));
      subscriptions.push(Notifications.addNotificationReceivedListener(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['requests'] });
      }));
      respond(await Notifications.getLastNotificationResponseAsync());
    }).catch(() => undefined);
    return () => { alive = false; subscriptions.forEach(s => s.remove()); };
  }, []);
  useEffect(() => {
    if (!owner || status !== 'authenticated') return;
    const generation = sessionIdentity.generation;
    let alive = true;
    let registering = false, registered = false, asked = false;
    let tokenListener: { remove(): void } | undefined;
    const current = () => alive && generation === sessionIdentity.generation;
    const refresh = () => {
      if (!current() || AppState.currentState !== 'active') return;
      void connectSocket().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void register().catch(() => undefined);
    };
    refresh();
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    // Fallback for a missed event or a different API process. Paused in the background.
    const timer = setInterval(refresh, 60_000);
    async function register() {
      if (registered || registering || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return;
      registering = true;
      try {
      const Notifications = await import('expo-notifications');
      if (!current()) return;
      tokenListener ??= Notifications.addPushTokenListener(() => {
        registered = false;
        void register().catch(() => undefined);
      });
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('social', {
        name: 'Messages and follow requests', importance: Notifications.AndroidImportance.HIGH,
      });
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && !asked && permission.canAskAgain) {
        asked = true;
        permission = await Notifications.requestPermissionsAsync();
      }
      if (!permission.granted || !current()) return;
      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) return;
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!current()) return;
      await apiClient.put('/notifications/push-token', { token: result.data });
      if (current()) { rememberPushToken(result.data); registered = true; }
      } finally { registering = false; }
    }
    return () => { alive = false; app.remove(); clearInterval(timer); tokenListener?.remove(); };
  }, [owner, status]);
  useEffect(() => {
    if (!pending || !unlocked || status !== 'authenticated' || handled.current === pending.id) return;
    handled.current = pending.id;
    const target = !pending.data.recipientId || pending.data.recipientId === owner
      ? notificationTarget(pending.data) : undefined;
    setPending(null);
    if (target) router.push(target as Href);
    void import('expo-notifications').then(n => n.clearLastNotificationResponseAsync()).catch(() => undefined);
  }, [pending, unlocked, status, router, owner]);
}
