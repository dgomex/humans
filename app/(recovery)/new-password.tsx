import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, Text, TextField, useToast } from '@/components';
import {
  AuthFlowError,
  passwordProblem,
  setPassword,
  signOutOtherDevices,
} from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 013 — Create a new password (after a recovery code). */
export default function NewPasswordScreen() {
  const { spacing, colors } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const [password, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [logoutOthers, setLogoutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('Please make sure both passwords match.');
    setLoading(true);
    setError(null);
    try {
      await setPassword(password);
      if (logoutOthers) await signOutOtherDevices().catch(() => {});
      auth.finishRecovery();
      toast.show('Password changed');
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStep
      title="Create a new password"
      subtitle="Create a password with at least 6 letters and numbers. You'll need this password to log into your account."
      onBack={() =>
        showDialog(
          'Stop resetting your password?',
          "You'll be logged out and can try again later.",
          [
            { text: 'Keep resetting', style: 'cancel' },
            { text: 'Stop', style: 'destructive', onPress: () => void auth.logout() },
          ],
        )
      }
    >
      <View style={{ gap: spacing.md }}>
        <TextField
          label="New password"
          value={password}
          onChangeText={(v) => {
            setPw(v);
            if (error) setError(null);
          }}
          secure
          autoFocus
          autoComplete="password-new"
          textContentType="newPassword"
        />
        <TextField
          label="Retype new password"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            if (error) setError(null);
          }}
          secure
          error={error}
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={() => setLogoutOthers((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: logoutOthers }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <Icon
            name={logoutOthers ? 'checkbox' : 'checkboxOff'}
            color={logoutOthers ? colors.primary : colors.textSecondary}
          />
          <Text>Log out of other devices</Text>
        </Pressable>
        <Button
          title="Continue"
          shape="pill"
          size="lg"
          fullWidth
          disabled={!password || !confirm}
          loading={loading}
          onPress={submit}
        />
      </View>
    </AuthStep>
  );
}
