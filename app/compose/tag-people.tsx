import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { useComposer } from '@/features/create/ComposerProvider';
import { cropOf, videoPoster } from '@/features/create/media';
import { TagEditor } from '@/features/posts/components/TagEditor';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Page 37 — Tag people while creating a post (tags stay in the composer until Share). */
export default function ComposeTagPeopleScreen() {
  const { colors } = useTheme();
  const composer = useComposer();
  const { items, ratio } = composer.state;
  const [posters, setPosters] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const item of items) {
      if (item.type !== 'video' || posters[item.key]) continue;
      void videoPoster(item.uri)
        .then((p) => p && setPosters((s) => ({ ...s, [item.key]: p.uri })))
        .catch(() => {});
    }
  }, [items, posters]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        title="Tag people"
        center
        right={<Button title="Done" variant="text" size="sm" onPress={() => goBack('/compose')} />}
      />
      <TagEditor
        ratio={ratio}
        slides={items.map((i) => ({
          key: i.key,
          type: i.type,
          uri: i.type === 'video' ? (posters[i.key] ?? i.uri) : i.uri,
          crop: i.type === 'image' ? cropOf(i, ratio) : null,
        }))}
        tags={Object.fromEntries(items.map((i) => [i.key, i.tags]))}
        onChange={(key, tags) => composer.updateItem(key, { tags })}
      />
    </SafeAreaView>
  );
}
