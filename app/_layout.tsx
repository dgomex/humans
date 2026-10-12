import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components';
import { AuthProvider, useAuth, type AuthGate } from '@/features/auth/AuthProvider';
import { UploadQueueProvider } from '@/features/create/UploadQueue';
import { PostSheetsProvider } from '@/features/feed/components/PostSheets';
import { StoryUploadsProvider } from '@/features/stories/StoryUploads';
import { ZoomProvider } from '@/features/feed/components/ZoomOverlay';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  const theme = useTheme();

  const navTheme = useMemo(() => {
    const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.separator,
        notification: theme.colors.like,
      },
    };
  }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <ToastProvider>
              <AuthProvider>
                <UploadQueueProvider>
                  <StoryUploadsProvider>
                    <PostSheetsProvider>
                      <ZoomProvider>
                        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
                        <RootNavigator />
                      </ZoomProvider>
                    </PostSheetsProvider>
                  </StoryUploadsProvider>
                </UploadQueueProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Route groups are guarded by the auth gate (see AuthProvider). While a gate is momentarily
 * `loading` (e.g. fetching the profile after a switch) the previous gate keeps its routes so
 * the user isn't bounced around.
 */
function RootNavigator() {
  const { gate } = useAuth();
  const [stableGate, setStableGate] = useState<Exclude<AuthGate, 'loading'> | null>(null);
  if (gate !== 'loading' && gate !== stableGate) setStableGate(gate);

  useEffect(() => {
    // Page 001: keep the splash until the stored session has been restored.
    if (gate !== 'loading') void SplashScreen.hideAsync();
  }, [gate]);

  // Cold start: render nothing under the splash until the session is known, so a deep link
  // (e.g. /profile) isn't redirected by guards that briefly look signed out.
  if (stableGate === null) return null;
  const g = gate === 'loading' ? stableGate : gate;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={g === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
        {/* Phase 3 — Creation (pages 32–42) */}
        <Stack.Screen
          name="compose"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="p/[id]/index" />
        {/* Phase 4 — Feed & interactions (pages 44–50) */}
        <Stack.Screen
          name="p/[id]/comments"
          // Transparent full-window route; the screen draws its own bottom sheet (ScreenSheet)
          // so keyboard and layout use real window coordinates (native form sheets don't).
          options={{ presentation: 'transparentModal', animation: 'none' }}
        />
        <Stack.Screen name="p/[id]/likes" />
        <Stack.Screen
          name="report"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="p/[id]/edit"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="archive" />
        {/* Phase 5 — Stories (pages 52–57) */}
        <Stack.Screen
          name="stories/[userId]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="stories/highlight/[id]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="stories/view"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="story"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        {/* Phase 6 — Reels (pages 58–64; creation lives in compose/reel/*) */}
        <Stack.Screen name="reel/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="saved/audio" />
        <Stack.Screen name="story-settings/index" />
        <Stack.Screen name="story-settings/hidden" />
        <Stack.Screen name="highlights/[id]/edit" />
        <Stack.Screen name="collab-invites" />
        <Stack.Screen name="dev/ui" options={{ headerShown: true, title: 'UI kit' }} />
        {/* Phase 2 — Profile (screens without the tab bar) */}
        <Stack.Screen name="edit-profile/index" />
        <Stack.Screen name="edit-profile/[field]" />
        <Stack.Screen name="edit-profile/links" />
        <Stack.Screen name="saved/index" />
        <Stack.Screen name="saved/new" />
        <Stack.Screen name="saved/[id]/index" />
        <Stack.Screen name="saved/[id]/edit" />
        <Stack.Screen name="close-friends" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="follow-requests" />
        <Stack.Screen name="highlights/new" />
        <Stack.Screen
          name="qr/index"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="qr/scan" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      <Stack.Protected guard={g === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={g === 'onboarding'}>
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={g === 'recovery'}>
        <Stack.Screen name="(recovery)/new-password" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={g === 'savePrompt'}>
        <Stack.Screen name="(session)/save-login" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
