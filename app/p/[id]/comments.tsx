import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionGroup,
  ActionRow,
  Avatar,
  BottomSheet,
  Icon,
  Text,
  ToastProvider,
  useToast,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useHiddenComments,
  useHideComment,
  usePinComment,
  usePostCard,
  useReplies,
  useToggleCommentLike,
  type Comment,
  type FeedPost,
} from '@/features/feed/api';
import {
  CommentComposer,
  type CommentComposerHandle,
} from '@/features/feed/components/CommentComposer';
import { ScreenSheet } from '@/features/feed/components/ScreenSheet';
import { shortAge } from '@/features/feed/format';
import { LinkedText } from '@/features/posts/components/CaptionText';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { useTheme } from '@/theme';

const UNDO_MS = 4000;

type Pending = { key: string; body: string; parentId: string | null; failed: boolean };

let pendingSeq = 0;
const nextPendingKey = () => `tmp-${++pendingSeq}`;

/** Page 46 — comments sheet: threads, likes, pin / hide / delete, emoji bar, replies. */
export default function CommentsScreen() {
  // The sheet is a native modal above the root, so it needs its own toast layer.
  return (
    <ToastProvider>
      <Comments />
    </ToastProvider>
  );
}

function Comments() {
  const params = useLocalSearchParams<{
    id: string;
    focus?: string;
    /** Opened from Activity "Reply" (page 71): thread + username to reply to. */
    replyTo?: string;
    replyUser?: string;
  }>();
  const { id, focus } = params;
  const { colors, spacing, hairline } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const card = usePostCard(id);
  const post = card.data;
  const comments = useComments(id);
  const add = useAddComment(id);
  const remove = useDeleteComment(id);
  const composer = useRef<CommentComposerHandle>(null);
  const [replyTo, setReplyTo] = useState<{ parentId: string; username: string } | null>(() =>
    params.replyTo && params.replyUser
      ? { parentId: params.replyTo, username: params.replyUser }
      : null,
  );
  const [pending, setPending] = useState<Pending[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<Comment | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  // Threads you replied to stay expanded.
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());

  const isPostAuthor = !!post && post.author_id === profile?.id;
  const rows = useMemo(
    () => (comments.data?.pages.flat() ?? []).filter((c) => !removed.has(c.id)),
    [comments.data, removed],
  );

  function send(body: string, parentId: string | null, retryKey?: string) {
    const key = retryKey ?? nextPendingKey();
    setPending((p) => [{ key, body, parentId, failed: false }, ...p.filter((x) => x.key !== key)]);
    setReplyTo(null);
    if (parentId) setOpenThreads((t) => new Set(t).add(parentId));
    add.mutate(
      { body, parentId },
      {
        onSuccess: () => setPending((p) => p.filter((x) => x.key !== key)),
        onError: () =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x))),
      },
    );
  }

  function startReply(c: Comment) {
    const parentId = c.parent_id ?? c.id;
    setReplyTo({ parentId, username: c.username });
    composer.current?.setText(`@${c.username} `);
    composer.current?.focus();
  }

  /** Delete after a short Undo window (Instagram's swipe-to-delete toast). */
  function deleteWithUndo(c: Comment) {
    setRemoved((s) => new Set(s).add(c.id));
    let undone = false;
    toast.show('Comment deleted', {
      actionLabel: 'Undo',
      duration: UNDO_MS,
      bottomOffset: 170,
      onAction: () => {
        undone = true;
        setRemoved((s) => {
          const n = new Set(s);
          n.delete(c.id);
          return n;
        });
      },
    });
    setTimeout(() => {
      if (undone) return;
      remove.mutate(c, {
        onError: () => {
          toast.show("Couldn't delete comment.");
          setRemoved((s) => {
            const n = new Set(s);
            n.delete(c.id);
            return n;
          });
        },
      });
    }, UNDO_MS);
  }

  return (
    <ScreenSheet
      header={
        <View
          style={[styles.header, { borderBottomWidth: hairline, borderColor: colors.separator }]}
        >
          <Text variant="subhead">Comments</Text>
        </View>
      }
    >
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingTop: spacing.xs }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {post?.caption ? <CaptionRow post={post} /> : null}
            {pending
              .filter((p) => !p.parentId)
              .map((p) => (
                <PendingRow
                  key={p.key}
                  pending={p}
                  onRetry={() => send(p.body, p.parentId, p.key)}
                />
              ))}
          </View>
        }
        renderItem={({ item }) => (
          <Thread
            comment={item}
            postId={id}
            post={post}
            pending={pending.filter((p) => p.parentId === item.id)}
            removed={removed}
            forceOpen={openThreads.has(item.id)}
            onCollapse={() =>
              setOpenThreads((t) => {
                const n = new Set(t);
                n.delete(item.id);
                return n;
              })
            }
            onReply={startReply}
            onMenu={setMenuFor}
            onRetry={(p) => send(p.body, p.parentId, p.key)}
          />
        )}
        ListEmptyComponent={
          comments.isPending ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : comments.isError ? (
            <Pressable onPress={() => void comments.refetch()} style={styles.empty}>
              <Text color="textSecondary">Couldn&apos;t load comments. Tap to retry.</Text>
            </Pressable>
          ) : pending.length === 0 ? (
            <View style={[styles.empty, { gap: spacing.xs }]}>
              <Text variant="headline">No comments yet</Text>
              <Text color="textSecondary">Start the conversation.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={{ paddingBottom: spacing.lg }}>
            {comments.isFetchingNextPage ? (
              <ActivityIndicator style={{ margin: spacing.md }} />
            ) : null}
            {isPostAuthor ? (
              <HiddenComments
                postId={id}
                open={showHidden}
                onToggle={() => setShowHidden((v) => !v)}
              />
            ) : null}
          </View>
        }
        onEndReached={() => {
          if (comments.hasNextPage && !comments.isFetchingNextPage) void comments.fetchNextPage();
        }}
      />

      {post?.comments_disabled ? (
        <View
          style={{
            padding: spacing.lg,
            borderTopWidth: hairline,
            borderColor: colors.separator,
          }}
        >
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            Commenting has been turned off.
          </Text>
        </View>
      ) : post ? (
        <View>
          <CommentComposer
            ref={composer}
            avatarPath={profile?.avatar_path}
            authorUsername={post.author.username}
            replyingTo={replyTo?.username ?? null}
            onCancelReply={() => {
              setReplyTo(null);
              composer.current?.setText('');
            }}
            onSubmit={(body) => send(body, replyTo?.parentId ?? null)}
            autoFocus={focus === '1' || !!params.replyTo}
            initialText={params.replyUser ? `@${params.replyUser} ` : undefined}
          />
        </View>
      ) : null}

      <CommentMenu
        comment={menuFor}
        postId={id}
        isPostAuthor={isPostAuthor}
        onClose={() => setMenuFor(null)}
        onDelete={(c) => {
          setMenuFor(null);
          deleteWithUndo(c);
        }}
      />
    </ScreenSheet>
  );
}

