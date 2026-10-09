import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useStoryCards } from '@/features/stories/api';
import { StoryPager, type PageControls } from '@/features/stories/components/StoryPager';
import { StoryLoading, StoryPlayer } from '@/features/stories/components/StoryPlayer';
import { goBack } from '@/lib/navigation';

/**
 * Specific stories (`?ids=a,b&start=b`): your stories archive (page 28) and Add yours chains.
 * One reel; expired archive stories play like highlights.
 */
export default function StoryCardsScreen() {
  const { ids, start } = useLocalSearchParams<{ ids: string; start?: string }>();
  const list = useMemo(() => (ids ?? '').split(',').filter(Boolean), [ids]);
  return (
    <StoryPager
      keys={['cards']}
      initialKey="cards"
      onClose={() => goBack('/')}
      renderPage={(_key, controls) => <CardsReel ids={list} start={start} controls={controls} />}
    />
  );
}

function CardsReel({
  ids,
  start,
  controls,
}: {
  ids: string[];
  start?: string;
  controls: PageControls;
}) {
  const cards = useStoryCards(ids);
  const stories = cards.data;
  const { active, onClose } = controls;

  useEffect(() => {
    if (active && stories && stories.length === 0) onClose();
  }, [active, stories, onClose]);

  if (!stories || stories.length === 0) return <StoryLoading />;
  const index = Math.max(
    0,
    stories.findIndex((s) => s.id === start),
  );
  return (
    <StoryPlayer
      stories={stories}
      initialIndex={index}
      header={{ kind: 'user' }}
      {...controls}
      onOpenViewers={(s) => controls.onOpenViewers(s, stories)}
    />
  );
}
