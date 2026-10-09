import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import type { ArchiveEntry } from '../api';
import { STICKER } from '../style';
import { StoryThumb } from './StoryThumb';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Page 28 (stories) / page 25 — your archived stories, 3 per row with a date badge. In select
 * mode tiles show a numbered check (order = order in the highlight).
 */
export function ArchiveGrid({
  entries,
  onPress,
  selected,
}: {
  entries: ArchiveEntry[];
  onPress: (e: ArchiveEntry) => void;
  /** Ordered selection (select mode). */
  selected?: string[];
}) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const gap = 2;
  const tile = (width - gap * 2) / 3;
  return (
    <View style={[styles.grid, { gap }]}>
      {entries.map((e) => {
        const d = new Date(e.published_at);
        const n = selected ? selected.indexOf(e.id) : -1;
        return (
          <Pressable
            key={e.id}
            onPress={() => onPress(e)}
            accessibilityRole={selected ? 'checkbox' : 'button'}
            accessibilityState={selected ? { checked: n >= 0 } : undefined}
            accessibilityLabel={`Story from ${d.toDateString()}`}
            style={{ width: tile }}
          >
            <StoryThumb story={e} width={tile} />
            <View style={[styles.date, { backgroundColor: colors.background, margin: spacing.xs }]}>
              <Text variant="captionBold" style={{ lineHeight: 14 }}>
                {d.getDate()}
              </Text>
              <Text variant="tiny" style={{ lineHeight: 12 }}>
                {MONTHS[d.getMonth()]}
              </Text>
            </View>
            {e.audience === 'close_friends' ? (
              <View style={[styles.cf, { backgroundColor: colors.closeFriends }]}>
                <Icon name="star" size={10} color={colors.onMedia} />
              </View>
            ) : null}
            {selected ? (
              <View
                style={[
                  styles.check,
                  {
                    backgroundColor: n >= 0 ? colors.primary : colors.mediaScrim,
                    borderColor: colors.onMedia,
                  },
                ]}
              >
                {n >= 0 ? (
                  <Text variant="captionBold" style={{ color: colors.onPrimary }}>
                    {n + 1}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {selected && n >= 0 ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.overlay, opacity: 0.35 },
                ]}
                pointerEvents="none"
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Calendar view: months with the days you shared a story (first story of the day as the cell). */
export function ArchiveCalendar({
  entries,
  onOpenDay,
}: {
  entries: ArchiveEntry[];
  onOpenDay: (stories: ArchiveEntry[]) => void;
}) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const cell = (width - spacing.lg * 2) / 7;

  const byDay = new Map<string, ArchiveEntry[]>();
  for (const e of entries) {
    const k = dayKey(e.published_at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const months: { year: number; month: number }[] = [];
  for (const e of entries) {
    const d = new Date(e.published_at);
    if (!months.some((m) => m.year === d.getFullYear() && m.month === d.getMonth())) {
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl, paddingVertical: spacing.lg }}>
      {months.map(({ year, month }) => {
        const first = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();
        const cells = [
          ...Array(first).fill(null),
          ...Array.from({ length: days }, (_, i) => i + 1),
        ];
        return (
          <View key={`${year}-${month}`} style={{ gap: spacing.sm }}>
            <Text variant="subhead">
              {MONTHS[month]} {year}
            </Text>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null)
                  return <View key={`e${i}`} style={{ width: cell, height: cell * 1.4 }} />;
                const stories = (byDay.get(`${year}-${month}-${day}`) ?? []).slice().reverse();
                return (
                  <Pressable
                    key={day}
                    disabled={stories.length === 0}
                    onPress={() => onOpenDay(stories)}
                    accessibilityRole={stories.length ? 'button' : undefined}
                    accessibilityLabel={
                      stories.length
                        ? `${MONTHS[month]} ${day}, ${stories.length} stories`
                        : undefined
                    }
                    style={{ width: cell, height: cell * 1.4, padding: 1 }}
                  >
                    {stories.length ? (
                      <View style={{ flex: 1, borderRadius: 4, overflow: 'hidden' }}>
                        <StoryThumb story={stories[0]} width={cell - 2} />
                        <Text variant="captionBold" style={[styles.day, { color: colors.onMedia }]}>
                          {day}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        variant="caption"
                        color="textTertiary"
                        style={{ textAlign: 'center', marginTop: cell * 0.4 }}
                      >
                        {day}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  date: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cf: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    textAlign: 'center',
    textShadowColor: STICKER.shadow,
    textShadowRadius: 3,
  },
});
