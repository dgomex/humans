import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { PickerPermissionError } from '@/features/create/media';
import type { ComposerItem } from '@/features/create/types';
import {
  directError,
  invalidateThread,
  markThreadRead,
  openMessageMedia,
  sendMessage,
  useMessageActions,
  useThreadInfo,
  useThreadMessages,
  type Message,
  type Outgoing,
  type ThreadInfo,
  type ViewMode,
} from '@/features/direct/api';
import { Composer, type ComposerMode } from '@/features/direct/components/Composer';
import { MessageBubble } from '@/features/direct/components/MessageBubble';
import { ThreadAvatar } from '@/features/direct/components/ThreadAvatar';
import {
  MessageMenu,
  ReactionsSheet,
  SendMediaSheet,
  type MenuAction,
} from '@/features/direct/components/ThreadSheets';
import {
  activeText,
  infoTitle,
  isActiveNow,
  memberName,
  namesOf,
  seenText,
  separatorTime,
  systemText,
  THEMES,
} from '@/features/direct/format';
import { captureChatMedia, pickChatMedia, prepareChatMedia } from '@/features/direct/media';
import { useThreadChannel } from '@/features/direct/realtime';
import { saveChatMedia } from '@/features/direct/saveMedia';
import { avatarUrl } from '@/features/profile/avatar';
import { formatCount, openProfile } from '@/features/profile/format';
import { TopBarButton } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

type Pending = { key: string; out: Outgoing; label: string; failed: boolean };

type Item =
  | { type: 'msg'; key: string; m: Message; first: boolean; last: boolean }
  | { type: 'system'; key: string; m: Message }
  | { type: 'sep'; key: string; at: string }
  | { type: 'pending'; key: string; p: Pending };

const RUN_GAP_MS = 5 * 60_000;
const SEP_GAP_MS = 60 * 60_000;

