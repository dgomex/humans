import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, useToast } from '@/components';
import { directThreadWith } from '@/features/direct/api';
import { PeoplePicker, type PickedPerson } from '@/features/direct/components/PeoplePicker';
import { TopBar } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/** Page 77 — New message: pick one person (→ chat) or several (→ group, page 78). */
export default function NewMessageScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState<PickedPerson[]>([]);
  const [busy, setBusy] = useState(false);

  async function next() {
    if (selected.length === 1) {
      setBusy(true);
      try {
        const id = await directThreadWith(selected[0].id);
        router.replace(`/direct/t/${id}`);
      } catch {
        toast.show("Couldn't open the chat.");
      } finally {
        setBusy(false);
      }
    } else {
      router.push({
        pathname: '/direct/new-group',
        params: {
          ids: selected.map((s) => s.id).join(','),
          names: selected.map((s) => s.username).join(','),
        },
      });
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="New message" center />
      <PeoplePicker
        selected={selected}
        onChange={setSelected}
        header={
          selected.length === 0 ? (
            <Pressable
              onPress={() => toast.show('Pick at least 2 people to create a group chat.')}
              accessibilityRole="button"
              style={[styles.groupRow, { padding: spacing.lg, gap: spacing.md }]}
            >
              <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="people" size={24} />
              </View>
              <Text variant="bodyBold">Create group chat</Text>
            </Pressable>
          ) : null
        }
      />
      {selected.length > 0 ? (
        <View style={{ padding: spacing.lg }}>
          <Button
            title={selected.length === 1 ? 'Chat' : 'Create group chat'}
            loading={busy}
            onPress={() => void next()}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  groupRow: { flexDirection: 'row', alignItems: 'center' },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
