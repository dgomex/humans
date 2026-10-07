import { useLocalSearchParams } from 'expo-router';

import { LoginForm } from '@/features/auth/components/LoginForm';

/** Page 003 — Log in, reached from "Use another profile", dialogs, or sign-up. */
export default function LoginScreen() {
  const { identifier } = useLocalSearchParams<{ identifier?: string }>();
  return <LoginForm showBack initialIdentifier={identifier ?? ''} />;
}
