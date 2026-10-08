import { useState } from 'react';
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from 'react-native';

import { BottomSheet, SearchField, Text, UserRow } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import { useSearchProfiles, type SearchedProfile } from '../api';

/** "Search for a user" sheet used by Tag people (page 37). Accounts you follow come first. */
export function PersonSearchSheet({
  visible,
  onClose,
  onPick,
  exclude = [],
  title = 'Tag people',
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (person: SearchedProfile) => void;
  exclude?: string[];
  title?: string;
}) {
  const { spacing } = useTheme();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim(), 200);
  const results = useSearchProfiles(term, visible);
  const people = (results.data ?? []).filter((p) => !exclude.includes(p.id));

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={title}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search for a user" />
      </View>
      <ScrollView
        style={{ height: height * 0.5 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {results.isPending ? <ActivityIndicator style={{ marginTop: spacing.lg }} /> : null}
        {!results.isPending && people.length === 0 ? (
          <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.lg }}>
            No results found.
          </Text>
        ) : null}
        {people.map((p) => (
          <UserRow
            key={p.id}
            username={p.username}
            subtitle={p.full_name}
            avatarUri={avatarUrl(p.avatar_path)}
            onPress={() => {
              setQuery('');
              onPick(p);
            }}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
