import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components';
import { AuthFlowError, completeSignup } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { useSignupDraft } from '@/features/onboarding/SignupDraft';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

function Link({ doc, children }: { doc: string; children: string }) {
  return (
    <Text
      color="primary"
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc } })}
    >
      {children}
    </Text>
  );
}

/** Page 009 — Agree to terms. "I agree" creates the account (profile + private data). */
export default function TermsScreen() {
  const { spacing } = useTheme();
  const auth = useAuth();
  const draft = useSignupDraft();
  const [loading, setLoading] = useState(false);

  async function agree() {
    if (!draft.birthday || !draft.username) {
      router.replace('/birthday');
      return;
    }
    setLoading(true);
    try {
      const profile = await completeSignup({
        username: draft.username,
        fullName: draft.fullName,
        birthday: draft.birthday,
      });
      auth.completeSignupLocally(profile);
      router.replace('/photo');
    } catch (e) {
      const err = e instanceof AuthFlowError ? e : null;
      if (err?.code === 'username_taken') {
        showDialog('Username not available', err.message, [
          { text: 'Choose another', onPress: () => router.back() },
        ]);
      } else {
        showDialog("Couldn't create account", err?.message ?? 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthStep title="Agree to Humans' terms and policies">
      <View style={{ gap: spacing.md }}>
        <Text>
          {'People who use our service may have uploaded your contact information to Humans. '}
          <Link doc="contacts">Learn more</Link>
        </Text>
        <Text>
          {"By tapping I agree, you agree to create an account and to Humans' "}
          <Link doc="terms">Terms</Link>
          {', '}
          <Link doc="privacy">Privacy Policy</Link>
          {' and '}
          <Link doc="cookies">Cookies Policy</Link>.
        </Text>
        <Text>
          {'The '}
          <Link doc="privacy">Privacy Policy</Link>
          {' describes the ways we can use the information we collect when you create an account.'}
        </Text>
      </View>
      <Button title="I agree" shape="pill" size="lg" fullWidth loading={loading} onPress={agree} />
    </AuthStep>
  );
}
