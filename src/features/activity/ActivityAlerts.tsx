import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { avatarUrl } from '@/features/profile/avatar';
import { openProfile } from '@/features/profile/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { activityKeys, fetchNotificationPreview, type NotificationPreview } from './api';
import { actionText, openPreview } from './format';

type Banner =
  | { id: string; kind: 'notification'; preview: NotificationPreview }
  | { id: string; kind: 'request'; username: string; avatar_path: string | null };

const SHOW_MS = 4000;

/**
 * In-app alerts (no OS push yet, decision 2026-10-13): listens to my new notifications and
 * follow requests over Realtime, refreshes the ♡ badge, and shows a banner at the top unless
 * Activity is already open (then the list reloads instead).
 */
export function ActivityAlerts() {
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const pathname = usePathname();
  const onActivity = useRef(false);
  useEffect(() => {
    onActivity.current = pathname.startsWith('/activity');
  }, [pathname]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!me) return;
    const show = (b: Banner) => {
      if (timer.current) clearTimeout(timer.current);
      setBanner(b);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      timer.current = setTimeout(() => setBanner(null), SHOW_MS);
    };
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: activityKeys.badge });
      if (onActivity.current) void qc.resetQueries({ queryKey: activityKeys.feed });
    };

    const channel = supabase
      .channel(`activity:${me}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${me}`,
        },
        (payload) => {
          refresh();
          if (onActivity.current) return;
          const id = (payload.new as { id: string }).id;
          fetchNotificationPreview(id)
            .then((p) => {
              if (p) show({ id, kind: 'notification', preview: p });
            })
            .catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_requests', filter: `target_id=eq.${me}` },
        (payload) => {
          refresh();
          void qc.invalidateQueries({ queryKey: activityKeys.requestSummary });
          void qc.invalidateQueries({ queryKey: ['activity', 'requests'] });
          if (payload.eventType !== 'INSERT' || onActivity.current) return;
          const requester = (payload.new as { requester_id: string }).requester_id;
          supabase
            .from('profiles')
            .select('username, avatar_path')
            .eq('id', requester)
            .single()
            .then(({ data }) => {
              if (data) show({ id: requester, kind: 'request', ...data });
            });
        },
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [me, qc]);

  if (!banner) return null;
  return <AlertBanner banner={banner} onClose={() => setBanner(null)} />;
}

function AlertBanner({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const username = banner.kind === 'notification' ? banner.preview.actor_username : banner.username;
  const avatar =
    banner.kind === 'notification' ? banner.preview.actor_avatar_path : banner.avatar_path;
  const text =
    banner.kind === 'notification'
      ? actionText(banner.preview.type, {
          kind: banner.preview.post_kind,
          comment: banner.preview.comment_body,
          title: banner.preview.data?.title,
          prompt: banner.preview.data?.prompt,
        })
      : 'requested to follow you.';

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6 }]}
    >
      <Animated.View
        key={banner.id}
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(160)}
        style={{ marginHorizontal: spacing.md }}
      >
        <Pressable
          onPress={() => {
            onClose();
            if (banner.kind === 'notification') openPreview(banner.preview);
            else openProfile(banner.username);
          }}
          accessibilityRole="alert"
          accessibilityLabel={`${username} ${text}`}
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
          <Avatar uri={avatarUrl(avatar)} size={36} />
          <Text style={{ flex: 1 }} numberOfLines={2}>
            <Text variant="bodyBold">{username}</Text>
            {text.startsWith("'") ? text : ` ${text}`}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
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
