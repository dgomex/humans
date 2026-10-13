import { Text } from '@/components';
import { openHashtag } from '@/features/explore/format';
import { openProfile } from '@/features/profile/format';

// Capturing group: `split` puts every match at an odd index.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

/** "username caption" with tappable @mentions and #hashtags (→ hashtag page, page 68). */
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
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return part;
        const onPress = part.startsWith('@')
          ? () => openProfile(part.slice(1).toLowerCase())
          : () => openHashtag(part.slice(1));
        return (
          <Text key={i} color="link" onPress={onPress}>
            {part}
          </Text>
        );
      })}
    </>
  );
}
