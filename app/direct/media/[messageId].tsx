import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar, Icon, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { saveChatMedia } from '@/features/direct/saveMedia';
import { shortTime } from '@/features/direct/format';
import { avatarUrl } from '@/features/profile/avatar';
import { BUCKETS, getSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/**
 * Page 80 — Media viewer: full-screen photo / video, swipe down to close, Save / Forward for kept
 * media. View-once / replay media arrive with a short-lived URL (`?url=&once=1`), can't be saved
 * or forwarded, and screenshots are reported to the sender where the OS allows.
 */
export default function ChatMediaViewer() {
  const { messageId, thread, url, once } = useLocalSearchParams<{
    messageId: string;
    thread: string;
    url?: string;
    once?: string;
  }>();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();
  const { width, height } = useWindowDimensions();
  const ephemeral = once === '1';

  const msg = useQuery({
    queryKey: ['direct', 'media', messageId, url ?? ''],
    gcTime: ephemeral ? 0 : undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, sender_id, media_type, media_path, thumb_path, width, height, view_mode, created_at',
        )
        .eq('id', messageId)
        .single();
      if (error) throw error;
      const { data: sender } = await supabase
        .from('profiles')
        .select('username, avatar_path')
        .eq('id', data.sender_id)
        .maybeSingle();
      let mediaUrl = url ?? null;
      if (!mediaUrl && data.media_path) {
        const urls = await getSignedUrls(BUCKETS.messages, [data.media_path]);
        mediaUrl = urls[data.media_path] ?? null;
      }
      return { ...data, sender, mediaUrl };
    },
  });
  const m = msg.data;
  const isVideo = m?.media_type === 'video';
  const player = useVideoPlayer(isVideo && m?.mediaUrl ? { uri: m.mediaUrl } : null, (p) => {
    p.loop = !ephemeral;
    p.play();
  });

  // Screenshot notice for disappearing media.
  useEffect(() => {
    if (!ephemeral || Platform.OS === 'web') return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      void supabase.rpc('note_screenshot', { p_thread: thread, p_message: messageId });
    });
    return () => sub.remove();
  }, [ephemeral, thread, messageId]);

  const close = () => goBack('/direct');
  const dy = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => dy.set(Math.max(0, e.translationY)))
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(close);
      else dy.set(withTiming(0));
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: dy.get() }],
    opacity: 1 - Math.min(0.6, dy.get() / 600),
  }));

  const ratio = (m?.width ?? 1) / (m?.height ?? 1);
  const w = Math.min(width, height * 0.8 * ratio);
  const h = w / ratio;
  const mine = m?.sender_id === profile?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.mediaBackground }}>
      <View style={[styles.header, { padding: spacing.md, gap: spacing.sm }]}>
        <Avatar uri={avatarUrl(m?.sender?.avatar_path)} size={32} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" style={{ color: colors.onMedia }}>
            {mine ? 'You' : (m?.sender?.username ?? '')}
          </Text>
          {m ? (
            <Text variant="caption" style={{ color: colors.onMedia, opacity: 0.7 }}>
              {shortTime(m.created_at)}
              {ephemeral ? ` · ${m.view_mode === 'replay' ? 'Allow replay' : 'View once'}` : ''}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="close" size={28} color={colors.onMedia} />
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.stage, style]}>
          {!m || !m.mediaUrl ? (
            msg.isError || (m && !m.mediaUrl) ? (
              <Text style={{ color: colors.onMedia }}>Couldn&apos;t load media.</Text>
            ) : (
              <ActivityIndicator color={colors.onMedia} />
            )
          ) : isVideo ? (
            <VideoView
              player={player}
              style={{ width: w, height: h }}
              contentFit="contain"
              nativeControls={!ephemeral}
            />
          ) : (
            <Image
              source={{ uri: m.mediaUrl }}
              style={{ width: w, height: h }}
              contentFit="contain"
            />
          )}
        </Animated.View>
      </GestureDetector>
      {!ephemeral && m?.mediaUrl ? (
        <View style={[styles.footer, { padding: spacing.lg }]}>
          <Pressable
            onPress={() =>
              void saveChatMedia(m.mediaUrl!, isVideo ? 'video' : 'image').then((r) =>
                toast.show(r === 'saved' ? 'Saved' : 'Allow photo access to save.'),
              )
            }
            style={styles.action}
            accessibilityRole="button"
          >
            <Icon name="download" size={24} color={colors.onMedia} />
            <Text variant="caption" style={{ color: colors.onMedia }}>
              Save
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/direct/send', params: { forward: messageId, thread } })
            }
            style={styles.action}
            accessibilityRole="button"
          >
            <Icon name="forwardMessage" size={24} color={colors.onMedia} />
            <Text variant="caption" style={{ color: colors.onMedia }}>
              Forward
            </Text>
          </Pressable>
        </View>
      ) : ephemeral ? (
        <Text
          variant="caption"
          style={{ color: colors.onMedia, opacity: 0.7, textAlign: 'center', padding: spacing.lg }}
        >
          {m?.view_mode === 'replay'
            ? 'You can replay this once.'
            : 'This disappears after you close it.'}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: 4 },
});
