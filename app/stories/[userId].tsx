import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useStoryReel } from '@/features/stories/api';
import { StoryPager, type PageControls } from '@/features/stories/components/StoryPager';
import { StoryLoading, StoryPlayer } from '@/features/stories/components/StoryPlayer';
import { storyQueueFor } from '@/features/stories/viewerQueue';
import { goBack } from '@/lib/navigation';

/** Page 52 — story viewer: the tapped user's active stories, then the next users in tray order. */
export default function StoriesScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const keys = useMemo(() => storyQueueFor(userId), [userId]);
  return (
    <StoryPager
      keys={keys}
      initialKey={userId}
      onClose={() => goBack('/')}
      renderPage={(key, controls) => <UserReel userId={key} controls={controls} />}
    />
  );
}

function UserReel({ userId, controls }: { userId: string; controls: PageControls }) {
  const reel = useStoryReel(userId);
  const stories = reel.data;
  const { active, onNextReel } = controls;

  // Nothing (left) to show for this user: move on.
  useEffect(() => {
    if (active && stories && stories.length === 0) onNextReel();
  }, [active, stories, onNextReel]);

  if (!stories || stories.length === 0) return <StoryLoading />;
  const firstUnseen = stories.findIndex((s) => !s.seen);
  return (
    <StoryPlayer
      stories={stories}
      initialIndex={firstUnseen < 0 ? 0 : firstUnseen}
      header={{ kind: 'user' }}
      {...controls}
      onOpenViewers={(s) => controls.onOpenViewers(s, stories)}
    />
  );
}
