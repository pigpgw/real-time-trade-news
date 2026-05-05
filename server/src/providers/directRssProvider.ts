import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { matchesExpandedQuery } from '../domain/queryExpansion';
import { fetchRssSource, type RssSource } from './rssReader';

const directSources: RssSource[] = [
  {
    id: 'bbc-world',
    label: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'bbc-business',
    label: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'bbc-technology',
    label: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'cnbc-top',
    label: 'CNBC Top News',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    language: 'en',
    country: 'US'
  },
  {
    id: 'cnbc-business',
    label: 'CNBC Business',
    url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html',
    language: 'en',
    country: 'US'
  },
  {
    id: 'cnbc-world',
    label: 'CNBC World',
    url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
    language: 'en',
    country: 'US'
  },
  {
    id: 'marketwatch-top',
    label: 'MarketWatch Top Stories',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    language: 'en',
    country: 'US'
  },
  {
    id: 'marketwatch-pulse',
    label: 'MarketWatch MarketPulse',
    url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
    language: 'en',
    country: 'US'
  },
  {
    id: 'abc-international',
    label: 'ABC News International',
    url: 'https://abcnews.go.com/abcnews/internationalheadlines',
    language: 'en',
    country: 'US'
  },
  {
    id: 'abc-top',
    label: 'ABC News Top Stories',
    url: 'https://abcnews.go.com/abcnews/topstories',
    language: 'en',
    country: 'US'
  },
  {
    id: 'aljazeera',
    label: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    language: 'en',
    country: 'QA'
  },
  {
    id: 'guardian-world',
    label: 'The Guardian World',
    url: 'https://www.theguardian.com/world/rss',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'guardian-business',
    label: 'The Guardian Business',
    url: 'https://www.theguardian.com/business/rss',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'sky-world',
    label: 'Sky News World',
    url: 'https://feeds.skynews.com/feeds/rss/world.xml',
    language: 'en',
    country: 'GB'
  },
  {
    id: 'dw-all',
    label: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    language: 'en',
    country: 'DE'
  },
  {
    id: 'yahoo-finance',
    label: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    language: 'en',
    country: 'US'
  },
  {
    id: 'investing-stock-market',
    label: 'Investing.com Stock Market News',
    url: 'https://www.investing.com/rss/news_25.rss',
    language: 'en',
    country: 'US'
  },
  {
    id: 'seeking-alpha-market-news',
    label: 'Seeking Alpha Market News',
    url: 'https://seekingalpha.com/market_currents.xml',
    language: 'en',
    country: 'US'
  }
];

export const directRssProvider: NewsProvider = {
  id: 'direct-rss',
  label: 'Direct Overseas RSS',
  enabled: () => true,
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const settled = await Promise.allSettled(
      directSources.map((source) => fetchRssSource(source, 'direct-rss', query, options.lookbackHours, options.signal))
    );

    const items: NewsItem[] = [];
    const errors: string[] = [];

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        items.push(
          ...result.value.filter((item) => matchesExpandedQuery(query, item.title, item.snippet, item.sourceName))
        );
      } else {
        errors.push(`${directSources[index].label}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
      }
    });

    if (items.length === 0 && errors.length === settled.length) {
      throw new Error(errors.slice(0, 3).join(' / '));
    }

    return items;
  }
};
