import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '@/components';
import { AuthFlowError, startRecovery } from '@/features/auth/api';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { showDialog } from '@/lib/dialog';

/** Page 012 — Find your account (username or email). */
export default function FindAccountScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function next() {
    const value = identifier.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    try {
      const maskedEmail = await startRecovery(value);
      router.push({ pathname: '/recover/code', params: { identifier: value, maskedEmail } });
    } catch (e) {
      const err = e instanceof AuthFlowError ? e : null;
      if (err?.code === 'user_not_found') setError("We couldn't find your account.");
      else setError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStep
      title="Find your account"
      subtitle="Enter your username or email."
      footer={
        <Button
          title="Can't reset your password?"
          variant="text"
          onPress={() =>
            showDialog(
              "Can't reset your password?",
              "If you no longer have access to the email on your account, contact support from a device you're logged into.",
            )
          }
        />
      }
    >
      <TextField
        label="Username or email"
        value={identifier}
        onChangeText={(v) => {
          setIdentifier(v);
          if (error) setError(null);
        }}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={next}
      />
      <Button
        title="Continue"
        shape="pill"
        size="lg"
        fullWidth
        disabled={!identifier.trim()}
        loading={loading}
        onPress={next}
      />
    </AuthStep>
  );
}
