import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components';
import { useTheme } from '@/theme';

import { STORY_COLORS } from '../../style';
import { CANVAS_W, type Brush, type Stroke } from '../../types';
import { DrawingStrokes } from '../StoryCanvas';

const BRUSHES: { brush: Brush; icon: IconName; label: string }[] = [
  { brush: 'pen', icon: 'brushPen', label: 'Pen' },
  { brush: 'marker', icon: 'brushMarker', label: 'Marker' },
  { brush: 'neon', icon: 'brushNeon', label: 'Neon' },
  { brush: 'eraser', icon: 'eraser', label: 'Eraser' },
];
const WIDTHS = [8, 16, 28, 44];

/** Points of a path we generated ("M x y L x y …"). */
function pointsOf(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

function touches(stroke: Stroke, x: number, y: number) {
  const p = pointsOf(stroke.d);
  const r = stroke.width + 24;
  for (let i = 0; i + 1 < p.length; i += 2) {
    if (Math.abs(p[i] - x) < r && Math.abs(p[i + 1] - y) < r) return true;
  }
  return false;
}

/**
 * Page 54 — draw over the story: pen, marker (translucent), neon (glow), eraser (removes the
 * strokes it touches), 4 sizes, colors, undo. Strokes are kept in canvas units.
 */
export function DrawTool({
  width,
  height,
  top,
  initial,
  onDone,
}: {
  width: number;
  height: number;
  /** Window Y of the canvas (the drawing area sits exactly over it). */
  top: number;
  initial: Stroke[];
  onDone: (strokes: Stroke[]) => void;
}) {
  const { colors, spacing } = useTheme();
  const k = width / CANVAS_W;
  // Committed strokes + the one being drawn, in one state so a gesture never reads stale values.
  const [draw, setDraw] = useState<{ strokes: Stroke[]; live: string | null }>({
    strokes: initial,
    live: null,
  });
  const strokes = draw.strokes;
  const [brush, setBrush] = useState<Brush>('pen');
  const [color, setColor] = useState<string>(STORY_COLORS[0]);
  const [size, setSize] = useState(1);

  const toUnits = (v: number) => Math.round((v / k) * 10) / 10;
  const erase = (x: number, y: number) =>
    setDraw((d) => ({
      ...d,
      strokes: d.strokes.filter((st) => !touches(st, toUnits(x), toUnits(y))),
    }));
  const begin = (x: number, y: number) => {
    if (brush === 'eraser') erase(x, y);
    else setDraw((d) => ({ ...d, live: `M${toUnits(x)} ${toUnits(y)}` }));
  };
  const move = (x: number, y: number) => {
    if (brush === 'eraser') erase(x, y);
    else setDraw((d) => (d.live ? { ...d, live: `${d.live} L${toUnits(x)} ${toUnits(y)}` } : d));
  };
  const end = () =>
    setDraw((d) => {
      if (!d.live) return d;
      // A tap leaves a dot.
      const path = d.live.includes('L') ? d.live : `${d.live} l0.1 0`;
      return {
        strokes: [
          ...d.strokes,
          { brush: brush as Stroke['brush'], color, width: WIDTHS[size], d: path },
        ],
        live: null,
      };
    });
  const setStrokes = (fn: (s: Stroke[]) => Stroke[]) =>
    setDraw((d) => ({ ...d, strokes: fn(d.strokes) }));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => begin(e.x, e.y))
    .onUpdate((e) => move(e.x, e.y))
    .onFinalize(end);

  const shown: Stroke[] =
    draw.live && brush !== 'eraser'
      ? [...strokes, { brush, color, width: WIDTHS[size], d: draw.live }]
      : strokes;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top, width, height, alignSelf: 'center' }}>
        <DrawingStrokes strokes={shown} width={width} />
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} accessibilityLabel="Drawing area" />
        </GestureDetector>
      </View>
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View
          style={[
            styles.row,
            { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
          ]}
        >
          <Pressable
            onPress={() => setStrokes((s) => s.slice(0, -1))}
            disabled={strokes.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            style={[
              styles.tool,
              { backgroundColor: colors.mediaScrim, opacity: strokes.length ? 1 : 0.4 },
            ]}
          >
            <Icon name="undo" size={20} color={colors.onMedia} />
          </Pressable>
          <View style={[styles.row, { flex: 1, justifyContent: 'center', gap: spacing.sm }]}>
            {BRUSHES.map((b) => (
              <Pressable
                key={b.brush}
                onPress={() => setBrush(b.brush)}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                accessibilityState={{ selected: brush === b.brush }}
                style={[
                  styles.tool,
                  { backgroundColor: brush === b.brush ? colors.onMedia : colors.mediaScrim },
                ]}
              >
                <Icon
                  name={b.icon}
                  size={20}
                  color={brush === b.brush ? colors.mediaBackground : colors.onMedia}
                />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => onDone(strokes)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text variant="subhead" style={{ color: colors.onMedia }}>
              Done
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View
          style={[
            styles.row,
            { justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.sm },
          ]}
        >
          {WIDTHS.map((w, i) => (
            <Pressable
              key={w}
              onPress={() => setSize(i)}
              accessibilityRole="button"
              accessibilityLabel={`Brush size ${i + 1}`}
              accessibilityState={{ selected: size === i }}
              style={[
                styles.sizeWrap,
                { borderColor: size === i ? colors.onMedia : 'transparent' },
              ]}
            >
              <View
                style={{
                  width: 6 + i * 5,
                  height: 6 + i * 5,
                  borderRadius: 20,
                  backgroundColor: colors.onMedia,
                }}
              />
            </Pressable>
          ))}
        </View>
        {brush === 'eraser' ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              gap: spacing.sm,
            }}
            style={{ flexGrow: 0 }}
          >
            {STORY_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityRole="button"
                accessibilityLabel={`Color ${c}`}
                accessibilityState={{ selected: color === c }}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: colors.onMedia,
                    borderWidth: color === c ? 3 : 2,
                  },
                ]}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tool: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sizeWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 28, height: 28, borderRadius: 14 },
});
