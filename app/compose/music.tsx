import { useComposer } from '@/features/create/ComposerProvider';
import { MusicPicker } from '@/features/posts/components/MusicPicker';
import { goBack } from '@/lib/navigation';

/** Page 39 — Add music to a post (picker shared with the story editor). */
export default function MusicScreen() {
  const composer = useComposer();
  return (
    <MusicPicker
      onDone={(music) => {
        // A catalog track replaces someone's original audio on a reel.
        composer.updateWith((s) => ({
          music,
          reel: s.reel ? { ...s.reel, borrowedAudio: null } : s.reel,
        }));
        goBack('/compose');
      }}
      onClose={() => goBack('/compose')}
    />
  );
}
