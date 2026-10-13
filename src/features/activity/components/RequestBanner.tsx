import { View } from 'react-native';

import { Button, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

import { useAnswerRequest, useRequestFrom } from '../api';

/** Page 72 — "<user> wants to follow you" with Confirm / Delete on the requester's profile. */
export function RequestBanner({
  userId,
  username,
  onAnswered,
}: {
  userId: string;
  username: string;
  onAnswered: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { session } = useAuth();
  const toast = useToast();
  const pending = useRequestFrom(userId, session?.user.id);
  const answer = useAnswerRequest();
  if (!pending.data) return null;

  const reply = (approve: boolean) =>
    answer.mutate(
      { requesterId: userId, approve },
      {
        onSuccess: onAnswered,
        onError: () => toast.show("Couldn't update the request."),
      },
    );

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      <Text>
        <Text variant="bodyBold">{username}</Text> wants to follow you.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Confirm"
          size="sm"
          style={{ flex: 1 }}
          loading={answer.isPending && answer.variables?.approve === true}
          onPress={() => reply(true)}
        />
        <Button
          title="Delete"
          size="sm"
          variant="secondary"
          style={{ flex: 1 }}
          loading={answer.isPending && answer.variables?.approve === false}
          onPress={() => reply(false)}
        />
      </View>
    </View>
  );
}
