import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { STICKER, contrastOn, fontStyle } from '../style';
import {
  CANVAS_H,
  CANVAS_W,
  LAYOUT_CELLS,
  type StoryContent,
  type StoryElement,
  type StoryKind,
  type Stroke,
  type TextElement,
  type Transform,
} from '../types';

/** Pixel size of a canvas `width` wide (9:16). */
export const canvasHeight = (width: number) => (width * CANVAS_H) / CANVAS_W;

export type CanvasSource = {
  kind: StoryKind;
  content: StoryContent;
  /** Photo / video URL (signed or local). */
  mediaUri?: string | null;
  /** Video poster (shown while the player loads, and in thumbnails). */
  posterUri?: string | null;
  mediaSize?: { width: number; height: number } | null;
  /** Resolve a storage path inside the content (layout cells, frames, photo stickers). */
  resolve: (path: string) => string | null | undefined;
};

/** The contain-fit box of the media inside the canvas, in units. */
export function containBox(size: { width: number; height: number } | null | undefined) {
  const aspect = size && size.width > 0 && size.height > 0 ? size.width / size.height : 9 / 16;
  return aspect > CANVAS_W / CANVAS_H
    ? { w: CANVAS_W, h: CANVAS_W / aspect }
    : { w: CANVAS_H * aspect, h: CANVAS_H };
}

/** Default placement: fill the screen for near-portrait media, otherwise fit with backdrop. */
export function defaultMediaTransform(size: { width: number; height: number }): Transform {
  const aspect = size.width / size.height;
  const box = containBox(size);
  const cover = Math.max(CANVAS_W / box.w, CANVAS_H / box.h);
  return { x: 0, y: 0, scale: aspect >= 0.5 && aspect <= 0.66 ? cover : 1, rotation: 0 };
}

export const transformStyle = (t: Transform, k: number) => [
  { translateX: t.x * k },
  { translateY: t.y * k },
  { scale: t.scale },
  { rotate: `${t.rotation}deg` },
];

/**
 * Background + media of a story (no overlay elements): gradient, photo / video with its
 * transform, layout grid, or boomerang frames. `paused` freezes boomerangs.
 */
export function StoryBase({
  source,
  width,
  player,
  paused = false,
  onReady,
}: {
  source: CanvasSource;
  width: number;
  player?: VideoPlayer | null;
  paused?: boolean;
  /** Photo loaded (or immediately for text / layout / boomerang); videos report via the player. */
  onReady?: () => void;
}) {
  const k = width / CANVAS_W;
  const height = canvasHeight(width);
  const { content, kind } = source;
  const box = containBox(source.mediaSize);
  const t = content.media ?? { x: 0, y: 0, scale: 1, rotation: 0 };
  const photoUri = kind === 'photo' ? source.mediaUri : null;

  useEffect(() => {
    if (kind !== 'photo' && kind !== 'video') onReady?.();
    // A photo without a URL (unreadable) shouldn't block the timer.
    if (kind === 'photo' && !photoUri) onReady?.();
  }, [kind, photoUri, onReady]);

  let media: ReactNode = null;
  if (kind === 'photo' || (kind === 'video' && !player)) {
    const uri = kind === 'video' ? (source.posterUri ?? null) : source.mediaUri;
    media = uri ? (
      <Image
        source={{ uri }}
        style={{ width: box.w * k, height: box.h * k }}
        contentFit="fill"
        recyclingKey={uri}
        onLoad={kind === 'photo' ? onReady : undefined}
        onError={kind === 'photo' ? onReady : undefined}
      />
    ) : null;
  } else if (kind === 'video' && player) {
    media = (
      <View style={{ width: box.w * k, height: box.h * k }}>
        {source.posterUri ? (
          <Image
            source={{ uri: source.posterUri }}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
          />
        ) : null}
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </View>
    );
  }

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <LinearGradient colors={content.background} style={StyleSheet.absoluteFill} />
      {media ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <View style={{ transform: transformStyle(t, k) }}>{media}</View>
        </View>
      ) : null}
      {kind === 'layout' && content.layout ? (
        <LayoutCells
          layout={content.layout}
          width={width}
          height={height}
          resolve={source.resolve}
        />
      ) : null}
      {kind === 'boomerang' && content.boomerang ? (
        <Boomerang
          frames={content.boomerang.frames.map((f) => source.resolve(f) ?? null)}
          fps={content.boomerang.fps}
          paused={paused}
          box={box}
          k={k}
          transform={t}
        />
      ) : null}
    </View>
  );
}

