import { config } from '../config';
import type { NewsFetchOptions, NewsItem, NewsProvider } from '../domain/news';
import { createNewsId, isRecent, scoreNews } from '../domain/newsUtils';
import { fetchJson } from './http';

const cikByTicker: Record<string, string> = {
  AAPL: '0000320193',
  MSFT: '0000789019',
  NVDA: '0001045810',
  TSLA: '0001318605',
  AMZN: '0001018724',
  META: '0001326801',
  GOOGL: '0001652044',
  GOOG: '0001652044',
  AMD: '0000002488',
  NFLX: '0001065280'
};

interface SecSubmission {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      reportDate?: string[];
      items?: string[];
    };
  };
}

export const secProvider: NewsProvider = {
  id: 'sec',
  label: 'SEC Filings',
  enabled: () => true,
  async fetch(query: string, options: NewsFetchOptions): Promise<NewsItem[]> {
    const cik = resolveCik(query);
    if (!cik) return [];

    const data = await fetchJson<SecSubmission>(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      signal: options.signal,
      headers: {
        'User-Agent': config.sec.userAgent,
        Accept: 'application/json'
      }
    });

    const recent = data.filings?.recent;
    if (!recent?.accessionNumber) return [];

    return recent.accessionNumber.slice(0, 30)
      .map((accession, index) => {
        const form = recent.form?.[index] ?? 'Filing';
        const filingDate = recent.filingDate?.[index] ?? recent.reportDate?.[index] ?? new Date().toISOString();
        const publishedAt = new Date(`${filingDate}T00:00:00Z`).toISOString();
        const normalizedAccession = accession.replace(/-/g, '');
        const numericCik = String(Number(cik));
        const url = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${normalizedAccession}/${accession}-index.html`;
        const title = `${data.name ?? query.toUpperCase()} ${form} filed`;
        const snippet = recent.items?.[index] ? `Items: ${recent.items[index]}` : undefined;
        const scored = scoreNews(title, snippet);
        return {
          id: createNewsId('sec', url, title),
          query,
          provider: 'sec',
          title,
          url,
          sourceName: 'SEC EDGAR',
          publishedAt,
          snippet,
          language: 'en',
          country: 'US',
          severity: form === '8-K' || form === '10-K' || form === '10-Q' ? 'medium' : scored.severity,
          matchedKeywords: scored.matchedKeywords
        } satisfies NewsItem;
      })
      .filter((item) => isRecent(item.publishedAt, options.lookbackHours));
  }
};

function resolveCik(query: string): string | undefined {
  const compact = query.trim().toUpperCase();
  if (/^\d{1,10}$/.test(compact)) return compact.padStart(10, '0');
  return cikByTicker[compact];
}
