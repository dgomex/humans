import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import {
  ActionGroup,
  ActionRow,
  BottomSheet,
  Button,
  Icon,
  Text,
  useToast,
  type IconName,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useDeletePost,
  useRemoveMyTag,
  useUpdatePostFlags,
  type PostFlags,
} from '@/features/posts/api';
import { useFollowAction, useToggleList } from '@/features/profile/api';
import { useCollections } from '@/features/saved/api';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

import {
  invalidateFeeds,
  removeFromFeeds,
  useAddToCollection,
  useHidePost,
  useToggleRepost,
  useToggleSave,
  type FeedPost,
  type FeedReason,
  type HideReason,
} from '../api';
import { postUrl } from '../format';

type OptionsContext = { reason?: FeedReason; inFeed?: boolean };

type PostSheetsValue = {
  openOptions: (post: FeedPost, ctx?: OptionsContext) => void;
  openShare: (post: FeedPost) => void;
  openCollections: (post: FeedPost) => void;
  /** Save / unsave with the "Saved · Save to collection" toast. */
  toggleSave: (post: FeedPost) => void;
  /** Repost / Undo repost (with an "Add note" toast action). */
  toggleRepost: (post: FeedPost) => void;
  /** Posts hidden in place during this session (card shows the Undo panel). */
  hidden: Record<string, HideReason>;
  undoHide: (postId: string) => void;
};

const PostSheetsContext = createContext<PostSheetsValue | null>(null);

type Open =
  | { kind: 'options'; post: FeedPost; ctx: OptionsContext }
  | { kind: 'share'; post: FeedPost }
  | { kind: 'collections'; post: FeedPost }
  | { kind: 'why'; post: FeedPost; ctx: OptionsContext }
  | { kind: 'note'; post: FeedPost }
  | null;

/**
 * Pages 48–49 — share sheet, post options (⋯), save-to-collection, "Why you're seeing this
 * post" and the repost note, shared by every post card. Mount once inside the signed-in app.
 */
export function PostSheetsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Open>(null);
  const [hidden, setHidden] = useState<Record<string, HideReason>>({});
  const save = useToggleSave();
  const repost = useToggleRepost();
  const hide = useHidePost();

  const close = useCallback(() => setOpen(null), []);

  const toggleSave = useCallback(
    (post: FeedPost) => {
      const next = !post.saved;
      save.mutate(
        { postId: post.id, save: next },
        { onError: () => toast.show("Couldn't update. Try again.") },
      );
      if (next) {
        toast.show('Saved', {
          actionLabel: 'Save to collection',
          onAction: () => setOpen({ kind: 'collections', post }),
        });
      }
    },
    [save, toast],
  );

  const toggleRepost = useCallback(
    (post: FeedPost) => {
      const next = !post.reposted;
      repost.mutate(
        { postId: post.id, repost: next },
        { onError: () => toast.show("Couldn't repost. Try again.") },
      );
      toast.show(
        next ? 'Reposted' : 'Repost removed',
        next ? { actionLabel: 'Add note', onAction: () => setOpen({ kind: 'note', post }) } : {},
      );
    },
    [repost, toast],
  );

  const hidePost = useCallback(
    (post: FeedPost, reason: HideReason) => {
      setHidden((h) => ({ ...h, [post.id]: reason }));
      hide.mutate(
        { postId: post.id, reason },
        {
          onError: () => {
            setHidden(({ [post.id]: _, ...rest }) => rest);
            toast.show("Couldn't hide the post.");
          },
        },
      );
    },
    [hide, toast],
  );

  const undoHide = useCallback(
    (postId: string) => {
      const reason = hidden[postId];
      if (!reason) return;
      setHidden(({ [postId]: _, ...rest }) => rest);
      hide.mutate({ postId, reason, undo: true });
    },
    [hidden, hide],
  );

  const value = useMemo<PostSheetsValue>(
    () => ({
      openOptions: (post, ctx = {}) => setOpen({ kind: 'options', post, ctx }),
      openShare: (post) => setOpen({ kind: 'share', post }),
      openCollections: (post) => setOpen({ kind: 'collections', post }),
      toggleSave,
      toggleRepost,
      hidden,
      undoHide,
    }),
    [toggleSave, toggleRepost, hidden, undoHide],
  );

  return (
    <PostSheetsContext.Provider value={value}>
      {children}
      <OptionsSheet
        open={open?.kind === 'options' ? open : null}
        onClose={close}
        onWhy={(post, ctx) => setOpen({ kind: 'why', post, ctx })}
        onSave={toggleSave}
        onHide={(post, reason) => {
          close();
          hidePost(post, reason);
          if (reason === 'not_interested') removeFromFeeds(qc, post.id);
        }}
      />
      <ShareSheet
        post={open?.kind === 'share' ? open.post : null}
        onClose={close}
        onRepost={(post) => {
          close();
          toggleRepost(post);
        }}
      />
      <CollectionsSheet post={open?.kind === 'collections' ? open.post : null} onClose={close} />
      <WhySheet open={open?.kind === 'why' ? open : null} onClose={close} />
      <RepostNoteSheet post={open?.kind === 'note' ? open.post : null} onClose={close} />
    </PostSheetsContext.Provider>
  );
}