/** Page 76 — Chat thread. */
export default function ThreadScreen() {
  const { id, camera } = useLocalSearchParams<{ id: string; camera?: string }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const toast = useToast();
  const qc = useQueryClient();
  const info = useThreadInfo(id);
  const messages = useThreadMessages(id);
  const actions = useMessageActions(id);
  const t = info.data;
  const myStatus = t?.me.status;
  const { typingUsers, notifyTyping } = useThreadChannel(id, me, myStatus === 'active');

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<Message | null>(null);
  const [reactionsOf, setReactionsOf] = useState<Message | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [media, setMedia] = useState<{ items: ComposerItem[]; mode: ViewMode } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const list = useRef<FlatList<Item>>(null);

  const all = useMemo(() => messages.data?.pages.flat() ?? [], [messages.data]);
  const newestId = all[0]?.id;
  const names = useMemo(() => (t ? namesOf(t.members) : {}), [t]);
  // System lines name people by username ("ben set the nickname for dina to …").
  const usernames = useMemo(
    () => Object.fromEntries((t?.members ?? []).map((m) => [m.id, m.username])),
    [t],
  );
  const members = useMemo(() => Object.fromEntries((t?.members ?? []).map((x) => [x.id, x])), [t]);
  const others = (t?.members ?? []).filter((x) => x.id !== me && x.status !== 'left');
  const other = t?.kind === 'direct' ? others[0] : undefined;

  // Read receipts: mark read whenever the newest message changes while the chat is open.
  useFocusEffect(
    useCallback(() => {
      if (!id || !newestId) return;
      void markThreadRead(id).then(() => {
        void qc.invalidateQueries({ queryKey: ['direct', 'badge'] });
        void qc.invalidateQueries({ queryKey: ['direct', 'inbox'] });
      });
    }, [id, newestId, qc]),
  );

  // Vanish mode: seen messages disappear when you leave the chat; screenshots are announced.
  const vanish = !!t?.vanish_mode;
  useFocusEffect(
    useCallback(() => {
      if (!id || !vanish) return;
      const sub =
        Platform.OS === 'web'
          ? null
          : ScreenCapture.addScreenshotListener(() => {
              void supabase.rpc('note_screenshot', { p_thread: id });
            });
      return () => {
        sub?.remove();
        void supabase
          .rpc('end_vanish_session', { p_thread: id })
          .then(() => invalidateThread(qc, id));
      };
    }, [id, vanish, qc]),
  );

  // 📷 from the inbox row opens the camera right away.
  const cameraOpened = useRef(false);
  useEffect(() => {
    if (camera === '1' && t && !cameraOpened.current) {
      cameraOpened.current = true;
      void openCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, t]);

  const items = useMemo(() => buildItems(all, pending), [all, pending]);

  // ---- sending ----
  async function send(out: Outgoing, label: string) {
    const key = `p-${Date.now()}-${Math.random()}`;
    setPending((p) => [{ key, out, label, failed: false }, ...p]);
    // The list is inverted: offset 0 is the newest message.
    list.current?.scrollToOffset({ offset: 0, animated: true });
    try {
      await sendMessage(id, out);
      setPending((p) => p.filter((x) => x.key !== key));
      invalidateThread(qc, id);
    } catch (e) {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x)));
      toast.show(directError(e));
    }
  }

  function retry(p: Pending) {
    setPending((list) => list.filter((x) => x.key !== p.key));
    void send(p.out, p.label);
  }

  async function openCamera() {
    try {
      const item = await captureChatMedia();
      if (item) setMedia({ items: [item], mode: 'once' });
    } catch (e) {
      toast.show(
        e instanceof PickerPermissionError
          ? 'Allow camera access to send photos.'
          : "Couldn't open the camera.",
      );
    }
  }

  async function openGallery() {
    try {
      const { items: picked, tooLong } = await pickChatMedia();
      if (tooLong) toast.show('Videos can be up to 3 minutes.');
      if (picked.length) setMedia({ items: picked, mode: 'keep' });
    } catch (e) {
      toast.show(
        e instanceof PickerPermissionError
          ? 'Allow photo access to send photos.'
          : "Couldn't open your photos.",
      );
    }
  }

  async function sendMedia(mode: ViewMode) {
    if (!media) return;
    setSendingMedia(true);
    const picked = media.items;
    try {
      const prepared = await Promise.all(picked.map((it) => prepareChatMedia(it, mode)));
      setMedia(null);
      for (const out of prepared) {
        void send(
          { ...out, replyTo: replyTo?.id ?? null },
          out.mediaType === 'video' ? 'Video' : 'Photo',
        );
      }
      setReplyTo(null);
    } catch {
      toast.show("Couldn't prepare the media.");
    } finally {
      setSendingMedia(false);
    }
  }

  // ---- message actions ----
  function react(m: Message, emoji: string | null) {
    setMenu(null);
    actions.react(m, me, emoji).catch(() => toast.show("Couldn't react."));
  }

  async function openMedia(m: Message) {
    if (m.view_mode === 'keep' || m.sender_id === me) {
      router.push({
        pathname: '/direct/media/[messageId]',
        params: { messageId: m.id, thread: id },
      });
      return;
    }
    try {
      const url = await openMessageMedia(m);
      if (!url) {
        toast.show('This photo can no longer be opened.');
        invalidateThread(qc, id);
        return;
      }
      router.push({
        pathname: '/direct/media/[messageId]',
        params: { messageId: m.id, thread: id, url, once: '1' },
      });
    } catch {
      toast.show("Couldn't open the photo.");
    }
  }

  function onAction(m: Message, a: MenuAction) {
    setMenu(null);
    switch (a) {
      case 'reply':
        setEditing(null);
        setReplyTo(m);
        break;
      case 'forward':
        router.push({ pathname: '/direct/send', params: { forward: m.id, thread: id } });
        break;
      case 'copy':
        void Clipboard.setStringAsync(m.body ?? '').then(() => toast.show('Copied'));
        break;
      case 'edit':
        setReplyTo(null);
        setEditing(m);
        break;
      case 'pin':
      case 'unpin':
        actions.pin(m, a === 'pin').catch((e) => toast.show(directError(e)));
        break;
      case 'save':
        if (m.mediaUrl)
          void saveChatMedia(m.mediaUrl, m.media_type === 'video' ? 'video' : 'image').then((r) =>
            toast.show(r === 'saved' ? 'Saved' : 'Allow photo access to save.'),
          );
        break;
      case 'unsend':
        showDialog(
          m.scheduled_for ? 'Delete scheduled message?' : 'Unsend message?',
          'It will be removed for everyone in the chat.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: m.scheduled_for ? 'Delete' : 'Unsend',
              style: 'destructive',
              onPress: () => actions.unsend(m).catch(() => toast.show("Couldn't unsend.")),
            },
          ],
        );
        break;
      case 'report':
        router.push({ pathname: '/report', params: { type: 'message', id: m.id } });
        break;
    }
  }

  function jumpTo(messageId: string) {
    const index = items.findIndex((x) => x.type === 'msg' && x.m.id === messageId);
    if (index < 0) {
      toast.show('Scroll up to see the original message.');
      return;
    }
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlight(messageId);
    setTimeout(() => setHighlight(null), 1500);
  }

  // ---- composer mode ----
  let mode: ComposerMode = { kind: 'normal' };
  if (t) {
    if (myStatus === 'left')
      mode = {
        kind: 'blocked',
        text: "You can't send messages to this group because you're no longer in it.",
      };
    else if (t.kind === 'direct' && !other)
      mode = { kind: 'blocked', text: 'This account is no longer available.' };
    else if (t.request_pending)
      mode =
        t.my_message_count > 0
          ? {
              kind: 'blocked',
              text: `You can send more messages after ${other?.username ?? 'they'} accepts your request.`,
            }
          : { kind: 'textOnly' };
  }
  const isRequest = myStatus === 'request' || myStatus === 'hidden';

  // Sent / Seen only under my message when it's the newest thing in the chat.
  const lastMine = all[0]?.kind !== 'system' ? all[0] : undefined;
  const seen =
    t && lastMine && lastMine.sender_id === me && !pending.length
      ? seenText(t, me, lastMine.created_at)
      : null;
  const themeKey = t?.theme ?? 'default';

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: vanish ? colors.backgroundSecondary : colors.background }}
    >
      <Header info={t ?? null} me={me} threadId={id} />
      {vanish ? (
        <View style={[styles.vanishBar, { backgroundColor: colors.text }]}>
          <Icon name="vanish" size={14} color={colors.background} />
          <Text variant="caption" style={{ color: colors.background }}>
            Vanish mode is on
          </Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={list}
          inverted
          data={items}
          keyExtractor={(x) => x.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
          }}
          onScrollToIndexFailed={() => toast.show('Scroll up to see the original message.')}
          ListHeaderComponent={
            <View style={{ paddingBottom: spacing.sm }}>
              {seen ? (
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={{ textAlign: 'right', paddingHorizontal: spacing.lg, marginTop: 2 }}
                >
                  {seen}
                </Text>
              ) : lastMine?.sender_id === me && !pending.length && lastMine.kind !== 'system' ? (
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={{ textAlign: 'right', paddingHorizontal: spacing.lg, marginTop: 2 }}
                >
                  Sent
                </Text>
              ) : null}
              {typingUsers.length && !isRequest ? (
                <Typing avatar={members[typingUsers[0]]?.avatar_path ?? null} />
              ) : null}
              {t && t.scheduled_count > 0 ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/direct/t/[id]/filtered',
                      params: { id, filter: 'scheduled' },
                    })
                  }
                  style={[
                    styles.scheduled,
                    { margin: spacing.md, padding: spacing.sm, borderColor: colors.separator },
                  ]}
                  accessibilityRole="button"
                >
                  <Icon name="schedule" size={16} />
                  <Text variant="caption">
                    {t.scheduled_count} scheduled message{t.scheduled_count > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListFooterComponent={
            messages.isPending || messages.isFetchingNextPage ? (
              <ActivityIndicator style={{ margin: spacing.lg }} />
            ) : t && !messages.hasNextPage ? (
              <Intro info={t} me={me} />
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'sep')
              return (
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={[styles.center, { marginVertical: spacing.md }]}
                >
                  {separatorTime(item.at)}
                </Text>
              );
            if (item.type === 'system')
              return (
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={[
                    styles.center,
                    { marginVertical: spacing.sm, paddingHorizontal: spacing.xl },
                  ]}
                >
                  {systemText(item.m.data, item.m.sender_id, me, usernames)}
                </Text>
              );
            if (item.type === 'pending')
              return (
                <Pressable
                  onPress={item.p.failed ? () => retry(item.p) : undefined}
                  style={[styles.pending, { paddingHorizontal: spacing.md, marginTop: spacing.xs }]}
                  accessibilityRole={item.p.failed ? 'button' : undefined}
                >
                  <View
                    style={[
                      styles.pendingBubble,
                      {
                        backgroundColor: THEMES[themeKey].colors[1],
                        padding: spacing.sm,
                        opacity: 0.6,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.onPrimary }} numberOfLines={3}>
                      {item.p.label}
                    </Text>
                  </View>
                  <Text variant="tiny" color={item.p.failed ? 'danger' : 'textSecondary'}>
                    {item.p.failed ? 'Not delivered. Tap to retry.' : 'Sending…'}
                  </Text>
                </Pressable>
              );
            const m = item.m;
            const sender = members[m.sender_id];
            return (
              <MessageBubble
                message={m}
                me={me}
                mine={m.sender_id === me}
                first={item.first}
                last={item.last}
                group={t?.kind === 'group'}
                senderName={memberName(sender)}
                senderAvatar={sender?.avatar_path ?? null}
                theme={themeKey}
                names={names}
                highlighted={highlight === m.id}
                onMenu={setMenu}
                onDoubleTap={(x) => myStatus === 'active' && react(x, '❤️')}
                onReply={(x) => {
                  if (myStatus !== 'active') return;
                  setEditing(null);
                  setReplyTo(x);
                }}
                onOpenMedia={openMedia}
                onShowReactions={setReactionsOf}
                onJumpTo={jumpTo}
              />
            );
          }}
        />
        {isRequest && t ? (
          <RequestBar info={t} me={me} threadId={id} />
        ) : (
          <Composer
            mode={mode}
            replyTo={replyTo}
            replyName={
              replyTo
                ? replyTo.sender_id === me
                  ? 'yourself'
                  : memberName(members[replyTo.sender_id])
                : ''
            }
            editing={editing}
            vanish={vanish}
            onCancelReply={() => setReplyTo(null)}
            onCancelEdit={() => setEditing(null)}
            onTyping={notifyTyping}
            onSendText={(body) => {
              const r = replyTo;
              setReplyTo(null);
              void send({ kind: 'text', body, replyTo: r?.id ?? null }, body);
            }}
            onSchedule={(body, at) => {
              sendMessage(id, { kind: 'text', body, scheduledFor: at.toISOString() })
                .then(() => {
                  invalidateThread(qc, id);
                  toast.show(
                    `Scheduled for ${at.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`,
                  );
                })
                .catch((e) => toast.show(directError(e)));
            }}
            onEdit={(m, body) => {
              setEditing(null);
              actions.edit(m, body).catch((e) => toast.show(directError(e)));
            }}
            onCamera={() => void openCamera()}
            onGallery={() => void openGallery()}
            onVoice={(v) => {
              const r = replyTo;
              setReplyTo(null);
              void send({ kind: 'voice', ...v, replyTo: r?.id ?? null }, '🎤 Voice message');
            }}
          />
        )}
      </KeyboardAvoidingView>

      <MessageMenu
        message={menu}
        me={me}
        canInteract={myStatus === 'active'}
        onClose={() => setMenu(null)}
        onReact={react}
        onAction={onAction}
      />
      <ReactionsSheet
        message={reactionsOf}
        members={t?.members ?? []}
        me={me}
        onClose={() => setReactionsOf(null)}
        onRemoveMine={(m) => {
          setReactionsOf(null);
          react(m, null);
        }}
      />
      <SendMediaSheet
        items={media?.items ?? null}
        defaultMode={media?.mode ?? 'keep'}
        sending={sendingMedia}
        onClose={() => setMedia(null)}
        onSend={(m) => void sendMedia(m)}
      />
    </SafeAreaView>
  );
}

