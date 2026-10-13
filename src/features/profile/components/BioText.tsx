import { Text } from '@/components';
import { openHashtag } from '@/features/explore/format';

import { openProfile } from '../format';

// Capturing group: `split` puts every match at an odd index.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

/** Bio with tappable @mentions (→ profile) and #hashtags (→ hashtag page). */
export function BioText({ bio }: { bio: string }) {
  if (!bio) return null;
  return (
    <Text>
      {bio.split(TOKEN).map((part, i) => {
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
    </Text>
  );
}
