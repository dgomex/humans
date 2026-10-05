import { Tabs, router } from 'expo-router';

import { Avatar, Icon, type IconName } from '@/components';
import { useTheme } from '@/theme';

function tabIcon(outline: IconName, filled: IconName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={focused ? filled : outline} size={26} />;
  }
  return TabIcon;
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  // Phase 1/2 pass the signed-in user's avatar URI here.
  return <Avatar size={26} ring={focused ? 'seen' : 'none'} />;
}

/** Bottom tab shell: Home · Explore · Create · Reels · Profile (icons only, like Instagram). */
export default function TabsLayout() {
  const { colors, hairline } = useTheme();

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
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ProfileTabIcon }} />
    </Tabs>
  );
}
