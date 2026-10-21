import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, SearchField, Text, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  directError,
  useFilteredMessages,
  useMessageActions,
  useThreadInfo,
  type Message,
  type MessageFilter,
} from '@/features/direct/api';
import { SharedPostCard } from '@/features/direct/components/MessageContent';
import { linkPattern, memberName, separatorTime } from '@/features/direct/format';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { showDialog } from '@/lib/dialog';
import { useDebounced } from '@/lib/useDebounced';
import { useTheme } from '@/theme';

const TITLES: Record<MessageFilter, string> = {
  pinned: 'Pinned messages',
  media: 'Media, links and posts',
  links: 'Media, links and posts',
  posts: 'Media, links and posts',
  scheduled: 'Scheduled messages',
  search: 'Search',
};

/** Page 79 → pinned messages, shared media / links / posts, scheduled messages, search in chat. */
export default function FilteredMessages() {
  const params = useLocalSearchParams<{ id: string; filter: MessageFilter }>();
  const id = params.id;
  const [filter, setFilter] = useState<MessageFilter>(params.filter ?? 'pinned');
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 300);
  const info = useThreadInfo(id);
  const list = useFilteredMessages(id, filter, query);
  const actions = useMessageActions(id);
  const items = useMemo(() => list.data?.pages.flat() ?? [], [list.data]);
  const members = Object.fromEntries((info.data?.members ?? []).map((m) => [m.id, m]));
  const shared = filter === 'media' || filter === 'links' || filter === 'posts';
  const tile = (width - 4) / 3;

  const row = (m: Message, trailing?: React.ReactNode) => {
    const who = members[m.sender_id];
    return (
      <View
        style={[
          styles.row,
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.md },
        ]}
      >
        <Avatar uri={avatarUrl(who?.avatar_path)} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold">{m.sender_id === me ? 'You' : memberName(who)}</Text>
          <Text numberOfLines={3}>
            {m.body ??
              (m.kind === 'voice'
                ? 'Voice message'
                : m.kind === 'media'
                  ? 'Photo'
                  : m.kind === 'post'
                    ? 'Post'
                    : 'Attachment')}
          </Text>
          <Text variant="caption" color="textSecondary">
            {m.scheduled_for
              ? `Sends ${separatorTime(m.scheduled_for)}`
              : separatorTime(m.created_at)}
          </Text>
        </View>
        {trailing}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title={TITLES[filter]} center />
      {filter === 'search' ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <SearchField value={search} onChangeText={setSearch} />
        </View>
      ) : null}
      {shared ? (
        <View style={[styles.tabs, { borderColor: colors.separator }]}>
          {(['media', 'links', 'posts'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f }}
              style={[
                styles.tab,
                { borderBottomColor: filter === f ? colors.text : 'transparent' },
              ]}
            >
              <Text variant="bodyBold" color={filter === f ? 'text' : 'textSecondary'}>
                {f === 'media' ? 'Media' : f === 'links' ? 'Links' : 'Posts'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <FlatList
        key={filter === 'media' ? 'grid' : 'list'}
        data={items}
        numColumns={filter === 'media' ? 3 : 1}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        columnWrapperStyle={filter === 'media' ? { gap: 2 } : undefined}
        contentContainerStyle={filter === 'media' ? { gap: 2 } : { paddingVertical: spacing.sm }}
        renderItem={({ item: m }) => {
          if (filter === 'media')
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/direct/media/[messageId]',
                    params: { messageId: m.id, thread: id },
                  })
                }
                accessibilityRole="imagebutton"
              >
                <Image
                  source={
                    (m.media_type === 'video' ? m.thumbUrl : m.mediaUrl)
                      ? { uri: (m.media_type === 'video' ? m.thumbUrl : m.mediaUrl)! }
                      : null
                  }
                  style={{ width: tile, height: tile, backgroundColor: colors.skeleton }}
                  contentFit="cover"
                />
                {m.media_type === 'video' ? (
                  <View style={styles.videoIcon}>
                    <Icon name="play" size={16} color={colors.onMedia} />
                  </View>
                ) : null}
              </Pressable>
            );
          if (filter === 'posts')
            return (
              <View style={{ padding: spacing.md, alignItems: 'center' }}>
                <SharedPostCard postId={m.post_id} />
              </View>
            );
          if (filter === 'links') {
            const link = (m.body ?? '').match(linkPattern)?.[0];
            return (
              <Pressable
                onPress={() =>
                  link && void Linking.openURL(link.startsWith('http') ? link : `https://${link}`)
                }
                accessibilityRole="link"
              >
                {row(m, <Icon name="link" size={20} color={colors.textSecondary} />)}
              </Pressable>
            );
          }
          if (filter === 'pinned')
            return row(
              m,
              info.data?.me.status === 'active' ? (
                <Pressable
                  onPress={() => actions.pin(m, false).catch((e) => toast.show(directError(e)))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Unpin"
                >
                  <Icon name="pinOff" size={20} />
                </Pressable>
              ) : null,
            );
          if (filter === 'scheduled')
            return row(
              m,
              <Pressable
                onPress={() =>
                  showDialog('Delete scheduled message?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => void actions.unsend(m).then(() => list.refetch()),
                    },
                  ])
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete scheduled message"
              >
                <Icon name="trash" size={20} color={colors.danger} />
              </Pressable>,
            );
          return row(m);
        }}
        ListEmptyComponent={
          list.isPending && (filter !== 'search' || query) ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <Text color="textSecondary" style={{ padding: spacing.xl, textAlign: 'center' }}>
              {filter === 'search'
                ? query
                  ? 'No messages found.'
                  : 'Search for messages in this chat.'
                : filter === 'pinned'
                  ? 'No pinned messages. Long-press a message to pin it.'
                  : filter === 'scheduled'
                    ? 'No scheduled messages. Long-press Send to schedule one.'
                    : 'Nothing shared yet.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  videoIcon: { position: 'absolute', top: 6, right: 6 },
});
