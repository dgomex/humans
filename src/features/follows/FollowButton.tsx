import * as Haptics from 'expo-haptics';

import { Button, useToast, type ButtonSize } from '@/components';
import { useFollowAction, type FollowStatus } from '@/features/profile/api';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/**
 * Follow button with Instagram's states: blue "Follow" / "Follow back", gray "Following" /
 * "Requested". Private targets go to "Requested". Optimistic; the parent owns `status`.
 * Unfollowing a private account (or cancelling a request) asks first.
 */
export function FollowButton({
  userId,
  username,
  status,
  followsMe = false,
  isPrivate = false,
  onChange,
  size = 'sm',
  fill = false,
}: {
  userId: string;
  username?: string;
  status: FollowStatus;
  followsMe?: boolean;
  isPrivate?: boolean;
  onChange: (status: FollowStatus) => void;
  size?: ButtonSize;
  /** Stretch to the parent's width (profile action row). */
  fill?: boolean;
}) {
  const follow = useFollowAction();
  const toast = useToast();
  const { spacing } = useTheme();

  function run(next: FollowStatus) {
    const prev = status;
    onChange(next);
    void Haptics.selectionAsync().catch(() => {});
    follow.mutate(
      { userId, follow: next !== 'none' },
      {
        onSuccess: (server) => {
          if (server !== next) onChange(server);
        },
        onError: () => {
          onChange(prev);
          toast.show("Couldn't update. Try again.");
        },
      },
    );
  }

  function onPress() {
    if (status === 'none') {
      run(isPrivate ? 'requested' : 'following');
    } else if (status === 'requested') {
      showDialog(
        'Cancel follow request?',
        username ? `@${username} won't see that you requested to follow.` : undefined,
        [
          { text: 'Keep request', style: 'cancel' },
          { text: 'Cancel request', style: 'destructive', onPress: () => run('none') },
        ],
      );
    } else if (isPrivate) {
      showDialog(
        username ? `Unfollow @${username}?` : 'Unfollow?',
        "If you change your mind, you'll have to request to follow again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfollow', style: 'destructive', onPress: () => run('none') },
        ],
      );
    } else {
      run('none');
    }
  }

  const title =
    status === 'following'
      ? 'Following'
      : status === 'requested'
        ? 'Requested'
        : followsMe
          ? 'Follow back'
          : 'Follow';

  return (
    <Button
      title={title}
      variant={status === 'none' ? 'primary' : 'secondary'}
      size={size}
      style={fill ? { flex: 1 } : { minWidth: 96, paddingHorizontal: spacing.md }}
      onPress={onPress}
    />
  );
}
