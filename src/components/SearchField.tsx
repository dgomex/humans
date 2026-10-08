import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

/** Gray rounded search input (Instagram's list search). */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.backgroundSecondary,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[styles.input, { color: colors.text }]}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 36, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
