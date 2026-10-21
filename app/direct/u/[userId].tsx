import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components';
import { directThreadWith } from '@/features/direct/api';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Profile "Message" → the 1:1 chat with that person (created on demand). */
export default function DirectWithUser() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, spacing } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    directThreadWith(userId)
      .then((id) => router.replace(`/direct/t/${id}`))
      .catch(() => setFailed(true));
  }, [userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      {failed ? (
        <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
          <Text color="textSecondary">Couldn&apos;t open this chat.</Text>
          <Button title="Go back" variant="secondary" onPress={() => goBack('/direct')} />
        </View>
      ) : (
        <ActivityIndicator />
      )}
    </SafeAreaView>
  );
}
