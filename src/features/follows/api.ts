import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type SuggestedAccount = {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  reason: 'contact' | 'popular';
};

export const followKeys = {
  suggestions: ['follows', 'suggestions'] as const,
};

export function useSuggestedAccounts(enabled = true) {
  return useQuery({
    queryKey: followKeys.suggestions,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('suggested_accounts', { max_count: 30 });
      if (error) throw error;
      return (data ?? []) as SuggestedAccount[];
    },
  });
}

/**
 * Follow / unfollow. Uses the Phase 1 `follows` stub (Phase 2 adds follow requests for private
 * accounts — at that point this becomes "Requested" for private profiles).
 */
export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, follow }: { userId: string; follow: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error('Not signed in');
      if (follow) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: me, following_id: userId });
        if (error && error.code !== '23505') throw error; // already following is fine
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', me)
          .eq('following_id', userId);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['follows'], refetchType: 'none' }),
  });
}
