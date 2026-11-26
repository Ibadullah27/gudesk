import { QueryClient, keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.js';

/**
 * Shared TanStack Query client (spec §2: React data layer).
 * - Client errors (4xx) are not retried; they will not succeed on retry.
 * - Window-focus refetch is off so open forms and dialogs are not disturbed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => (error?.status && error.status < 500 ? false : failureCount < 2),
    },
    mutations: { retry: false },
  },
});

/**
 * GET an API path through TanStack Query. The cache key is the path's segments
 * plus any params, so `invalidateQueries({ queryKey: ['courses'] })` refreshes
 * every `/courses...` query.
 *
 * @param {string[]} key  Leading key segments, e.g. ['courses', courseId, 'resources'].
 * @param {string} path   API path without query string, e.g. `/courses/${id}/resources`.
 * @param {Record<string, string|number|undefined>} [params] Query-string params (empty values dropped).
 * @param {object} [options] Extra useQuery options (enabled, refetchInterval…).
 */
export function useApiQuery(key, path, params = {}, options = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const search = new URLSearchParams(Object.entries(clean).map(([k, v]) => [k, String(v)])).toString();
  return useQuery({
    queryKey: [...key, clean],
    queryFn: () => apiFetch(search ? `${path}?${search}` : path),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Empty list result used while a paginated query has no data yet. */
export const EMPTY_PAGE = Object.freeze({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
