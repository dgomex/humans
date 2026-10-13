import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text, UserRow } from '@/components';
import { FollowButton } from '@/features/follows/FollowButton';
import type { FollowStatus } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount } from '@/features/profile/format';
import { useTheme } from '@/theme';

import type { AccountResult, AudioResult, HashtagResult, RecentSearch } from '../api';

/** "Following" · "Followed by x + N more" · full name — Instagram's account result subtitle. */
export function accountSubtitle(a: {
  full_name: string | null;
  i_follow?: boolean | null;
  followed_by?: string | null;
  mutual_count?: number | null;
}) {
  const parts = [a.full_name || null];
  if (a.i_follow) parts.push('Following');
  else if (a.followed_by) {
    const more = (a.mutual_count ?? 1) - 1;
    parts.push(`Followed by ${a.followed_by}${more > 0 ? ` + ${more} more` : ''}`);
  }
  return parts.filter(Boolean).join(' • ');
}

export function AccountResultRow({
  account,
  onPress,
  status,
  onStatus,
  trailing,
}: {
  account: AccountResult;
  onPress: () => void;
  /** With a follow status: shows the Follow button (Accounts tab). */
  status?: FollowStatus;
  onStatus?: (s: FollowStatus) => void;
  trailing?: React.ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <UserRow
        username={account.username}
        subtitle={accountSubtitle(account)}
        avatarUri={avatarUrl(account.avatar_path)}
        onPress={onPress}
        trailing={
          trailing ??
          (status && onStatus ? (
            <FollowButton
              userId={account.id}
              username={account.username}
              isPrivate={account.is_private}
              status={status}
              onChange={onStatus}
            />
          ) : undefined)
        }
      />
    </View>
  );
}

/** Round icon bubble used by hashtag / keyword / audio rows (same size as avatars). */
function Bubble({ icon, color }: { icon: 'hashtag' | 'search' | 'music'; color?: string }) {
  const { colors, hairline } = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: color ?? 'transparent',
          borderColor: colors.separator,
          borderWidth: color ? 0 : hairline * 2,
        },
      ]}
    >
      <Icon name={icon} size={22} color={color ? colors.onMedia : colors.icon} />
    </View>
  );
}

function Row({
  left,
  title,
  subtitle,
  onPress,
  trailing,
  accessibilityLabel,
}: {
  left: React.ReactNode;
  title: string;
  subtitle?: string | null;
  onPress: () => void;
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, spacing } = useTheme();
  // The trailing control (✕) sits beside the row's button, not inside it.
  return (
    <View style={[styles.row, { paddingRight: trailing ? spacing.lg : 0 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [
          styles.row,
          {
            flex: 1,
            gap: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: trailing ? spacing.md : spacing.lg,
            paddingVertical: spacing.sm,
            backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
          },
        ]}
      >
        {left}
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const postsLabel = (n: number) => `${formatCount(n)} ${n === 1 ? 'post' : 'posts'}`;

export function HashtagRow({ tag, onPress }: { tag: HashtagResult; onPress: () => void }) {
  return (
    <Row
      left={<Bubble icon="hashtag" />}
      title={`#${tag.name}`}
      subtitle={postsLabel(tag.post_count)}
      onPress={onPress}
    />
  );
}

export function KeywordRow({ query, onPress }: { query: string; onPress: () => void }) {
  return (
    <Row
      left={<Bubble icon="search" />}
      title={query}
      onPress={onPress}
      accessibilityLabel={`Search for ${query}`}
    />
  );
}

export function AudioRow({ audio, onPress }: { audio: AudioResult; onPress: () => void }) {
  const original = audio.source === 'original';
  return (
    <Row
      left={
        original && audio.owner_avatar_path ? (
          <Avatar uri={avatarUrl(audio.owner_avatar_path)} size={44} />
        ) : (
          <Bubble icon="music" color={audio.cover_color} />
        )
      }
      title={audio.title}
      subtitle={[
        original ? `${audio.owner_username ?? audio.artist} · Original audio` : audio.artist,
        audio.reel_count > 0
          ? `${formatCount(audio.reel_count)} ${audio.reel_count === 1 ? 'reel' : 'reels'}`
          : null,
      ]
        .filter(Boolean)
        .join(' • ')}
      onPress={onPress}
    />
  );
}

/** A recent search with ✕ (page 67). */
export function RecentRow({
  item,
  onPress,
  onRemove,
}: {
  item: RecentSearch;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const remove = (
    <Pressable
      onPress={onRemove}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Remove from recent searches"
    >
      <Icon name="close" size={20} color={colors.textSecondary} />
    </Pressable>
  );
  switch (item.kind) {
    case 'account':
      return (
        <Row
          left={<Avatar uri={avatarUrl(item.avatar_path)} size={44} />}
          title={item.username ?? ''}
          subtitle={accountSubtitle({ full_name: item.full_name, i_follow: item.i_follow })}
          onPress={onPress}
          trailing={remove}
        />
      );
    case 'hashtag':
      return (
        <Row
          left={<Bubble icon="hashtag" />}
          title={`#${item.tag_name ?? ''}`}
          subtitle={postsLabel(item.post_count ?? 0)}
          onPress={onPress}
          trailing={remove}
        />
      );
    case 'audio':
      return (
        <Row
          left={
            item.audio_source === 'original' && item.audio_owner_avatar_path ? (
              <Avatar uri={avatarUrl(item.audio_owner_avatar_path)} size={44} />
            ) : (
              <Bubble icon="music" color={item.audio_cover_color ?? undefined} />
            )
          }
          title={item.audio_title ?? ''}
          subtitle={item.audio_artist}
          onPress={onPress}
          trailing={remove}
        />
      );
    default:
      return (
        <Row
          left={<Bubble icon="search" />}
          title={item.query ?? ''}
          onPress={onPress}
          trailing={remove}
        />
      );
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
