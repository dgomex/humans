import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useComposer } from '@/features/create/ComposerProvider';
import { useDrafts } from '@/features/create/drafts';
import { useOpenLibrary } from '@/features/create/useOpenLibrary';
import { newReelState } from '@/features/reels/composer';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/**
 * Page 32 — Create entry. Decision: the OS photo picker instead of an in-app gallery, so this
 * screen offers Library · Camera, plus your drafts (page 42). On native the picker opens straight
 * away (like Instagram's gallery) when there are no drafts to show.
 */
export default function CreateEntryScreen() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const composer = useComposer();
  const drafts = useDrafts(profile?.id);
  const openLibrary = useOpenLibrary();
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoOpened.current || Platform.OS === 'web' || !drafts.isSuccess) return;
    autoOpened.current = true;
    if (drafts.data.length === 0) void openLibrary();
  }, [drafts.isSuccess, drafts.data, openLibrary]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        back={false}
        left={<TopBarButton icon="close" label="Close" onPress={() => router.back()} />}
        title="New post"
        center
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Option icon="image" label="Library" onPress={() => void openLibrary()} />
          <Option
            icon="camera"
            label="Camera"
            onPress={() => {
              composer.reset();
              router.push('/compose/camera');
            }}
          />
          <Option
            icon="reels"
            label="Reel"
            onPress={() => {
              composer.reset(newReelState());
              router.push('/compose/reel/camera');
            }}
          />
        </View>

        {drafts.data && drafts.data.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.rowBetween}>
              <Text variant="subhead">Drafts</Text>
              <Pressable
                onPress={() => router.push('/compose/drafts')}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text variant="bodyBold" color="primary">
                  Manage
                </Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {drafts.data.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      composer.reset(d.state);
                      router.push(d.state.reel ? '/compose/reel/edit' : '/compose/edit');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open draft"
                    style={{ width: 96, height: 128, backgroundColor: colors.skeleton }}
                  >
                    <Image
                      source={{ uri: d.state.items[0]?.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    {d.state.reel || d.state.items.length > 1 ? (
                      <View style={styles.badge}>
                        <Icon
                          name={d.state.reel ? 'reels' : 'carousel'}
                          size={16}
                          color={colors.onMedia}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
          Posts: up to 20 photos and videos (videos up to 60 seconds). Reels: up to 3 minutes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Option({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.option,
        {
          gap: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.backgroundPressed : colors.backgroundSecondary,
        },
      ]}
    >
      <Icon name={icon} size={32} />
      <Text variant="bodyBold">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: { flex: 1, height: 120, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { position: 'absolute', top: 6, right: 6 },
});
