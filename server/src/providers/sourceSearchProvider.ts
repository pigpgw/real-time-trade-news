import { XMLParser } from 'fast-xml-parser';
import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { expandQuery, expandQueryGroups, matchesExpandedQuery, newsSearchTerms } from '../domain/queryExpansion';
import { createNewsId, decodeHtml, isRecent, scoreNews, stripHtml } from '../domain/newsUtils';
import { fetchText } from './http';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text'
});

interface SourceTarget {
  id: string;
  label: string;
  domain: string;
  country: string;
  topics: SourceTopic[];
  priority: number;
}

type SourceTopic = 'market' | 'geopolitics' | 'tech' | 'general';

interface GoogleRssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: { text?: string; url?: string } | string;
  description?: string;
}

const sourceTargets: SourceTarget[] = [
  { id: 'reuters', label: 'Reuters', domain: 'reuters.com', country: 'GB', topics: ['market', 'geopolitics', 'general'], priority: 100 },
  { id: 'ap', label: 'AP News', domain: 'apnews.com', country: 'US', topics: ['geopolitics', 'general'], priority: 95 },
  { id: 'cnbc', label: 'CNBC', domain: 'cnbc.com', country: 'US', topics: ['market', 'tech'], priority: 92 },
  { id: 'marketwatch', label: 'MarketWatch', domain: 'marketwatch.com', country: 'US', topics: ['market'], priority: 88 },
  { id: 'bloomberg', label: 'Bloomberg', domain: 'bloomberg.com', country: 'US', topics: ['market', 'geopolitics', 'tech'], priority: 87 },
  { id: 'wsj', label: 'Wall Street Journal', domain: 'wsj.com', country: 'US', topics: ['market', 'geopolitics', 'tech'], priority: 84 },
  { id: 'bbc', label: 'BBC', domain: 'bbc.com', country: 'GB', topics: ['geopolitics', 'general'], priority: 82 },
  { id: 'aljazeera', label: 'Al Jazeera', domain: 'aljazeera.com', country: 'QA', topics: ['geopolitics', 'general'], priority: 80 },
  { id: 'cnn', label: 'CNN', domain: 'cnn.com', country: 'US', topics: ['geopolitics', 'general'], priority: 76 },
  { id: 'guardian', label: 'The Guardian', domain: 'theguardian.com', country: 'GB', topics: ['geopolitics', 'general'], priority: 74 },
  { id: 'skynews', label: 'Sky News', domain: 'news.sky.com', country: 'GB', topics: ['geopolitics', 'general'], priority: 72 },
  { id: 'france24', label: 'France 24', domain: 'france24.com', country: 'FR', topics: ['geopolitics', 'general'], priority: 70 },
  { id: 'dw', label: 'Deutsche Welle', domain: 'dw.com', country: 'DE', topics: ['geopolitics', 'general'], priority: 68 },
  { id: 'politico', label: 'Politico', domain: 'politico.com', country: 'US', topics: ['geopolitics', 'general'], priority: 64 },
  { id: 'axios', label: 'Axios', domain: 'axios.com', country: 'US', topics: ['market', 'geopolitics', 'tech'], priority: 62 },
  { id: 'barrons', label: "Barron's", domain: 'barrons.com', country: 'US', topics: ['market'], priority: 60 },
  { id: 'yahoo-finance', label: 'Yahoo Finance', domain: 'finance.yahoo.com', country: 'US', topics: ['market', 'tech'], priority: 58 },
  { id: 'investing', label: 'Investing.com', domain: 'investing.com', country: 'US', topics: ['market'], priority: 56 },
  { id: 'ft', label: 'Financial Times', domain: 'ft.com', country: 'GB', topics: ['market', 'geopolitics'], priority: 54 },
  { id: 'nikkei', label: 'Nikkei Asia', domain: 'asia.nikkei.com', country: 'JP', topics: ['market', 'geopolitics', 'tech'], priority: 52 }
];

export const sourceSearchProvider: NewsProvider = {
  id: 'source-search',
  label: 'Overseas Source Search',
  enabled: () => true,
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const searchTerms = buildSearchTerms(query).slice(0, 3);
    const targets = selectSourceTargets(query);
    const searches = targets.flatMap((source) =>
      searchTerms.map((term) => fetchSourceSearch(source, term, query, options))
    );
    const settled = await Promise.allSettled(searches);
    const items: NewsItem[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        items.push(...result.value);
      }
    }

    return items.filter((item) => matchesExpandedQuery(query, item.title, item.snippet, item.sourceName));
  }
};

function selectSourceTargets(query: string): SourceTarget[] {
  const topics = detectTopics(query);
  return [...sourceTargets]
    .sort((a, b) => sourceScore(b, topics) - sourceScore(a, topics))
    .slice(0, 5);
}

