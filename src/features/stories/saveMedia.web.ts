/** Web: the native media library isn't available. */
export async function saveStoryMedia(
  _url: string,
  _ext: 'jpg' | 'mp4',
): Promise<'saved' | 'denied' | 'unsupported'> {
  return 'unsupported';
}

export async function saveStoryView(_view: unknown): Promise<'saved' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
