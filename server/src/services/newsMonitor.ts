import { config } from '../config';
import type { NewsItem, NewsProvider, NewsProviderId, NewsSearchResult, ProviderStatus } from '../domain/news';
import { scoreNewsImpact, type PriceContext } from '../domain/impactScoring';
import { compactQuery, dedupeNews } from '../domain/newsUtils';
import { newsProviders } from '../providers';
import { getMarketQuote } from './quoteService';

export class NewsMonitor {
  private statuses = new Map<NewsProviderId, ProviderStatus>();
  private cache = new Map<string, { expiresAt: number; result: NewsSearchResult }>();
  private providerCache = new Map<string, { expiresAt: number; items: NewsItem[]; fetchedAt: string }>();
  private inFlight = new Map<string, Promise<NewsSearchResult>>();

  constructor(private readonly providers: NewsProvider[] = newsProviders) {
    for (const provider of providers) {
      this.statuses.set(provider.id, {
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled(),
        status: provider.enabled() ? 'idle' : 'disabled',
        message: provider.enabled() ? undefined : provider.disabledReason
      });
    }
  }

  async search(query: string, lookbackHours = config.newsLookbackHours): Promise<NewsSearchResult> {
    const normalizedQuery = compactQuery(query);
    if (!normalizedQuery) {
      return {
        query: normalizedQuery,
        generatedAt: new Date().toISOString(),
        items: [],
        statuses: this.getStatuses()
      };
    }

    const cacheKey = `${normalizedQuery}:${lookbackHours}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const request = this.executeSearch(normalizedQuery, lookbackHours, cacheKey).finally(() => {
      this.inFlight.delete(cacheKey);
    });
    this.inFlight.set(cacheKey, request);
    return request;
  }

  private async executeSearch(
    normalizedQuery: string,
    lookbackHours: number,
    cacheKey: string
  ): Promise<NewsSearchResult> {

    const enabledProviders = this.providers.filter((provider) => provider.enabled());
    const priceContextPromise = resolvePriceContext(normalizedQuery);
    const settled = await Promise.allSettled(
      enabledProviders.map(async (provider) => {
        return this.fetchProvider(provider, normalizedQuery, lookbackHours);
      })
    );

    const allItems: NewsItem[] = [];
    const localStatuses: ProviderStatus[] = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { provider, items, cached: providerCached, stale } = result.value;
        const status = this.successStatus(provider, `${items.length}건${stale ? ' / stale' : providerCached ? ' / cached' : ' / live'}`);
        this.statuses.set(provider.id, status);
        localStatuses.push(status);
        allItems.push(...items);
      } else {
        const provider = enabledProviders[index];
        this.markError(provider, result.reason instanceof Error ? result.reason.message : String(result.reason));
        localStatuses.push(this.statuses.get(provider.id)!);
      }
    });

    this.refreshDisabledStatuses();

    const dedupedItems = dedupeNews(allItems).slice(0, 180);
    const price = await priceContextPromise;
    const items = dedupedItems.map((item) => ({
      ...item,
      impact: scoreNewsImpact({
        query: normalizedQuery,
        item,
        peers: dedupedItems.filter((peer) => peer.id !== item.id),
        price
      })
    })).sort(compareNewsForTrading).slice(0, 150);

    const result = {
      query: normalizedQuery,
      generatedAt: new Date().toISOString(),
      items,
      statuses: this.withDisabledStatuses(localStatuses)
    };
    this.cache.set(cacheKey, { expiresAt: Date.now() + 2_000, result });
    return result;
  }

  getStatuses(): ProviderStatus[] {
    this.refreshDisabledStatuses();
    return Array.from(this.statuses.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  private markSuccess(provider: NewsProvider, message?: string): void {
    this.statuses.set(provider.id, this.successStatus(provider, message));
  }

  private async fetchProvider(
    provider: NewsProvider,
    query: string,
    lookbackHours: number
  ): Promise<{ provider: NewsProvider; items: NewsItem[]; cached: boolean; stale?: boolean }> {
    const cacheKey = `${provider.id}:${query}:${lookbackHours}`;
    const cached = this.providerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { provider, items: cached.items, cached: true };
    }

    try {
      const items = await provider.fetch(query, { lookbackHours });
      this.providerCache.set(cacheKey, {
        items,
        fetchedAt: new Date().toISOString(),
        expiresAt: Date.now() + providerTtlMs(provider.id)
      });
      return { provider, items, cached: false };
    } catch (error) {
      if (cached && isTemporaryProviderLimit(error)) {
        return { provider, items: cached.items, cached: true, stale: true };
      }
      if (provider.id === 'gdelt' && isTemporaryProviderLimit(error)) {
        return { provider, items: [], cached: false, stale: true };
      }
      throw error;
    }
  }

  private successStatus(provider: NewsProvider, message?: string): ProviderStatus {
    return {
      id: provider.id,
      label: provider.label,
      enabled: true,
      status: 'ok',
      message,
      lastSuccessAt: new Date().toISOString(),
      lastErrorAt: this.statuses.get(provider.id)?.lastErrorAt
    };
  }

  private markError(provider: NewsProvider, message: string): void {
    this.statuses.set(provider.id, {
      id: provider.id,
      label: provider.label,
      enabled: true,
      status: 'error',
      message,
      lastSuccessAt: this.statuses.get(provider.id)?.lastSuccessAt,
      lastErrorAt: new Date().toISOString()
    });
  }

  private refreshDisabledStatuses(): void {
    for (const provider of this.providers) {
      if (provider.enabled()) continue;
      this.statuses.set(provider.id, {
        id: provider.id,
        label: provider.label,
        enabled: false,
        status: 'disabled',
        message: provider.disabledReason
      });
    }
  }

  private withDisabledStatuses(statuses: ProviderStatus[]): ProviderStatus[] {
    const byId = new Map(statuses.map((status) => [status.id, status]));
    for (const provider of this.providers) {
      if (byId.has(provider.id) || provider.enabled()) continue;
      byId.set(provider.id, {
        id: provider.id,
        label: provider.label,
        enabled: false,
        status: 'disabled',
        message: provider.disabledReason
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }
}

export const newsMonitor = new NewsMonitor();

function providerTtlMs(providerId: NewsProviderId): number {
  if (providerId === 'google-news') return 20_000;
  if (providerId === 'source-search') return 60_000;
  if (providerId === 'direct-rss') return 45_000;
  if (providerId === 'naver') return 45_000;
  if (providerId === 'newsapi') return 60_000;
  if (providerId === 'gdelt') return 180_000;
  if (providerId === 'sec') return 300_000;
  return 60_000;
}

function isTemporaryProviderLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cooldown|rate limit|too many requests|429/i.test(message);
}

function compareNewsForTrading(a: NewsItem, b: NewsItem): number {
  const priority = tradingPriority(b) - tradingPriority(a);
  if (priority !== 0) return priority;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

function tradingPriority(item: NewsItem): number {
  const impactScore = item.impact?.score ?? (item.severity === 'high' ? 65 : item.severity === 'medium' ? 42 : 18);
  const ageMinutes = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 60_000);
  const freshness = ageMinutes <= 5 ? 30 : ageMinutes <= 15 ? 24 : ageMinutes <= 60 ? 15 : ageMinutes <= 180 ? 8 : 0;
  const deliveryBoost = item.impact?.deliveryMode === 'breaking' ? 16 : item.impact?.deliveryMode === 'priority' ? 10 : 0;
  const marketBoost = item.impact?.positionEffect === 'unfavorable' ? 12 : item.impact?.positionEffect === 'mixed' ? 8 : 0;
  const sourceBoost = item.provider === 'direct-rss' || item.provider === 'source-search' || item.provider === 'sec' ? 6 : 0;
  return impactScore * 2 + freshness + deliveryBoost + marketBoost + sourceBoost;
}

const quoteSymbols = new Set([
  'SOXL',
  'TQQQ',
  'SQQQ',
  'SOXS',
  'QQQ',
  'SPY',
  'NVDA',
  'AMD',
  'AVGO',
  'TSM',
  'ASML',
  'MU',
  'AAPL',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'GOOG',
  'TSLA'
]);

async function resolvePriceContext(query: string): Promise<PriceContext | undefined> {
  const symbol = inferQuoteSymbol(query);
  if (!symbol) return undefined;

  return getMarketQuote(symbol)
    .then((quote) => ({
      symbol: quote.symbol,
      session: quote.session,
      activeChangePercent: quote.activeChangePercent,
      regularChangePercent: quote.regularChangePercent,
      provider: quote.provider,
      isRealtime: quote.isRealtime
    }))
    .catch(() => undefined);
}

function inferQuoteSymbol(query: string): string | undefined {
  const compact = query.trim().toUpperCase();
  if (quoteSymbols.has(compact)) return compact;
  const tokens = compact.match(/\b[A-Z][A-Z0-9.=-]{0,11}\b/g) ?? [];
  return tokens.find((token) => quoteSymbols.has(token));
}
