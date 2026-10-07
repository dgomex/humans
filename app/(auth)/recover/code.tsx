import { router, useLocalSearchParams } from 'expo-router';

import { startRecovery, verifyRecoveryCode } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { CodeStep } from '@/features/auth/components/CodeStep';

/** Page 012 — recovery code. A valid code signs in for recovery → page 013 (new password). */
export default function RecoverCodeScreen() {
  const auth = useAuth();
  const { identifier = '', maskedEmail = '' } = useLocalSearchParams<{
    identifier: string;
    maskedEmail: string;
  }>();

  return (
    <CodeStep
      destination={maskedEmail}
      submitLabel="Continue"
      purpose="recovery"
      onVerify={async (code) => {
        const session = await verifyRecoveryCode(identifier, code);
        await auth.beginRecovery(session);
      }}
      onResend={async () => {
        await startRecovery(identifier);
      }}
      changeLabel="Try a different account"
      onChange={() => router.back()}
    />
  );
}
