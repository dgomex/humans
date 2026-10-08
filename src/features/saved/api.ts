import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Collection = Database['public']['Tables']['saved_collections']['Row'] & {
  item_count: number;
};

/** Pseudo-collection id for "All posts" (every saved post; `saves` arrives in Phase 4). */
export const ALL_POSTS = 'all';

export const savedKeys = {
  all: ['saved'] as const,
  collections: ['saved', 'collections'] as const,
  collection: (id: string) => ['saved', 'collection', id] as const,
};

export function useCollections() {
  return useQuery({
    queryKey: savedKeys.collections,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_collections')
        .select('*, saved_collection_items(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(({ saved_collection_items, ...c }) => ({
        ...c,
        item_count: saved_collection_items[0]?.count ?? 0,
      })) as Collection[];
    },
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: savedKeys.collection(id ?? ''),
    enabled: !!id && id !== ALL_POSTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_collections')
        .select('*, saved_collection_items(post_id, created_at)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('saved_collections')
        .insert({ name: name.trim() })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: savedKeys.all }),
  });
}

export function useRenameCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('saved_collections')
        .update({ name: name.trim() })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: savedKeys.all }),
  });
}

/** Deleting a collection keeps the posts saved (they stay in All posts). */
export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_collections').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: savedKeys.all }),
  });
}
