import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, TextField, useToast } from '@/components';
import { directError, directKeys, setGroupPhoto } from '@/features/direct/api';
import { pickAvatar } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Page 78 — Group chat creation: optional name + photo, then the new group opens. */
export default function NewGroupScreen() {
  const { ids, names } = useLocalSearchParams<{ ids: string; names?: string }>();
  const members = (ids ?? '').split(',').filter(Boolean);
  const usernames = (names ?? '').split(',').filter(Boolean);
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_group_thread', {
        p_members: members,
        p_title: title.trim() || undefined,
      });
      if (error) throw error;
      const thread = data as string;
      if (photo)
        await setGroupPhoto(thread, photo).catch(() => toast.show("Couldn't set the group photo."));
      void qc.invalidateQueries({ queryKey: directKeys.all });
      // Inbox → New message → New group: leave the chat on top of the inbox.
      router.dismiss(1);
      router.replace(`/direct/t/${thread}`);
    } catch (e) {
      toast.show(directError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="New group" center />
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <Pressable
          onPress={async () => {
            const uri = await pickAvatar('library').catch(() => null);
            if (uri) setPhoto(uri);
          }}
          accessibilityRole="button"
          accessibilityLabel="Add group photo"
          style={[styles.photo, { backgroundColor: colors.backgroundSecondary }]}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photoImg} contentFit="cover" />
          ) : (
            <Icon name="camera" size={32} />
          )}
        </Pressable>
        <TextField
          label="Group name (optional)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        <Text color="textSecondary">
          {members.length + 1} members: you, {usernames.join(', ')}
        </Text>
        <Text variant="caption" color="textSecondary">
          People who don&apos;t follow you will get your group as a message request.
        </Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <Button
          title="Create"
          loading={busy}
          disabled={members.length < 2}
          onPress={() => void create()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: 96, height: 96 },
});
