import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, TextField, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseLinks, useProfile, useUpdateProfile, type ProfileLink } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { displayLink } from '@/features/profile/format';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

const MAX_LINKS = 5;

/** Mirror of public.is_valid_profile_links for one URL; adds https:// when missing. */
function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return /^https?:\/\/[^\s/?#]+\.[^\s]+$/i.test(url) && url.length <= 2048 ? url : null;
}

/** Page 019 — Links: up to 5 (URL + optional title); add, edit, remove. Saves on each change. */
export default function LinksScreen() {
  const { colors, spacing, hairline } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const profile = useProfile({ userId: auth.session?.user.id });
  const update = useUpdateProfile();
  const links = parseLinks(profile.data?.links);
  // null = list; -1 = adding; n = editing link n.
  const [editing, setEditing] = useState<number | null>(null);

  function save(next: ProfileLink[], after?: () => void) {
    if (!profile.data) return;
    update.mutate(
      { id: profile.data.id, patch: { links: next } },
      {
        onSuccess: () => after?.(),
        onError: () => toast.show("Couldn't save links. Try again."),
      },
    );
  }

  if (editing !== null) {
    return (
      <LinkForm
        initial={editing >= 0 ? links[editing] : undefined}
        saving={update.isPending}
        onCancel={() => setEditing(null)}
        onSave={(link) =>
          save(
            editing >= 0 ? links.map((l, i) => (i === editing ? link : l)) : [...links, link],
            () => setEditing(null),
          )
        }
        onRemove={
          editing >= 0
            ? () =>
                save(
                  links.filter((_, i) => i !== editing),
                  () => setEditing(null),
                )
            : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Links" center />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm }}>
        {links.length < MAX_LINKS ? (
          <Pressable
            onPress={() => setEditing(-1)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <Icon name="link" />
            <Text style={{ flex: 1 }}>Add external link</Text>
            <Icon name="chevronRight" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Text color="textSecondary" style={{ padding: spacing.lg }}>
            You can add up to 5 links.
          </Text>
        )}
        {links.map((l, i) => (
          <Pressable
            key={`${l.url}-${i}`}
            onPress={() => setEditing(i)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopWidth: hairline,
              borderTopColor: colors.separator,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" numberOfLines={1}>
                {l.title || displayLink(l.url)}
              </Text>
              {l.title ? (
                <Text color="textSecondary" numberOfLines={1}>
                  {displayLink(l.url)}
                </Text>
              ) : null}
            </View>
            <Icon name="chevronRight" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkForm({
  initial,
  saving,
  onSave,
  onCancel,
  onRemove,
}: {
  initial?: ProfileLink;
  saving: boolean;
  onSave: (link: ProfileLink) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [touched, setTouched] = useState(false);
  const normalized = normalizeUrl(url);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={initial ? 'Edit link' : 'Add link'}
        center
        onBack={onCancel}
        right={
          <Button
            title="Done"
            variant="text"
            disabled={!normalized || saving}
            loading={saving}
            onPress={() =>
              normalized &&
              onSave(title.trim() ? { url: normalized, title: title.trim() } : { url: normalized })
            }
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <TextField
          label="URL"
          value={url}
          onChangeText={setUrl}
          onBlur={() => setTouched(true)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus={!initial}
          error={touched && url && !normalized ? 'Enter a valid URL.' : null}
        />
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={60} />
        {onRemove ? (
          <Button
            title="Remove link"
            variant="danger"
            onPress={() =>
              showDialog('Remove link?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: onRemove },
              ])
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
