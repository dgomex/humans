import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { avatarUrl } from '@/features/profile/avatar';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { directKeys, purgeMessageFiles, touchPresence, type LastMessage } from './api';
import { isMuted, previewText } from './format';

type Banner = {
  key: string;
  threadId: string;
  username: string;
  avatar_path: string | null;
  text: string;
};

const SHOW_MS = 4000;
const PRESENCE_MS = 60_000;

/**
 * Direct in the background (no OS push yet): listens to `inbox:{me}` to refresh the inbox and the
 * Home ✈ badge, shows a banner for new messages outside that chat, keeps "Active now" fresh, and
 * cleans up files I uploaded that are no longer needed.
 */
export function DirectAlerts() {
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Presence heartbeat while the app is in the foreground; cleanup once per session.
  useEffect(() => {
    if (!me) return;
    void touchPresence().catch(() => {});
    void purgeMessageFiles();
    const beat = setInterval(() => {
      if (AppState.currentState === 'active') void touchPresence().catch(() => {});
    }, PRESENCE_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void touchPresence().catch(() => {});
    });
    return () => {
      clearInterval(beat);
      sub.remove();
    };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const show = (b: Banner) => {
      if (timer.current) clearTimeout(timer.current);
      setBanner(b);
      if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
      timer.current = setTimeout(() => setBanner(null), SHOW_MS);
    };
    const channel = supabase
      .channel(`inbox:${me}`, { config: { private: true } })
      .on('broadcast', { event: 'inbox' }, ({ payload }) => {
        const p = payload as {
          thread_id: string;
          event: string;
          message_id?: string;
          sender_id?: string;
        };
        void qc.invalidateQueries({ queryKey: directKeys.inboxAll });
        void qc.invalidateQueries({ queryKey: directKeys.badge });
        if (p.event !== 'message' || !p.message_id || p.sender_id === me) return;
        // Open chats refresh through their own channel; no banner inside that chat or the inbox.
        if (path.current.startsWith(`/direct/t/${p.thread_id}`) || path.current === '/direct')
          return;
        void bannerFor(p.thread_id, p.message_id, me).then((b) => b && show(b));
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [me, qc]);

  if (!banner) return null;
  return <MessageBanner banner={banner} onClose={() => setBanner(null)} />;
}

async function bannerFor(threadId: string, messageId: string, me: string): Promise<Banner | null> {
  const [msg, member] = await Promise.all([
    supabase
      .from('messages')
      .select(
        'id, sender_id, kind, body, media_type, view_mode, vanish, data, story_id, created_at',
      )
      .eq('id', messageId)
      .maybeSingle(),
    supabase
      .from('thread_members')
      .select('muted_until, status')
      .eq('thread_id', threadId)
      .eq('user_id', me)
      .maybeSingle(),
  ]);
  const m = msg.data;
  if (!m || m.kind === 'system' || isMuted(member.data?.muted_until)) return null;
  if (member.data?.status === 'hidden') return null;
  const { data: sender } = await supabase
    .from('profiles')
    .select('username, avatar_path')
    .eq('id', m.sender_id)
    .maybeSingle();
  if (!sender) return null;
  const last = {
    ...m,
    story_reply: !!m.story_id && m.kind === 'text',
    post_kind: null,
  } as unknown as LastMessage;
  const text =
    member.data?.status === 'request'
      ? 'wants to send you a message.'
      : previewText({ kind: 'direct', members: [], unread_count: 1 }, last, me);
  return {
    key: messageId,
    threadId,
    username: sender.username,
    avatar_path: sender.avatar_path,
    text,
  };
}

function MessageBanner({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6 }]}
    >
      <Animated.View
        key={banner.key}
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(160)}
        style={{ marginHorizontal: spacing.md }}
      >
        <Pressable
          onPress={() => {
            onClose();
            router.push(`/direct/t/${banner.threadId}`);
          }}
          accessibilityRole="alert"
          accessibilityLabel={`${banner.username}: ${banner.text}`}
          style={[
            styles.banner,
            {
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.md,
            },
          ]}
        >
          <Avatar uri={avatarUrl(banner.avatar_path)} size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" numberOfLines={1}>
              {banner.username}
            </Text>
            <Text numberOfLines={2} color="textSecondary">
              {banner.text}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const TYPING_SEND_MS = 2500;
const TYPING_SHOW_MS = 5000;

/**
 * One open chat (page 76): refreshes messages / seen state from `thread:{id}` broadcasts and
 * exchanges typing indicators. Returns the users typing right now and a `typing()` notifier.
 */
export function useThreadChannel(
  threadId: string | undefined,
  me: string | undefined,
  canType: boolean,
) {
  const qc = useQueryClient();
  const [typing, setTyping] = useState<string[]>([]);
  const expiries = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!threadId || !me) return;
    // Coalesce bursts (a reaction + a message) into one refetch.
    const stopTyping = (user: string) => {
      clearTimeout(expiries.current[user]);
      delete expiries.current[user];
      setTyping((t) => t.filter((u) => u !== user));
    };
    const refetchMessages = () => {
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        void qc.invalidateQueries({ queryKey: directKeys.messages(threadId) });
      }, 120);
    };
    const channel = supabase
      .channel(`thread:${threadId}`, { config: { private: true, broadcast: { self: false } } })
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        const p = (payload ?? {}) as { user_id?: string; sender_id?: string };
        if (event === 'typing') {
          const user = p.user_id;
          if (!user || user === me) return;
          clearTimeout(expiries.current[user]);
          expiries.current[user] = setTimeout(() => stopTyping(user), TYPING_SHOW_MS);
          setTyping((t) => (t.includes(user) ? t : [...t, user]));
          return;
        }
        if (event === 'message' && p.sender_id) {
          // Their message ends their typing.
          stopTyping(p.sender_id);
        }
        if (['message', 'message_updated', 'message_deleted', 'reaction'].includes(event)) {
          refetchMessages();
        }
        if (['read', 'accepted', 'join_requests', 'message'].includes(event)) {
          void qc.invalidateQueries({ queryKey: directKeys.info(threadId) });
        }
      })
      .subscribe();
    channelRef.current = channel;
    const timers = expiries.current;
    return () => {
      channelRef.current = null;
      for (const t of Object.values(timers)) clearTimeout(t);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      void supabase.removeChannel(channel);
    };
  }, [threadId, me, qc]);

  const notifyTyping = useCallback(() => {
    if (!canType || !me || !channelRef.current) return;
    const now = Date.now();
    if (now - lastSent.current < TYPING_SEND_MS) return;
    lastSent.current = now;
    void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: me } });
  }, [canType, me]);

  return { typingUsers: typing, notifyTyping };
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
