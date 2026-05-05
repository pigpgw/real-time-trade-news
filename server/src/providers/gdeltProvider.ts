import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { matchesExpandedQuery, newsSearchTerms } from '../domain/queryExpansion';
import { createNewsId, isRecent, parseGdeltDate, quotedQuery, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchText } from './http';

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
      query: gdeltSearchQuery(query),
      mode: 'ArtList',
      format: 'json',
      maxrecords: '75',
      sort: 'DateDesc',
      timespan: `${options.lookbackHours}h`
    });
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
    const data = await fetchGdelt(url, options.signal);

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
      .filter((item) =>
        item.title
        && item.url
        && isRecent(item.publishedAt, options.lookbackHours)
        && matchesExpandedQuery(query, item.title, item.sourceName)
      );
  }
};

let nextAllowedRequestAt = 0;

async function fetchGdelt(url: string, signal?: AbortSignal): Promise<GdeltResponse> {
  const now = Date.now();
  if (now < nextAllowedRequestAt) {
    const seconds = Math.ceil((nextAllowedRequestAt - now) / 1000);
    throw new Error(`GDELT cooldown ${seconds}s`);
  }

  nextAllowedRequestAt = now + 5_500;
  let text: string;
  try {
    text = await fetchText(url, { signal });
  } catch (error) {
    if (error instanceof Error && /429|too many requests/i.test(error.message)) {
      nextAllowedRequestAt = Date.now() + 30_000;
      throw new Error('GDELT rate limit: one request every 5 seconds');
    }
    throw error;
  }
  const compact = text.trim();
  if (!compact.startsWith('{')) {
    if (/limit requests|too many requests/i.test(compact)) {
      nextAllowedRequestAt = Date.now() + 30_000;
      throw new Error('GDELT rate limit: one request every 5 seconds');
    }
    throw new Error(compact.slice(0, 120) || 'GDELT returned non-JSON response');
  }

  return JSON.parse(compact) as GdeltResponse;
}

function gdeltSearchQuery(query: string): string {
  const compact = query.trim().replace(/\s+/g, ' ');
  const expanded = newsSearchTerms(compact).filter((term) => /[a-z0-9]/i.test(term));
  const isSingleToken = !/\s/.test(compact);
  const shouldExpand = isSingleToken && expanded.length >= 4;

  if (!shouldExpand) return quotedQuery(compact);

  return expanded
    .filter((term) => term.length <= 32)
    .slice(0, 8)
    .map((term) => (term.includes(' ') ? `"${term}"` : term))
    .join(' OR ');
}
