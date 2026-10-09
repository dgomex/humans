import { useLocalSearchParams } from 'expo-router';

import { HighlightEditor } from '@/features/stories/components/HighlightEditor';

/** Page 25 — Edit highlight: add / remove stories, title, cover. */
export default function EditHighlightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HighlightEditor key={id} highlightId={id} />;
}
