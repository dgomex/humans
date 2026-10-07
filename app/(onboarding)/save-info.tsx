import { router } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { SaveLoginView } from '@/features/auth/components/SaveLoginView';

/** Page 006 — "Save your login info?" right after the password, as in Instagram's sign-up. */
export default function SaveInfoScreen() {
  const auth = useAuth();
  return (
    <SaveLoginView
      onBack={undefined}
      name={auth.session?.user.email}
      onAnswer={(save) => {
        auth.setSignupSaveChoice(save);
        router.push('/birthday');
      }}
    />
  );
}
