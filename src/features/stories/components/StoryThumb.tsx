import { View } from 'react-native';

import type { StoryContent, StoryKind } from '../types';
import { StoryBase, StoryElements, canvasHeight } from './StoryCanvas';
import { StickerView } from './StickerView';

export type ThumbSource = {
  kind: StoryKind;
  content: StoryContent;
  media_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  urls: Record<string, string>;
};

/** A story drawn small and static (archive grid, viewers strip, highlight editor). */
export function StoryThumb({ story, width }: { story: ThumbSource; width: number }) {
  const resolve = (p: string) => story.urls[p] ?? null;
  return (
    <View style={{ width, height: canvasHeight(width), overflow: 'hidden' }} pointerEvents="none">
      <StoryBase
        source={{
          kind: story.kind,
          content: story.content,
          mediaUri: story.media_path ? resolve(story.media_path) : null,
          posterUri: story.thumb_path ? resolve(story.thumb_path) : null,
          mediaSize:
            story.width && story.height ? { width: story.width, height: story.height } : null,
          resolve,
        }}
        width={width}
        paused
      />
      <StoryElements
        elements={story.content.elements ?? []}
        width={width}
        renderSticker={(el, k) => (
          <StickerView sticker={el.sticker} k={k} ctx={{ preview: true, resolve }} />
        )}
      />
    </View>
  );
}
