import { useEffect, useState } from 'react';
import { AppState, Alert, Image, View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Text, Button } from '@/components/ui';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useVaultLock } from '../lock';
import { viewPhoto, editPhoto, initializeVaultOwner } from '../vaultService';
import { list } from '../repository';
import { removeTemp } from '../files';
import { downloadPhoto } from '../sync';
import { exportPhotos } from '../export';

export function VaultViewer(): React.JSX.Element {
  useScreenshotProtection('vault-viewer');
  const { id } = useLocalSearchParams<{ id: string }>();
  const unlocked = useVaultLock((s) => s.unlocked);
  const [display, setDisplay] = useState<{ id: string; uri: string }>();
  const uri = display?.id === id ? display.uri : undefined;
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setActive(s === 'active');
      if (s !== 'active') setDisplay(undefined);
    });
    const unsubscribe = useVaultLock.subscribe((state) => {
      if (!state.unlocked) setDisplay(undefined);
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    let dead = false,
      path: string | undefined;
    if (unlocked && active)
      void initializeVaultOwner()
        .then(async (user) => {
          setOwner(user);
          const value = await viewPhoto(user, id);
          path = value;
          if (dead) await removeTemp(value);
          else setDisplay({ id, uri: value });
        })
        .catch(() => {
          if (!dead)
            setError('Photo is unavailable or damaged. Try downloading the cloud copy again.');
        });
    return () => {
      dead = true;
      if (path) void removeTemp(path);
    };
  }, [id, unlocked, active, revision]);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Private photo" back backFallback={'/vault' as Href} />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        {unlocked && active ? (
          <>
            {uri ? (
              <Image
                accessibilityLabel="Private photo"
                source={{ uri }}
                resizeMode="contain"
                style={{ flex: 1 }}
              />
            ) : (
              <Text>{error || 'Loading photo…'}</Text>
            )}
            {!uri && (
              <Button
                label="Download cloud copy"
                onPress={() =>
                  void downloadPhoto(owner, id)
                    .then(() => {
                      setError('');
                      setRevision((r) => r + 1);
                    })
                    .catch(() =>
                      setError('Download unavailable. Check your connection and sign in online.'),
                    )
                }
              />
            )}
            <Button
              label="Hide photo"
              onPress={() =>
                void editPhoto(owner, id, { hidden: 1 }).catch(() =>
                  setError('Could not hide photo.'),
                )
              }
            />
            <Button
              label="Export to Photos"
              disabled={!uri}
              onPress={() =>
                void exportPhotos(owner, [id]).catch(() =>
                  setError('Export failed. Your vault copy is safe. Check permissions or storage.'),
                )
              }
            />
            <Button
              label="Share"
              disabled={!uri}
              onPress={() =>
                void exportPhotos(owner, [id], true).catch(() =>
                  setError('Sharing failed. Your vault copy is safe.'),
                )
              }
            />
            <Button
              label="Move to first"
              onPress={() =>
                void (async () => {
                  const others = (await list(owner)).filter((p) => p.id !== id);
                  for (let i = 0; i < others.length; i++)
                    await editPhoto(owner, others[i]!.id, { sortOrder: i + 1 });
                  await editPhoto(owner, id, { sortOrder: 0 });
                })().catch(() => setError('Could not reorder photo.'))
              }
            />
            <Button
              label="Show in normal grid"
              onPress={() =>
                void editPhoto(owner, id, { hidden: 0 }).catch(() =>
                  setError('Could not show photo.'),
                )
              }
            />
            <Button
              label="Delete"
              onPress={() =>
                Alert.alert('Delete photo?', 'Cloud deletion will sync when online.', [
                  { text: 'Cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      void editPhoto(owner, id, { deletedAt: Date.now() })
                        .then(() => setDisplay(undefined))
                        .catch(() => setError('Could not delete photo.')),
                  },
                ])
              }
            />
          </>
        ) : (
          <Text>🔒 Return to Photo Vault to unlock.</Text>
        )}
      </View>
    </Screen>
  );
}
