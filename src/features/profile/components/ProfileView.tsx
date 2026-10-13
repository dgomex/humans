import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { Avatar, Button, Icon, Text, useToast, type IconName } from '@/components';
import { FollowButton } from '@/features/follows/FollowButton';
import { postKeys } from '@/features/posts/api';
import { useTheme } from '@/theme';

import {
  followStatusOf,
  parseLinks,
  parseMutuals,
  useHighlights,
  type FollowStatus,
  type ProfileDetails,
} from '../api';
import { avatarUrl } from '../avatar';
import { displayLink, formatCount, openConnections } from '../format';
import { BioText } from './BioText';
import { useChangePhotoSheet } from './ChangePhotoSheet';
import { HighlightsRow } from './HighlightsRow';
import { ringOf, useStoryRing } from '@/features/stories/api';
import { setStoryQueue } from '@/features/stories/viewerQueue';
import { FollowingSheet, LinksSheet } from './ProfileSheets';
import { PROFILE_TABS, ProfileTabBar, ProfileTabPages, type ProfileTabKey } from './ProfileTabs';
import { RequestBanner } from '@/features/activity/components/RequestBanner';

import { SuggestedStrip } from './SuggestedStrip';

const AVATAR = 86;

/**
 * Pages 16/17/18 — the profile body shared by the own profile, other profiles and the private
 * locked state: identity row, bio, links, mutuals, action buttons, highlights, sticky tabs.
 */
export function ProfileView({
  profile,
  refreshing,
  onRefresh,
}: {
  profile: ProfileDetails;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { colors, spacing } = useTheme();
  const isOwn = profile.is_self;
  const locked = !profile.can_view;
  const highlights = useHighlights(profile.id, !locked);
  const [tab, setTab] = useState<ProfileTabKey>('grid');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const pager = useRef<ScrollView>(null);
  const loadMore = useRef<(() => void) | null>(null);
  const { width } = useWindowDimensions();
  const qc = useQueryClient();

  function selectTab(next: ProfileTabKey) {
    setTab(next);
    pager.current?.scrollTo({ x: PROFILE_TABS.indexOf(next) * width, animated: true });
  }

  return (
    <ScrollView
      stickyHeaderIndices={locked ? undefined : [1]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void qc.invalidateQueries({ queryKey: postKeys.all });
            onRefresh();
          }}
        />
      }
      scrollEventThrottle={200}
      onScroll={(e) => {
        // Next page of the active grid when near the bottom.
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (layoutMeasurement.height + contentOffset.y > contentSize.height - 600) {
          loadMore.current?.();
        }
      }}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ paddingBottom: spacing.md }}>
        <Identity profile={profile} />
        <Bio profile={profile} />
        {isOwn ? null : (
          <RequestBanner userId={profile.id} username={profile.username} onAnswered={onRefresh} />
        )}
        <Actions
          profile={profile}
          suggestionsOn={showSuggestions}
          onToggleSuggestions={() => setShowSuggestions((v) => !v)}
        />
        {showSuggestions ? <SuggestedStrip /> : null}
        {isOwn ? (
          <CompleteProfile profile={profile} onFindPeople={() => setShowSuggestions(true)} />
        ) : null}
        {locked ? null : (
          <HighlightsRow highlights={highlights.data ?? []} isOwn={isOwn} ownerId={profile.id} />
        )}
      </View>
      {locked ? <PrivateNotice /> : <ProfileTabBar active={tab} onChange={selectTab} />}
      {locked ? (
        <SuggestedStrip title="Suggested for you" />
      ) : (
        <ProfileTabPages
          pagerRef={pager}
          active={tab}
          onSwipe={setTab}
          isOwn={isOwn}
          userId={profile.id}
          username={profile.username}
          loadMoreRef={loadMore}
        />
      )}
    </ScrollView>
  );
}

