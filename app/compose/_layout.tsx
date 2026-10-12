import { Stack } from 'expo-router';

import { ComposerProvider } from '@/features/create/ComposerProvider';

/** Creation flow (posts: pages 32–42, reels: 59–63): one composer shared by every step. */
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
        {/* Phase 6 — reels (pages 59–63) share the composer */}
        <Stack.Screen name="reel/camera" options={{ animation: 'fade' }} />
        <Stack.Screen name="reel/edit" />
        <Stack.Screen name="reel/timeline" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reel/voiceover" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reel/details" />
        <Stack.Screen name="reel/cover" options={{ presentation: 'modal' }} />
      </Stack>
    </ComposerProvider>
  );
}
