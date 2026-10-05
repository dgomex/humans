import { useQuery } from '@tanstack/react-query';

import { SIGNED_URL_TTL, getMediaUrl, type Bucket } from './storage';

/** Cached display URL for a storage object; signed URLs are refreshed before they expire. */
export function useMediaUrl(bucket: Bucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ['media-url', bucket, path],
    queryFn: () => getMediaUrl(bucket, path!),
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL - 5 * 60) * 1000,
    gcTime: (SIGNED_URL_TTL - 5 * 60) * 1000,
  });
}
