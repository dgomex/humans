import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Share, Switch, View } from 'react-native';

import { ActionGroup, ActionRow, BottomSheet, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

import {
  parseLinks,
  useBellPrefs,
  useFollowAction,
  useRemoveFollower,
  useSetBellPref,
  useToggleList,
  type BellKey,
  type ProfileDetails,
} from '../api';
import { displayLink, profileUrl } from '../format';

type SheetProps = { visible: boolean; onClose: () => void };

const soon = 'Coming soon';

/** Close the sheet, then run the action once it has started animating out. */
function after(onClose: () => void, action: () => void) {
  return () => {
    onClose();
    setTimeout(action, 250);
  };
}

export async function copyProfileLink(username: string, toast: ReturnType<typeof useToast>) {
  await Clipboard.setStringAsync(profileUrl(username));
  toast.show('Link copied');
}

export function shareProfile(username: string) {
  const url = profileUrl(username);
  return Share.share({ message: url, url }).catch(() => {});
}

/** "Following ▾" on another profile: Close Friends, Favorites, Mute, Restrict, Unfollow. */
export function FollowingSheet({
  visible,
  onClose,
  profile,
}: SheetProps & { profile: ProfileDetails }) {
  const { colors } = useTheme();
  const toast = useToast();
  const closeFriends = useToggleList('close_friends');
  const favorites = useToggleList('favorites');
  const follow = useFollowAction();

  function unfollow() {
    const run = () =>
      follow.mutate(
        { userId: profile.id, follow: false },
        { onError: () => toast.show("Couldn't unfollow. Try again.") },
      );
    if (profile.is_private) {
      showDialog(
        `Unfollow @${profile.username}?`,
        "If you change your mind, you'll have to request to follow again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfollow', style: 'destructive', onPress: run },
        ],
      );
    } else {
      run();
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={profile.username}>
      <ActionRow
        icon="closeFriends"
        label={
          profile.is_close_friend ? 'Remove from close friends list' : 'Add to close friends list'
        }
        trailing={
          profile.is_close_friend ? <Icon name="checkCircle" color={colors.closeFriends} /> : null
        }
        onPress={() => closeFriends.mutate({ userId: profile.id, on: !profile.is_close_friend })}
      />
      <ActionRow
        icon={profile.is_favorite ? 'star' : 'starOutline'}
        label={profile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        onPress={() =>
          favorites.mutate(
            { userId: profile.id, on: !profile.is_favorite },
            {
              onError: (e) =>
                toast.show(
                  e.message === 'favorites_limit'
                    ? 'You can add up to 50 favorites.'
                    : "Couldn't update favorites.",
                ),
            },
          )
        }
      />
      <ActionRow icon="mute" label="Mute" onPress={() => toast.show(soon)} />
      <ActionRow icon="restrict" label="Restrict" onPress={() => toast.show(soon)} />
      <ActionRow label="Unfollow" destructive onPress={after(onClose, unfollow)} />
    </BottomSheet>
  );
}

const BELL_ROWS: { key: BellKey; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
  { key: 'live', label: 'Live videos' },
];

/** Bell on another profile: which of their activity notifies you (delivered in Phase 8). */
export function BellSheet({ visible, onClose, profile }: SheetProps & { profile: ProfileDetails }) {
  const { colors, spacing } = useTheme();
  const { session } = useAuth();
  const prefs = useBellPrefs(visible ? profile.id : undefined);
  const set = useSetBellPref(session?.user.id, profile.id);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Notifications">
      {BELL_ROWS.map((r) => (
        <ActionRow
          key={r.key}
          label={r.label}
          trailing={
            <Switch
              value={!!prefs.data?.[r.key]}
              onValueChange={(v) => set.mutate({ [r.key]: v })}
              trackColor={{ true: colors.primary, false: colors.backgroundPressed }}
            />
          }
        />
      ))}
      <Text
        variant="caption"
        color="textSecondary"
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
      >
        {`Get notified when @${profile.username} shares.`}
      </Text>
    </BottomSheet>
  );
}

/** ⋯ on another profile (page 23). */
export function ProfileOptionsSheet({
  visible,
  onClose,
  profile,
}: SheetProps & { profile: ProfileDetails }) {
  const toast = useToast();
  const { session } = useAuth();
  const remove = useRemoveFollower();
  const me = session?.user.id;

  function removeFollower() {
    showDialog(
      'Remove follower?',
      `We won't tell @${profile.username} they were removed from your followers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            me &&
            remove.mutate(
              { me, followerId: profile.id },
              { onError: () => toast.show("Couldn't remove follower.") },
            ),
        },
      ],
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ActionGroup>
        <ActionRow
          icon="report"
          label="Report…"
          destructive
          onPress={after(onClose, () => toast.show(soon))}
        />
        <ActionRow
          icon="block"
          label="Block"
          destructive
          onPress={after(onClose, () => toast.show(soon))}
        />
      </ActionGroup>
      <ActionGroup>
        <ActionRow
          icon="info"
          label="About this account"
          onPress={after(onClose, () =>
            router.push({ pathname: '/[username]/about', params: { username: profile.username } }),
          )}
        />
        <ActionRow
          icon="restrict"
          label="Restrict"
          onPress={after(onClose, () => toast.show(soon))}
        />
        <ActionRow
          icon="hide"
          label="Hide your story"
          onPress={after(onClose, () => toast.show(soon))}
        />
        {profile.follows_me ? (
          <ActionRow
            icon="close"
            label="Remove follower"
            onPress={after(onClose, removeFollower)}
          />
        ) : null}
      </ActionGroup>
      <ActionGroup>
        <ActionRow
          icon="copy"
          label="Copy profile URL"
          onPress={after(onClose, () => void copyProfileLink(profile.username, toast))}
        />
        <ActionRow
          icon="qr"
          label="Show QR code"
          onPress={after(onClose, () =>
            router.push({ pathname: '/qr', params: { username: profile.username } }),
          )}
        />
        <ActionRow
          icon="sendPlane"
          label="Share this profile"
          onPress={after(onClose, () => void shareProfile(profile.username))}
        />
      </ActionGroup>
    </BottomSheet>
  );
}

/** "example.com and 2 others" → all bio links. */
export function LinksSheet({
  visible,
  onClose,
  profile,
}: SheetProps & { profile: ProfileDetails }) {
  const { spacing } = useTheme();
  const links = parseLinks(profile.links);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Links">
      {links.map((l, i) => (
        <Pressable
          key={`${l.url}-${i}`}
          onPress={after(onClose, () => void WebBrowser.openBrowserAsync(l.url))}
          accessibilityRole="link"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Icon name="link" />
          <View style={{ flex: 1 }}>
            {l.title ? <Text variant="bodyBold">{l.title}</Text> : null}
            <Text color={l.title ? 'textSecondary' : 'text'} numberOfLines={1}>
              {displayLink(l.url)}
            </Text>
          </View>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

/** "+" on the own profile: what to create. */
export function CreateSheet({ visible, onClose }: SheetProps) {
  const create = after(onClose, () => router.push('/compose'));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create">
      <ActionRow icon="reels" label="Reel" onPress={create} />
      <ActionRow icon="post" label="Post" onPress={create} />
      <ActionRow icon="story" label="Story" onPress={create} />
      <ActionRow
        icon="addCircle"
        label="Story highlight"
        onPress={after(onClose, () => router.push('/highlights/new'))}
      />
      <ActionRow icon="live" label="Live" onPress={create} />
    </BottomSheet>
  );
}

/**
 * ☰ on the own profile. STUB of "Settings and activity" (page 86, Phase 11): only the Phase 2–8
 * destinations (Archive, Notifications, Follow requests, Discover people) + temporary Log out.
 */
export function OwnMenuSheet({
  visible,
  onClose,
  requestCount,
}: SheetProps & { requestCount: number }) {
  const auth = useAuth();
  const { colors, spacing } = useTheme();
  const go = (
    path:
      | '/saved'
      | '/archive'
      | '/close-friends'
      | '/favorites'
      | '/activity'
      | '/activity/requests'
      | '/discover-people'
      | '/qr',
  ) => after(onClose, () => router.push(path));
  const username = auth.profile?.username ?? '';

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Settings and activity">
      <ActionRow icon="bookmark" label="Saved" onPress={go('/saved')} />
      <ActionRow icon="archive" label="Archive" onPress={go('/archive')} />
      <ActionRow icon="closeFriends" label="Close Friends" onPress={go('/close-friends')} />
      <ActionRow icon="starOutline" label="Favorites" onPress={go('/favorites')} />
      <ActionRow icon="heart" label="Notifications" onPress={go('/activity')} />
      <ActionRow
        icon="personAdd"
        label="Follow requests"
        onPress={go('/activity/requests')}
        trailing={
          requestCount > 0 ? (
            <View
              style={{
                minWidth: 20,
                paddingHorizontal: spacing.xs,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.like,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="captionBold" style={{ color: colors.onPrimary }}>
                {requestCount}
              </Text>
            </View>
          ) : null
        }
      />
      <ActionRow icon="contacts" label="Discover people" onPress={go('/discover-people')} />
      <ActionRow icon="qr" label="QR code" onPress={go('/qr')} />
      <ActionRow
        icon="logout"
        label={`Log out ${username}`}
        destructive
        onPress={after(onClose, () =>
          showDialog(`Log out of ${username}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => void auth.logout() },
          ]),
        )}
      />
    </BottomSheet>
  );
}
