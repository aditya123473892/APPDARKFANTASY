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
        'Keep your photos',
        'Some photos or changes are saved only on this phone. Stay signed in to keep them, or discard them and log out. Discarding cannot be undone.',
        [
          { text: 'Stay signed in', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Discard and log out', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!discard) throw new Error('Logout cancelled. Your photos are still on this phone.');
  }
  lock();
  cancelVaultTransfers();
  await wipeVault();
}
