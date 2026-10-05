import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

export type AvatarRing = 'none' | 'unseen' | 'seen' | 'closeFriends';

export type AvatarProps = {
  uri?: string | null;
  size?: number;
  /** Story ring state around the avatar. */
  ring?: AvatarRing;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Circular profile picture with an optional story ring and a silhouette fallback. */
export function Avatar({
  uri,
  size = 32,
  ring = 'none',
  onPress,
  accessibilityLabel,
}: AvatarProps) {
  const { colors, storyGradient } = useTheme();
  const ringWidth = ring === 'none' ? 0 : Math.max(2, Math.round(size / 28));
  const gap = ring === 'none' ? 0 : Math.max(2, Math.round(size / 24));
  const outer = size + (ringWidth + gap) * 2;

  const picture = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={150}
      recyclingKey={uri}
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.backgroundPressed,
        },
      ]}
    >
      <Icon name="person" size={size * 0.62} color={colors.background} />
    </View>
  );

  const inner = (
    <View
      style={{
        padding: gap,
        borderRadius: outer / 2,
        backgroundColor: colors.background,
      }}
    >
      {picture}
    </View>
  );

  let content;
  if (ring === 'unseen') {
    content = (
      <LinearGradient
        colors={[...storyGradient]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: ringWidth, borderRadius: outer / 2 }}
      >
        {inner}
      </LinearGradient>
    );
  } else if (ring === 'seen' || ring === 'closeFriends') {
    content = (
      <View
        style={{
          padding: ring === 'seen' ? ringWidth - StyleSheet.hairlineWidth * 2 : ringWidth,
          borderRadius: outer / 2,
          backgroundColor: ring === 'seen' ? colors.storySeenRing : colors.closeFriends,
        }}
      >
        {inner}
      </View>
    );
  } else {
    content = picture;
  }

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
