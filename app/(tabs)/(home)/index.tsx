import { router } from 'expo-router';

import { Button } from '@/components';
import { UploadBanner } from '@/features/create/components/UploadBanner';
import { PlaceholderScreen } from '@/features/shell/PlaceholderScreen';

export default function HomeScreen() {
  return (
    <PlaceholderScreen
      title="Home"
      note="Home feed — page 43 (Phase 4)."
      // Page 40: posting progress sits at the top of the feed.
      header={<UploadBanner />}
    >
      {__DEV__ ? (
        <Button title="Open UI kit" variant="secondary" onPress={() => router.push('/dev/ui')} />
      ) : null}
    </PlaceholderScreen>
  );
}
