import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, SearchField, Text, UserRow, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useComposer } from '@/features/create/ComposerProvider';
import { MAX_COLLABORATORS } from '@/features/create/types';
import { useSearchProfiles } from '@/features/posts/api';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

/**
 * Page 36 → Add collaborators: invite up to 5 accounts. They're asked to accept; once they do,
 * the post appears on their profile too.
 */
export default function CollaboratorsScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { profile } = useAuth();
  const composer = useComposer();
  const selected = composer.state.collaborators;
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim(), 200);
  const results = useSearchProfiles(term);
  const people = (results.data ?? []).filter((p) => p.id !== profile?.id);

  function toggle(p: { id: string; username: string; avatar_path: string | null }) {
    if (selected.some((s) => s.id === p.id)) {
      composer.update({ collaborators: selected.filter((s) => s.id !== p.id) });
    } else if (selected.length >= MAX_COLLABORATORS) {
      toast.show(`You can invite up to ${MAX_COLLABORATORS} collaborators.`);
    } else {
      composer.update({
        collaborators: [
          ...selected,
          { id: p.id, username: p.username, avatar_path: p.avatar_path },
        ],
      });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Invite collaborators"
        center
        right={<Button title="Done" variant="text" size="sm" onPress={() => goBack('/compose')} />}
      />
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <SearchField value={query} onChangeText={setQuery} />
        <Text variant="caption" color="textSecondary">
          Collaborators will be asked to accept. When they do, their username is added to the post
          and it&apos;s shared with their followers. {selected.length}/{MAX_COLLABORATORS}
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {selected.map((p) => (
          <UserRow
            key={`sel-${p.id}`}
            username={p.username}
            avatarUri={avatarUrl(p.avatar_path)}
            onPress={() => toggle(p)}
            trailing={<Icon name="checkCircle" size={24} color={colors.primary} />}
          />
        ))}
        {results.isPending ? <ActivityIndicator style={{ marginTop: spacing.lg }} /> : null}
        {people
          .filter((p) => !selected.some((s) => s.id === p.id))
          .map((p) => (
            <UserRow
              key={p.id}
              username={p.username}
              subtitle={p.full_name}
              avatarUri={avatarUrl(p.avatar_path)}
              onPress={() => toggle(p)}
              trailing={<Icon name="radioOff" size={24} color={colors.textTertiary} />}
            />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}
