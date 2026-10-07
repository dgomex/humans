import { router, useLocalSearchParams } from 'expo-router';

import { sendSignupCode, verifySignupCode } from '@/features/auth/api';
import { CodeStep } from '@/features/auth/components/CodeStep';

/**
 * Page 005 — Sign up: confirmation code. A valid code creates the session; the auth gate then
 * moves to onboarding (password step) on its own.
 */
export default function SignupCodeScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  return (
    <CodeStep
      destination={email}
      onVerify={(code) => verifySignupCode(email, code)}
      onResend={() => sendSignupCode(email)}
      changeLabel="Change email"
      onChange={() => router.back()}
    />
  );
}
