import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useHighlights } from '@/features/profile/api';
import {
  useHighlightCovers,
  useHighlightReel,
  type ProfileHighlight,
} from '@/features/stories/api';
import { StoryPager, type PageControls } from '@/features/stories/components/StoryPager';
import { StoryLoading, StoryPlayer } from '@/features/stories/components/StoryPlayer';
import { goBack } from '@/lib/navigation';

/** Page 57 — highlights viewer: plays one highlight; swiping moves to the profile's next highlight. */
export default function HighlightScreen() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner: string }>();
  const highlights = useHighlights(owner);
  const covers = useHighlightCovers(highlights.data);
  const list = highlights.data ?? [];
  const keys = list.some((h) => h.id === id) ? list.map((h) => h.id) : [id];
  return (
    <StoryPager
      keys={keys}
      initialKey={id}
      onClose={() => goBack('/')}
      renderPage={(key, controls) => (
        <HighlightReel
          highlight={list.find((h) => h.id === key)}
          id={key}
          coverUri={covers[key] ?? null}
          controls={controls}
        />
      )}
    />
  );
}

function HighlightReel({
  id,
  highlight,
  coverUri,
  controls,
}: {
  id: string;
  highlight: ProfileHighlight | undefined;
  coverUri: string | null;
  controls: PageControls;
}) {
  const reel = useHighlightReel(id);
  const stories = reel.data;
  const { active, onNextReel } = controls;

  useEffect(() => {
    if (active && stories && stories.length === 0) onNextReel();
  }, [active, stories, onNextReel]);

  if (!stories || stories.length === 0) return <StoryLoading />;
  return (
    <StoryPlayer
      stories={stories}
      initialIndex={0}
      header={{
        kind: 'highlight',
        highlightId: id,
        title: highlight?.title || 'Highlights',
        coverUri,
      }}
      {...controls}
      onOpenViewers={(s) => controls.onOpenViewers(s, stories)}
    />
  );
}
