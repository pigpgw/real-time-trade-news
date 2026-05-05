import { describe, expect, it } from 'vitest';
import { scoreNewsImpact } from '../server/src/domain/impactScoring';
import type { NewsItem } from '../server/src/domain/news';

describe('news impact scoring', () => {
  it('escalates fresh geopolitical shock news for leveraged US queries', () => {
    const impact = scoreNewsImpact({
      query: 'SOXL Iran missile',
      item: item({
        title: 'Iran launches missiles as Nasdaq futures drop and oil jumps',
        snippet: 'Strait of Hormuz tensions hit semiconductor and leveraged ETF sentiment.',
        sourceName: 'Reuters',
        publishedAt: minutesAgo(4),
        severity: 'high',
        matchedKeywords: ['missile', 'nasdaq', 'oil']
      }),
      peers: [
        item({ title: 'Oil rises after missile reports', publishedAt: minutesAgo(8), severity: 'high' }),
        item({ title: 'US stock futures fall on Middle East risk', publishedAt: minutesAgo(18), severity: 'medium' })
      ]
    });

    expect(impact.score).toBeGreaterThanOrEqual(80);
    expect(impact.level).toBe('critical');
    expect(impact.deliveryMode).toBe('breaking');
    expect(impact.factors.map((factor) => factor.id)).toContain('event');
  });

  it('keeps stale and weakly related articles low priority', () => {
    const impact = scoreNewsImpact({
      query: 'AAPL',
      item: item({
        title: 'Developer conference agenda published',
        snippet: 'The company shared a schedule for app makers.',
        sourceName: 'Example Blog',
        publishedAt: daysAgo(3),
        severity: 'low'
      })
    });

    expect(impact.score).toBeLessThan(40);
    expect(impact.level).toBe('low');
    expect(impact.deliveryMode).toBe('normal');
  });
});

function item(overrides: Partial<NewsItem>): Pick<NewsItem, 'provider' | 'title' | 'publishedAt' | 'snippet' | 'severity' | 'matchedKeywords' | 'sourceName'> {
  return {
    provider: 'source-search',
    title: 'Sample headline',
    publishedAt: new Date().toISOString(),
    snippet: '',
    severity: 'low',
    matchedKeywords: [],
    sourceName: 'Example',
    ...overrides
  };
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
