import { Text, useToast } from '@/components';
import { openProfile } from '@/features/profile/format';

// Capturing group: `split` puts every match at an odd index.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

/** "username caption" with tappable @mentions and #hashtags (hashtag pages: Phase 7). */
export function CaptionText({ username, caption }: { username: string; caption: string }) {
  return (
    <Text>
      <Text variant="bodyBold" onPress={() => openProfile(username)}>
        {username}
      </Text>{' '}
      <LinkedText text={caption} />
    </Text>
  );
}

/** Text with tappable @mentions and #hashtags (comments, captions). Nest inside a <Text>. */
export function LinkedText({ text }: { text: string }) {
  const toast = useToast();
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return part;
        const onPress = part.startsWith('@')
          ? () => openProfile(part.slice(1).toLowerCase())
          : () => toast.show('Hashtag pages are coming soon');
        return (
          <Text key={i} color="link" onPress={onPress}>
            {part}
          </Text>
        );
      })}
    </>
  );
}
