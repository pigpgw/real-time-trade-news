import { XMLParser } from 'fast-xml-parser';
import type { NewsItem, NewsProviderId } from '../domain/news';
import { createNewsId, isRecent, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchText } from './http';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  removeNSPrefix: true
});

export interface RssSource {
  id: string;
  label: string;
  url: string;
  language?: string;
  country?: string;
}

interface RawRssItem {
  title?: string | { text?: string };
  link?: string | { href?: string; text?: string };
  guid?: string | { text?: string };
  pubDate?: string;
  published?: string;
  updated?: string;
  date?: string;
  description?: string;
  encoded?: string;
  summary?: string;
  source?: string | { text?: string };
}

export async function fetchRssSource(
  source: RssSource,
  provider: NewsProviderId,
  query: string,
  lookbackHours: number,
  signal?: AbortSignal
): Promise<NewsItem[]> {
  const xml = await fetchText(source.url, {
    signal,
    headers: {
      'User-Agent': 'stock-issue-monitor/0.1 RSS reader'
    }
  }, 8_000);
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const rawItems = asArray<RawRssItem>(channel?.item ?? channel?.entry);

  return rawItems
    .map((raw) => toNewsItem(raw, source, provider, query))
    .filter((item) => item.title && item.url && isRecent(item.publishedAt, lookbackHours));
}

function toNewsItem(raw: RawRssItem, source: RssSource, provider: NewsProviderId, query: string): NewsItem {
  const title = stripHtml(textValue(raw.title));
  const snippet = stripHtml(raw.description ?? raw.summary ?? raw.encoded ?? '');
  const url = linkValue(raw.link) || textValue(raw.guid);
  const publishedAt = parseDate(raw.pubDate ?? raw.published ?? raw.updated ?? raw.date);
  const scored = scoreNews(title, snippet);

  return {
    id: createNewsId(`${provider}-${source.id}`, url, title),
    query,
    provider,
    title,
    url,
    sourceName: textValue(raw.source) || source.label,
    publishedAt,
    snippet,
    language: source.language,
    country: source.country,
    severity: scored.severity,
    matchedKeywords: scored.matchedKeywords
  };
}

function parseDate(value?: string): string {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function textValue(value: RawRssItem['title'] | RawRssItem['source'] | RawRssItem['guid']): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.text ?? '';
}

function linkValue(value: RawRssItem['link']): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.href ?? value.text ?? '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
