import { Platform } from 'react-native';
// Use the native API available in clients that do not include ExpoMediaLibraryNext.
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FS from 'expo-file-system/legacy';
import { assertUnlocked, assertEpoch } from './lock';
import { viewPhoto } from './vaultService';
import { photoUri } from './media';
import { read, temporaryFile, removeTemp } from './files';
import { get } from './repository';
import { whileExternal } from '@/services/externalActivity';

import { dialog } from '@/components/ui/dialogStore';
function confirmExport(sharing: boolean): Promise<boolean> {
  return new Promise((resolve) =>
    dialog.alert(
      sharing ? 'Share outside Photo Vault?' : 'Download to phone?',
      sharing
        ? 'This will leave the vault. The receiving app can keep a copy.'
        : 'This will leave the vault and become visible in your gallery and to other apps. The vault copy stays.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: sharing ? 'Share' : 'Download', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function exportPhotos(owner: string, ids: string[], sharing = false): Promise<number> {
  const scope = assertUnlocked(owner);
  if (!(await confirmExport(sharing))) return 0;
  assertEpoch(owner, scope);
  // expo-media-library only saves without asking from Android 13 (API 33); before that it
  // refuses unless the storage write permission was granted, even on Android 11 and 12.
  if (
    !sharing &&
    (Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) < 33))
  ) {
    const permission = await whileExternal(() =>
      MediaLibrary.requestPermissionsAsync(true, ['photo', 'video']),
    );
    if (!permission.granted)
      throw new Error('Photo export permission was denied. Your vault copy is safe.');
  }
  if (sharing && !(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is unavailable on this device.');
  for (const id of ids) {
    assertEpoch(owner, scope);
    let source: string | undefined, normalized: string | undefined, output: string | undefined;
    try {
      // Makes sure a cloud-only item is downloaded; its viewing copy is not needed here.
      await removeTemp(await photoUri(owner, id));
      if ((await get(owner, id))?.kind === 'video') {
        // Videos leave the vault unchanged (no re-encode), after a native checksum check.
        output = await viewPhoto(owner, id);
        assertEpoch(owner, scope);
        // The share sheet is a system screen: keep the vault and this temporary file.
        if (sharing)
          await whileExternal(() =>
            Sharing.shareAsync(output!, { mimeType: 'video/mp4', dialogTitle: 'Share video' }),
          );
        else await whileExternal(() => MediaLibrary.saveToLibraryAsync(output!));
        continue;
      }
      source = await viewPhoto(owner, id);
      const context = ImageManipulator.manipulate(source);
      const rendered = await context.renderAsync();
      normalized = (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })).uri;
      const bytes = await read(normalized);
      try {
        output = await temporaryFile(bytes);
      } finally {
        bytes.fill(0);
      }
      assertEpoch(owner, scope);
      if (sharing)
        await whileExternal(() =>
          Sharing.shareAsync(output!, { mimeType: 'image/jpeg', dialogTitle: 'Share photo' }),
        );
      else await whileExternal(() => MediaLibrary.saveToLibraryAsync(output!));
    } finally {
      if (source) await removeTemp(source);
      if (output) await removeTemp(output);
      if (normalized && FS.cacheDirectory && normalized.startsWith(FS.cacheDirectory))
        await FS.deleteAsync(normalized, { idempotent: true });
    }
  }
  return ids.length;
}
