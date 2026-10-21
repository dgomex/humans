import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Avatar, type AvatarRing } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { BUCKETS } from '@/lib/storage';
import { useMediaUrl } from '@/lib/useMediaUrl';
import { useTheme } from '@/theme';

import type { ThreadPerson } from '../api';

/**
 * Chat picture: the other person (1:1), the group photo, or two overlapping member avatars.
 * A green dot marks someone active now.
 */
export function ThreadAvatar({
  kind,
  photoPath,
  members,
  size = 56,
  active = false,
  ring = 'none',
}: {
  kind: 'direct' | 'group';
  photoPath?: string | null;
  members: Pick<ThreadPerson, 'avatar_path'>[];
  size?: number;
  active?: boolean;
  ring?: AvatarRing;
}) {
  const { colors } = useTheme();
  const photo = useMediaUrl(BUCKETS.messages, kind === 'group' ? photoPath : null);
  const dot = Math.max(12, Math.round(size * 0.26));

  let picture;
  if (kind === 'group' && photoPath) {
    picture = (
      <Image
        source={photo.data ? { uri: photo.data } : null}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.backgroundSecondary,
        }}
        contentFit="cover"
      />
    );
  } else if (kind === 'group' && members.length >= 2) {
    const small = Math.round(size * 0.72);
    picture = (
      <View style={{ width: size, height: size }}>
        <View style={styles.back}>
          <Avatar uri={avatarUrl(members[1].avatar_path)} size={small} />
        </View>
        <View
          style={[
            styles.front,
            { borderColor: colors.background, borderRadius: small, borderWidth: 2 },
          ]}
        >
          <Avatar uri={avatarUrl(members[0].avatar_path)} size={small} />
        </View>
      </View>
    );
  } else {
    picture = <Avatar uri={avatarUrl(members[0]?.avatar_path)} size={size} ring={ring} />;
  }

  return (
    <View>
      {picture}
      {active ? (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.success,
              borderColor: colors.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 0, right: 0 },
  front: { position: 'absolute', bottom: -2, left: -2 },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
});