function sourceScore(source: SourceTarget, topics: SourceTopic[]): number {
  const topicBoost = topics.filter((topic) => source.topics.includes(topic)).length * 30;
  const generalBoost = source.topics.includes('general') ? 5 : 0;
  return source.priority + topicBoost + generalBoost;
}

function detectTopics(query: string): SourceTopic[] {
  const text = expandQuery(query).join(' ').toLowerCase();
  const topics = new Set<SourceTopic>(['general']);
  if (/(stock|stocks|market|nasdaq|s&p|dow|futures|oil|brent|wti|yield|rate|fed|soxl|tqqq|qqq|etf)/.test(text)) {
    topics.add('market');
  }
  if (/(chip|semiconductor|nvidia|amd|apple|microsoft|tesla|ai|technology|nasdaq)/.test(text)) {
    topics.add('tech');
  }
  if (/(iran|israel|war|conflict|attack|missile|drone|uav|hormuz|russia|ukraine|china|taiwan|gulf)/.test(text)) {
    topics.add('geopolitics');
  }
  return Array.from(topics);
}

async function fetchSourceSearch(
  source: SourceTarget,
  term: string,
  query: string,
  options: NewsFetchOptions
): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    q: `${term} site:${source.domain} when:${options.lookbackHours}h`,
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en'
  });
  const xml = await fetchText(`https://news.google.com/rss/search?${params.toString()}`, {
    signal: options.signal
  }, 8_000);
  const parsed = parser.parse(xml);
  const rawItems = asArray<GoogleRssItem>(parsed?.rss?.channel?.item);

  return rawItems
    .map((raw) => {
      const { title, sourceName } = splitGoogleTitle(stripHtml(raw.title ?? ''), raw.source, source.label);
      const snippet = stripHtml(raw.description ?? '');
      const publishedAt = new Date(raw.pubDate ?? Date.now()).toISOString();
      const url = decodeHtml(raw.link ?? '');
      const scored = scoreNews(title, snippet);
      return {
        id: createNewsId(`source-search-${source.id}`, url, title),
        query,
        provider: 'source-search',
        title,
        url,
        sourceName,
        publishedAt,
        snippet,
        language: 'en',
        country: source.country,
        severity: scored.severity,
        matchedKeywords: scored.matchedKeywords
      } satisfies NewsItem;
    })
    .filter((item) => item.title && item.url && isRecent(item.publishedAt, options.lookbackHours));
}

function buildSearchTerms(query: string): string[] {
  const groups = expandQueryGroups(query);
  const exact = query.trim().toLowerCase();
  const flat = prioritizeSourceSearchTerms(
    newsSearchTerms(query).filter((term) => /[a-z0-9]/i.test(term)),
    exact
  );
  const expanded = expandQuery(query).filter((term) => /[a-z0-9]/i.test(term));
  const terms = new Set<string>();

  for (const term of flat) {
    if (term.length <= 48) terms.add(term);
  }

  if (groups.length > 1) {
    const asciiGroups = groups.map((group) => group.filter((term) => /[a-z0-9]/i.test(term)));
    const first = asciiGroups[0] ?? [];
    const second = asciiGroups[1] ?? [];
    for (const left of first.slice(0, 4)) {
      for (const right of second.slice(0, 4)) {
        terms.add(`${quoteIfNeeded(left)} ${quoteIfNeeded(right)}`);
      }
    }
  }

  for (const term of expanded) {
    if (term.includes(' ') && term.length <= 48) terms.add(`"${term}"`);
  }

  for (const term of expanded) {
    if (!term.includes(' ') && term.length > 2) terms.add(term);
  }

  return Array.from(terms).slice(0, 6);
}

function prioritizeSourceSearchTerms(terms: string[], exact: string): string[] {
  if (!/^(soxl|tqqq|sqqq)$/.test(exact)) return terms;
  return [
    ...terms.filter((term) => term.toLowerCase() !== exact),
    ...terms.filter((term) => term.toLowerCase() === exact)
  ];
}

function quoteIfNeeded(value: string): string {
  return value.includes(' ') ? `"${value}"` : value;
}

function splitGoogleTitle(
  title: string,
  source?: GoogleRssItem['source'],
  fallbackSource = 'Overseas source'
): { title: string; sourceName: string } {
  const explicitSource = typeof source === 'string' ? source : source?.text;
  if (explicitSource) {
    const suffix = ` - ${explicitSource}`;
    return {
      title: title.endsWith(suffix) ? title.slice(0, -suffix.length) : title,
      sourceName: explicitSource
    };
  }

  const parts = title.split(' - ');
  if (parts.length < 2) return { title, sourceName: fallbackSource };
  const sourceName = parts.at(-1) ?? fallbackSource;
  return { title: parts.slice(0, -1).join(' - '), sourceName };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
