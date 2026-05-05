import { config, hasKeys } from '../config';
import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { createNewsId, isRecent, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchJson } from './http';

interface NewsApiResponse {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

export const newsApiProvider: NewsProvider = {
  id: 'newsapi',
  label: 'NewsAPI',
  disabledReason: 'NEWSAPI_KEY 없음',
  enabled: () => hasKeys('newsApi'),
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const from = new Date(Date.now() - options.lookbackHours * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      q: query,
      from,
      sortBy: 'publishedAt',
      pageSize: '50',
      searchIn: 'title,description'
    });
    const data = await fetchJson<NewsApiResponse>(`https://newsapi.org/v2/everything?${params.toString()}`, {
      signal: options.signal,
      headers: {
        'X-Api-Key': config.newsApi.apiKey
      }
    });

    return (data.articles ?? [])
      .map((article) => {
        const title = stripHtml(article.title ?? '');
        const snippet = stripHtml(article.description ?? '');
        const url = article.url ?? '';
        const publishedAt = new Date(article.publishedAt ?? Date.now()).toISOString();
        const scored = scoreNews(title, snippet);
        return {
          id: createNewsId('newsapi', url, title),
          query,
          provider: 'newsapi',
          title,
          url,
          sourceName: article.source?.name ?? 'NewsAPI',
          publishedAt,
          snippet,
          severity: scored.severity,
          matchedKeywords: scored.matchedKeywords
        } satisfies NewsItem;
      })
      .filter((item) => item.title && item.url && isRecent(item.publishedAt, options.lookbackHours));
  }
};