function CaptionRow({ post }: { post: FeedPost }) {
  const { spacing, colors, hairline } = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
          marginBottom: spacing.sm,
          borderBottomWidth: hairline,
          borderColor: colors.separator,
          alignItems: 'flex-start',
        },
      ]}
    >
      <Avatar
        uri={avatarUrl(post.author.avatar_path)}
        size={34}
        onPress={() => openProfile(post.author.username)}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="captionBold">
          {post.author.username}{' '}
          <Text variant="caption" color="textSecondary">
            {post.published_at ? shortAge(post.published_at) : ''}
          </Text>
        </Text>
        <Text>
          <LinkedText text={post.caption} />
        </Text>
      </View>
    </View>
  );
}

function Thread({
  comment,
  postId,
  post,
  pending,
  removed,
  forceOpen,
  onCollapse,
  onReply,
  onMenu,
  onRetry,
}: {
  comment: Comment;
  postId: string;
  post: FeedPost | null | undefined;
  pending: Pending[];
  removed: Set<string>;
  forceOpen: boolean;
  onCollapse: () => void;
  onReply: (c: Comment) => void;
  onMenu: (c: Comment) => void;
  onRetry: (p: Pending) => void;
}) {
  const { colors, spacing } = useTheme();
  const [expanded, setOpen] = useState(false);
  const open = expanded || forceOpen;
  const replies = useReplies(postId, comment.id, open);
  const list = (replies.data?.pages.flat() ?? []).filter((r) => !removed.has(r.id));
  const remaining = Math.max(comment.reply_count - list.length, 0);

  return (
    <View>
      <CommentRow comment={comment} post={post} onReply={onReply} onMenu={onMenu} />
      <View style={{ paddingLeft: 58 }}>
        {open
          ? list.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                post={post}
                onReply={onReply}
                onMenu={onMenu}
                small
              />
            ))
          : null}
        {pending.map((p) => (
          <PendingRow key={p.key} pending={p} small onRetry={() => onRetry(p)} />
        ))}
        {comment.reply_count > 0 ? (
          <Pressable
            onPress={() => {
              if (!open) setOpen(true);
              else if (remaining > 0 && replies.hasNextPage) void replies.fetchNextPage();
              else {
                setOpen(false);
                onCollapse();
              }
            }}
            style={[styles.row, { gap: spacing.sm, paddingVertical: spacing.sm }]}
            accessibilityRole="button"
          >
            <View style={[styles.rule, { backgroundColor: colors.textTertiary }]} />
            <Text variant="captionBold" color="textSecondary">
              {!open
                ? `View ${comment.reply_count} more ${comment.reply_count === 1 ? 'reply' : 'replies'}`
                : replies.isFetching
                  ? 'Loading…'
                  : remaining > 0
                    ? `View ${remaining} more ${remaining === 1 ? 'reply' : 'replies'}`
                    : 'Hide replies'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CommentRow({
  comment: c,
  post,
  onReply,
  onMenu,
  small = false,
}: {
  comment: Comment;
  post: FeedPost | null | undefined;
  onReply: (c: Comment) => void;
  onMenu: (c: Comment) => void;
  small?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const like = useToggleCommentLike(c.post_id);
  const lastTap = useRef(0);

  function toggleLike(next = !c.liked) {
    if (next === c.liked) return;
    if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    like.mutate({ comment: c, like: next });
  }

  return (
    <Pressable
      onLongPress={() => onMenu(c)}
      onPress={() => {
        // Double-tap a comment to like it.
        const now = Date.now();
        if (now - lastTap.current < 300) toggleLike(true);
        lastTap.current = now;
      }}
      style={({ pressed }) => [
        styles.row,
        {
          alignItems: 'flex-start',
          gap: spacing.md,
          paddingHorizontal: small ? 0 : spacing.md,
          paddingRight: spacing.md,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.backgroundPressed : 'transparent',
          opacity: c.is_hidden ? 0.6 : 1,
        },
      ]}
    >
      <Avatar
        uri={avatarUrl(c.avatar_path)}
        size={small ? 26 : 34}
        onPress={() => openProfile(c.username)}
      />
      <View style={{ flex: 1, gap: 4 }}>
        {c.is_pinned ? (
          <View style={[styles.row, { gap: 4 }]}>
            <Icon name="pin" size={12} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              Pinned{post ? ` by ${post.author.username}` : ''}
            </Text>
          </View>
        ) : null}
        <Text variant="captionBold">
          <Text variant="captionBold" onPress={() => openProfile(c.username)}>
            {c.username}
          </Text>
          {c.is_post_author ? (
            <Text variant="caption" color="textSecondary">
              {' · Author'}
            </Text>
          ) : null}{' '}
          <Text variant="caption" color="textSecondary">
            {shortAge(c.created_at)}
          </Text>
        </Text>
        <Text>
          <LinkedText text={c.body} />
        </Text>
        <View style={[styles.row, { gap: spacing.lg, paddingTop: 2 }]}>
          <Pressable onPress={() => onReply(c)} hitSlop={6} accessibilityRole="button">
            <Text variant="captionBold" color="textSecondary">
              Reply
            </Text>
          </Pressable>
          {c.liked_by_post_author && post ? (
            <View style={[styles.row, { gap: 4 }]} accessibilityLabel="Liked by the author">
              <Avatar uri={avatarUrl(post.author.avatar_path)} size={14} />
              <Icon name="heartFilled" size={11} color={colors.like} />
            </View>
          ) : null}
          {c.is_hidden ? (
            <Text variant="caption" color="textSecondary">
              Hidden
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'center', minWidth: 24, paddingTop: 6 }}>
        <Pressable
          onPress={() => toggleLike()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={c.liked ? 'Unlike comment' : 'Like comment'}
        >
          <Icon
            name={c.liked ? 'heartFilled' : 'heart'}
            size={14}
            color={c.liked ? colors.like : colors.textSecondary}
          />
        </Pressable>
        {c.like_count > 0 ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/p/[id]/likes', params: { id: c.post_id, comment: c.id } })
            }
            hitSlop={6}
          >
            <Text variant="tiny" color="textSecondary">
              {formatCount(c.like_count)}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function PendingRow({
  pending,
  small = false,
  onRetry,
}: {
  pending: Pending;
  small?: boolean;
  onRetry: () => void;
}) {
  const { spacing } = useTheme();
  const { profile } = useAuth();
  return (
    <Pressable
      onPress={pending.failed ? onRetry : undefined}
      disabled={!pending.failed}
      style={[
        styles.row,
        {
          alignItems: 'flex-start',
          gap: spacing.md,
          paddingHorizontal: small ? 0 : spacing.md,
          paddingVertical: spacing.sm,
          opacity: pending.failed ? 1 : 0.6,
        },
      ]}
    >
      <Avatar uri={avatarUrl(profile?.avatar_path)} size={small ? 26 : 34} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="captionBold">{profile?.username}</Text>
        <Text>{pending.body}</Text>
        <Text variant="caption" color={pending.failed ? 'danger' : 'textSecondary'}>
          {pending.failed ? "Couldn't post. Tap to retry." : 'Posting…'}
        </Text>
      </View>
    </Pressable>
  );
}

/** Post author only: "View hidden comments" with Unhide. */
function HiddenComments({
  postId,
  open,
  onToggle,
}: {
  postId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { spacing } = useTheme();
  const hidden = useHiddenComments(postId, true);
  const unhide = useHideComment(postId);
  const rows = hidden.data ?? [];
  if (rows.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Text variant="bodyBold" color="textSecondary" style={{ textAlign: 'center' }}>
          {open ? 'Hide hidden comments' : `View hidden comments (${rows.length})`}
        </Text>
      </Pressable>
      {open
        ? rows.map((c) => (
            <View key={c.id} style={[styles.row, { gap: spacing.md }]}>
              <Avatar uri={avatarUrl(c.avatar_path)} size={28} />
              <Text style={{ flex: 1 }} numberOfLines={3}>
                <Text variant="bodyBold">{c.username}</Text> {c.body}
              </Text>
              <Pressable
                onPress={() => unhide.mutate({ commentId: c.id, hidden: false })}
                accessibilityRole="button"
              >
                <Text variant="captionBold" color="link">
                  Unhide
                </Text>
              </Pressable>
            </View>
          ))
        : null}
    </View>
  );
}

function CommentMenu({
  comment: c,
  postId,
  isPostAuthor,
  onClose,
  onDelete,
}: {
  comment: Comment | null;
  postId: string;
  isPostAuthor: boolean;
  onClose: () => void;
  onDelete: (c: Comment) => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const pin = usePinComment(postId);
  const hide = useHideComment(postId);
  const own = !!c && c.author_id === profile?.id;

  return (
    <BottomSheet visible={!!c} onClose={onClose}>
      {c ? (
        <ActionGroup>
          {isPostAuthor && !c.parent_id && !c.is_hidden ? (
            <ActionRow
              icon={c.is_pinned ? 'pinOff' : 'pin'}
              label={c.is_pinned ? 'Unpin comment' : 'Pin comment'}
              onPress={() => {
                onClose();
                pin.mutate(
                  { commentId: c.id, pinned: !c.is_pinned },
                  {
                    onSuccess: () =>
                      toast.show(c.is_pinned ? 'Comment unpinned' : 'Comment pinned'),
                    onError: (e) =>
                      toast.show(
                        e.message === 'pin_limit'
                          ? 'You can pin up to 3 comments.'
                          : "Couldn't pin the comment.",
                      ),
                  },
                );
              }}
            />
          ) : null}
          {isPostAuthor && !own ? (
            <ActionRow
              icon="hide"
              label={c.is_hidden ? 'Unhide comment' : 'Hide comment'}
              onPress={() => {
                onClose();
                hide.mutate(
                  { commentId: c.id, hidden: !c.is_hidden },
                  {
                    onSuccess: () =>
                      toast.show(c.is_hidden ? 'Comment unhidden' : 'Comment hidden'),
                  },
                );
              }}
            />
          ) : null}
          {own || isPostAuthor ? (
            <ActionRow icon="trash" label="Delete" destructive onPress={() => onDelete(c)} />
          ) : null}
          {!own ? (
            <ActionRow
              icon="report"
              label="Report"
              destructive
              onPress={() => {
                onClose();
                router.push({ pathname: '/report', params: { type: 'comment', id: c.id } });
              }}
            />
          ) : null}
        </ActionGroup>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  rule: { width: 24, height: StyleSheet.hairlineWidth * 2 },
});
