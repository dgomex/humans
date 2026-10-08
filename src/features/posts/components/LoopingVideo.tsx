import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

// The player is an imperative native object; mutating it outside render is how expo-video works.
function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

/** Muted-by-default looping video (edit preview, post viewer). Key it by source to swap videos. */
export function LoopingVideo({
  uri,
  muted = true,
  playing = true,
  contentFit = 'cover',
  style,
}: {
  uri: string;
  muted?: boolean;
  playing?: boolean;
  contentFit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    applyMuted(player, muted);
  }, [player, muted]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}
