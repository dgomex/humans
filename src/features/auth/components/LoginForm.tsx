import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, TextField } from '@/components';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

import { AuthFlowError, loginWithPassword } from '../api';
import { useAuth } from '../AuthProvider';
import { AppLogo } from './AppLogo';
import { AuthStep } from './AuthStep';
import { LanguageSelector } from './LanguageSelector';

/** Page 003 — Log in (also the Welcome screen when no profiles are saved). */
export function LoginForm({
  initialIdentifier = '',
  showBack = false,
}: {
  initialIdentifier?: string;
  showBack?: boolean;
}) {
  const { spacing } = useTheme();
  const auth = useAuth();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const session = await loginWithPassword(identifier.trim(), password);
      await auth.signInWithSession(session);
    } catch (e) {
      const err = e instanceof AuthFlowError ? e : new AuthFlowError('unknown', String(e));
      if (__DEV__) console.warn('[login] failed:', err.code, err.message);
      if (err.code === 'invalid_password') {
        showDialog('Incorrect password', err.message, [
          {
            text: 'Forgot password?',
            onPress: () =>
              router.push({ pathname: '/recover', params: { identifier: identifier.trim() } }),
          },
          { text: 'Try again', style: 'cancel' },
        ]);
      } else if (err.code === 'user_not_found') {
        showDialog(
          "Can't find account",
          `It looks like ${identifier.trim()} isn't connected to an account. You can create a new account with your email address, or try again.`,
          [
            { text: 'Create new account', onPress: () => router.push('/signup/email') },
            { text: 'Try again', style: 'cancel' },
          ],
        );
      } else {
        showDialog(
          err.code === 'rate_limited' ? 'Try again later' : "Couldn't log in",
          err.message,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const adding = !!auth.addingAccountFrom;

  return (
    <AuthStep
      centered
      onBack={adding ? () => void auth.cancelAddAccount() : showBack ? undefined : null}
      backIcon={adding ? 'close' : 'back'}
      footer={
        <View style={{ alignSelf: 'stretch', gap: spacing.md }}>
          <Button
            title="Create new account"
            variant="outlinePrimary"
            shape="pill"
            size="lg"
            fullWidth
            onPress={() => router.push('/signup/email')}
          />
        </View>
      }
    >
      <LanguageSelector />
      <View style={{ paddingVertical: spacing.xxl }}>
        <AppLogo size={64} />
      </View>
      <View style={{ gap: spacing.md }}>
        <TextField
          label="Username or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          title="Log in"
          shape="pill"
          size="lg"
          fullWidth
          disabled={!canSubmit && !loading}
          loading={loading}
          onPress={submit}
        />
        <Button
          title="Forgot password?"
          variant="text"
          style={{ alignSelf: 'center' }}
          onPress={() =>
            router.push({
              pathname: '/recover',
              params: identifier.trim() ? { identifier: identifier.trim() } : {},
            })
          }
        />
      </View>
    </AuthStep>
  );
}
