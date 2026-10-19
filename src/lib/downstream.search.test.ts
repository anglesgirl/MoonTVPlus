jest.mock('@/lib/config', () => ({
  API_CONFIG: { search: { path: '?wd=', pagePath: '?wd={query}&pg={page}', headers: {} } },
  getConfig: jest.fn(async () => ({ SiteConfig: { SearchDownstreamMaxPage: 2 } })),
}));
jest.mock('@/lib/utils', () => ({ cleanHtmlTags: (value: string) => value }));
jest.mock('@/lib/special-sources-detail', () => ({ handleSpecialSourceDetail: jest.fn() }));

import { searchFromApi } from './downstream';
import { getCachedSearchPage } from './search-cache';

describe('search pagination cache', () => {
  it('keeps cached page one unchanged across repeated searches and overlapping pages', async () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        pagecount: 2,
        list: (url.includes('pg=2') ? ['1', '2'] : ['1']).map(id => ({
          vod_id: id, vod_name: '进击的巨人', vod_pic: '',
          vod_play_url: '第1集$https://example.com/1.m3u8',
        })),
      }),
    }));
    global.fetch = mockFetch as unknown as typeof fetch;
    const site = { key: 'regression-pagination', name: '暴风资源', api: 'https://example.com/api' };
    try {
      for (let i = 0; i < 3; i++) {
        const results = await searchFromApi(site, '进击的巨人');
        expect(results.map(item => item.id)).toEqual(['1', '2']);
        expect(getCachedSearchPage(site.key, '进击的巨人', 1)?.data.map(item => item.id)).toEqual(['1']);
      }
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
