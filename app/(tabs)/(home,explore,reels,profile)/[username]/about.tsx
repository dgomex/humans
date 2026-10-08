import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, Text, type IconName } from '@/components';
import { useProfile } from '@/features/profile/api';
import { avatarUrl } from '@/features/profile/avatar';
import { TopBar } from '@/features/profile/components/TopBar';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Page 023 — About this account: date joined + former usernames count (no country, by decision). */
export default function AboutAccountScreen() {
  const { colors, spacing } = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useProfile({ username });
  const userId = profile.data?.id;
  const about = useQuery({
    queryKey: ['profile', 'about', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_about', { p_user_id: userId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const a = about.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="About this account" center />
      {a ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Avatar uri={avatarUrl(a.avatar_path)} size={86} />
            <Text variant="subhead">{a.username}</Text>
            <Text color="textSecondary" style={{ textAlign: 'center' }}>
              To help keep our community authentic, we&apos;re showing information about accounts on
              Humans.
            </Text>
          </View>
          <Fact
            icon="calendar"
            title="Date joined"
            value={new Date(a.date_joined).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          />
          <Fact icon="history" title="Former usernames" value={String(a.former_usernames_count)} />
        </ScrollView>
      ) : (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      )}
    </SafeAreaView>
  );
}

function Fact({ icon, title, value }: { icon: IconName; title: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={icon} size={28} />
      <View>
        <Text variant="bodyBold">{title}</Text>
        <Text color="textSecondary">{value}</Text>
      </View>
    </View>
  );
}
