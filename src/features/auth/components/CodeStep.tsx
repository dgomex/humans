import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet, Button, TextField, useToast } from '@/components';
import { useTheme } from '@/theme';

import { AuthFlowError } from '../api';
import { AuthStep } from './AuthStep';

const RESEND_COOLDOWN_S = 30;

/**
 * Shared "Enter the confirmation code" step (pages 005 and 012): numeric one-time-code field,
 * auto-submit at 6 digits, and an "I didn't get the code" sheet with resend cooldown.
 */
export function CodeStep({
  destination,
  onVerify,
  onResend,
  changeLabel,
  onChange,
  submitLabel = 'Next',
  purpose = 'signup',
}: {
  destination: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  changeLabel: string;
  onChange: () => void;
  submitLabel?: string;
  /** Sign-up says "To confirm your account…"; recovery doesn't. */
  purpose?: 'signup' | 'recovery';
}) {
  const { spacing } = useTheme();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(value = code) {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onVerify(value);
    } catch (e) {
      setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setSheet(false);
    try {
      await onResend();
      setCooldown(RESEND_COOLDOWN_S);
      setCode('');
      toast.show('Code sent');
    } catch (e) {
      toast.show(e instanceof AuthFlowError ? e.message : "Couldn't send a new code.");
    }
  }

  return (
    <AuthStep
      title="Enter the confirmation code"
      subtitle={
        purpose === 'signup'
          ? `To confirm your account, enter the 6-digit code we sent to ${destination}.`
          : `Enter the 6-digit code we sent to ${destination}.`
      }
    >
      <TextField
        label="Confirmation code"
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (error) setError(null);
          if (digits.length === 6) void verify(digits);
        }}
        error={error}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        clearable={false}
      />
      <View style={{ gap: spacing.md }}>
        <Button
          title={submitLabel}
          shape="pill"
          size="lg"
          fullWidth
          disabled={code.length !== 6}
          loading={loading}
          onPress={() => verify()}
        />
        <Button
          title="I didn't get the code"
          variant="outline"
          shape="pill"
          size="lg"
          fullWidth
          onPress={() => setSheet(true)}
        />
      </View>
      <BottomSheet visible={sheet} onClose={() => setSheet(false)}>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
          <Button
            title={
              cooldown > 0 ? `Resend confirmation code (${cooldown}s)` : 'Resend confirmation code'
            }
            variant="secondary"
            size="lg"
            fullWidth
            disabled={cooldown > 0}
            onPress={resend}
          />
          <Button
            title={changeLabel}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => {
              setSheet(false);
              onChange();
            }}
          />
          <Button
            title="Cancel"
            variant="text"
            size="lg"
            fullWidth
            onPress={() => setSheet(false)}
          />
        </View>
      </BottomSheet>
    </AuthStep>
  );
}
