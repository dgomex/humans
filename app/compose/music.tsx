import { useComposer } from '@/features/create/ComposerProvider';
import { MusicPicker } from '@/features/posts/components/MusicPicker';
import { goBack } from '@/lib/navigation';

/** Page 39 — Add music to a post (picker shared with the story editor). */
export default function MusicScreen() {
  const composer = useComposer();
  return (
    <MusicPicker
      onDone={(music) => {
        composer.update({ music });
        goBack('/compose');
      }}
      onClose={() => goBack('/compose')}
    />
  );
}
