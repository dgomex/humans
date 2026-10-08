import { Text, useToast } from '@/components';

import { openProfile } from '../format';

// Capturing group: `split` puts every match at an odd index.
const TOKEN = /(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]+)/iu;

/** Bio with tappable @mentions (→ profile) and #hashtags (hashtag pages arrive in Phase 7). */
export function BioText({ bio }: { bio: string }) {
  const toast = useToast();
  if (!bio) return null;
  return (
    <Text>
      {bio.split(TOKEN).map((part, i) => {
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
