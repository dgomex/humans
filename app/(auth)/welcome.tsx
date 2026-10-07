import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Button, Icon, Text, UserRow, Avatar, useToast } from '@/components';
import { AuthFlowError } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppLogo } from '@/features/auth/components/AppLogo';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { LanguageSelector } from '@/features/auth/components/LanguageSelector';
import { LoginForm } from '@/features/auth/components/LoginForm';
import type { SavedAccount } from '@/features/auth/savedAccounts';
import { avatarUrl } from '@/features/profile/avatar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/**
 * Page 002 — Welcome. Saved profiles get one-tap login; with none saved (or while adding an
 * account) this is the Log in form, as in Instagram.
 */
export default function WelcomeScreen() {
  const auth = useAuth();
  const saved = auth.accounts.filter((a) => a.saveLogin && a.refreshToken);

  useEffect(() => {
    if (auth.addingAccountIntent === 'signup') {
      auth.clearAddingAccountIntent();
      router.push('/signup/email');
    }
  }, [auth]);

  if (saved.length === 0 || auth.addingAccountFrom) return <LoginForm />;
  return <SavedProfiles saved={saved} />;
}

function SavedProfiles({ saved }: { saved: SavedAccount[] }) {
  const { spacing, colors } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [manage, setManage] = useState(false);

  async function login(account: SavedAccount) {
    setBusy(account.userId);
    try {
      await auth.switchAccount(account.userId);
    } catch (e) {
      if (e instanceof AuthFlowError && e.code === 'session_expired') {
        router.push({ pathname: '/login', params: { identifier: account.username } });
      } else {
        toast.show("Couldn't log in. Check your connection.");
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(account: SavedAccount) {
    showDialog(
      `Remove ${account.username}?`,
      "You'll need to enter your login info the next time you log in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void auth.removeAccount(account.userId),
        },
      ],
    );
  }

  const single = saved.length === 1 ? saved[0] : null;

  return (
    <AuthStep
      centered
      onBack={null}
      headerRight={
        <Pressable
          onPress={() => setManage(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Manage profiles"
        >
          <Icon name="settings" />
        </Pressable>
      }
      footer={
        <Button
          title="Create new account"
          variant="outlinePrimary"
          shape="pill"
          size="lg"
          fullWidth
          onPress={() => router.push('/signup/email')}
        />
      }
    >
      <LanguageSelector />
      <View style={{ paddingVertical: spacing.xl }}>
        <AppLogo size={56} />
      </View>
      {single ? (
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Avatar uri={avatarUrl(single.avatarPath)} size={96} />
          <Text variant="subhead">{single.username}</Text>
          <Button
            title="Log in"
            shape="pill"
            size="lg"
            fullWidth
            loading={busy === single.userId}
            onPress={() => login(single)}
          />
        </View>
      ) : (
        <View>
          {saved.map((a) => (
            <UserRow
              key={a.userId}
              username={a.username}
              subtitle={a.fullName}
              avatarUri={avatarUrl(a.avatarPath)}
              avatarSize={56}
              onPress={() => login(a)}
              trailing={
                busy === a.userId ? (
                  <Text color="textSecondary">Logging in…</Text>
                ) : (
                  <Icon name="forward" color={colors.textSecondary} />
                )
              }
            />
          ))}
        </View>
      )}
      <Button
        title="Use another profile"
        variant="outline"
        shape="pill"
        size="lg"
        fullWidth
        onPress={() => router.push('/login')}
      />

      <BottomSheet visible={manage} onClose={() => setManage(false)} title="Saved profiles">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          {saved.map((a) => (
            <UserRow
              key={a.userId}
              username={a.username}
              subtitle={a.fullName}
              avatarUri={avatarUrl(a.avatarPath)}
              trailing={
                <Button
                  title="Remove"
                  variant="danger"
                  size="sm"
                  onPress={() => {
                    setManage(false);
                    confirmRemove(a);
                  }}
                />
              }
            />
          ))}
        </View>
      </BottomSheet>
    </AuthStep>
  );
}