export function usePostSheets() {
  const ctx = useContext(PostSheetsContext);
  if (!ctx) throw new Error('usePostSheets must be used inside PostSheetsProvider');
  return ctx;
}

async function copyLink(post: FeedPost, toast: ReturnType<typeof useToast>) {
  await Clipboard.setStringAsync(postUrl(post.id));
  toast.show('Link copied');
}

// ---------------------------------------------------------------------------------------------
// ⋯ Post options (page 49)
// ---------------------------------------------------------------------------------------------

function OptionsSheet({
  open,
  onClose,
  onWhy,
  onSave,
  onHide,
}: {
  open: { post: FeedPost; ctx: OptionsContext } | null;
  onClose: () => void;
  onWhy: (post: FeedPost, ctx: OptionsContext) => void;
  onSave: (post: FeedPost) => void;
  onHide: (post: FeedPost, reason: HideReason) => void;
}) {
  const { profile } = useAuth();
  const post = open?.post;
  const isOwn = !!post && post.author_id === profile?.id;
  return (
    <BottomSheet visible={!!open} onClose={onClose}>
      {post ? (
        isOwn ? (
          <OwnPostOptions post={post} onClose={onClose} />
        ) : (
          <OtherPostOptions
            post={post}
            ctx={open.ctx}
            onClose={onClose}
            onWhy={onWhy}
            onSave={onSave}
            onHide={onHide}
          />
        )
      ) : null}
    </BottomSheet>
  );
}

function TopButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: spacing.xs, flex: 1 }}
    >
      <View style={[styles.round, { borderColor: colors.separator }]}>
        <Icon name={icon} size={24} />
      </View>
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

