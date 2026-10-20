import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Alert, Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Text, Button, IconButton } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useVaultLock, unlock } from '../lock';
import { editPhoto, initializeVaultOwner } from '../vaultService';
import { get } from '../repository';
import { photoUri } from '../media';
import { exportPhotos } from '../export';
import { vaultError } from '../presentation';
import type { VaultPhoto } from '../types';

export function VaultViewer(): React.JSX.Element {
  useScreenshotProtection('vault-viewer');
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = theme.colors;
  const { unlocked: lockOpen, revision, owner: unlockedOwner } = useVaultLock();
  const [owner, setOwner] = useState('');
  const [photo, setPhoto] = useState<VaultPhoto | null>(null);
  const [display, setDisplay] = useState<{ id: string; uri: string }>();
  const [error, setError] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [attempt, setAttempt] = useState(0);
  const repair = useRef(false);
  const [busy, setBusy] = useState(false);
  const unlocked = lockOpen && unlockedOwner === owner;
  const uri = unlocked && active && display?.id === id ? display.uri : undefined;

  useEffect(() => {
    let mounted = true;
    void initializeVaultOwner()
      .then((user) => {
        if (mounted) setOwner(user);
      })
      .catch(() => {
        if (mounted) setError('Sign in to open your vault.');
      });
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state !== 'active') {
        setDisplay(undefined);
        setPhoto(null);
      }
    });
    const unsubscribe = useVaultLock.subscribe((state) => {
      if (!state.unlocked) {
        setDisplay(undefined);
        setPhoto(null);
      }
    });
    return () => {
      mounted = false;
      sub.remove();
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!unlocked || !active) return;
    if (owner) {
      void (async () => {
        const row = await get(owner, id);
        if (cancelled) return;
        if (!row || row.deletedAt) throw new Error('Photo unavailable');
        setError('');
        setPhoto(row);
        const restore = repair.current;
        repair.current = false;
        const value = await photoUri(owner, id, restore);
        if (!cancelled) setDisplay({ id, uri: value });
      })().catch(() => {
        if (!cancelled) {
          setDisplay(undefined);
          setError('Couldn’t open this photo. Check your connection and try again.');
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [id, owner, unlocked, active, revision, attempt]);
  const run = async (work: () => Promise<unknown>, fallback: string) => {
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
  const remove = () =>
    Alert.alert(
      'Delete photo?',
      'This removes it from your vault on all devices. Exported copies will stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await editPhoto(owner, id, { deletedAt: Date.now() });
              if (router.canGoBack()) router.back();
              else router.replace('/vault' as Href);
            }, 'Couldn’t delete this photo. Try again.'),
        },
      ],
    );
  const more = () =>
    Alert.alert('Photo options', undefined, [
      {
        text: photo?.hidden ? 'Unhide photo' : 'Hide photo',
        onPress: () =>
          void run(
            () => editPhoto(owner, id, { hidden: photo?.hidden ? 0 : 1 }),
            'Couldn’t update this photo.',
          ),
      },
      { text: 'Delete photo', style: 'destructive', onPress: remove },
      { text: 'Cancel', style: 'cancel' },
    ]);
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header
        title="Private photo"
        back
        backFallback={'/vault' as Href}
        action={
          unlocked &&
          active && (
            <IconButton
              icon="ellipsis-horizontal"
              label="Photo options"
              onPress={more}
              disabled={!photo || busy}
            />
          )
        }
      />
      <View style={styles.content}>
        {!unlocked || !active ? (
          <View style={styles.center}>
            <Text variant="heading" center>
              Your photo is locked
            </Text>
            <Button
              label="Unlock"
              icon="finger-print"
              loading={busy}
              disabled={!owner}
              onPress={() => void run(() => unlock(owner), 'Couldn’t unlock. Please try again.')}
            />
          </View>
        ) : (
          <>
            <View style={[styles.image, { backgroundColor: colors.mediaBackground }]}>
              {uri ? (
                <Image
                  key={`${id}:${photo?.sha256}`}
                  accessibilityLabel="Private vault photo"
                  source={{ uri }}
                  resizeMode="contain"
                  style={StyleSheet.absoluteFill}
                  onError={() => {
                    setDisplay(undefined);
                    repair.current = true;
                    setError('Couldn’t open this photo. Try again to restore it.');
                  }}
                />
              ) : (
                <View style={styles.center}>
                  {!error && <ActivityIndicator size="large" color={colors.primaryText} />}
                  {!!error && (
                    <Button
                      label="Try again"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => {
                        setError('');
                        setAttempt((value) => value + 1);
                      }}
                    />
                  )}
                </View>
              )}
            </View>
            {photo?.hidden ? (
              <Text variant="caption" color="secondary" center>
                Hidden photo
              </Text>
            ) : null}
            {photo?.status === 'rejected' && (
              <Text color="danger" accessibilityRole="alert">
                This photo wasn’t accepted for backup. You can keep it here, export it or delete it.
              </Text>
            )}
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Button
                label="Share"
                icon="share-outline"
                variant="secondary"
                fullWidth={false}
                style={styles.grow}
                disabled={!uri || busy}
                onPress={() =>
                  void run(
                    () => exportPhotos(owner, [id], true),
                    'Couldn’t share this photo. Try again.',
                  )
                }
              />
              <Button
                label="Export"
                icon="download-outline"
                fullWidth={false}
                style={styles.grow}
                loading={busy}
                disabled={!uri}
                onPress={() =>
                  void run(
                    () => exportPhotos(owner, [id]),
                    'Couldn’t export. Check permissions and storage.',
                  )
                }
              />
            </View>
          </>
        )}
        {!!error && (
          <Text color="danger" accessibilityRole="alert" center>
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  grow: { flex: 1 },
  content: { flex: 1, gap: 12, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  image: { flex: 1, minHeight: 180, borderRadius: 16, overflow: 'hidden' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
