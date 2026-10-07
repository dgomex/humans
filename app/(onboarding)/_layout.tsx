import { Stack } from 'expo-router';

import { SignupDraftProvider } from '@/features/onboarding/SignupDraft';

export const unstable_settings = { initialRouteName: 'password' };

/**
 * Onboarding (pages 006–011): reached automatically when a session has no finished account,
 * and kept until the follow-suggestions step finishes.
 */
export default function OnboardingLayout() {
  return (
    <SignupDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SignupDraftProvider>
  );
}
