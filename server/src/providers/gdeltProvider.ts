import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { createNewsId, isRecent, parseGdeltDate, quotedQuery, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchJson } from './http';

interface GdeltResponse {
  articles?: Array<{
    url?: string;
    title?: string;
    seendate?: string;
    domain?: string;
    sourcecountry?: string;
    sourceCountry?: string;
    language?: string;
  }>;
}

export const gdeltProvider: NewsProvider = {
  id: 'gdelt',
  label: 'GDELT Global News',
  enabled: () => true,
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const params = new URLSearchParams({
      query: quotedQuery(query),
      mode: 'ArtList',
      format: 'json',
      maxrecords: '75',
      sort: 'DateDesc',
      timespan: `${options.lookbackHours}h`
    });
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
    const data = await fetchJson<GdeltResponse>(url, { signal: options.signal });

    return (data.articles ?? [])
      .map((article) => {
        const title = stripHtml(article.title ?? '');
        const publishedAt = parseGdeltDate(article.seendate);
        const url = article.url ?? '';
        const scored = scoreNews(title);
        return {
          id: createNewsId('gdelt', url, title),
          query,
          provider: 'gdelt',
          title,
          url,
          sourceName: article.domain ?? 'GDELT',
          publishedAt,
          language: article.language,
          country: article.sourcecountry ?? article.sourceCountry,
          severity: scored.severity,
          matchedKeywords: scored.matchedKeywords
        } satisfies NewsItem;
      })
      .filter((item) => item.title && item.url && isRecent(item.publishedAt, options.lookbackHours));
  }
};
