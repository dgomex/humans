import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SearchField, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useClearCloseFriends, usePeoplePicker, useToggleList } from '@/features/profile/api';
import { PeoplePickerList } from '@/features/profile/components/PeoplePickerList';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Page 030 — Close Friends list: people who follow you or whom you follow, check to add. */
export default function CloseFriendsScreen() {
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const people = usePeoplePicker(query);
  const toggle = useToggleList('close_friends');
  const clear = useClearCloseFriends();

  const list = [...(people.data ?? [])].sort(
    (a, b) => Number(b.is_close_friend) - Number(a.is_close_friend),
  );
  const count = list.filter((p) => p.is_close_friend).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Close friends"
        center
        right={<Button title="Done" variant="text" onPress={() => goBack()} />}
      />
      <PeoplePickerList
        people={list}
        loading={people.isPending}
        variant="check"
        selected={(p) => p.is_close_friend}
        onToggle={(p) =>
          toggle.mutate(
            { userId: p.id, on: !p.is_close_friend },
            { onError: () => toast.show("Couldn't update close friends.") },
          )
        }
        empty={
          query
            ? 'No users found.'
            : 'Follow people or get followers to add them to your close friends.'
        }
        header={
          <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
            <Text color="textSecondary">
              We don&apos;t send notifications when you edit your close friends list.
            </Text>
            <SearchField value={search} onChangeText={setSearch} />
            {!query && count > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="bodyBold" style={{ flex: 1 }}>
                  {`${count} ${count === 1 ? 'person' : 'people'}`}
                </Text>
                <Button
                  title="Remove all"
                  variant="text"
                  onPress={() =>
                    showDialog('Remove all close friends?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove all',
                        style: 'destructive',
                        onPress: () => auth.session && clear.mutate(auth.session.user.id),
                      },
                    ])
                  }
                />
              </View>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
