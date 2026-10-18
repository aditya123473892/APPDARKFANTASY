import { useEffect, useState } from 'react';
import { AppState, Alert, FlatList, Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header } from '@/components/layout';
import { Text, Button } from '@/components/ui';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useVaultLock, unlock, lock, noDeviceLock, setLockTimeout } from '../lock';
import { addPhotos, editPhoto, initializeVaultOwner, viewPhoto } from '../vaultService';
import * as repo from '../repository';
import { removeTemp } from '../files';
import type { VaultPhoto } from '../types';
import { useVaultNetwork, retrySync } from '../sync';
import { exportPhotos } from '../export';

export function VaultScreen(): React.JSX.Element {
  useScreenshotProtection('vault', true, true);
  const router = useRouter();
  const network = useVaultNetwork();
  const { unlocked, revision } = useVaultLock();
  const [owner, setOwner] = useState('');
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const [hidden, setHidden] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vault operation failed.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void initializeVaultOwner()
      .then(setOwner)
      .catch(() => setError('Sign in online once before using Photo Vault.'));
    void noDeviceLock().then(setFallback);
    const sub = AppState.addEventListener('change', (s) => {
      setActive(s === 'active');
      if (s !== 'active') {
        setPhotos([]);
        setSelected([]);
      }
    });
    const unsubscribe = useVaultLock.subscribe((state) => {
      if (!state.unlocked) {
        setPhotos([]);
        setSelected([]);
      }
    });
    return () => {
      sub.remove();
      unsubscribe();
      lock();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (unlocked && owner && active)
      void repo
        .list(owner)
        .then((rows) => {
          if (!cancelled) setPhotos(rows);
        })
        .catch(() => setError('Could not read vault.'));
    return () => {
      cancelled = true;
    };
  }, [owner, unlocked, revision, active]);
  const remove = () =>
    Alert.alert(
      'Delete selected photos?',
      'Photos will disappear now. Cloud copies will be deleted when online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              for (const id of selected) await editPhoto(owner, id, { deletedAt: Date.now() });
              setSelected([]);
            }),
        },
      ],
    );
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Photo Vault" back backFallback="/settings" />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        {network.offline && (
          <Text accessibilityRole="alert">Offline — changes will sync when online.</Text>
        )}
        <Text>Photos stay outside your gallery until you export them.</Text>
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        {!unlocked || !active ? (
          <>
            <Text>🔒 Your photos are locked.</Text>
            {fallback && (
              <>
                <Text>Set up an Android screen lock to use Photo Vault.</Text>
              </>
            )}
            <Button
              label="Unlock vault"
              disabled={busy || !owner || fallback}
              onPress={() => void run(() => unlock(owner))}
            />
          </>
        ) : (
          <>
            <Button
              label={network.syncing ? 'Syncing…' : 'Sync / retry'}
              disabled={busy || network.syncing}
              onPress={() => void run(() => retrySync(owner))}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button fullWidth={false} label="Lock" onPress={lock} />
              <Button
                fullWidth={false}
                label={hidden ? 'Normal grid' : 'Show hidden'}
                onPress={() => setHidden(!hidden)}
              />
            </View>
            <Text>Hidden means hidden inside this app. New photos are hidden by default.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                fullWidth={false}
                label="Add photos"
                disabled={busy}
                onPress={() => void run(() => addPhotos(owner, false))}
              />
              <Button
                fullWidth={false}
                label="Camera"
                disabled={busy}
                onPress={() => void run(() => addPhotos(owner, true))}
              />
            </View>
            <Button
              label="Relock delay"
              onPress={() =>
                Alert.alert(
                  'Relock after backgrounding',
                  'Temporary images are cleared immediately with either setting.',
                  [
                    {
                      text: 'Immediately',
                      onPress: () => void run(() => setLockTimeout(owner, 0)),
                    },
                    {
                      text: 'After 30 seconds',
                      onPress: () => void run(() => setLockTimeout(owner, 30_000)),
                    },
                  ],
                )
              }
            />
            {!!selected.length && (
              <>
                <Button label={`Delete ${selected.length} selected`} onPress={remove} />
                <Button
                  label={hidden ? 'Show selected' : 'Hide selected'}
                  onPress={() =>
                    void run(async () => {
                      for (const id of selected)
                        await editPhoto(owner, id, { hidden: hidden ? 0 : 1 });
                      setSelected([]);
                    })
                  }
                />
                <Button label="Clear selection" onPress={() => setSelected([])} />
                <Button
                  label="Export selected"
                  disabled={busy}
                  onPress={() => void run(() => exportPhotos(owner, selected))}
                />
              </>
            )}
            <FlatList
              data={photos.filter((p) => Boolean(p.hidden) === hidden)}
              numColumns={3}
              keyExtractor={(p) => p.id}
              ListEmptyComponent={
                <Text>
                  {hidden
                    ? 'No hidden photos yet. Add a photo to get started.'
                    : 'No visible photos. New photos appear under Show hidden.'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Photo, ${item.syncState}${selected.includes(item.id) ? ', selected' : ''}`}
                  onLongPress={() =>
                    setSelected((s) =>
                      s.includes(item.id) ? s.filter((id) => id !== item.id) : [...s, item.id],
                    )
                  }
                  onPress={() =>
                    selected.length
                      ? setSelected((s) =>
                          s.includes(item.id) ? s.filter((id) => id !== item.id) : [...s, item.id],
                        )
                      : router.push({ pathname: '/vault/[id]', params: { id: item.id } })
                  }
                  style={{
                    width: '33.33%',
                    padding: 4,
                    borderWidth: selected.includes(item.id) ? 2 : 0,
                    borderColor: '#bd89d8',
                  }}
                >
                  <VaultThumbnail owner={owner} photo={item} />
                  <Text>{item.syncState}</Text>
                  {item.syncState === 'rejected' && (
                    <Text>Moderation rejected this photo. You can delete it.</Text>
                  )}
                </Pressable>
              )}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
function VaultThumbnail({ owner, photo }: { owner: string; photo: VaultPhoto }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let dead = false,
      path: string | undefined;
    if (photo.localPath)
      void viewPhoto(owner, photo.id)
        .then((value) => {
          path = value;
          if (dead) void removeTemp(value);
          else setUri(value);
        })
        .catch(() => undefined);
    return () => {
      dead = true;
      if (path) void removeTemp(path);
    };
  }, [owner, photo.id, photo.localPath]);
  return uri ? (
    <Image
      accessibilityLabel="Private vault photo"
      source={{ uri }}
      resizeMode="cover"
      style={{ width: '100%', aspectRatio: 1 }}
    />
  ) : (
    <View style={{ aspectRatio: 1, backgroundColor: '#35283c', justifyContent: 'center' }}>
      <Text>🔒 Photo</Text>
    </View>
  );
}
