import { Stack } from 'expo-router';

import { ComposerProvider } from '@/features/create/ComposerProvider';

/** Phase 3 creation flow (pages 32–42): one composer shared by every step. */
export default function ComposeLayout() {
  return (
    <ComposerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="camera" options={{ animation: 'fade' }} />
        <Stack.Screen name="edit" />
        <Stack.Screen name="details" />
        <Stack.Screen name="tag-people" />
        <Stack.Screen name="collaborators" />
        <Stack.Screen name="music" options={{ presentation: 'modal' }} />
        <Stack.Screen name="advanced" />
        <Stack.Screen name="alt-text" />
        <Stack.Screen name="drafts" />
      </Stack>
    </ComposerProvider>
  );
}
