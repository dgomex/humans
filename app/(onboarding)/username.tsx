import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Text, TextField, type TextFieldStatus } from '@/components';
import { isUsernameAvailable, suggestUsernames } from '@/features/auth/api';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { useSignupDraft } from '@/features/onboarding/SignupDraft';
import { useTheme } from '@/theme';

/** Client mirror of public.is_valid_username (the database is the source of truth). */
function usernameRuleError(name: string): string | null {
  if (!name) return null;
  if (name.length > 30) return 'Enter a username that is 30 characters or less.';
  if (!/^[a-z0-9._]+$/.test(name))
    return 'Usernames can only use letters, numbers, underscores and periods.';
  if (name.includes('..')) return "You can't use more than one period in a row.";
  if (name.startsWith('.') || name.endsWith('.'))
    return "You can't start or end a username with a period.";
  return null;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Page 008 — Create a username (pre-filled suggestion + live availability). */
export default function UsernameScreen() {
  const { spacing, colors, radius } = useTheme();
  const draft = useSignupDraft();
  const [typed, setTyped] = useState<string | null>(draft.username || null);

  const suggestions = useQuery({
    queryKey: ['signup', 'username-suggestions', draft.fullName],
    queryFn: () => suggestUsernames(draft.fullName),
    staleTime: Infinity,
  });

  // Pre-filled with the first suggestion until the user types.
  const username = typed ?? suggestions.data?.[0] ?? '';

  const ruleError = usernameRuleError(username);
  const debounced = useDebounced(username, 300);
  const availability = useQuery({
    queryKey: ['signup', 'username-available', debounced],
    queryFn: () => isUsernameAvailable(debounced),
    enabled: !!debounced && !usernameRuleError(debounced),
  });

  const settled = debounced === username && !availability.isFetching;
  let status: TextFieldStatus = 'idle';
  if (username && !ruleError) {
    if (!settled) status = 'checking';
    else if (availability.data === true) status = 'valid';
    else if (availability.data === false) status = 'invalid';
  } else if (ruleError) status = 'invalid';

  const takenError =
    status === 'invalid' && !ruleError ? `The username ${username} is not available.` : null;
  const alternatives = (suggestions.data ?? []).filter((s) => s !== username).slice(0, 3);

  function next() {
    if (status !== 'valid') return;
    draft.update({ username });
    router.push('/terms');
  }

  return (
    <AuthStep
      title="Create a username"
      subtitle="Add a username or use our suggestion. You can change this at any time."
    >
      <TextField
        label="Username"
        value={username}
        onChangeText={(v) => setTyped(v.toLowerCase().replace(/\s/g, ''))}
        status={status}
        error={ruleError ?? takenError}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={30}
        returnKeyType="next"
        onSubmitEditing={next}
      />
      {takenError && alternatives.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {alternatives.map((s) => (
            <Pressable
              key={s}
              onPress={() => setTyped(s)}
              accessibilityRole="button"
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.backgroundSecondary,
              }}
            >
              <Text variant="bodyBold">{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button
        title="Next"
        shape="pill"
        size="lg"
        fullWidth
        disabled={status !== 'valid'}
        onPress={next}
      />
    </AuthStep>
  );
}
