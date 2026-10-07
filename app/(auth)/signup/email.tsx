import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, TextField } from '@/components';
import { AuthFlowError, EMAIL_RE, sendSignupCode } from '@/features/auth/api';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/** Page 004 — Sign up: email (email-only accounts, see DECISIONS.md). */
export default function SignupEmailScreen() {
  const { spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  async function next() {
    if (!valid) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const normalized = email.trim().toLowerCase();
      await sendSignupCode(normalized);
      router.push({ pathname: '/signup/code', params: { email: normalized } });
    } catch (e) {
      if (e instanceof AuthFlowError && e.code === 'account_exists') {
        showDialog(
          'Are you trying to log in?',
          `It looks like ${email.trim()} is already connected to an account.`,
          [
            {
              text: 'Log in',
              onPress: () =>
                router.replace({ pathname: '/login', params: { identifier: email.trim() } }),
            },
            { text: 'Create new account', style: 'cancel' },
          ],
        );
      } else {
        setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStep
      title="What's your email?"
      subtitle="Enter the email where you can be contacted. No one will see this on your profile."
      footer={
        <Button
          title="I already have an account"
          variant="text"
          onPress={() => router.replace('/login')}
        />
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(null);
        }}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={next}
      />
      <View style={{ gap: spacing.md }}>
        <Button
          title="Next"
          shape="pill"
          size="lg"
          fullWidth
          disabled={!valid}
          loading={loading}
          onPress={next}
        />
      </View>
    </AuthStep>
  );
}
