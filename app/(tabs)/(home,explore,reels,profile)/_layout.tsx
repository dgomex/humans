import { Stack } from 'expo-router';

/**
 * Each tab (except Create) is its own stack, so profiles and lists pushed from a tab keep the
 * tab bar, like Instagram. Shared routes (`[username]/…`) live in this array group and open in
 * whichever tab you're in; cold deep links land in the first group alphabetically (Explore).
 */
export const unstable_settings = {
  anchor: 'index',
  explore: { anchor: 'explore' },
  reels: { anchor: 'reels' },
  profile: { anchor: 'profile' },
};

export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
