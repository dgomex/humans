import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type SuggestedAccount = {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  is_private: boolean;
  reason: 'follows_you' | 'contact' | 'mutual' | 'new' | 'popular';
  follows_me: boolean;
  mutual_count: number;
  mutual_username: string | null;
};

export const followKeys = {
  suggestions: ['follows', 'suggestions'] as const,
};

export function useSuggestedAccounts(enabled = true) {
  return useQuery({
    queryKey: followKeys.suggestions,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('suggested_accounts', {
        max_count: 30,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as SuggestedAccount[];
    },
  });
}

/** Bulk "Follow all" on page 11 (single buttons use `FollowButton` / `useFollowAction`). */
export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, follow }: { userId: string; follow: boolean }) => {
      const { error } = follow
        ? await supabase.rpc('follow_user', { target: userId })
        : await supabase.rpc('unfollow_user', { target: userId });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile'], refetchType: 'none' }),
  });
}
