import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAccountSwitcher } from '@/features/auth/components/AccountSwitcher';
import { avatarUrl } from '@/features/profile/avatar';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

/**
 * Own profile — placeholder until page 16 (Phase 2). Already has the real header control
 * (username ▾ → account switcher) and a temporary Log out (Settings comes in Phase 11).
 */
export default function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const auth = useAuth();
  const switcher = useAccountSwitcher();
  const profile = auth.profile;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        <Pressable
          onPress={switcher.open}
          accessibilityRole="button"
          accessibilityLabel="Switch accounts"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Text variant="headline">{profile?.username}</Text>
          <Icon name="down" size={16} />
        </Pressable>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          padding: spacing.xl,
        }}
      >
        <Avatar uri={avatarUrl(profile?.avatar_path)} size={96} />
        <Text variant="subhead">{profile?.full_name}</Text>
        <Text color="textSecondary" style={{ textAlign: 'center' }}>
          Own profile — page 16 (Phase 2).
        </Text>
        <Button title="Switch account" variant="secondary" onPress={switcher.open} />
        <Button
          title={`Log out ${profile?.username ?? ''}`}
          variant="danger"
          onPress={() =>
            showDialog(`Log out of ${profile?.username}?`, undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: () => void auth.logout() },
            ])
          }
        />
      </View>
    </SafeAreaView>
  );
}
