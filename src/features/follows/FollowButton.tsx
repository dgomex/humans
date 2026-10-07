import * as Haptics from 'expo-haptics';

import { Button, useToast } from '@/components';

import { useFollow } from './api';

/** Blue "Follow" ↔ gray "Following", optimistic. The parent owns `following`. */
export function FollowButton({
  userId,
  following,
  onChange,
}: {
  userId: string;
  following: boolean;
  onChange: (following: boolean) => void;
}) {
  const follow = useFollow();
  const toast = useToast();

  return (
    <Button
      title={following ? 'Following' : 'Follow'}
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      style={{ minWidth: 96 }}
      onPress={() => {
        const next = !following;
        onChange(next);
        void Haptics.selectionAsync().catch(() => {});
        follow.mutate(
          { userId, follow: next },
          {
            onError: () => {
              onChange(!next);
              toast.show("Couldn't update. Try again.");
            },
          },
        );
      }}
    />
  );
}
