import { router } from 'expo-router';

import { Button } from '@/components';
import { PlaceholderScreen } from '@/features/shell/PlaceholderScreen';

export default function HomeScreen() {
  return (
    <PlaceholderScreen title="Home" note="Home feed — page 43 (Phase 4).">
      {__DEV__ ? (
        <Button title="Open UI kit" variant="secondary" onPress={() => router.push('/dev/ui')} />
      ) : null}
    </PlaceholderScreen>
  );
}
