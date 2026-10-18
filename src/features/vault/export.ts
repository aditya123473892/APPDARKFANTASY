import { Alert, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { saveToLibraryAsync } from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FS from 'expo-file-system/legacy';
import { assertUnlocked, assertEpoch } from './lock';
import { viewPhoto } from './vaultService';
import { read, temporaryFile, removeTemp } from './files';

function confirmExport(sharing: boolean): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      sharing ? 'Share outside Photo Vault?' : 'Export to Photos?',
      sharing
        ? 'This photo will leave the vault. The receiving app can keep a copy.'
        : 'This photo will leave the vault and become visible in your gallery and to other apps. The vault copy stays.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: sharing ? 'Share' : 'Export', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export async function exportPhotos(owner: string, ids: string[], sharing = false): Promise<void> {
  const scope = assertUnlocked(owner);
  if (!(await confirmExport(sharing))) return;
  assertEpoch(owner, scope);
  // Android 10+ inserts app-owned media via MediaStore without read permission.
  if (!sharing && Platform.OS === 'android' && Number(Platform.Version) < 30) {
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted)
      throw new Error('Photo export permission was denied. Your vault copy is safe.');
  }
  if (sharing && !(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is unavailable on this device.');
  for (const id of ids) {
    assertEpoch(owner, scope);
    let source: string | undefined, normalized: string | undefined, output: string | undefined;
    try {
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
        await Sharing.shareAsync(output, { mimeType: 'image/jpeg', dialogTitle: 'Share photo' });
      else if (Number(Platform.Version) >= 30) await MediaLibrary.Asset.create(output);
      else await saveToLibraryAsync(output);
    } finally {
      if (source) await removeTemp(source);
      if (output) await removeTemp(output);
      if (normalized && FS.cacheDirectory && normalized.startsWith(FS.cacheDirectory))
        await FS.deleteAsync(normalized, { idempotent: true });
    }
  }
}
