import { Alert } from 'react-native';
import { hasUnsyncedPhotos, wipeVault, serial } from './vaultService';
import { cancelVaultTransfers } from './sync';
import { lock } from './lock';

export async function beforeLogout(discardUnsynced = false): Promise<void> {
  lock();
  cancelVaultTransfers();
  if (!discardUnsynced && (await serial(hasUnsyncedPhotos))) {
    const discard = await new Promise<boolean>((resolve) =>
      Alert.alert(
        'Unsynced vault photos',
        'Some photos or changes are stored only on this device. Sync them before logging out, or explicitly discard them. Discarding cannot be undone.',
        [
          { text: 'Stay signed in', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Discard unsynced photos', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!discard) throw new Error('Logout cancelled. Sync your vault first.');
  }
  lock();
  cancelVaultTransfers();
  await wipeVault();
}
