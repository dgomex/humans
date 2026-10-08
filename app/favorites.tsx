import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchField, Text, useToast } from '@/components';
import { usePeoplePicker, useToggleList } from '@/features/profile/api';
import { PeoplePickerList } from '@/features/profile/components/PeoplePickerList';
import { TopBar } from '@/features/profile/components/TopBar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

const MAX_FAVORITES = 50;

/** Page 031 — Favorites: up to 50 accounts you follow; their posts rank higher (Phase 4 feed). */
export default function FavoritesScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const people = usePeoplePicker(query);
  const toggle = useToggleList('favorites');

  const followed = (people.data ?? []).filter((p) => p.i_follow);
  const list = [...followed].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
  const count = followed.filter((p) => p.is_favorite).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Favorites" center />
      <PeoplePickerList
        people={list}
        loading={people.isPending}
        variant="pill"
        selected={(p) => p.is_favorite}
        onToggle={(p) => {
          if (!p.is_favorite && count >= MAX_FAVORITES) {
            toast.show('You can add up to 50 favorites.');
            return;
          }
          toggle.mutate(
            { userId: p.id, on: !p.is_favorite },
            {
              onError: (e) =>
                toast.show(
                  e.message === 'favorites_limit'
                    ? 'You can add up to 50 favorites.'
                    : "Couldn't update favorites.",
                ),
            },
          );
        }}
        empty={query ? 'No users found.' : 'Follow people to add them to your favorites.'}
        header={
          <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
            <Text color="textSecondary">
              Posts from your favorites appear higher in your feed. They won&apos;t be notified when
              you add them.
            </Text>
            <SearchField value={search} onChangeText={setSearch} />
            {!query ? (
              <Text variant="bodyBold">{`Favorites (${count}/${MAX_FAVORITES})`}</Text>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
