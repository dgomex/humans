import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button, Icon, Text, useToast } from '@/components';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { syncContacts } from '@/features/onboarding/contacts';
import { useTheme } from '@/theme';

/** Page 011 (part 1) — Find your contacts. Only hashed email addresses are uploaded. */
export default function ContactsScreen() {
  const { spacing, colors } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    try {
      await syncContacts();
    } catch {
      toast.show("Couldn't sync contacts. You can try again later in Settings.");
    } finally {
      setLoading(false);
      router.replace('/suggestions');
    }
  }

  return (
    <AuthStep
      onBack={null}
      footer={<Button title="Skip" variant="text" onPress={() => router.replace('/suggestions')} />}
    >
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        <Icon name="contacts" size={96} color={colors.text} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          Find your contacts
        </Text>
        <Text style={{ textAlign: 'center' }}>
          {
            "Connect your contacts to find people you know on Humans. Email addresses from your contacts are turned into one-way codes on your phone before they're synced, and you can disconnect at any time."
          }
        </Text>
      </View>
      <Button
        title="Next"
        shape="pill"
        size="lg"
        fullWidth
        loading={loading}
        disabled={Platform.OS === 'web'}
        onPress={connect}
      />
    </AuthStep>
  );
}
