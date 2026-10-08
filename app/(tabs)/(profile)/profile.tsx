import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { useFollowRequests, useProfile } from '@/features/profile/api';
import { CreateSheet, OwnMenuSheet } from '@/features/profile/components/ProfileSheets';
import { ProfileView } from '@/features/profile/components/ProfileView';
import { TopBar, TopBarButton } from '@/features/profile/components/TopBar';
import { useTheme } from '@/theme';

/** Page 016 — Own profile (Profile tab). */
export default function OwnProfileScreen() {
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const switcher = useAccountSwitcher();
  const me = auth.session?.user.id;
  const profile = useProfile({ userId: me });
  const requests = useFollowRequests(me);
  const [sheet, setSheet] = useState<'create' | 'menu' | null>(null);
  const data = profile.data;
  const username = data?.username ?? auth.profile?.username ?? '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        back={false}
        title={
          <Pressable
            onPress={switcher.open}
            accessibilityRole="button"
            accessibilityLabel="Switch accounts"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            {data?.is_private ? <Icon name="lock" size={16} /> : null}
            <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
              {username}
            </Text>
            <Icon name="down" size={16} />
          </Pressable>
        }
        right={
          <>
            <TopBarButton icon="create" label="Create" onPress={() => setSheet('create')} />
            <View>
              <TopBarButton
                icon="menu"
                label="Settings and activity"
                onPress={() => setSheet('menu')}
              />
              {(requests.data?.length ?? 0) > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.like,
                  }}
                />
              ) : null}
            </View>
          </>
        }
      />
      {data ? (
        <ProfileView
          profile={data}
          refreshing={profile.isRefetching}
          onRefresh={() => {
            void profile.refetch();
            void requests.refetch();
          }}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {profile.isError ? (
            <Text color="textSecondary" onPress={() => void profile.refetch()}>
              Couldn&apos;t load your profile. Tap to retry.
            </Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      )}
      <CreateSheet visible={sheet === 'create'} onClose={() => setSheet(null)} />
      <OwnMenuSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        requestCount={requests.data?.length ?? 0}
      />
    </SafeAreaView>
  );
}
