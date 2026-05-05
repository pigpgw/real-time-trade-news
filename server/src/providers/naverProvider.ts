import { config, hasKeys } from '../config';
import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { createNewsId, isRecent, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchJson } from './http';

interface NaverNewsResponse {
  items?: Array<{
    title: string;
    originallink?: string;
    link: string;
    description?: string;
    pubDate: string;
  }>;
}

export const naverProvider: NewsProvider = {
  id: 'naver',
  label: 'Naver News Search',
  disabledReason: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음',
  enabled: () => hasKeys('naver'),
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const params = new URLSearchParams({
      query,
      display: '50',
      sort: 'date'
    });
    const data = await fetchJson<NaverNewsResponse>(`https://openapi.naver.com/v1/search/news.json?${params.toString()}`, {
      signal: options.signal,
      headers: {
        'X-Naver-Client-Id': config.naver.clientId,
        'X-Naver-Client-Secret': config.naver.clientSecret
      }
    });

    return (data.items ?? [])
      .map((item) => {
        const title = stripHtml(item.title);
        const snippet = stripHtml(item.description ?? '');
        const url = item.originallink || item.link;
        const publishedAt = new Date(item.pubDate).toISOString();
        const scored = scoreNews(title, snippet);
        return {
          id: createNewsId('naver', url, title),
          query,
          provider: 'naver',
          title,
          url,
          sourceName: getHostname(url) ?? 'Naver News',
          publishedAt,
          snippet,
          language: 'ko',
          country: 'KR',
          severity: scored.severity,
          matchedKeywords: scored.matchedKeywords
        } satisfies NewsItem;
      })
      .filter((item) => item.title && item.url && isRecent(item.publishedAt, options.lookbackHours));
  }
};

function getHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
