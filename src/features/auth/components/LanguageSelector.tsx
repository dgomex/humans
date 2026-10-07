import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

/**
 * Language picker at the top of Welcome / Log in. The app is English-only until translations
 * are added, so the list has a single entry.
 */
export function LanguageSelector() {
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Language: English (US)"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center' }}
      >
        <Text color="textSecondary">English (US)</Text>
        <Icon name="down" size={14} color={colors.textSecondary} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select your language">
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="radio"
            accessibilityState={{ checked: true }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
            }}
          >
            <Text variant="subhead">English (US)</Text>
            <Icon name="radioOn" color={colors.text} />
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}
