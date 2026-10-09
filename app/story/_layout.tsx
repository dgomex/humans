import { Stack } from 'expo-router';

import { StoryComposerProvider } from '@/features/stories/StoryComposer';
import { useTheme } from '@/theme';

/** Phase 5 story creation (pages 53–55): camera → editor → share, one composer for the flow. */
export default function StoryLayout() {
  const { colors } = useTheme();
  return (
    <StoryComposerProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.mediaBackground },
        }}
      >
        <Stack.Screen name="camera" />
        <Stack.Screen name="editor" options={{ animation: 'fade' }} />
        <Stack.Screen name="share" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </StoryComposerProvider>
  );
}
