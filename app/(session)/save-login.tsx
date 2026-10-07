import { useAuth } from '@/features/auth/AuthProvider';
import { SaveLoginView } from '@/features/auth/components/SaveLoginView';
import { avatarUrl } from '@/features/profile/avatar';

/** "Save your login info?" after logging in with a password (page 003). */
export default function SaveLoginScreen() {
  const auth = useAuth();
  return (
    <SaveLoginView
      name={auth.profile?.username}
      avatarUri={avatarUrl(auth.profile?.avatar_path)}
      onAnswer={(save) => void auth.answerSavePrompt(save)}
    />
  );
}
