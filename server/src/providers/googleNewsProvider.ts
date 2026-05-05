import { XMLParser } from 'fast-xml-parser';
import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { createNewsId, decodeHtml, isRecent, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchText } from './http';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text'
});

interface GoogleRssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: { text?: string; url?: string } | string;
  description?: string;
}

export const googleNewsProvider: NewsProvider = {
  id: 'google-news',
  label: 'Google News RSS',
  enabled: () => true,
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const [kr, us] = await Promise.all([
      fetchRegion(query, options, 'ko', 'KR', 'KR:ko'),
      fetchRegion(query, options, 'en-US', 'US', 'US:en')
    ]);
    return [...kr, ...us];
  }
};

async function fetchRegion(
  query: string,
  options: NewsFetchOptions,
  hl: string,
  gl: string,
  ceid: string
): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    q: `${query} when:${options.lookbackHours}h`,
    hl,
    gl,
    ceid
  });
  const xml = await fetchText(`https://news.google.com/rss/search?${params.toString()}`, {
    signal: options.signal
  });
  const parsed = parser.parse(xml);
  const rawItems = asArray<GoogleRssItem>(parsed?.rss?.channel?.item);

  return rawItems
    .map((raw) => {
      const { title, sourceName } = splitGoogleTitle(stripHtml(raw.title ?? ''), raw.source);
      const snippet = stripHtml(raw.description ?? '');
      const publishedAt = new Date(raw.pubDate ?? Date.now()).toISOString();
      const scored = scoreNews(title, snippet);
      const url = decodeHtml(raw.link ?? '');
      return {
        id: createNewsId(`google-news-${gl}`, url, title),
        query,
        provider: 'google-news',
        title,
        url,
        sourceName,
        publishedAt,
        snippet,
        language: hl,
        country: gl,
        severity: scored.severity,
        matchedKeywords: scored.matchedKeywords
      } satisfies NewsItem;
    })
    .filter((item) => item.title && item.url && isRecent(item.publishedAt, options.lookbackHours));
}

function splitGoogleTitle(title: string, source?: GoogleRssItem['source']): { title: string; sourceName: string } {
  const explicitSource = typeof source === 'string' ? source : source?.text;
  if (explicitSource) {
    const suffix = ` - ${explicitSource}`;
    return {
      title: title.endsWith(suffix) ? title.slice(0, -suffix.length) : title,
      sourceName: explicitSource
    };
  }

  const parts = title.split(' - ');
  if (parts.length < 2) return { title, sourceName: 'Google News' };
  const sourceName = parts.at(-1) ?? 'Google News';
  return { title: parts.slice(0, -1).join(' - '), sourceName };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
