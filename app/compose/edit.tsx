import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { CropView } from '@/features/create/components/CropView';
import { SortableStrip } from '@/features/create/components/SortableStrip';
import { originalRatio, videoPoster } from '@/features/create/media';
import { useOpenLibrary } from '@/features/create/useOpenLibrary';
import { useSaveDraftGuard } from '@/features/create/useSaveDraftGuard';
import { LoopingVideo } from '@/features/posts/components/LoopingVideo';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/**
 * Pages 34/35 — crop and arrange. Decision: no filters/adjustments. The first item's shape sets
 * the ratio (⤢ toggles square ↔ original, 3:4…1.91:1); photos pinch/drag to crop; videos are
 * center-cropped. The strip switches slides, long-press-drags to reorder, ✕ removes, + adds.
 */
export default function EditScreen() {
  const { colors, spacing } = useTheme();
  const { width, height: windowHeight } = useWindowDimensions();
  const composer = useComposer();
  const { items, ratio } = composer.state;
  const { allowExit } = composer;
  const openLibrary = useOpenLibrary();
  const [selected, setSelected] = useState<string | null>(items[0]?.key ?? null);
  const [posters, setPosters] = useState<Record<string, string>>({});
  useSaveDraftGuard();

  const current = items.find((i) => i.key === selected) ?? items[0];
  // Keep the preview within ~60% of the screen for tall ratios on short phones.
  const frameWidth = Math.min(width, windowHeight * 0.6 * ratio);
  const canToggle = items[0] ? Math.abs(originalRatio(items[0]) - 1) > 0.01 : false;

  // Video thumbnails for the strip.
  useEffect(() => {
    for (const item of items) {
      if (item.type !== 'video' || posters[item.key]) continue;
      void videoPoster(item.uri)
        .then((p) => p && setPosters((s) => ({ ...s, [item.key]: p.uri })))
        .catch(() => {});
    }
  }, [items, posters]);

  // Everything removed → back to the picker.
  useEffect(() => {
    if (items.length === 0) {
      allowExit();
      router.back();
    }
  }, [items.length, allowExit]);

  if (!current) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="New post"
        center
        right={
          <Button
            title="Next"
            variant="text"
            size="sm"
            onPress={() => router.push('/compose/details')}
          />
        }
      />
      <View style={{ alignItems: 'center', backgroundColor: colors.mediaBackground }}>
        <View style={{ width: frameWidth, height: frameWidth / ratio }}>
          {current.type === 'image' ? (
            <CropView
              key={`${current.key}-${ratio}`}
              item={current}
              ratio={ratio}
              width={frameWidth}
              onChange={(crop) => composer.updateItem(current.key, { crop })}
            />
          ) : (
            <LoopingVideo
              key={current.key}
              uri={current.uri}
              style={{ width: frameWidth, height: frameWidth / ratio }}
            />
          )}
          {canToggle ? (
            <Pressable
              onPress={composer.toggleRatio}
              accessibilityRole="button"
              accessibilityLabel={ratio === 1 ? 'Show original shape' : 'Crop to square'}
              style={[styles.ratioButton, { backgroundColor: colors.mediaScrim }]}
            >
              <Icon name={ratio === 1 ? 'expand' : 'collapse'} size={18} color={colors.onMedia} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text
          variant="caption"
          color="textSecondary"
          style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}
        >
          {current.type === 'image'
            ? 'Pinch and drag to adjust the crop.'
            : 'Videos are shown centered in the frame.'}
          {items.length > 1 ? ' Hold and drag a thumbnail to reorder.' : ''}
        </Text>
        <SortableStrip
          items={items.map((i) => ({
            key: i.key,
            type: i.type,
            uri: i.type === 'video' ? (posters[i.key] ?? i.uri) : i.uri,
          }))}
          selectedKey={current.key}
          onSelect={setSelected}
          onMove={composer.moveItem}
          onRemove={(key) => {
            const idx = items.findIndex((i) => i.key === key);
            composer.removeItem(key);
            setSelected(items[idx + 1]?.key ?? items[idx - 1]?.key ?? null);
          }}
          onAdd={items.length < 20 ? () => void openLibrary({ append: true }) : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ratioButton: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
