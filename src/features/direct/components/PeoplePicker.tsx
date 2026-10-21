import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Icon, Text, UserRow } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

import { useShareTargets } from '../api';

export type PickedPerson = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
};

/**
 * "To:" field with chips + suggested people (recent chats, then people you follow) or search
 * results, with round checkboxes (pages 77 / 78 / 79 Add people).
 */
export function PeoplePicker({
  selected,
  onChange,
  exclude = [],
  header,
  max = 249,
}: {
  selected: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
  exclude?: string[];
  header?: React.ReactNode;
  max?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim().toLowerCase(), 200);
  const targets = useShareTargets(query);
  const picked = new Set(selected.map((s) => s.id));

  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: PickedPerson[] = [];
    for (const t of targets.data ?? []) {
      if (!t.user_id || !t.username || seen.has(t.user_id) || exclude.includes(t.user_id)) continue;
      seen.add(t.user_id);
      out.push({
        id: t.user_id,
        username: t.username,
        full_name: t.full_name,
        avatar_path: t.avatar_path,
      });
    }
    return out;
  }, [targets.data, exclude]);

  function toggle(p: PickedPerson) {
    if (picked.has(p.id)) onChange(selected.filter((s) => s.id !== p.id));
    else if (selected.length < max) {
      onChange([...selected, p]);
      setSearch('');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          styles.to,
          { paddingHorizontal: spacing.lg, gap: spacing.sm, borderColor: colors.separator },
        ]}
      >
        <Text variant="bodyBold">To:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, { gap: spacing.xs }]}
          keyboardShouldPersistTaps="handled"
        >
          {selected.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => toggle(s)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${s.username}`}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              <Text variant="captionBold" color="primary">
                {s.username}
              </Text>
            </Pressable>
          ))}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text }]}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Backspace' && !search && selected.length)
                onChange(selected.slice(0, -1));
            }}
            accessibilityLabel="Search people"
          />
        </ScrollView>
      </View>
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {header}
            <Text
              variant="bodyBold"
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
            >
              {query ? 'Accounts' : 'Suggested'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <UserRow
              username={item.full_name || item.username}
              subtitle={item.username}
              avatarUri={avatarUrl(item.avatar_path)}
              onPress={() => toggle(item)}
              trailing={
                <Pressable
                  onPress={() => toggle(item)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: picked.has(item.id) }}
                >
                  <Icon
                    name={picked.has(item.id) ? 'checkCircle' : 'radioOff'}
                    size={26}
                    color={picked.has(item.id) ? colors.primary : colors.textTertiary}
                  />
                </Pressable>
              }
            />
          </View>
        )}
        ListEmptyComponent={
          targets.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
              No account found.
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  to: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chips: { alignItems: 'center', flexGrow: 1 },
  chip: { height: 28, justifyContent: 'center' },
  input: { minWidth: 120, flexGrow: 1, fontSize: 15, paddingVertical: 8 },
});
