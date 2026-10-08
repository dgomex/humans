import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

import { useSavedPosts } from './api';

/** Saved collection tile: a 2×2 mosaic of its latest saved posts with the name below. */
export function CollectionTile({
  id,
  name,
  width,
  onPress,
}: {
  /** Collection id, or ALL_POSTS. */
  id: string;
  name: string;
  width: number;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const cell = (width - 1) / 2;
  const posts = useSavedPosts(id);
  const covers = (posts.data?.pages[0] ?? []).slice(0, 4).map((p) => p.coverUrl);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} collection`}
      style={{ width, gap: spacing.xs }}
    >
      <View style={[styles.mosaic, { width, height: width, borderRadius: radius.md }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: cell, height: cell, backgroundColor: colors.skeleton }}>
            {covers[i] ? (
              <Image
                source={{ uri: covers[i] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
          </View>
        ))}
      </View>
      <Text variant="bodyBold" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, overflow: 'hidden' },
});