function Identity({ profile }: { profile: ProfileDetails }) {
  const { colors, spacing } = useTheme();
  const isOwn = profile.is_self;
  // Page 52: a ring around the picture when there are active stories you can see.
  const ring = useStoryRing(profile.can_view ? profile.id : undefined);
  const canOpenLists = profile.can_view;

  const stats: { label: string; value: number; onPress?: () => void }[] = [
    { label: profile.posts_count === 1 ? 'post' : 'posts', value: profile.posts_count },
    {
      label: profile.followers_count === 1 ? 'follower' : 'followers',
      value: profile.followers_count,
      onPress: canOpenLists ? () => openConnections(profile.username, 'followers') : undefined,
    },
    {
      label: 'following',
      value: profile.following_count,
      onPress: canOpenLists ? () => openConnections(profile.username, 'following') : undefined,
    },
  ];

  return (
    <View style={[styles.identity, { paddingHorizontal: spacing.lg, gap: spacing.xl }]}>
      <View>
        <Avatar
          uri={avatarUrl(profile.avatar_path)}
          size={AVATAR}
          // Your own active stories keep the colored ring (you never "see" them), like the tray.
          ring={isOwn && ring.data ? 'unseen' : ringOf(ring.data)}
          onPress={
            ring.data
              ? () => {
                  setStoryQueue([profile.id]);
                  router.push({ pathname: '/stories/[userId]', params: { userId: profile.id } });
                }
              : isOwn
                ? () => router.push('/story/camera')
                : undefined
          }
          accessibilityLabel={
            ring.data
              ? `${profile.username}'s story`
              : isOwn
                ? 'Add to your story'
                : `${profile.username}'s profile picture`
          }
        />
        {isOwn ? (
          <Pressable
            onPress={() => router.push('/story/camera')}
            accessibilityRole="button"
            accessibilityLabel="Add to your story"
            style={[
              styles.addBadge,
              { backgroundColor: colors.text, borderColor: colors.background },
            ]}
          >
            <Icon name="add" size={18} color={colors.background} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        {profile.full_name ? (
          <Text variant="bodyBold" numberOfLines={1}>
            {profile.full_name}
          </Text>
        ) : null}
        <View style={styles.stats}>
          {stats.map((s) => (
            <Pressable
              key={s.label}
              onPress={s.onPress}
              disabled={!s.onPress}
              accessibilityRole={s.onPress ? 'button' : undefined}
              style={styles.stat}
            >
              <Text variant="subhead">{formatCount(s.value)}</Text>
              <Text>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function Bio({ profile }: { profile: ProfileDetails }) {
  const { spacing } = useTheme();
  const [linksOpen, setLinksOpen] = useState(false);
  const links = parseLinks(profile.links);
  const mutuals = parseMutuals(profile.mutual_preview);

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xxs }}>
      <BioText bio={profile.bio} />
      {links.length > 0 ? (
        <Pressable
          onPress={() => setLinksOpen(true)}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Icon name="link" size={16} />
          <Text variant="bodyBold" color="link" numberOfLines={1} style={{ flexShrink: 1 }}>
            {links[0].title || displayLink(links[0].url)}
            {links.length > 1
              ? ` and ${links.length - 1} ${links.length === 2 ? 'other' : 'others'}`
              : ''}
          </Text>
        </Pressable>
      ) : null}
      {mutuals.length > 0 ? <MutualsLine profile={profile} names={mutuals} /> : null}
      <LinksSheet visible={linksOpen} onClose={() => setLinksOpen(false)} profile={profile} />
    </View>
  );
}

function MutualsLine({
  profile,
  names,
}: {
  profile: ProfileDetails;
  names: ReturnType<typeof parseMutuals>;
}) {
  const { colors, spacing } = useTheme();
  const shown = names.slice(0, 2).map((m) => m.username);
  const others = profile.mutual_count - shown.length;
  const text =
    others > 0
      ? `${shown.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`
      : shown.join(' and ');

  return (
    <Pressable
      onPress={() => openConnections(profile.username, 'mutual')}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}
    >
      <View style={{ flexDirection: 'row' }}>
        {names.slice(0, 3).map((m, i) => (
          <View
            key={m.username}
            style={{
              marginLeft: i === 0 ? 0 : -8,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: colors.background,
            }}
          >
            <Avatar uri={avatarUrl(m.avatar_path)} size={20} />
          </View>
        ))}
      </View>
      <Text variant="caption" style={{ flex: 1 }}>
        <Text variant="caption" color="textSecondary">
          Followed by{' '}
        </Text>
        <Text variant="captionBold">{text}</Text>
      </Text>
    </Pressable>
  );
}

/** Gray profile button (Edit profile, Share profile, Message, Following ▾). */
function ProfileButton({
  children,
  onPress,
  square,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  square?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        {
          // flex: 0 collapses to zero width on web; a fixed, non-shrinking square instead.
          ...(square ? { width: 34, flexShrink: 0 } : { flex: 1 }),
          borderRadius: radius.md,
          gap: spacing.xs,
          backgroundColor: pressed ? colors.backgroundPressed : colors.backgroundSecondary,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function Actions({
  profile,
  suggestionsOn,
  onToggleSuggestions,
}: {
  profile: ProfileDetails;
  suggestionsOn: boolean;
  onToggleSuggestions: () => void;
}) {
  const { spacing } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  // Optimistic status while the follow mutation runs; the server value wins once it refetches.
  const [override, setOverride] = useState<{ server: FollowStatus; local: FollowStatus } | null>(
    null,
  );
  const server = followStatusOf(profile);
  const status = override && override.server === server ? override.local : server;
  const suggestIcon: IconName = suggestionsOn ? 'personAddFilled' : 'personAdd';

  const suggestButton = (
    <ProfileButton square onPress={onToggleSuggestions} accessibilityLabel="Suggested accounts">
      <Icon name={suggestIcon} size={16} />
    </ProfileButton>
  );

  if (profile.is_self) {
    return (
      <View style={[styles.actions, { gap: spacing.xs, paddingHorizontal: spacing.lg }]}>
        <ProfileButton onPress={() => router.push('/edit-profile')}>
          <Text variant="bodyBold">Edit profile</Text>
        </ProfileButton>
        <ProfileButton onPress={() => router.push('/qr')}>
          <Text variant="bodyBold">Share profile</Text>
        </ProfileButton>
        {suggestButton}
      </View>
    );
  }

  return (
    <View style={[styles.actions, { gap: spacing.xs, paddingHorizontal: spacing.lg }]}>
      {status === 'following' ? (
        <ProfileButton onPress={() => setSheet(true)} accessibilityLabel="Following options">
          <Text variant="bodyBold">Following</Text>
          <Icon name="down" size={14} />
        </ProfileButton>
      ) : (
        <View style={{ flex: 1 }}>
          <FollowButton
            userId={profile.id}
            username={profile.username}
            status={status}
            followsMe={profile.follows_me}
            isPrivate={profile.is_private}
            onChange={(local) => setOverride({ server, local })}
            fill
          />
        </View>
      )}
      <ProfileButton onPress={() => toast.show('Messages are coming soon')}>
        <Text variant="bodyBold">Message</Text>
      </ProfileButton>
      {suggestButton}
      <FollowingSheet visible={sheet} onClose={() => setSheet(false)} profile={profile} />
    </View>
  );
}

/** "Complete your profile" cards for new accounts (own profile only). */
function CompleteProfile({
  profile,
  onFindPeople,
}: {
  profile: ProfileDetails;
  onFindPeople: () => void;
}) {
  const { colors, spacing, radius, hairline } = useTheme();
  const photo = useChangePhotoSheet();
  const steps: {
    key: string;
    done: boolean;
    icon: IconName;
    title: string;
    body: string;
    cta: string;
    onPress: () => void;
  }[] = [
    {
      key: 'photo',
      done: !!profile.avatar_path,
      icon: 'person',
      title: 'Add profile photo',
      body: 'Choose a profile photo to represent yourself.',
      cta: 'Add photo',
      onPress: photo.open,
    },
    {
      key: 'name',
      done: !!profile.full_name,
      icon: 'person',
      title: 'Add your name',
      body: 'Add your full name so your friends know it’s you.',
      cta: 'Add name',
      onPress: () => router.push({ pathname: '/edit-profile/[field]', params: { field: 'name' } }),
    },
    {
      key: 'bio',
      done: !!profile.bio,
      icon: 'comment',
      title: 'Add bio',
      body: 'Tell your followers a little bit about yourself.',
      cta: 'Add bio',
      onPress: () => router.push({ pathname: '/edit-profile/[field]', params: { field: 'bio' } }),
    },
    {
      key: 'follow',
      done: profile.following_count > 0,
      icon: 'personAdd',
      title: 'Find people to follow',
      body: 'Follow people and interests you care about.',
      cta: 'Find more',
      onPress: onFindPeople,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Text variant="bodyBold">Complete your profile</Text>
        <Text variant="caption" color="textSecondary">
          <Text variant="captionBold" style={{ color: colors.success }}>
            {`${doneCount} of ${steps.length}`}
          </Text>
          {' complete'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {steps.map((s) => (
          <View
            key={s.key}
            style={{
              width: 160,
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: hairline * 2,
              borderColor: colors.separator,
            }}
          >
            <View style={[styles.stepIcon, { borderColor: colors.text }]}>
              <Icon name={s.done ? 'check' : s.icon} size={22} />
            </View>
            <Text variant="bodyBold" style={styles.center}>
              {s.title}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.center} numberOfLines={3}>
              {s.body}
            </Text>
            <Button
              title={s.done ? 'Done' : s.cta}
              variant={s.done ? 'secondary' : 'primary'}
              size="sm"
              fullWidth
              disabled={s.done}
              onPress={s.onPress}
              style={{ marginTop: 'auto' }}
            />
          </View>
        ))}
      </ScrollView>
      {photo.sheet}
    </View>
  );
}

/** Page 18 — what a non-approved viewer sees instead of the tabs. */
function PrivateNotice() {
  const { colors, spacing, hairline } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
        borderTopWidth: hairline,
        borderTopColor: colors.separator,
      }}
    >
      <View style={[styles.lockCircle, { borderColor: colors.text }]}>
        <Icon name="lock" size={30} />
      </View>
      <Text variant="subhead">This account is private</Text>
      <Text color="textSecondary" style={styles.center}>
        Follow this account to see their photos and videos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 8 },
  stat: { alignItems: 'flex-start' },
  actions: { flexDirection: 'row', marginTop: 12 },
  button: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
