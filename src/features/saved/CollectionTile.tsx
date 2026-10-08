import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

/**
 * Saved collection tile: a 2×2 mosaic of its latest posts (gray placeholders until posts exist,
 * Phase 3/4) with the name below.
 */
export function CollectionTile({
  name,
  width,
  onPress,
}: {
  name: string;
  width: number;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const cell = (width - 1) / 2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} collection`}
      style={{ width, gap: spacing.xs }}
    >
      <View style={[styles.mosaic, { width, height: width, borderRadius: radius.md }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: cell, height: cell, backgroundColor: colors.skeleton }} />
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
