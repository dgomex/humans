/** Web: open the file in a new tab (the browser handles saving). */
export async function saveChatMedia(
  url: string,
  _type: 'image' | 'video',
): Promise<'saved' | 'denied' | 'unsupported'> {
  window.open(url, '_blank');
  return 'saved';
}
