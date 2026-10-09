import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SearchField, Text, useToast } from '@/components';
import { usePeoplePicker } from '@/features/profile/api';
import { PeoplePickerList } from '@/features/profile/components/PeoplePickerList';
import { TopBar } from '@/features/profile/components/TopBar';
import { useHiddenFrom, useToggleHiddenFrom } from '@/features/stories/api';
import { goBack } from '@/lib/navigation';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/** Page 55 — Hide story from: people checked here can't see your stories or highlights. */
export default function HideStoryFromScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const people = usePeoplePicker(query);
  const hidden = useHiddenFrom();
  const toggle = useToggleHiddenFrom();
  const hiddenIds = new Set((hidden.data ?? []).map((h) => h.hidden_id));
  const list = [...(people.data ?? [])].sort(
    (a, b) => Number(hiddenIds.has(b.id)) - Number(hiddenIds.has(a.id)),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Hide story from"
        center
        right={<Button title="Done" variant="text" onPress={() => goBack()} />}
      />
      <PeoplePickerList
        people={list}
        loading={people.isPending || hidden.isPending}
        variant="check"
        selected={(p) => hiddenIds.has(p.id)}
        onToggle={(p) =>
          toggle.mutate(
            { userId: p.id, hidden: hiddenIds.has(p.id) },
            { onError: () => toast.show("Couldn't update. Try again.") },
          )
        }
        empty={query ? 'No users found.' : 'People who follow you or whom you follow appear here.'}
        header={
          <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
            <Text color="textSecondary">
              Hide your story and highlights from specific people. They won&apos;t be notified.
            </Text>
            <SearchField value={search} onChangeText={setSearch} />
          </View>
        }
      />
    </SafeAreaView>
  );
}
