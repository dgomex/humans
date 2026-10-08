import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderScreen } from '@/features/shell/PlaceholderScreen';
import { TopBar } from '@/features/profile/components/TopBar';

/** Page 025 — the highlight editor is built with Stories (Phase 5), per the agreed decision. */
export default function NewHighlightScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <TopBar title="New highlight" center />
      <PlaceholderScreen
        title="No stories in your archive"
        note="Highlights are made from stories you've shared. Once Stories arrive, you'll pick them here, add a title and choose a cover."
      />
    </SafeAreaView>
  );
}