function OtherPostOptions({
  post,
  ctx,
  onClose,
  onWhy,
  onSave,
  onHide,
}: {
  post: FeedPost;
  ctx: OptionsContext;
  onClose: () => void;
  onWhy: (post: FeedPost, ctx: OptionsContext) => void;
  onSave: (post: FeedPost) => void;
  onHide: (post: FeedPost, reason: HideReason) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { spacing } = useTheme();
  const follow = useFollowAction();
  const favorites = useToggleList('favorites');
  const author = post.author;
  const suggested = ctx.reason === 'suggested';
  const { profile } = useAuth();
  const untag = useRemoveMyTag(post.id, profile?.id);
  // Page 37: people tagged in a post can remove their own tag.
  const tagged = post.tags.some((t) => t.user.id === profile?.id);

  function unfollow() {
    onClose();
    const run = () =>
      follow.mutate(
        { userId: author.id, follow: false },
        {
          onSuccess: () => {
            toast.show(`Unfollowed ${author.username}`);
            invalidateFeeds(qc);
          },
          onError: () => toast.show("Couldn't unfollow. Try again."),
        },
      );
    if (author.is_private) {
      showDialog(
        `Unfollow ${author.username}?`,
        "If you change your mind, you'll have to request to follow them again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfollow', style: 'destructive', onPress: run },
        ],
      );
    } else run();
  }

  function toggleFavorite() {
    onClose();
    const on = !post.is_favorite_author;
    favorites.mutate(
      { userId: author.id, on },
      {
        onSuccess: () => {
          toast.show(on ? `Added ${author.username} to Favorites` : 'Removed from Favorites');
          invalidateFeeds(qc);
        },
        onError: (e) =>
          toast.show(
            e.message.includes('favorites_limit')
              ? 'You can add up to 50 accounts to Favorites.'
              : "Couldn't update Favorites.",
          ),
      },
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
        <TopButton
          icon={post.saved ? 'bookmarkFilled' : 'bookmark'}
          label={post.saved ? 'Remove' : 'Save'}
          onPress={() => {
            onClose();
            onSave(post);
          }}
        />
        <TopButton
          icon="link"
          label="Copy link"
          onPress={() => {
            onClose();
            void copyLink(post, toast);
          }}
        />
      </View>
      <ActionGroup>
        {post.i_follow_author ? (
          <ActionRow
            icon={post.is_favorite_author ? 'star' : 'starOutline'}
            label={post.is_favorite_author ? 'Remove from favorites' : 'Add to favorites'}
            onPress={toggleFavorite}
          />
        ) : null}
        {post.i_follow_author ? (
          <ActionRow icon="personAdd" label="Unfollow" onPress={unfollow} />
        ) : null}
        <ActionRow
          icon="info"
          label="Why you're seeing this post"
          onPress={() => onWhy(post, ctx)}
        />
        {ctx.inFeed ? (
          <ActionRow
            icon="hide"
            label={suggested ? 'Not interested' : 'Hide'}
            onPress={() => onHide(post, suggested ? 'not_interested' : 'hidden')}
          />
        ) : null}
        {tagged ? (
          <ActionRow
            icon="tagPerson"
            label="Remove me from post"
            onPress={() => {
              onClose();
              untag.mutate(undefined, {
                onSuccess: () => toast.show('Tag removed'),
                onError: () => toast.show("Couldn't remove the tag."),
              });
            }}
          />
        ) : null}
        <ActionRow
          icon="profile"
          label="About this account"
          onPress={() => {
            onClose();
            router.push({ pathname: '/[username]/about', params: { username: author.username } });
          }}
        />
      </ActionGroup>
      <ActionGroup>
        <ActionRow
          icon="report"
          label="Report"
          destructive
          onPress={() => {
            onClose();
            router.push({ pathname: '/report', params: { type: 'post', id: post.id } });
          }}
        />
      </ActionGroup>
    </View>
  );
}

/** Own post: Phase 3's menu (Edit, Archive, Pin, Hide like count, Commenting, Delete) + links. */
function OwnPostOptions({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const toast = useToast();
  const { spacing } = useTheme();
  const flags = useUpdatePostFlags(post.id);
  const remove = useDeletePost();

  const run = (change: PostFlags, message: string) => {
    onClose();
    flags.mutate(change, {
      onSuccess: () => toast.show(message),
      onError: (e) =>
        toast.show(
          e.message === 'pin_limit' ? 'You can pin up to 3 posts.' : "Couldn't update the post.",
        ),
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
        <TopButton
          icon="link"
          label="Copy link"
          onPress={() => {
            onClose();
            void copyLink(post, toast);
          }}
        />
        <TopButton
          icon="share"
          label="Share to…"
          onPress={() => {
            onClose();
            void Share.share({ message: postUrl(post.id), url: postUrl(post.id) });
          }}
        />
      </View>
      <ActionGroup>
        <ActionRow
          icon="edit"
          label="Edit"
          onPress={() => {
            onClose();
            router.push({ pathname: '/p/[id]/edit', params: { id: post.id } });
          }}
        />
        {post.archived_at ? (
          <ActionRow
            icon="unarchive"
            label="Show on profile"
            onPress={() => run({ archived_at: null }, 'Post shown on your profile')}
          />
        ) : (
          <>
            <ActionRow
              icon="archive"
              label="Archive"
              onPress={() => run({ archived_at: new Date().toISOString() }, 'Post archived')}
            />
            <ActionRow
              icon={post.pinned_at ? 'pinOff' : 'pin'}
              label={post.pinned_at ? 'Unpin from profile' : 'Pin to your profile'}
              onPress={() =>
                run(
                  { pinned_at: post.pinned_at ? null : new Date().toISOString() },
                  post.pinned_at ? 'Post unpinned' : 'Post pinned to your profile',
                )
              }
            />
          </>
        )}
        <ActionRow
          icon="heartOff"
          label={post.hide_like_counts ? 'Unhide like count' : 'Hide like count'}
          onPress={() =>
            run(
              { hide_like_counts: !post.hide_like_counts },
              post.hide_like_counts ? 'Like count visible' : 'Like count hidden',
            )
          }
        />
        <ActionRow
          icon="commentOff"
          label={post.comments_disabled ? 'Turn on commenting' : 'Turn off commenting'}
          onPress={() =>
            run(
              { comments_disabled: !post.comments_disabled },
              post.comments_disabled ? 'Commenting turned on' : 'Commenting turned off',
            )
          }
        />
      </ActionGroup>
      <ActionGroup>
        <ActionRow
          icon="trash"
          label="Delete"
          destructive
          onPress={() => {
            onClose();
            showDialog('Delete post?', "You won't be able to restore it.", [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  remove.mutate(post, {
                    onSuccess: () => {
                      toast.show('Post deleted');
                      if (router.canGoBack()) router.back();
                    },
                    onError: () => toast.show("Couldn't delete the post."),
                  }),
              },
            ]);
          }}
        />
      </ActionGroup>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// ✈ Share sheet (page 48)
// ---------------------------------------------------------------------------------------------

function ShareSheet({
  post,
  onClose,
  onRepost,
}: {
  post: FeedPost | null;
  onClose: () => void;
  onRepost: (post: FeedPost) => void;
}) {
  const toast = useToast();
  const { colors, spacing, radius } = useTheme();
  if (!post)
    return (
      <BottomSheet visible={false} onClose={onClose}>
        {null}
      </BottomSheet>
    );

  const actions: { icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    {
      icon: 'story',
      label: 'Add to story',
      onPress: () => toast.show('Stories are coming soon'),
    },
  ];
  if (post.can_repost || post.reposted) {
    actions.push({
      icon: 'reposts',
      label: post.reposted ? 'Undo repost' : 'Repost',
      active: post.reposted,
      onPress: () => onRepost(post),
    });
  }
  actions.push(
    {
      icon: 'link',
      label: 'Copy link',
      onPress: () => {
        onClose();
        void copyLink(post, toast);
      },
    },
    {
      icon: 'share',
      label: 'Share to…',
      onPress: () => {
        onClose();
        void Share.share({ message: postUrl(post.id), url: postUrl(post.id) });
      },
    },
  );

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {/* Send to chats waits for Direct (Phase 9). */}
        <Pressable
          onPress={() => toast.show('Messages are coming soon')}
          accessibilityRole="button"
          style={[
            styles.sendStub,
            {
              backgroundColor: colors.backgroundSecondary,
              borderRadius: radius.lg,
              gap: spacing.sm,
            },
          ]}
        >
          <Icon name="share" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">Send to friends</Text>
            <Text variant="caption" color="textSecondary">
              Sending posts in chats arrives with messages.
            </Text>
          </View>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.topRow, { gap: spacing.lg, paddingBottom: spacing.md }]}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={{ alignItems: 'center', gap: spacing.xs, width: 72 }}
              >
                <View
                  style={[
                    styles.round,
                    {
                      borderColor: colors.separator,
                      backgroundColor: a.active ? colors.primary : colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Icon name={a.icon} size={24} color={a.active ? colors.onPrimary : colors.icon} />
                </View>
                <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Save to collection
// ---------------------------------------------------------------------------------------------

function CollectionsSheet({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  const toast = useToast();
  const { spacing } = useTheme();
  const collections = useCollections();
  const add = useAddToCollection();
  return (
    <BottomSheet visible={!!post} onClose={onClose} title="Save to collection">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
        {(collections.data ?? []).map((c) => (
          <ActionRow
            key={c.id}
            icon="bookmark"
            label={c.name}
            onPress={() => {
              if (!post) return;
              onClose();
              add.mutate(
                { postId: post.id, collectionId: c.id },
                {
                  onSuccess: () => toast.show(`Saved to ${c.name}`),
                  onError: () => toast.show("Couldn't save to the collection."),
                },
              );
            }}
          />
        ))}
        <ActionRow
          icon="addCircle"
          label="New collection"
          onPress={() => {
            onClose();
            router.push('/saved/new');
          }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Why you're seeing this post
// ---------------------------------------------------------------------------------------------

function WhySheet({
  open,
  onClose,
}: {
  open: { post: FeedPost; ctx: OptionsContext } | null;
  onClose: () => void;
}) {
  const { spacing } = useTheme();
  const post = open?.post;
  const reason = open?.ctx.reason;
  const name = post?.author.username ?? '';
  const lines: { icon: IconName; text: string }[] = [];
  if (post) {
    if (reason === 'suggested') {
      lines.push({
        icon: 'globe',
        text: `This post is suggested based on its popularity and what you've interacted with. You don't follow ${name}.`,
      });
    } else if (reason === 'repost') {
      lines.push({ icon: 'reposts', text: `Someone you follow reposted this post from ${name}.` });
    } else if (reason === 'collab') {
      lines.push({ icon: 'collab', text: `You follow a collaborator on this post.` });
    } else if (post.i_follow_author) {
      lines.push({ icon: 'personAdd', text: `You follow ${name}.` });
    }
    if (post.is_favorite_author) {
      lines.push({
        icon: 'star',
        text: `${name} is in your Favorites, so their posts show higher.`,
      });
    }
    if (reason !== 'suggested') {
      lines.push({
        icon: 'history',
        text: 'Posts are ranked by how recent they are and how much people are interacting with them.',
      });
    }
  }
  return (
    <BottomSheet visible={!!open} onClose={onClose} title="Why you're seeing this post">
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {lines.map((l) => (
          <View
            key={l.text}
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}
          >
            <Icon name={l.icon} size={24} />
            <Text style={{ flex: 1 }}>{l.text}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Repost note (≤60 characters)
// ---------------------------------------------------------------------------------------------

function RepostNoteSheet({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  const toast = useToast();
  const { colors, spacing, radius } = useTheme();
  const repost = useToggleRepost();
  const [note, setNote] = useState('');
  return (
    <BottomSheet visible={!!post} onClose={onClose} title="Add a note">
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={60}
          autoFocus
          placeholder="What do you think of this post?"
          placeholderTextColor={colors.textTertiary}
          style={{
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: radius.lg,
            padding: spacing.md,
            fontSize: 15,
          }}
        />
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'right' }}>
          {note.length}/60
        </Text>
        <Button
          title="Share note"
          disabled={!note.trim()}
          loading={repost.isPending}
          onPress={() => {
            if (!post) return;
            repost.mutate(
              { postId: post.id, repost: true, note, replaceNote: true },
              {
                onSuccess: () => {
                  setNote('');
                  onClose();
                  toast.show('Note added');
                },
                onError: () => toast.show("Couldn't add the note."),
              },
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-around' },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendStub: { flexDirection: 'row', alignItems: 'center', padding: 14 },
});
