import { router } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '@/components';
import { AuthFlowError, passwordProblem, setPassword } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { showDialog } from '@/lib/dialog';

/** Page 006 (part 1) — Create a password. First onboarding step after the email code. */
export default function PasswordScreen() {
  const auth = useAuth();
  const [password, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function next() {
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    setLoading(true);
    setError(null);
    try {
      await setPassword(password);
      router.push('/save-info');
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStep
      title="Create a password"
      subtitle="Create a password with at least 6 letters or numbers. It should be something others can't guess."
      onBack={() =>
        showDialog(
          'Do you want to stop creating your account?',
          "If you stop now, you'll lose any progress you've made.",
          [
            { text: 'Continue creating account', style: 'cancel' },
            {
              text: 'Stop creating account',
              style: 'destructive',
              onPress: () => void auth.logout(),
            },
          ],
        )
      }
    >
      <TextField
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPw(v);
          if (error) setError(null);
        }}
        error={error}
        secure
        autoFocus
        autoCapitalize="none"
        autoComplete="password-new"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={next}
      />
      <Button
        title="Next"
        shape="pill"
        size="lg"
        fullWidth
        disabled={!password}
        loading={loading}
        onPress={next}
      />
    </AuthStep>
  );
}
