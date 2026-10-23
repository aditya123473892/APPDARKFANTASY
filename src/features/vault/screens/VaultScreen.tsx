import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header } from '@/components/layout';
import { Text, Button, IconButton } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useVaultLock, unlock, lock, noDeviceLock, unlockMethod } from '../lock';
import type { UnlockMethod } from '../pin';
import { addPhotos, editPhoto, initializeVaultOwner } from '../vaultService';
import * as repo from '../repository';
import type { VaultPhoto } from '../types';
import { useVaultNetwork, retrySync } from '../sync';
import { exportPhotos } from '../export';
import { visiblePhotos, vaultError } from '../presentation';
import { VaultPhotoTile } from '../components/VaultPhotoTile';

export function VaultScreen(): React.JSX.Element {
  useScreenshotProtection('vault');
  const router = useRouter();
  const { theme } = useTheme();
  const colors = theme.colors;
  const offline = useVaultNetwork((s) => s.offline);
  const syncing = useVaultNetwork((s) => s.syncing);
  const { unlocked, revision, owner: unlockedOwner } = useVaultLock();
  const [owner, setOwner] = useState('');
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const [hidden, setHidden] = useState(false);
  const [noLock, setNoLock] = useState(false);
  const [method, setMethod] = useState<UnlockMethod>('device');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const canView = unlocked && unlockedOwner === owner && active && focused;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void noDeviceLock()
        .then(setNoLock)
        .catch(() => setNoLock(true));
      return () => setFocused(false);
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      if (owner)
        void unlockMethod(owner)
          .then(setMethod)
          .catch(() => undefined);
    }, [owner]),
  );
  const pinUnlock = method === 'pin';
  const addFromCamera = () =>
    Alert.alert('Camera', undefined, [
      {
        text: 'Take a photo',
        onPress: () =>
          void run(
            () => addPhotos(owner, 'camera'),
            'Couldn’t open the camera. Check camera permission.',
          ),
      },
      {
        text: 'Record a video',
        onPress: () =>
          void run(
            () => addPhotos(owner, 'video-camera'),
            'Couldn’t record a video. Check camera permission.',
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  useEffect(() => {
    let mounted = true;
    void initializeVaultOwner()
      .then((user) => {
        if (mounted) setOwner(user);
      })
      .catch(() => {
        if (mounted) setError('Sign in to open your vault.');
      });
    const clear = () => {
      setPhotos([]);
      setSelected([]);
      setLoading(true);
    };
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state !== 'active') clear();
    });
    const unsubscribe = useVaultLock.subscribe((state) => {
      if (!state.unlocked) clear();
    });
    return () => {
      mounted = false;
      sub.remove();
      unsubscribe();
      lock();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (canView && owner)
      void repo
        .list(owner)
        .then((rows) => {
          if (!cancelled) {
            setPhotos(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoading(false);
            setError('Couldn’t open your photos. Try again.');
          }
        });
    return () => {
      cancelled = true;
    };
  }, [owner, canView, revision]);

  const run = async (
    work: () => Promise<unknown>,
    fallback = 'Couldn’t complete that. Please try again.',
  ) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      setError(vaultError(cause, fallback));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const deleteSelected = () =>
    Alert.alert(
      `Delete ${selected.length === 1 ? 'item' : `${selected.length} items`}?`,
      'This removes them from your vault on all devices. Exported copies will stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              for (const id of selected) await editPhoto(owner, id, { deletedAt: Date.now() });
              setSelected([]);
            }, 'Couldn’t delete these photos. Try again.'),
        },
      ],
    );
  const allHidden =
    selected.length > 0 &&
    photos.filter((photo) => selected.includes(photo.id)).every((photo) => photo.hidden);
  const failed = photos.some((photo) => photo.syncState === 'failed');
  const backupError = photos.find((photo) => photo.syncState === 'failed')?.error;
  const pending = photos.filter(
    (photo) => photo.syncState !== 'synced' && photo.syncState !== 'rejected',
  ).length;
  const data = visiblePhotos(photos, hidden);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void retrySync(owner).finally(() => setRefreshing(false));
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header
        title={selected.length ? `${selected.length} selected` : 'Photo Vault'}
        back
        backFallback="/settings"
        action={
          canView && (
            <View style={styles.headerActions}>
              {!selected.length && (
                <IconButton
                  icon="settings-outline"
                  label="Vault security"
                  onPress={() => router.push('/vault/settings' as Href)}
                />
              )}
              <IconButton
                icon={selected.length ? 'close' : 'lock-closed-outline'}
                label={selected.length ? 'Clear selection' : 'Lock vault'}
                onPress={() => (selected.length ? setSelected([]) : lock())}
              />
            </View>
          )
        }
      />
      {!canView ? (
        <View style={styles.center}>
          <View style={[styles.lockIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="lock-closed-outline" size={34} color={colors.primaryText} />
          </View>
          <Text variant="title" center>
            Just for you
          </Text>
          <Text color="secondary" center>
            {pinUnlock
              ? 'Enter your vault PIN to see your private photos and videos.'
              : noLock
                ? 'Set up a screen lock on your phone, or open the vault with a PIN.'
                : 'Unlock to see your private photos and videos.'}
          </Text>
          {!!error && (
            <Text color="danger" center accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Button
            label={pinUnlock ? 'Enter PIN' : 'Unlock vault'}
            icon={pinUnlock ? 'keypad-outline' : 'finger-print'}
            loading={busy}
            disabled={!owner || (noLock && !pinUnlock)}
            onPress={() => void run(() => unlock(owner), 'Couldn’t unlock. Please try again.')}
            style={styles.unlock}
          />
        </View>
      ) : (
        <View style={styles.library}>
          <View style={styles.topLine}>
            <Text color="secondary" variant="caption">
              Only you can see these photos and videos
            </Text>
            {offline && (
              <View style={[styles.offline, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
                <Text variant="caption" color="muted">
                  Offline
                </Text>
              </View>
            )}
          </View>
          {pending > 0 && !failed && (
            <Text variant="caption" color="secondary" accessibilityLiveRegion="polite">
              {offline
                ? `${pending} photos waiting for connection`
                : syncing
                  ? `Backing up ${pending} photos…`
                  : `${pending} photos waiting for backup`}
            </Text>
          )}
          <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]}>
            {[false, true].map((hiddenOnly) => (
              <Pressable
                key={String(hiddenOnly)}
                accessibilityRole="tab"
                accessibilityState={{ selected: hidden === hiddenOnly }}
                onPress={() => {
                  setHidden(hiddenOnly);
                  setSelected([]);
                }}
                style={[
                  styles.tab,
                  hidden === hiddenOnly && { backgroundColor: colors.surfaceElevated },
                ]}
              >
                <Text variant="label" color={hidden === hiddenOnly ? 'default' : 'secondary'}>
                  {hiddenOnly
                    ? `Hidden · ${photos.filter((photo) => photo.hidden).length}`
                    : `All · ${photos.length}`}
                </Text>
              </Pressable>
            ))}
          </View>
          {!!error && (
            <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]}>
              <Text color="danger" accessibilityRole="alert" style={styles.grow}>
                {error}
              </Text>
              <IconButton icon="close" label="Dismiss message" onPress={() => setError('')} />
            </View>
          )}
          {failed && !offline && (
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.notice}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
              <Text variant="caption" color="secondary" style={styles.grow}>
                {backupError || 'Some photos could not be backed up.'}
              </Text>
              <Text variant="label" color="primary">
                Retry
              </Text>
            </Pressable>
          )}
          <FlatList
            data={data}
            numColumns={3}
            style={styles.grow}
            contentContainerStyle={styles.grid}
            keyExtractor={(photo) => photo.id}
            extraData={selected}
            refreshing={refreshing}
            onRefresh={refresh}
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={5}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator style={styles.empty} color={colors.primaryText} />
              ) : (
                <View style={styles.empty}>
                  <Ionicons
                    name={hidden ? 'eye-off-outline' : 'images-outline'}
                    size={44}
                    color={colors.textMuted}
                  />
                  <Text variant="heading" center>
                    {hidden ? 'Nothing hidden' : 'Your private collection'}
                  </Text>
                  <Text color="secondary" center>
                    {hidden
                      ? 'Hide a photo or video from its menu to keep it here.'
                      : 'Add photos and videos from your phone, or use the camera.'}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <VaultPhotoTile
                owner={owner}
                photo={item}
                selected={selected.includes(item.id)}
                selecting={selected.length > 0}
                onLongPress={() => toggle(item.id)}
                onPress={() =>
                  selected.length
                    ? toggle(item.id)
                    : router.push({
                        pathname: '/vault/[id]',
                        params: { id: item.id },
                      } as unknown as Href)
                }
              />
            )}
          />
          {selected.length ? (
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Button
                label={allHidden ? 'Unhide' : 'Hide'}
                icon={allHidden ? 'eye-outline' : 'eye-off-outline'}
                variant="secondary"
                fullWidth={false}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    for (const id of selected)
                      await editPhoto(owner, id, { hidden: allHidden ? 0 : 1 });
                    setSelected([]);
                  })
                }
                style={styles.grow}
              />
              <IconButton
                icon="download-outline"
                label="Export selected items"
                disabled={busy}
                onPress={() =>
                  void run(
                    () => exportPhotos(owner, selected),
                    'Couldn’t export. Check permissions and storage.',
                  )
                }
              />
              <IconButton
                icon="trash-outline"
                label="Delete selected items"
                disabled={busy}
                onPress={deleteSelected}
              />
            </View>
          ) : (
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Button
                label="Add photos & videos"
                icon="add"
                fullWidth={false}
                loading={busy}
                style={styles.grow}
                onPress={() =>
                  void run(() => addPhotos(owner), 'Couldn’t add these items. Please try again.')
                }
              />
              <IconButton
                icon="camera-outline"
                label="Take a photo or video"
                filled
                disabled={busy}
                onPress={addFromCamera}
              />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  grow: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  library: { flex: 1, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  lockIcon: {
    width: 88,
    height: 88,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  unlock: { marginTop: 12, maxWidth: 320 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  grid: { flexGrow: 1, paddingBottom: 12 },
  empty: {
    flex: 1,
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
