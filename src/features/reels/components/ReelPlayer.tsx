import { useEventListener } from 'expo';
import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Text } from '@/components';
import { StoryElements } from '@/features/stories/components/StoryCanvas';
import { StickerView, type StickerActions } from '@/features/stories/components/StickerView';
import { CANVAS_H, CANVAS_W } from '@/features/stories/types';
import { useTheme } from '@/theme';

import { fitFor, segmentAt, type ReelSource, type Segment } from '../source';
import { overlayVisible } from '../types';

/** How often the composition clock is published to overlays / voiceovers / progress (ms). */
const TICK_MS = 100;
/** Resync audio tracks when they drift further than this from the clock (s). */
const DRIFT_S = 0.35;

// expo-video / expo-audio players are imperative native objects; mutating them outside render is
// how both libraries work, so the writes live in these helpers.
function setVideo(
  p: VideoPlayer,
  patch: Partial<
    Pick<
      VideoPlayer,
      'muted' | 'volume' | 'playbackRate' | 'currentTime' | 'loop' | 'timeUpdateEventInterval'
    >
  >,
) {
  Object.assign(p, patch);
}
function setAudio(p: AudioPlayer, patch: Partial<Pick<AudioPlayer, 'muted' | 'volume'>>) {
  Object.assign(p, patch);
}

export type ReelPlayerProps = {
  source: ReelSource;
  /** Container size; the 9:16 canvas covers it (centered). */
  width: number;
  height: number;
  /** Focused reel: plays. Others keep their first frame. */
  active: boolean;
  /** Held / sheet open / scrubbing. */
  paused?: boolean;
  muted?: boolean;
  /** ⋯ Playback speed (page 58). */
  rate?: number;
  /** Bump to restart from 0 (remix originals / borrowed audio follow their reel). */
  restartKey?: number;
  /** Seek request (composition ms); bump `key` to repeat the same time. */
  seek?: { ms: number; key: number } | null;
  /** 0–1 progress for the scrubber (written ~10× a second, no re-render). */
  progress?: SharedValue<number>;
  /** Composition time, ~10× a second (editor timeline). */
  onTime?: (ms: number) => void;
  /** One full pass finished (plays are counted on the first one). */
  onLoop?: () => void;
  /** Only the sound (borrowed original audio): nothing is drawn. */
  audioOnly?: boolean;
  /** Sticker taps (mention → profile…). Absent = preview. */
  stickerActions?: StickerActions;
  hideOverlays?: boolean;
};

/**
 * Pages 58–63 — plays a reel's edit list live (decision: no encoding). Two video players take
 * turns: one shows the current clip (seeked to its trim, at its speed), the other preloads the
 * next, so cuts are close to seamless. Music, voiceovers and timed overlays follow one clock.
 * Remixes draw the original next to (side by side) or over (react) the reel; sequence remixes are
 * already part of `source.segments`.
 */