function LayoutCells({
  layout,
  width,
  height,
  resolve,
}: {
  layout: NonNullable<StoryContent['layout']>;
  width: number;
  height: number;
  resolve: CanvasSource['resolve'];
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {LAYOUT_CELLS[layout.grid].map(([x, y, w, h], i) => {
        const path = layout.cells[i];
        const uri = path ? resolve(path) : null;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              { left: x * width, top: y * height, width: w * width, height: h * height },
            ]}
          >
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Forward-then-backward loop of burst frames (Instagram's original Boomerang). */
function Boomerang({
  frames,
  fps,
  paused,
  box,
  k,
  transform,
}: {
  frames: (string | null)[];
  fps: number;
  paused: boolean;
  box: { w: number; h: number };
  k: number;
  transform: Transform;
}) {
  const [tick, setTick] = useState(0);
  const n = frames.length;
  useEffect(() => {
    if (paused || n < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000 / Math.max(4, fps));
    return () => clearInterval(id);
  }, [paused, n, fps]);
  if (n === 0) return null;
  const cycle = Math.max(1, 2 * n - 2);
  const step = tick % cycle;
  const index = step < n ? step : cycle - step;
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <View
        style={{ transform: transformStyle(transform, k), width: box.w * k, height: box.h * k }}
      >
        {/* Every frame stays mounted (decoded once); only the current one is visible. */}
        {frames.map((uri, i) =>
          uri ? (
            <Image
              key={i}
              source={{ uri }}
              style={[StyleSheet.absoluteFill, { opacity: i === index ? 1 : 0 }]}
              contentFit="fill"
            />
          ) : null,
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------------------------

/** Positions a child centered on an element's (x, y) with its scale / rotation. */
export function Placed({
  el,
  k,
  children,
  pointerEvents = 'box-none',
}: {
  el: Transform;
  k: number;
  children: ReactNode;
  pointerEvents?: 'box-none' | 'none' | 'auto';
}) {
  const span = CANVAS_W * 2 * k;
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.placed,
        { left: el.x * k - span / 2, top: el.y * k - span / 2, width: span, height: span },
      ]}
    >
      <View
        pointerEvents={pointerEvents}
        style={{ transform: [{ scale: el.scale }, { rotate: `${el.rotation}deg` }] }}
      >
        {children}
      </View>
    </View>
  );
}

export function TextBody({ el, k }: { el: TextElement; k: number }) {
  const size = el.size * k;
  const bg =
    el.background === 'solid' ? el.color : el.background === 'soft' ? STICKER.shadow : null;
  const color = el.background === 'solid' ? contrastOn(el.color) : el.color;
  return (
    <View
      style={{
        maxWidth: CANVAS_W * 0.9 * k,
        backgroundColor: bg ?? 'transparent',
        borderRadius: size * 0.35,
        paddingHorizontal: bg ? size * 0.35 : 0,
        paddingVertical: bg ? size * 0.15 : 0,
      }}
    >
      <RNText
        style={[
          {
            color,
            fontSize: size,
            lineHeight: size * 1.25,
            textAlign: el.align,
          },
          !bg && el.font !== 'neon'
            ? {
                textShadowColor: STICKER.shadow,
                textShadowRadius: size * 0.08,
                textShadowOffset: { width: 0, height: 1 },
              }
            : null,
          fontStyle(el.font, el.color),
        ]}
      >
        {el.text}
      </RNText>
    </View>
  );
}

const BRUSH_OPACITY: Record<Stroke['brush'], number> = { pen: 1, marker: 0.55, neon: 1 };

export function DrawingStrokes({ strokes, width }: { strokes: Stroke[]; width: number }) {
  return (
    <Svg
      width={width}
      height={canvasHeight(width)}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {strokes.map((s, i) =>
        s.brush === 'neon' ? (
          <Path
            key={i}
            d={s.d}
            stroke={s.color}
            strokeWidth={s.width * 2.2}
            strokeOpacity={0.45}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null,
      )}
      {strokes.map((s, i) => (
        <Path
          key={`s${i}`}
          d={s.d}
          stroke={s.brush === 'neon' ? '#FFFFFF' : s.color}
          strokeWidth={s.brush === 'marker' ? s.width * 1.6 : s.width}
          strokeOpacity={BRUSH_OPACITY[s.brush]}
          strokeLinecap={s.brush === 'marker' ? 'square' : 'round'}
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

/**
 * Overlay elements (text, drawings, stickers) in z-order. `renderSticker` draws stickers (the
 * viewer passes interactive ones); text and drawings never take touches.
 */
export function StoryElements({
  elements,
  width,
  renderSticker,
}: {
  elements: StoryElement[];
  width: number;
  renderSticker: (el: Extract<StoryElement, { type: 'sticker' }>, k: number) => ReactNode;
}) {
  const k = width / CANVAS_W;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="box-none">
      {elements.map((el) => {
        if (el.type === 'drawing')
          return <DrawingStrokes key={el.id} strokes={el.strokes} width={width} />;
        if (el.type === 'text')
          return (
            <Placed key={el.id} el={el} k={k} pointerEvents="none">
              <TextBody el={el} k={k} />
            </Placed>
          );
        return (
          <Placed key={el.id} el={el} k={k}>
            {renderSticker(el, k)}
          </Placed>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  cell: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: STICKER.layoutDivider,
  },
  placed: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
