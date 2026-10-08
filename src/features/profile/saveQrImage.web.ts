import type { RefObject } from 'react';
import type { View } from 'react-native';

/** Web: the native media library isn't available (and breaks static rendering). */
export async function saveQrImage(_view: RefObject<View | null>): Promise<'unsupported'> {
  return 'unsupported';
}
