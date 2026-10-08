import { Text, useToast } from '@/components';
import { openProfile } from '@/features/profile/format';

// Capturing group: `split` puts every match at an odd index.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

/** "username caption" with tappable @mentions and #hashtags (hashtag pages: Phase 7). */
export function CaptionText({ username, caption }: { username: string; caption: string }) {
  const toast = useToast();
  return (
    <Text>
      <Text variant="bodyBold" onPress={() => openProfile(username)}>
        {username}
      </Text>{' '}
      {caption.split(TOKEN).map((part, i) => {
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
    </Text>
  );
}
