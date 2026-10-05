import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, BottomSheet, Button, Icon, Text, useToast, type IconName } from '@/components';
import { supabaseConfig } from '@/lib/supabase';
import { useTheme } from '@/theme';

const SAMPLE_AVATAR = 'https://i.pravatar.cc/150?img=12';
const ICONS: IconName[] = [
  'home',
  'search',
  'create',
  'reels',
  'heart',
  'comment',
  'share',
  'bookmark',
  'more',
];

/** Dev-only showcase of the shared UI kit + a Supabase connectivity check (Phase 0 verification). */
export default function UiKitScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const health = useQuery({
    queryKey: ['dev', 'supabase-health'],
    queryFn: async () => {
      const res = await fetch(`${supabaseConfig.url}/auth/v1/health`, {
        headers: { apikey: supabaseConfig.key },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ version?: string; name?: string }>;
    },
    retry: false,
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
    >
      <Section title="Supabase">
        <Text color={health.isError ? 'danger' : 'textSecondary'}>
          {health.isPending
            ? 'Checking…'
            : health.isError
              ? `Unreachable (${supabaseConfig.url}): ${String(health.error)}`
              : `Connected to ${supabaseConfig.url} (${health.data?.name ?? 'auth'} ${health.data?.version ?? ''})`}
        </Text>
      </Section>

      <Section title="Avatar">
        <View style={[styles.row, { gap: spacing.lg }]}>
          <Avatar size={56} />
          <Avatar size={56} uri={SAMPLE_AVATAR} ring="unseen" />
          <Avatar size={56} uri={SAMPLE_AVATAR} ring="seen" />
          <Avatar size={56} uri={SAMPLE_AVATAR} ring="closeFriends" />
        </View>
      </Section>

      <Section title="Button">
        <View style={{ gap: spacing.sm }}>
          <Button title="Follow" />
          <Button title="Following" variant="secondary" />
          <Button title="Outline" variant="outline" />
          <Button title="Forgot password?" variant="text" />
          <Button title="Log out" variant="danger" />
          <Button title="Loading" loading />
          <Button title="Disabled" disabled fullWidth size="lg" />
        </View>
      </Section>

      <Section title="Icons">
        <View style={[styles.row, styles.wrap, { gap: spacing.lg }]}>
          {ICONS.map((name) => (
            <Icon key={name} name={name} />
          ))}
          <Icon name="heartFilled" color={colors.like} />
        </View>
      </Section>

      <Section title="BottomSheet & Toast">
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Open bottom sheet"
            variant="secondary"
            onPress={() => setSheetOpen(true)}
          />
          <Button
            title="Show toast"
            variant="secondary"
            onPress={() => toast.show('Link copied')}
          />
          <Button
            title="Toast with action"
            variant="secondary"
            onPress={() => toast.show('Post saved', { actionLabel: 'View', onAction: () => {} })}
          />
        </View>
      </Section>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Options">
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Button
            title="Copy link"
            variant="secondary"
            onPress={() => {
              setSheetOpen(false);
              toast.show('Link copied');
            }}
          />
          <Button title="Report" variant="danger" onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="subhead">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
});
