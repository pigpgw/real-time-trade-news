import { config } from '../config';
import type { NewsItem, NewsProvider, NewsProviderId, NewsSearchResult, ProviderStatus } from '../domain/news';
import { scoreNewsImpact } from '../domain/impactScoring';
import { compactQuery, dedupeNews } from '../domain/newsUtils';
import { newsProviders } from '../providers';

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
    const settled = await Promise.allSettled(
      enabledProviders.map(async (provider) => {
        return this.fetchProvider(provider, normalizedQuery, lookbackHours);
      })
    );

    const allItems: NewsItem[] = [];
    const localStatuses: ProviderStatus[] = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { provider, items, cached: providerCached } = result.value;
        const status = this.successStatus(provider, `${items.length}건${providerCached ? ' / cached' : ' / live'}`);
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

    const dedupedItems = dedupeNews(allItems).slice(0, 150);
    const items = dedupedItems.map((item) => ({
      ...item,
      impact: scoreNewsImpact({
        query: normalizedQuery,
        item,
        peers: dedupedItems
      })
    }));

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
  ): Promise<{ provider: NewsProvider; items: NewsItem[]; cached: boolean }> {
    const cacheKey = `${provider.id}:${query}:${lookbackHours}`;
    const cached = this.providerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { provider, items: cached.items, cached: true };
    }

    const items = await provider.fetch(query, { lookbackHours });
    this.providerCache.set(cacheKey, {
      items,
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + providerTtlMs(provider.id)
    });
    return { provider, items, cached: false };
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
