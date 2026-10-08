import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components';
import { useProfile } from '@/features/profile/api';
import { BellSheet, ProfileOptionsSheet } from '@/features/profile/components/ProfileSheets';
import { ProfileView } from '@/features/profile/components/ProfileView';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Pages 017/018 — another user's profile (or the locked private state). */
export default function UserProfileScreen() {
  const { colors, spacing } = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useProfile({ username });
  const [sheet, setSheet] = useState<'bell' | 'options' | null>(null);
  const data = profile.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={
          <Text variant="headline" numberOfLines={1}>
            {data?.username ?? username}
          </Text>
        }
        right={
          data && !data.is_self ? (
            <>
              {data.i_follow ? (
                <TopBarButton icon="bell" label="Notifications" onPress={() => setSheet('bell')} />
              ) : null}
              <TopBarButton icon="more" label="Options" onPress={() => setSheet('options')} />
            </>
          ) : null
        }
      />
      {data ? (
        <ProfileView
          profile={data}
          refreshing={profile.isRefetching}
          onRefresh={() => void profile.refetch()}
        />
      ) : profile.isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            paddingTop: 96,
            gap: spacing.md,
            padding: spacing.xl,
          }}
        >
          <Text variant="headline">
            {profile.isError ? "Couldn't load profile" : "Sorry, this page isn't available."}
          </Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            {profile.isError
              ? 'Check your connection and try again.'
              : 'The link you followed may be broken, or the page may have been removed.'}
          </Text>
          {profile.isError ? (
            <Button title="Retry" variant="secondary" onPress={() => void profile.refetch()} />
          ) : (
            <Button title="Go back" variant="text" onPress={() => goBack()} />
          )}
        </View>
      )}
      {data && !data.is_self ? (
        <>
          <BellSheet visible={sheet === 'bell'} onClose={() => setSheet(null)} profile={data} />
          <ProfileOptionsSheet
            visible={sheet === 'options'}
            onClose={() => setSheet(null)}
            profile={data}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}
