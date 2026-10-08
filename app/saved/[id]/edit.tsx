import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, TextField, useToast } from '@/components';
import { TopBar } from '@/features/profile/components/TopBar';
import { useCollection, useDeleteCollection, useRenameCollection } from '@/features/saved/api';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Page 027 — Edit collection: rename, delete (cover choice arrives with posts, Phase 3/4). */
export default function EditCollectionScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection(id);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {collection.data ? <EditForm id={id} initialName={collection.data.name} /> : null}
    </SafeAreaView>
  );
}

function EditForm({ id, initialName }: { id: string; initialName: string }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const rename = useRenameCollection();
  const remove = useDeleteCollection();
  const [name, setName] = useState(initialName);

  return (
    <>
      <TopBar
        title="Edit collection"
        center
        right={
          <Button
            title="Done"
            variant="text"
            disabled={!name.trim()}
            loading={rename.isPending}
            onPress={() =>
              name.trim() === initialName
                ? goBack()
                : rename.mutate(
                    { id, name },
                    {
                      onSuccess: () => goBack(),
                      onError: () => toast.show("Couldn't rename collection."),
                    },
                  )
            }
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <TextField label="Name" value={name} onChangeText={setName} maxLength={50} />
        <Button
          title="Delete collection"
          variant="danger"
          onPress={() =>
            showDialog(
              'Delete collection?',
              'When you delete this collection, the photos and videos will still be saved.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    remove.mutate(id, {
                      onSuccess: () => router.dismissTo('/saved'),
                      onError: () => toast.show("Couldn't delete collection."),
                    }),
                },
              ],
            )
          }
        />
      </ScrollView>
    </>
  );
}
