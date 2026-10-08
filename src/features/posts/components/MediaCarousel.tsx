import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Icon, Text } from '@/components';
import { openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

import type { PostMediaItem, PostTag } from '../api';
import { LoopingVideo } from './LoopingVideo';

/**
 * Swipeable post media (stub of the Phase 4 carousel): 1/N counter, dots, tap a photo to show
 * its tags (tap a tag → profile), videos loop muted with a sound toggle.
 */
export function MediaCarousel({
  media,
  tags,
  ratio,
}: {
  media: PostMediaItem[];
  tags: PostTag[];
  ratio: number;
}) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const height = width / ratio;
  const [page, setPage] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [muted, setMuted] = useState(true);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
    setShowTags(false);
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEnabled={media.length > 1}
      >
        {media.map((m, i) => {
          const slideTags = tags.filter((t) => t.media_id === m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => (m.type === 'video' ? setMuted((v) => !v) : setShowTags((v) => !v))}
              accessibilityLabel={m.alt_text ?? `Slide ${i + 1} of ${media.length}`}
              style={{ width, height, backgroundColor: colors.mediaBackground }}
            >
              {m.type === 'video' && m.url ? (
                <LoopingVideo
                  uri={m.url}
                  muted={muted}
                  playing={i === page}
                  style={{ width, height }}
                />
              ) : m.url ? (
                <Image
                  source={{ uri: m.url }}
                  style={{ width, height }}
                  contentFit="cover"
                  recyclingKey={m.id}
                />
              ) : null}

              {showTags && i === page
                ? slideTags
                    .filter((t) => t.x !== null && t.y !== null)
                    .map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => t.user && openProfile(t.user.username)}
                        accessibilityRole="button"
                        style={[
                          styles.tag,
                          {
                            left: (t.x ?? 0) * width - 40,
                            top: (t.y ?? 0) * height,
                            backgroundColor: colors.mediaScrim,
                          },
                        ]}
                      >
                        <Text
                          variant="captionBold"
                          numberOfLines={1}
                          style={{ color: colors.onMedia }}
                        >
                          {t.user?.username}
                        </Text>
                      </Pressable>
                    ))
                : null}

              {slideTags.length > 0 ? (
                <View style={[styles.corner, styles.left, { backgroundColor: colors.mediaScrim }]}>
                  <Icon name="tagPersonFilled" size={16} color={colors.onMedia} />
                </View>
              ) : null}
              {m.type === 'video' ? (
                <View style={[styles.corner, styles.right, { backgroundColor: colors.mediaScrim }]}>
                  <Icon name={muted ? 'volumeOff' : 'volumeOn'} size={16} color={colors.onMedia} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {media.length > 1 ? (
        <>
          <View style={[styles.counter, { backgroundColor: colors.mediaScrim }]}>
            <Text variant="captionBold" style={{ color: colors.onMedia }}>
              {page + 1}/{media.length}
            </Text>
          </View>
          <View style={[styles.dots, { gap: spacing.xs, paddingTop: spacing.sm }]}>
            {media.map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.dot,
                  { backgroundColor: i === page ? colors.primary : colors.textTertiary },
                ]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  corner: {
    position: 'absolute',
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: { left: 12 },
  right: { right: 12 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