export function ReelPlayer(props: ReelPlayerProps) {
  const { source, width, height, audioOnly } = props;
  // The 9:16 canvas covers the container (like the Reels viewer: slight crop on tall phones).
  const k = Math.max(width / CANVAS_W, height / CANVAS_H);
  const cw = CANVAS_W * k;
  const ch = CANVAS_H * k;

  const remix = source.remix;
  const [clock, setClock] = useState(0);
  const [restart, setRestart] = useState(0);
  const own = (
    <Composition
      {...props}
      cw={remix?.layout === 'side_by_side' ? cw / 2 : cw}
      ch={ch}
      onTick={setClock}
      onRestart={() => setRestart((r) => r + 1)}
      clockMs={clock}
    />
  );
  if (audioOnly) return <View style={styles.hidden}>{own}</View>;

  const ownTime = clock - source.ownOffset;
  const overlays = props.hideOverlays
    ? []
    : source.overlays.filter((o) => overlayVisible(o, ownTime));

  return (
    <View
      style={{ width, height, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: cw, height: ch, overflow: 'hidden', flexDirection: 'row' }}>
        {remix?.layout === 'side_by_side' ? (
          <>
            <RemixPane
              {...props}
              original={remix.original}
              width={cw / 2}
              height={ch}
              restartKey={restart + (props.restartKey ?? 0)}
            />
            {own}
          </>
        ) : (
          own
        )}
        {remix?.layout === 'react' ? (
          <View
            style={[
              styles.pip,
              {
                width: cw * 0.38,
                height: (cw * 0.38 * 16) / 9,
                left: remix.pip.x * cw - (cw * 0.38) / 2,
                top: remix.pip.y * ch - (cw * 0.38 * 16) / 9 / 2,
                borderRadius: 12 * k * 3,
              },
            ]}
          >
            <RemixPane
              {...props}
              original={remix.original}
              width={cw * 0.38}
              height={(cw * 0.38 * 16) / 9}
              restartKey={restart + (props.restartKey ?? 0)}
            />
          </View>
        ) : null}
        {overlays.length > 0 ? (
          <View
            style={[StyleSheet.absoluteFill, { width: cw, height: ch }]}
            pointerEvents="box-none"
          >
            <StoryElements
              elements={overlays}
              width={cw}
              renderSticker={(el, kk) => (
                <StickerView
                  sticker={el.sticker}
                  k={kk}
                  ctx={props.stickerActions ? { actions: props.stickerActions } : { preview: true }}
                />
              )}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The remixed original inside a remix (its own sound follows the original volume). */
function RemixPane({
  original,
  width,
  height,
  active,
  paused,
  muted,
  rate,
  restartKey,
  source,
}: ReelPlayerProps & { original: ReelSource | null; width: number; height: number }) {
  const { colors } = useTheme();
  const volume = source.volumes.original;
  const scaled = useMemo(
    () =>
      original
        ? {
            ...original,
            segments: original.segments.map((s) => ({ ...s, volume: s.volume * volume })),
          }
        : null,
    [original, volume],
  );
  if (!scaled) {
    return (
      <View style={[styles.gap, { width, height, backgroundColor: colors.mediaScrim }]}>
        <Text variant="captionBold" style={{ color: colors.onMedia, textAlign: 'center' }}>
          Content unavailable
        </Text>
      </View>
    );
  }
  return (
    <ReelPlayer
      source={scaled}
      width={width}
      height={height}
      active={active}
      paused={paused}
      muted={muted || volume === 0}
      rate={rate}
      restartKey={restartKey}
      hideOverlays={false}
    />
  );
}

/**
 * The clock + clips of one source drawn on a `cw × ch` canvas area: two alternating video
 * players, still images, "Content unavailable" gaps, music and voiceovers.
 */
function Composition({
  source,
  cw,
  ch,
  active,
  paused = false,
  muted = false,
  rate = 1,
  restartKey = 0,
  seek,
  progress,
  onTime,
  onLoop,
  onTick,
  onRestart,
  clockMs,
}: ReelPlayerProps & {
  cw: number;
  ch: number;
  onTick: (ms: number) => void;
  onRestart: () => void;
  /** Last published composition time (state of the parent). */
  clockMs: number;
}) {
  const { colors } = useTheme();
  const { segments, total } = source;
  const n = segments.length;
  const segKey = segments.map((s) => `${s.key}|${s.uri}|${s.inMs}|${s.outMs}|${s.speed}`).join(',');

  const setup = (p: VideoPlayer) => {
    setVideo(p, { loop: false, muted: true, timeUpdateEventInterval: 0.05 });
  };
  const playerA = useVideoPlayer(null, setup);
  const playerB = useVideoPlayer(null, setup);
  const players = useMemo(() => [playerA, playerB], [playerA, playerB]);
  const loaded = useRef<(string | null)[]>([null, null]);

  // Current segment, the offset to start it at, and a counter that re-runs the start effect
  // (looping a single clip lands on the same index).
  const [cursor, setCursor] = useState({ index: 0, offset: 0, pass: 0 });
  const seekKey = seek?.key ?? null;
  const [seen, setSeen] = useState({ segKey, restartKey, seekKey });
  if (seen.segKey !== segKey || seen.restartKey !== restartKey || seen.seekKey !== seekKey) {
    // New edit list, restart with the parent reel, or a seek: adjust during render (no effect).
    const at =
      seek && seen.seekKey !== seekKey && seen.segKey === segKey
        ? segmentAt(segments, seek.ms)
        : { index: 0, offset: 0 };
    setSeen({ segKey, restartKey, seekKey });
    setCursor((c) => ({ index: at.index, offset: at.offset, pass: c.pass + 1 }));
  }

  const lastTick = useRef(0);
  const firstLoopDone = useRef(false);
  // Ignore end-of-clip events until the new segment has really started (stale timeUpdates).
  const guardUntil = useRef(0);
  const running = active && !paused;

  const index = Math.min(cursor.index, Math.max(0, n - 1));
  const seg: Segment | undefined = segments[index];
  const slot = index % 2;

  function publish(ms: number, force = false) {
    if (progress) progress.set(total > 0 ? Math.min(1, ms / total) : 0);
    const now = Date.now();
    if (force || now - lastTick.current >= TICK_MS) {
      lastTick.current = now;
      onTick(ms);
      onTime?.(ms);
    }
  }

  function load(p: VideoPlayer, i: number, s: Segment) {
    if (s.type !== 'video' || !s.uri) return;
    if (loaded.current[i] !== s.uri) {
      loaded.current[i] = s.uri;
      p.replace({ uri: s.uri }, true);
    }
  }

  function advance() {
    if (Date.now() < guardUntil.current) return;
    guardUntil.current = Date.now() + 250;
    const last = index + 1 >= n;
    if (last) {
      if (!firstLoopDone.current) {
        firstLoopDone.current = true;
        onLoop?.();
      }
      onRestart();
    }
    setCursor((c) => ({ index: last ? 0 : index + 1, offset: 0, pass: c.pass + 1 }));
  }

  // Start the current segment; preload the next one in the other player.
  useEffect(() => {
    if (!seg) return;
    const p = players[slot];
    const other = players[1 - slot];
    guardUntil.current = Date.now() + 250;
    if (seg.type === 'video' && seg.uri) {
      load(p, slot, seg);
      setVideo(p, {
        currentTime: (seg.inMs + cursor.offset * seg.speed) / 1000,
        playbackRate: seg.speed * rate,
        volume: Math.min(1, Math.max(0, seg.volume)),
        muted: muted || seg.volume === 0,
      });
      if (running) p.play();
      else p.pause();
    }
    other.pause();
    const next = segments[(index + 1) % n];
    if (n > 1 && next && next.type === 'video' && next.uri) {
      load(other, 1 - slot, next);
      setVideo(other, { currentTime: next.inMs / 1000, muted: true });
    }
    publish(seg.start + cursor.offset, true);
    // Runs once per segment start (cursor); the rest is read at start time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // Pause / resume / mute / rate without restarting the segment.
  useEffect(() => {
    if (!seg || seg.type !== 'video') return;
    const p = players[slot];
    setVideo(p, { muted: muted || seg.volume === 0, playbackRate: seg.speed * rate });
    if (running) p.play();
    else p.pause();
  }, [running, muted, rate, seg, players, slot]);

  // Video clips: the clock follows the player; cut at the trim end.
  function handleTime(which: number, currentTime: number) {
    if (which !== slot || !seg || seg.type !== 'video') return;
    const t = currentTime * 1000;
    const local = Math.max(0, (t - seg.inMs) / seg.speed);
    publish(seg.start + Math.min(local, seg.dur));
    if (running && t >= seg.outMs - 40) advance();
  }
  useEventListener(playerA, 'timeUpdate', (e) => handleTime(0, e.currentTime));
  useEventListener(playerB, 'timeUpdate', (e) => handleTime(1, e.currentTime));
  useEventListener(playerA, 'playToEnd', () => {
    if (slot === 0 && running) advance();
  });
  useEventListener(playerB, 'playToEnd', () => {
    if (slot === 1 && running) advance();
  });

  // Photos, gaps and clips without a URL: a timer drives the clock.
  useEffect(() => {
    if (!seg || (seg.type === 'video' && seg.uri) || !running) return;
    let elapsed = cursor.offset;
    const step = 50;
    const id = setInterval(() => {
      elapsed += step * rate;
      if (elapsed >= seg.dur) {
        clearInterval(id);
        advance();
        return;
      }
      publish(seg.start + elapsed);
    }, step);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, running, rate]);

  const ownTime = clockMs - source.ownOffset;

  if (!seg)
    return <View style={{ width: cw, height: ch, backgroundColor: colors.mediaBackground }} />;

  return (
    <View
      style={{ width: cw, height: ch, backgroundColor: colors.mediaBackground, overflow: 'hidden' }}
    >
      {/* Poster under the video so a cut never flashes black. */}
      {seg.poster ? (
        <Image
          source={{ uri: seg.poster }}
          style={StyleSheet.absoluteFill}
          contentFit={fitFor(seg.width, seg.height)}
          recyclingKey={seg.poster}
        />
      ) : null}
      {players.map((p, i) => {
        const s = i === slot ? seg : segments[(index + 1) % n];
        return (
          <VideoView
            key={i}
            player={p}
            style={[
              StyleSheet.absoluteFill,
              { opacity: i === slot && seg.type === 'video' ? 1 : 0 },
            ]}
            contentFit={s ? fitFor(s.width, s.height) : 'cover'}
            nativeControls={false}
            allowsPictureInPicture={false}
          />
        );
      })}
      {seg.type === 'gap' ? (
        <View style={[StyleSheet.absoluteFill, styles.gap, { backgroundColor: colors.mediaScrim }]}>
          <Text variant="captionBold" style={{ color: colors.onMedia }}>
            Content unavailable
          </Text>
        </View>
      ) : null}
      {source.music ? (
        <MusicTrack
          uri={source.music.uri}
          startMs={source.music.startMs}
          at={ownTime}
          running={running && ownTime >= 0}
          muted={muted}
          volume={source.volumes.music}
          rate={rate}
        />
      ) : null}
      {source.voiceovers.map((v) => (
        <VoiceoverTrack
          key={v.id}
          uri={v.uri}
          start={v.atMs}
          duration={v.durationMs}
          at={ownTime}
          running={running}
          muted={muted}
          volume={source.volumes.voiceover}
          rate={rate}
        />
      ))}
      {source.borrowed ? (
        <BorrowedAudio
          source={source.borrowed}
          running={running && ownTime >= 0}
          muted={muted}
          rate={rate}
          restartKey={cursor.pass}
          volume={source.volumes.music}
          firstIndex={index === 0}
        />
      ) : null}
    </View>
  );
}

/** Catalog music: plays from the clip start in step with the reel's own time. */
function MusicTrack({
  uri,
  startMs,
  at,
  running,
  muted,
  volume,
  rate,
}: {
  uri: string;
  startMs: number;
  at: number;
  running: boolean;
  muted: boolean;
  volume: number;
  rate: number;
}) {
  const player = useAudioPlayer({ uri });
  useEffect(() => {
    setAudio(player, { muted, volume });
  }, [player, muted, volume]);
  useEffect(() => {
    player.setPlaybackRate(rate);
  }, [player, rate]);
  useEffect(() => {
    if (!running) {
      player.pause();
      return;
    }
    const target = (startMs + Math.max(0, at)) / 1000;
    if (!player.playing || Math.abs(player.currentTime - target) > DRIFT_S) {
      void player.seekTo(target);
    }
    if (!player.playing) player.play();
  }, [player, running, at, startMs]);
  return null;
}

/** One voiceover take: audible only inside its window on the reel's own timeline. */
function VoiceoverTrack({
  uri,
  start,
  duration,
  at,
  running,
  muted,
  volume,
  rate,
}: {
  uri: string;
  start: number;
  duration: number;
  at: number;
  running: boolean;
  muted: boolean;
  volume: number;
  rate: number;
}) {
  const player = useAudioPlayer({ uri });
  useEffect(() => {
    setAudio(player, { muted, volume });
  }, [player, muted, volume]);
  useEffect(() => {
    player.setPlaybackRate(rate);
  }, [player, rate]);
  const inside = at >= start && at < start + duration;
  useEffect(() => {
    if (!running || !inside) {
      if (player.playing) player.pause();
      return;
    }
    const target = (at - start) / 1000;
    if (!player.playing || Math.abs(player.currentTime - target) > DRIFT_S) {
      void player.seekTo(target);
    }
    if (!player.playing) player.play();
  }, [player, running, inside, at, start]);
  return null;
}

/** Someone's original audio: their reel plays invisibly (sound only) alongside this one. */
function BorrowedAudio({
  source,
  running,
  muted,
  rate,
  restartKey,
  volume,
  firstIndex,
}: {
  source: ReelSource;
  running: boolean;
  muted: boolean;
  rate: number;
  restartKey: number;
  volume: number;
  firstIndex: boolean;
}) {
  // Restart the borrowed sound each time this reel starts over.
  const [key, setKey] = useState(0);
  const prev = useRef(restartKey);
  useEffect(() => {
    if (firstIndex && restartKey !== prev.current) setKey((x) => x + 1);
    prev.current = restartKey;
  }, [restartKey, firstIndex]);
  const scaled = useMemo(
    () => ({
      ...source,
      segments: source.segments.map((s) => ({ ...s, volume: s.volume * volume })),
    }),
    [source, volume],
  );
  return (
    <ReelPlayer
      source={scaled}
      width={1}
      height={1}
      active={running}
      muted={muted}
      rate={rate}
      restartKey={key}
      audioOnly
    />
  );
}

/** Wraps a cover image with the reel's 3:4 (or other) window (`offset` 0 = top … 1 = bottom). */
export function CoverImage({
  uri,
  offset = 0.5,
  style,
  children,
}: {
  uri: string | null;
  offset?: number;
  style?: object;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.skeleton, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ left: '50%', top: `${Math.round(offset * 100)}%` }}
          recyclingKey={uri}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  pip: { position: 'absolute', overflow: 'hidden' },
  gap: { alignItems: 'center', justifyContent: 'center' },
});
