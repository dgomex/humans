import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text, useToast } from '@/components';
import { BUCKETS, getPublicUrl } from '@/lib/storage';
import { useTheme } from '@/theme';

import type { Highlight } from '../api';

const SIZE = 64;

/**
 * Story highlights under the bio (page 25, row only). Own profile ends with "New"; the editor
 * (archive picker, cover) and the viewer (page 57) arrive with Stories in Phase 5.
 */
export function HighlightsRow({ highlights, isOwn }: { highlights: Highlight[]; isOwn: boolean }) {
  const { colors, spacing, hairline } = useTheme();
  const toast = useToast();
  if (!isOwn && highlights.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}
      style={{ marginTop: spacing.md }}
    >
      {highlights.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => toast.show('Highlights open with Stories (coming soon)')}
          accessibilityRole="button"
          accessibilityLabel={`Highlight ${h.title}`}
          style={styles.item}
        >
          <View style={[styles.ring, { borderColor: colors.separator, borderWidth: hairline * 2 }]}>
            <Avatar
              uri={h.cover_path ? getPublicUrl(BUCKETS.highlightCovers, h.cover_path) : null}
              size={SIZE}
            />
          </View>
          <Text variant="caption" numberOfLines={1} style={styles.label}>
            {h.title}
          </Text>
        </Pressable>
      ))}
      {isOwn ? (
        <Pressable
          onPress={() => router.push('/highlights/new')}
          accessibilityRole="button"
          accessibilityLabel="New highlight"
          style={styles.item}
        >
          <View
            style={[
              styles.ring,
              styles.newCircle,
              { borderColor: colors.separator, borderWidth: hairline * 2 },
            ]}
          >
            <Icon name="add" size={30} />
          </View>
          <Text variant="caption" style={styles.label}>
            New
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', width: SIZE + 10 },
  ring: {
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCircle: {},
  label: { marginTop: 4, maxWidth: SIZE + 10, textAlign: 'center' },
});
