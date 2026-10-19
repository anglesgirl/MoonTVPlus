import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

import { deduplicateSearchResults } from './search-results';
import type { SearchResult } from './types';

const result = (source: string, id: string): SearchResult => ({
  source, id, source_name: source, title: '进击的巨人',
  poster: '', episodes: [], year: 'unknown',
});

describe('search result identity', () => {
  it('deduplicates repeated pages and batches without modifying input', () => {
    const first = result('暴风资源', '1');
    const input = [first, result('暴风资源', '1'), result('giriGiriLove', '1')];
    expect(deduplicateSearchResults(input)).toEqual([first, input[2]]);
    expect(input).toHaveLength(3);
  });

  it('does not confuse delimiter-containing source/id pairs', () => {
    const input = [result('a-b', 'c'), result('a', 'b-c')];
    expect(deduplicateSearchResults(input)).toEqual(input);
  });

  it('removes all other-source DOM cards after selecting giriGiriLove', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const input = [result('other', '1'), result('暴风资源', '1'),
      result('暴风资源', '1'), result('giriGiriLove', '1')];
    const render = (items: SearchResult[]) => React.createElement('div', null,
      items.map(item => React.createElement('button', {
        key: `all-${item.source}-${item.id}`,
      }, item.source_name)));
    const unique = deduplicateSearchResults(input);
    try {
      flushSync(() => root.render(render(unique)));
      const filtered = unique.filter(item => item.source === 'giriGiriLove');
      flushSync(() => root.render(render(filtered)));
      expect(container.querySelectorAll('button')).toHaveLength(filtered.length);
      expect(container.textContent).toBe('giriGiriLove');
    } finally {
      root.unmount();
    }
  });
});
