import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionGroup, ActionRow, Avatar, BottomSheet, Icon, Text, useToast } from '@/components';
import { useDeleteHighlight, useHighlightCovers } from '@/features/stories/api';
import { highlightUrl } from '@/features/stories/components/StorySheets';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

import type { Highlight } from '../api';

const SIZE = 64;

/**
 * Story highlights under the bio (pages 25 / 57). Tap plays the highlight; on your own profile a
 * long-press offers Edit / Copy link / Delete, and "New" starts the editor.
 */
export function HighlightsRow({
  highlights,
  isOwn,
  ownerId,
}: {
  highlights: Highlight[];
  isOwn: boolean;
  ownerId: string;
}) {
  const { colors, spacing, hairline } = useTheme();
  const toast = useToast();
  const covers = useHighlightCovers(highlights);
  const remove = useDeleteHighlight();
  const [menu, setMenu] = useState<Highlight | null>(null);
  if (!isOwn && highlights.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}
        style={{ marginTop: spacing.md }}
      >
        {highlights.map((h) => (
          <Pressable
            key={h.id}
            onPress={() =>
              router.push({
                pathname: '/stories/highlight/[id]',
                params: { id: h.id, owner: ownerId },
              })
            }
            onLongPress={isOwn ? () => setMenu(h) : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Highlight ${h.title}`}
            accessibilityHint={isOwn ? 'Long press for options' : undefined}
            style={styles.item}
          >
            <View
              style={[styles.ring, { borderColor: colors.separator, borderWidth: hairline * 2 }]}
            >
              <Avatar uri={covers[h.id] ?? null} size={SIZE} />
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
              style={[styles.ring, { borderColor: colors.separator, borderWidth: hairline * 2 }]}
            >
              <Icon name="add" size={30} />
            </View>
            <Text variant="caption" style={styles.label}>
              New
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.title}>
        {menu ? (
          <ActionGroup>
            <ActionRow
              icon="edit"
              label="Edit highlight"
              onPress={() => {
                setMenu(null);
                router.push({ pathname: '/highlights/[id]/edit', params: { id: menu.id } });
              }}
            />
            <ActionRow
              icon="link"
              label="Copy link"
              onPress={async () => {
                await Clipboard.setStringAsync(highlightUrl(menu.id));
                setMenu(null);
                toast.show('Link copied');
              }}
            />
            <ActionRow
              icon="trash"
              label="Delete highlight"
              destructive
              onPress={() =>
                showDialog('Delete highlight?', 'The stories stay in your archive.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      remove.mutate(
                        { id: menu.id, cover_path: menu.cover_path },
                        {
                          onSuccess: () => {
                            setMenu(null);
                            toast.show('Highlight deleted');
                          },
                        },
                      ),
                  },
                ])
              }
            />
          </ActionGroup>
        ) : null}
      </BottomSheet>
    </>
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
  label: { marginTop: 4, maxWidth: SIZE + 10, textAlign: 'center' },
});
