import { router } from 'expo-router';

import { Button } from '@/components';
import { PlaceholderScreen } from '@/features/shell/PlaceholderScreen';

export default function CreateEntryModal() {
  return (
    <PlaceholderScreen title="Create" note="Create entry / media picker — page 32 (Phase 3).">
      <Button title="Close" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}
