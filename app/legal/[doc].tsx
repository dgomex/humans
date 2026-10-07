import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

const DOCS: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Use',
    body: 'Draft placeholder. The Humans Terms of Use will be published here before launch.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'Draft placeholder. The Privacy Policy will describe what information Humans collects when you create an account and use the app, how it is used and shared, and the choices you have.',
  },
  cookies: {
    title: 'Cookies Policy',
    body: 'Draft placeholder. The Cookies Policy will be published here before launch.',
  },
  contacts: {
    title: 'Contact information',
    body: 'People who use Humans may choose to sync their contacts. Humans only receives one-way hashes of email addresses, which are used to suggest people you may know.',
  },
};

/** Legal pages linked from page 009 (placeholders until real policies exist). */
export default function LegalScreen() {
  const { doc = 'terms' } = useLocalSearchParams<{ doc: string }>();
  const { spacing, colors } = useTheme();
  const page = DOCS[doc] ?? DOCS.terms;
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: page.title }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <Text variant="headline">{page.title}</Text>
        <Text>{page.body}</Text>
      </ScrollView>
    </>
  );
}