/** Messages (newest first, for the inverted list) + time separators + sending bubbles. */
function buildItems(all: Message[], pending: Pending[]): Item[] {
  const chrono = [...all].reverse();
  const out: Item[] = [];
  for (let i = 0; i < chrono.length; i++) {
    const m = chrono[i];
    const prev = chrono[i - 1];
    const next = chrono[i + 1];
    const t = new Date(m.created_at).getTime();
    if (!prev || t - new Date(prev.created_at).getTime() > SEP_GAP_MS)
      out.push({ type: 'sep', key: `sep-${m.id}`, at: m.created_at });
    if (m.kind === 'system') {
      out.push({ type: 'system', key: m.id, m });
      continue;
    }
    const sameAsPrev =
      !!prev &&
      prev.kind !== 'system' &&
      prev.sender_id === m.sender_id &&
      t - new Date(prev.created_at).getTime() < RUN_GAP_MS;
    const sameAsNext =
      !!next &&
      next.kind !== 'system' &&
      next.sender_id === m.sender_id &&
      new Date(next.created_at).getTime() - t < RUN_GAP_MS;
    out.push({ type: 'msg', key: m.id, m, first: !sameAsPrev, last: !sameAsNext });
  }
  const items = out.reverse();
  return [...pending.map((p) => ({ type: 'pending' as const, key: p.key, p })), ...items];
}

