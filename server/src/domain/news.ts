export type NewsProviderId = 'direct-rss' | 'source-search' | 'gdelt' | 'google-news' | 'naver' | 'newsapi' | 'sec';
export type NewsSeverity = 'low' | 'medium' | 'high';

export interface NewsItem {
  id: string;
  query: string;
  provider: NewsProviderId;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  snippet?: string;
  language?: string;
  country?: string;
  severity: NewsSeverity;
  matchedKeywords: string[];
}

export interface ProviderStatus {
  id: NewsProviderId;
  label: string;
  enabled: boolean;
  status: 'idle' | 'ok' | 'disabled' | 'error';
  message?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
}

export interface NewsSearchResult {
  query: string;
  generatedAt: string;
  items: NewsItem[];
  statuses: ProviderStatus[];
}

export interface NewsProvider {
  id: NewsProviderId;
  label: string;
  enabled(): boolean;
  disabledReason?: string;
  fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]>;
}

export interface NewsFetchOptions {
  lookbackHours: number;
  signal?: AbortSignal;
}
