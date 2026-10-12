import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useComposer } from '@/features/create/ComposerProvider';
import { useDeleteDrafts, useDrafts } from '@/features/create/drafts';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 42 — Drafts: open one to keep editing, or Select → Discard. Drafts stay on this device. */
export default function DraftsScreen() {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const composer = useComposer();
  const drafts = useDrafts(profile?.id);
  const remove = useDeleteDrafts(profile?.id);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const tile = (width - 2) / 3;

  function discard() {
    const n = selected.length;
    showDialog(
      `Discard ${n} ${n === 1 ? 'draft' : 'drafts'}?`,
      "If you discard now, you'll lose these drafts.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            remove.mutate(selected, {
              onSuccess: () => {
                setSelected([]);
                setSelecting(false);
              },
            }),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Drafts"
        center
        right={
          <Button
            title={selecting ? 'Cancel' : 'Select'}
            variant="text"
            size="sm"
            onPress={() => {
              setSelecting((s) => !s);
              setSelected([]);
            }}
          />
        }
      />
      <ScrollView>
        {drafts.data?.length === 0 ? (
          <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xxl }}>
            No drafts. Drafts are saved on this device only.
          </Text>
        ) : null}
        <View style={styles.grid}>
          {(drafts.data ?? []).map((d) => {
            const on = selected.includes(d.id);
            return (
              <Pressable
                key={d.id}
                onPress={() => {
                  if (selecting) {
                    setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]));
                  } else {
                    composer.reset(d.state);
                    router.replace(d.state.reel ? '/compose/reel/edit' : '/compose/edit');
                  }
                }}
                accessibilityRole="button"
                accessibilityState={selecting ? { selected: on } : undefined}
                accessibilityLabel={`Draft from ${new Date(d.savedAt).toLocaleDateString()}`}
                style={{ width: tile, height: (tile * 4) / 3, backgroundColor: colors.skeleton }}
              >
                <Image
                  source={{ uri: d.state.items[0]?.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                {d.state.items.length > 1 ? (
                  <View style={styles.badge}>
                    <Icon name="carousel" size={16} color={colors.onMedia} />
                  </View>
                ) : null}
                {selecting ? (
                  <View style={styles.check}>
                    <Icon
                      name={on ? 'checkCircle' : 'radioOff'}
                      size={24}
                      color={on ? colors.primary : colors.onMedia}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {selecting ? (
        <View style={{ padding: spacing.lg }}>
          <Button
            title="Discard"
            variant="danger"
            fullWidth
            disabled={selected.length === 0}
            loading={remove.isPending}
            onPress={discard}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  badge: { position: 'absolute', top: 6, right: 6 },
  check: { position: 'absolute', bottom: 6, right: 6 },
});