function Header({ info, me, threadId }: { info: ThreadInfo | null; me: string; threadId: string }) {
  const { colors, spacing, hairline } = useTheme();
  const toast = useToast();
  const others = (info?.members ?? []).filter((m) => m.id !== me && m.status !== 'left');
  const other = info?.kind === 'direct' ? others[0] : undefined;
  const subtitle = !info
    ? ''
    : info.kind === 'group'
      ? `${others.length + 1} members`
      : (activeText(other?.last_active_at) ?? other?.username ?? '');
  const calls = () => toast.show('Calls are coming soon');
  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          borderBottomWidth: hairline,
          borderColor: colors.separator,
        },
      ]}
    >
      <TopBarButton icon="back" label="Back" onPress={() => goBack('/direct')} />
      <Pressable
        onPress={() => router.push(`/direct/t/${threadId}/details`)}
        style={[styles.headerTitle, { gap: spacing.sm }]}
        accessibilityRole="button"
        accessibilityLabel="Chat details"
      >
        {info ? (
          <ThreadAvatar
            kind={info.kind}
            photoPath={info.photo_path}
            members={others}
            size={34}
            active={info.kind === 'direct' && isActiveNow(other?.last_active_at)}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" numberOfLines={1}>
            {info ? infoTitle(info, me) : ''}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {info?.me.status === 'active' ? (
        <View style={[styles.row, { gap: spacing.lg }]}>
          <TopBarButton icon="phone" label="Audio call" onPress={calls} />
          <TopBarButton icon="videoCall" label="Video call" onPress={calls} />
        </View>
      ) : null}
    </View>
  );
}

