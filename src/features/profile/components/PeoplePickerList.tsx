import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import type { PickerPerson } from '../api';
import { avatarUrl } from '../avatar';

/**
 * Searchable people list with a circular check per row (Close Friends) or an Add/Remove pill
 * (Favorites). Pages 30/31.
 */
export function PeoplePickerList({
  people,
  loading,
  selected,
  onToggle,
  variant,
  header,
  empty,
}: {
  people: PickerPerson[];
  loading: boolean;
  selected: (p: PickerPerson) => boolean;
  onToggle: (p: PickerPerson) => void;
  variant: 'check' | 'pill';
  header?: ReactElement;
  empty: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <FlatList
      data={people}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : (
          <Text color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xl }}>
            {empty}
          </Text>
        )
      }
      renderItem={({ item }) => {
        const on = selected(item);
        return (
          <Pressable
            onPress={() => onToggle(item)}
            accessibilityRole={variant === 'check' ? 'checkbox' : 'button'}
            accessibilityState={variant === 'check' ? { checked: on } : undefined}
            accessibilityLabel={item.username}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <Avatar
              uri={avatarUrl(item.avatar_path)}
              size={52}
              ring={on && variant === 'check' ? 'closeFriends' : 'none'}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" numberOfLines={1}>
                {item.username}
              </Text>
              {item.full_name ? (
                <Text color="textSecondary" numberOfLines={1}>
                  {item.full_name}
                </Text>
              ) : null}
            </View>
            {variant === 'check' ? (
              on ? (
                <Icon name="checkCircle" size={26} color={colors.primary} />
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: colors.textTertiary,
                  }}
                />
              )
            ) : (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 6,
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.backgroundSecondary : colors.primary,
                }}
              >
                <Text variant="bodyBold" style={{ color: on ? colors.text : colors.onPrimary }}>
                  {on ? 'Remove' : 'Add'}
                </Text>
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}
