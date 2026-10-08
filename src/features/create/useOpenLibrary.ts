import { router } from 'expo-router';

import { useToast } from '@/components';
import { openAppSettings } from '@/features/profile/avatar';
import { showDialog } from '@/lib/dialog';

import { useComposer } from './ComposerProvider';
import { PickerPermissionError, pickFromLibrary } from './media';
import { MAX_ITEMS } from './types';

/**
 * Open the OS photo picker (page 32 decision). `append` adds to the current carousel (+ tile on
 * the edit strip); otherwise it starts a new post and goes to the edit step.
 */
export function useOpenLibrary() {
  const composer = useComposer();
  const toast = useToast();

  return async function openLibrary({ append = false } = {}) {
    const room = append ? MAX_ITEMS - composer.state.items.length : MAX_ITEMS;
    if (room <= 0) {
      toast.show(`You can only select up to ${MAX_ITEMS} photos and videos.`);
      return;
    }
    try {
      const { items, tooLong } = await pickFromLibrary(room);
      if (tooLong > 0) toast.show('Videos must be 60 seconds or shorter.');
      if (items.length === 0) return;
      if (append) {
        composer.appendItems(items);
        return;
      }
      composer.reset();
      composer.setItems(items);
      router.push('/compose/edit');
    } catch (e) {
      if (e instanceof PickerPermissionError) {
        showDialog(
          'Allow access to your photos',
          'To share photos and videos, allow Humans to access your photo library in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void openAppSettings() },
          ],
        );
      } else {
        toast.show("Couldn't open your photos. Try again.");
      }
    }
  };
}
