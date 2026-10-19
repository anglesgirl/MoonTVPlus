import type { SearchResult } from './types';

/** Keep the first occurrence in source order; IDs are only unique within a source. */
export function deduplicateSearchResults(
  results: SearchResult[]
): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = JSON.stringify([item.source, item.id]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
