import { Tabs, router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Icon, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  AccountSwitcherProvider,
  useAccountSwitcher,
} from '@/features/auth/components/AccountSwitcher';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

function tabIcon(outline: IconName, filled: IconName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={focused ? filled : outline} size={26} />;
  }
  return TabIcon;
}

/** The signed-in user's avatar; outlined in the text color when the tab is active. */
function ProfileTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  return (
    <View
      style={{
        padding: 1.5,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: focused ? colors.text : 'transparent',
      }}
    >
      <Avatar uri={avatarUrl(profile?.avatar_path)} size={26} />
    </View>
  );
}

/** Bottom tab shell: Home · Explore · Create · Reels · Profile (icons only, like Instagram). */
export default function TabsLayout() {
  return (
    <AccountSwitcherProvider>
      <TabsNavigator />
    </AccountSwitcherProvider>
  );
}

function TabsNavigator() {
  const { colors, hairline } = useTheme();
  const switcher = useAccountSwitcher();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.icon,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.separator,
          borderTopWidth: hairline,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'homeFilled') }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Search and explore', tabBarIcon: tabIcon('search', 'searchFilled') }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: 'Create', tabBarIcon: tabIcon('create', 'createFilled') }}
        listeners={{
          // Create is not a destination tab: it opens the creation flow as a modal.
          tabPress: (e) => {
            e.preventDefault();
            router.push('/create-entry');
          },
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{ title: 'Reels', tabBarIcon: tabIcon('reels', 'reelsFilled') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ProfileTabIcon }}
        listeners={{
          // Page 015: long-press the Profile tab to switch accounts.
          tabLongPress: () => switcher.open(),
        }}
      />
    </Tabs>
  );
}
