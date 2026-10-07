import { router } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '@/components';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { useSignupDraft } from '@/features/onboarding/SignupDraft';

/** Page 006 (part 2) — What's your name? */
export default function NameScreen() {
  const draft = useSignupDraft();
  const [name, setName] = useState(draft.fullName);
  const valid = name.trim().length > 0;

  function next() {
    if (!valid) return;
    draft.update({ fullName: name.trim() });
    router.push('/username');
  }

  return (
    <AuthStep title="What's your name?">
      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={64}
        returnKeyType="next"
        onSubmitEditing={next}
      />
      <Button title="Next" shape="pill" size="lg" fullWidth disabled={!valid} onPress={next} />
    </AuthStep>
  );
}
