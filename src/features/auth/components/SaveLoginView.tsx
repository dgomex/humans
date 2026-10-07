import { View } from 'react-native';

import { Avatar, Button, Text } from '@/components';
import { useTheme } from '@/theme';

import { AuthStep } from './AuthStep';

/** "Save your login info?" — after logging in (page 003) and after the password step (page 006). */
export function SaveLoginView({
  name,
  avatarUri,
  onAnswer,
  onBack = null,
}: {
  name?: string;
  avatarUri?: string | null;
  onAnswer: (save: boolean) => void;
  onBack?: (() => void) | null;
}) {
  const { spacing } = useTheme();
  return (
    <AuthStep onBack={onBack} title="Save your login info?">
      <Text>
        {`We'll save the login info for ${name ?? 'your account'}, so you won't need to enter it the next time you log in.`}
      </Text>
      {avatarUri !== undefined ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Avatar uri={avatarUri} size={88} />
        </View>
      ) : null}
      <View style={{ gap: spacing.md }}>
        <Button title="Save" shape="pill" size="lg" fullWidth onPress={() => onAnswer(true)} />
        <Button
          title="Not now"
          variant="outline"
          shape="pill"
          size="lg"
          fullWidth
          onPress={() => onAnswer(false)}
        />
      </View>
    </AuthStep>
  );
}