/** Top of the conversation: who you're talking to. */
function Intro({ info, me }: { info: ThreadInfo; me: string }) {
  const { spacing } = useTheme();
  const others = info.members.filter((m) => m.id !== me && m.status !== 'left');
  const other = info.kind === 'direct' ? others[0] : undefined;
  return (
    <View style={[styles.intro, { padding: spacing.xl, gap: spacing.xs }]}>
      <ThreadAvatar kind={info.kind} photoPath={info.photo_path} members={others} size={88} />
      <Text variant="headline" style={{ marginTop: spacing.sm }}>
        {infoTitle(info, me)}
      </Text>
      {other ? (
        <>
          <Text color="textSecondary">{other.username} · Humans</Text>
          <Text color="textSecondary">
            {formatCount(other.followers_count)}{' '}
            {other.followers_count === 1 ? 'follower' : 'followers'} ·{' '}
            {formatCount(other.posts_count)} {other.posts_count === 1 ? 'post' : 'posts'}
          </Text>
          <Text color="textSecondary">
            {other.i_follow && other.follows_me
              ? 'You follow each other on Humans'
              : other.i_follow
                ? 'You follow this account'
                : other.follows_me
                  ? 'Follows you'
                  : "You don't follow each other on Humans"}
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="View profile"
              variant="secondary"
              size="sm"
              onPress={() => openProfile(other.username)}
            />
          </View>
        </>
      ) : (
        <Text color="textSecondary">{others.length + 1} members</Text>
      )}
    </View>
  );
}

function Typing({ avatar }: { avatar: string | null }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
      ]}
    >
      <Avatar uri={avatarUrl(avatar)} size={28} />
      <View
        style={[styles.typing, { backgroundColor: colors.backgroundSecondary }]}
        accessibilityLabel="Typing"
      >
        <Text color="textSecondary">• • •</Text>
      </View>
    </View>
  );
}

/** Message request (page 75): Block · Delete · Accept. */
function RequestBar({ info, me, threadId }: { info: ThreadInfo; me: string; threadId: string }) {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const others = info.members.filter((m) => m.id !== me && m.status !== 'left');
  const who = info.kind === 'direct' ? (others[0]?.username ?? 'Someone') : 'Someone';
  return (
    <View
      style={[
        styles.requestBar,
        { padding: spacing.lg, gap: spacing.md, borderTopColor: colors.separator },
      ]}
    >
      <Text color="textSecondary" style={styles.center}>
        {info.kind === 'group'
          ? `${who} added you to a group. Accept to see new messages and let others know you've seen them.`
          : `${who} wants to send you a message. Accept to chat; they won't know you've seen it until you accept.`}
      </Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Button
            title="Block"
            variant="secondary"
            onPress={() => toast.show('Blocking arrives with privacy settings (Phase 11).')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Delete"
            variant="secondary"
            onPress={async () => {
              await supabase.rpc('clear_thread', { p_thread: threadId });
              invalidateThread(qc, threadId);
              goBack('/direct');
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Accept"
            onPress={async () => {
              const { error } = await supabase.rpc('accept_thread', { p_thread: threadId });
              if (error) toast.show("Couldn't accept.");
              invalidateThread(qc, threadId);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { textAlign: 'center' },
  intro: { alignItems: 'center' },
  typing: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  vanishBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  requestBar: { borderTopWidth: StyleSheet.hairlineWidth },
  pending: { alignItems: 'flex-end', gap: 2 },
  pendingBubble: { borderRadius: 20, maxWidth: 260, paddingHorizontal: 12 },
  scheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
});
