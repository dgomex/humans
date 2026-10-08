import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, TextField, useToast } from '@/components';
import { TopBar } from '@/features/profile/components/TopBar';
import { useCreateCollection } from '@/features/saved/api';
import { useTheme } from '@/theme';

/**
 * Page 027 — New collection: name → pick from saved posts → Done. Picking shows an empty state
 * until saves exist (Phase 4).
 */
export default function NewCollectionScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const create = useCreateCollection();
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'pick'>('name');

  function finish() {
    create.mutate(name, {
      onSuccess: (c) => router.replace({ pathname: '/saved/[id]', params: { id: c.id } }),
      onError: () => toast.show("Couldn't create collection. Try again."),
    });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title={step === 'name' ? 'New collection' : 'Add from saved'}
        center
        onBack={step === 'pick' ? () => setStep('name') : undefined}
        right={
          step === 'name' ? (
            <Button
              title="Next"
              variant="text"
              disabled={!name.trim()}
              onPress={() => setStep('pick')}
            />
          ) : (
            <Button title="Done" variant="text" loading={create.isPending} onPress={finish} />
          )
        }
      />
      {step === 'name' ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg }}
        >
          <TextField
            label="Collection name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && setStep('pick')}
          />
        </ScrollView>
      ) : (
        <View
          style={{
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.xl,
            marginTop: spacing.xxl,
          }}
        >
          <Icon name="bookmark" size={48} />
          <Text variant="headline">No saved posts</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>
            Posts you save will show up here so you can add them to this collection.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
