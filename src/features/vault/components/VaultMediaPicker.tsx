import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { Button, Modal, Text } from '@/components/ui';
import type { UploadAsset } from '@/features/feed/types';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { cleanupPickedAssets } from '@/services/api/photoUpload';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { useTheme } from '@/theme/useTheme';
import { assertEpoch, assertUnlocked, lock, unlock, useVaultLock } from '../lock';
import { initializeVaultOwner } from '../vaultService';
import * as repo from '../repository';
import { vaultError } from '../presentation';
import { selectVaultMedia, validateVaultSelection } from '../selectMedia';
import type { VaultPhoto } from '../types';
import { VaultPhotoTile } from './VaultPhotoTile';

export default function VaultMediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (assets: UploadAsset[]) => void;
  onClose: () => void;
}): React.JSX.Element {
  useScreenshotProtection('vault-media-picker');
  const { theme } = useTheme();
  const { owner: unlockedOwner, unlocked, revision } = useVaultLock();
  const [owner, setOwner] = useState<string>();
  const [photos, setPhotos] = useState<VaultPhoto[]>([]);
  const [selected, setSelected] = useState<VaultPhoto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  const selecting = useRef(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const ready = active && unlocked && unlockedOwner === owner;

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state !== 'active') setSelected([]);
    });
    const unsubscribe = useVaultLock.subscribe((state) => {
      if (!state.unlocked) setSelected([]);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      unsubscribe();
      lock();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await initializeVaultOwner();
      if (!active) return;
      if (sessionIdentity.userId !== current) throw new Error('Sign in to select vault media.');
      setOwner(current);
      const state = useVaultLock.getState();
      if (!state.unlocked || state.owner !== current) await unlock(current);
    })()
      .catch((cause: unknown) => {
        if (active) setError(vaultError(cause, 'Unable to open your vault. Try again.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready || !owner) return;
    let current = true;
    void (async () => {
      const scope = assertUnlocked(owner);
      const items = await repo.list(owner);
      assertEpoch(owner, scope);
      if (current) {
        setPhotos(items);
        setSelected((previous) =>
          previous.filter((item) => items.some((photo) => photo.id === item.id)),
        );
      }
    })().catch(() => {
      if (current) setError('Unable to load vault media. Try again.');
    });
    return () => {
      current = false;
    };
  }, [owner, ready, revision]);

  const confirm = async () => {
    if (!owner || !ready || selecting.current) return;
    selecting.current = true;
    setBusy(true);
    setError('');
    try {
      const assets = await selectVaultMedia(owner, selected);
      if (mounted.current) onSelect(assets);
      else await cleanupPickedAssets(assets);
    } catch (cause) {
      if (mounted.current) setError(vaultError(cause, 'Unable to prepare this media. Try again.'));
    } finally {
      selecting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Modal visible={!loading} title="Upload from vault" onClose={onClose}>
      {error ? <Text color="danger">{error}</Text> : null}
      {!ready ? (
        <Button
          label="Unlock vault"
          onPress={() => {
            setLoading(true);
            setError('');
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        <>
          <Text color="secondary">
            Choose up to five items, including at most one video. Only selected items will be copied
            out of your private vault for this upload.
          </Text>
          {!photos.length ? (
            <Text>Your vault is empty. Add photos or videos in Photo Vault first.</Text>
          ) : null}
          <View style={styles.grid} pointerEvents={busy ? 'none' : 'auto'}>
            {photos.map((photo) => (
              <VaultPhotoTile
                key={photo.id}
                owner={owner!}
                photo={photo}
                selecting
                selected={selected.some((item) => item.id === photo.id)}
                onLongPress={() => {}}
                onPress={() => {
                  const next = selected.some((item) => item.id === photo.id)
                    ? selected.filter((item) => item.id !== photo.id)
                    : [...selected, photo];
                  try {
                    if (next.length) validateVaultSelection(next);
                    setSelected(next);
                    setError('');
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : 'Unable to select this item.',
                    );
                  }
                }}
              />
            ))}
          </View>
          {busy ? <ActivityIndicator color={theme.colors.primary} /> : null}
          <Button
            label={`Upload from vault${selected.length ? ` (${selected.length})` : ''}`}
            disabled={!selected.length || busy}
            loading={busy}
            onPress={() => {
              void confirm();
            }}
          />
        </>
      )}
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap' } });
