import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text, TextField, useToast, type TextFieldStatus } from '@/components';
import { isUsernameAvailable } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { usernameRuleError } from '@/features/auth/username';
import { useProfile, useUpdateProfile, type ProfileDetails } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

type Field = 'name' | 'username' | 'bio';

const BIO_MAX = 150;
const NAME_MAX = 64;

/** Page 019 — single-field editor (Name, Username, Bio). Done saves immediately. */
export default function EditFieldScreen() {
  const { field } = useLocalSearchParams<{ field: Field }>();
  const auth = useAuth();
  const profile = useProfile({ userId: auth.session?.user.id });
  const { colors } = useTheme();
  // Mount the form only once the current value is known, so it starts pre-filled.
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {profile.data ? <FieldForm field={field} profile={profile.data} /> : null}
    </SafeAreaView>
  );
}

function FieldForm({ field, profile }: { field: Field; profile: ProfileDetails }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const auth = useAuth();
  const update = useUpdateProfile();
  const initial =
    field === 'name' ? profile.full_name : field === 'username' ? profile.username : profile.bio;
  const [value, setValue] = useState(initial);

  // Username: same live rules + availability as sign-up (page 8). The current one is fine.
  const username = value.trim().toLowerCase();
  const ruleError = field === 'username' ? usernameRuleError(username) : null;
  const debounced = useDebounced(username, 300);
  const availability = useQuery({
    queryKey: ['profile', 'username-available', debounced],
    queryFn: () => isUsernameAvailable(debounced),
    enabled:
      field === 'username' &&
      !!debounced &&
      debounced !== profile.username &&
      !usernameRuleError(debounced),
  });
  let status: TextFieldStatus = 'idle';
  if (field === 'username' && username && username !== profile.username) {
    if (ruleError) status = 'invalid';
    else if (debounced !== username || availability.isFetching) status = 'checking';
    else status = availability.data ? 'valid' : 'invalid';
  }
  const usernameError =
    ruleError ?? (status === 'invalid' ? `The username ${username} is not available.` : null);

  const unchanged = value === initial;
  const canSave =
    !update.isPending &&
    (field !== 'username' || (!!username && (username === profile.username || status === 'valid')));

  function save() {
    if (unchanged) {
      goBack();
      return;
    }
    const patch =
      field === 'name'
        ? { full_name: value.trim() }
        : field === 'username'
          ? { username }
          : { bio: value.trim() };
    update.mutate(
      { id: profile.id, patch },
      {
        onSuccess: async () => {
          await auth.refreshProfile();
          goBack();
        },
        onError: (e) =>
          toast.show(
            'code' in e && e.code === '23505'
              ? `The username ${username} is not available.`
              : "Couldn't save. Try again.",
          ),
      },
    );
  }

  const title = field === 'name' ? 'Name' : field === 'username' ? 'Username' : 'Bio';

  return (
    <>
      <TopBar
        title={title}
        center
        right={
          <Button
            title="Done"
            variant="text"
            disabled={!canSave}
            loading={update.isPending}
            onPress={save}
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        {field === 'bio' ? (
          <View>
            <TextField
              label="Bio"
              value={value}
              onChangeText={(t) => setValue(t.slice(0, BIO_MAX))}
              multiline
              autoFocus
              maxLength={BIO_MAX}
              clearable={false}
            />
            <Text
              variant="caption"
              color="textSecondary"
              style={{ alignSelf: 'flex-end', marginTop: spacing.xs }}
            >
              {`${value.length}/${BIO_MAX}`}
            </Text>
          </View>
        ) : field === 'username' ? (
          <TextField
            label="Username"
            value={value}
            onChangeText={(t) => setValue(t.toLowerCase().replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            maxLength={30}
            status={status}
            error={usernameError}
          />
        ) : (
          <TextField
            label="Name"
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={NAME_MAX}
          />
        )}
        <Text variant="caption" color="textSecondary">
          {field === 'name'
            ? 'Help people discover your account by using the name you’re known by: either your full name, nickname or business name.'
            : field === 'username'
              ? 'Your username is how people find you. Others will see how many times you’ve changed it on About this account.'
              : 'Your bio is visible to everyone on and off Humans. Mention people with @ and add #hashtags.'}
        </Text>
      </ScrollView>
    </>
  );
}
