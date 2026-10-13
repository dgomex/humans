import { router } from 'expo-router';

import { openProfile } from '@/features/profile/format';

import type { ActivityGroup, ActivitySection, NotificationPreview, NotificationType } from './api';

export const SECTION_TITLES: Record<ActivitySection, string> = {
  new: 'New',
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'Last 30 days',
  older: 'Older',
};

function quote(body: string | null | undefined) {
  if (!body) return '';
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > 80 ? `${one.slice(0, 80)}…` : one;
}

/** The sentence after the bold username(s): "liked your post.", "commented: Nice!"… */
export function actionText(
  type: NotificationType,
  ctx: {
    kind?: 'post' | 'reel' | null;
    comment?: string | null;
    title?: string;
    prompt?: string;
    audio?: string | null;
  },
): string {
  const thing = ctx.kind === 'reel' ? 'reel' : 'post';
  switch (type) {
    case 'post_like':
      return `liked your ${thing}.`;
    case 'comment':
      return `commented: ${quote(ctx.comment)}`;
    case 'comment_reply':
      return `replied to your comment: ${quote(ctx.comment)}`;
    case 'comment_like':
      return `liked your comment: ${quote(ctx.comment)}`;
    case 'comment_mention':
      return `mentioned you in a comment: ${quote(ctx.comment)}`;
    case 'post_mention':
      return `mentioned you in a ${thing}.`;
    case 'post_tag':
      return `tagged you in a ${thing}.`;
    case 'follow':
      return 'started following you.';
    case 'follow_accepted':
      return 'accepted your follow request.';
    case 'collab_invite':
      return `invited you to collaborate on their ${thing}.`;
    case 'collab_accepted':
      return `accepted your invite to collaborate on your ${thing}.`;
    case 'repost':
      return `reposted your ${thing}.`;
    case 'story_like':
      return 'liked your story.';
    case 'story_mention':
      return 'mentioned you in their story.';
    case 'remix':
      return 'remixed your reel.';
    case 'audio_use':
      return ctx.audio ? `used your audio "${ctx.audio}" in a reel.` : 'used your audio in a reel.';
    case 'countdown_ended':
      return `'s countdown ${ctx.title ? `"${ctx.title}" ` : ''}has ended.`;
    case 'add_yours':
      return ctx.prompt ? `added to your "${ctx.prompt}" story.` : 'added to your Add Yours story.';
    case 'bell_post':
      return 'shared a new post.';
    case 'bell_reel':
      return 'shared a new reel.';
    case 'bell_story':
      return 'shared a new story.';
  }
}

/** "alex", "alex and sam", "alex, sam and 23 others". */
export function actorNames(group: Pick<ActivityGroup, 'actors' | 'actor_count'>): string[] {
  const [first, second] = group.actors;
  if (!first) return [];
  if (group.actor_count <= 1 || !second) return [first.username];
  if (group.actor_count === 2) return [first.username, second.username];
  return [first.username, second.username];
}

export function othersSuffix(group: Pick<ActivityGroup, 'actor_count'>): number {
  return Math.max(0, group.actor_count - 2);
}

type Target = {
  type: NotificationType;
  actorUsername?: string;
  postId?: string | null;
  postKind?: 'post' | 'reel' | null;
  commentId?: string | null;
  storyId?: string | null;
  storyVisible?: boolean;
  audioId?: string | null;
};

/** Where tapping a notification (row text, banner) goes. */
export function openTarget(t: Target) {
  switch (t.type) {
    case 'follow':
    case 'follow_accepted':
      if (t.actorUsername) openProfile(t.actorUsername);
      return;
    case 'comment':
    case 'comment_reply':
    case 'comment_like':
    case 'comment_mention':
      if (t.postId) router.push({ pathname: '/p/[id]/comments', params: { id: t.postId } });
      return;
    case 'story_like':
    case 'story_mention':
    case 'add_yours':
    case 'bell_story':
    case 'countdown_ended':
      if (t.storyId && t.storyVisible !== false) {
        router.push({ pathname: '/stories/view', params: { ids: t.storyId } });
      } else if (t.actorUsername) {
        openProfile(t.actorUsername);
      }
      return;
    case 'audio_use':
      if (t.audioId) {
        router.push({ pathname: '/audio/[id]', params: { id: t.audioId } });
        return;
      }
      break;
    default:
      break;
  }
  if (t.postId) {
    if (t.postKind === 'reel') router.push({ pathname: '/reel/[id]', params: { id: t.postId } });
    else router.push({ pathname: '/p/[id]', params: { id: t.postId } });
  } else if (t.actorUsername) {
    openProfile(t.actorUsername);
  }
}

export function openGroup(g: ActivityGroup) {
  openTarget({
    type: g.type,
    actorUsername: g.actors[0]?.username,
    postId: g.post?.id,
    postKind: g.post?.kind,
    commentId: g.comment?.id,
    storyId: g.story?.id,
    storyVisible: g.story?.visible,
    audioId: g.audio?.id,
  });
}

export function openPreview(p: NotificationPreview) {
  openTarget({
    type: p.type,
    actorUsername: p.actor_username,
    postId: p.post_id,
    postKind: p.post_kind,
    storyId: p.story_id,
  });
}
