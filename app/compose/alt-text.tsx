import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { CroppedImage } from '@/features/create/components/CroppedImage';
import { cropOf } from '@/features/create/media';
import { MAX_ALT } from '@/features/create/types';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

const THUMB = 72;

/** Advanced settings → Write alt text: one description per slide. */
export default function AltTextScreen() {
  const { colors, spacing, hairline } = useTheme();
  const composer = useComposer();
  const { items, ratio } = composer.state;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Alt text"
        center
        right={<Button title="Done" variant="text" size="sm" onPress={() => goBack('/compose')} />}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          {items.map((item, i) => (
            <View
              key={item.key}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                padding: spacing.lg,
                borderBottomWidth: hairline,
                borderBottomColor: colors.separator,
              }}
            >
              {item.type === 'image' ? (
                <CroppedImage
                  uri={item.uri}
                  crop={cropOf(item, ratio)}
                  width={THUMB}
                  height={THUMB / ratio}
                />
              ) : (
                <View
                  style={{
                    width: THUMB,
                    height: THUMB / ratio,
                    backgroundColor: colors.skeleton,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="video" size={20} />
                </View>
              )}
              <TextInput
                value={item.altText}
                onChangeText={(altText) => composer.updateItem(item.key, { altText })}
                placeholder="Write alt text..."
                placeholderTextColor={colors.textSecondary}
                maxLength={MAX_ALT}
                multiline
                accessibilityLabel={`Alt text for slide ${i + 1}`}
                style={{ flex: 1, color: colors.text, fontSize: 15, textAlignVertical: 'top' }}
              />
            </View>
          ))}
          <Text variant="caption" color="textSecondary" style={{ padding: spacing.lg }}>
            Alt text describes your photos for people with visual impairments. If you don&apos;t
            write any, the post is shared without it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
