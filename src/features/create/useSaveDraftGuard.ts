import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { showDialog } from '@/lib/dialog';

import { useComposer } from './ComposerProvider';
import { useSaveDraft } from './drafts';

/**
 * Page 42 — leaving the edit step with media selected asks "Save draft?" (also on Android back
 * and the iOS swipe). Skipped once the flow is closed on purpose (`exitAllowed`).
 */
export function useSaveDraftGuard() {
  const navigation = useNavigation();
  const composer = useComposer();
  const { profile } = useAuth();
  const save = useSaveDraft(profile?.id);
  const toast = useToast();
  const { dirty, allowExit, isExitAllowed, state } = composer;

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!dirty || isExitAllowed()) return;
      e.preventDefault();
      const leave = () => {
        allowExit();
        navigation.dispatch(e.data.action);
      };
      showDialog('Save draft?', "If you go back now, you'll lose all the edits you've made.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save draft',
          onPress: () => {
            save.mutate(state, {
              onSuccess: () => {
                toast.show('Draft saved');
                leave();
              },
              onError: () => toast.show("Couldn't save the draft."),
            });
          },
        },
        { text: 'Discard', style: 'destructive', onPress: leave },
      ]);
    });
  }, [navigation, dirty, allowExit, isExitAllowed, state, save, toast]);
}
