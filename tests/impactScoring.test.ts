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
      ],
      price: {
        symbol: 'SOXL',
        session: 'post',
        activeChangePercent: -3.1,
        provider: 'cnbc',
        isRealtime: true
      }
    });

    expect(impact.score).toBeGreaterThanOrEqual(80);
    expect(impact.level).toBe('critical');
    expect(impact.deliveryMode).toBe('breaking');
    expect(impact.direction).toBe('bearish');
    expect(impact.positionBias).toBe('long');
    expect(impact.positionEffect).toBe('unfavorable');
    expect(impact.marketAlignment).toBe('confirming');
    expect(impact.factors.map((factor) => factor.id)).toContain('direction');
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

  it('inverts bearish market news for inverse ETFs', () => {
    const impact = scoreNewsImpact({
      query: 'SQQQ',
      item: item({
        title: 'Nasdaq futures fall as AI stocks sell off',
        snippet: 'Technology stocks drop before the open.',
        sourceName: 'CNBC',
        publishedAt: minutesAgo(3),
        severity: 'high'
      }),
      peers: [item({ title: 'US stock futures fall on tech weakness', publishedAt: minutesAgo(6), severity: 'medium' })],
      price: {
        symbol: 'SQQQ',
        session: 'pre',
        activeChangePercent: 2.4,
        provider: 'cnbc',
        isRealtime: true
      }
    });

    expect(impact.direction).toBe('bearish');
    expect(impact.positionBias).toBe('inverse');
    expect(impact.positionEffect).toBe('favorable');
  });

  it('marks single-source rumors with no price confirmation as high truth risk', () => {
    const impact = scoreNewsImpact({
      query: 'NVDA',
      item: item({
        title: 'Unconfirmed social media rumor claims Nvidia faces export halt',
        snippet: 'The report could not be verified and shares are higher.',
        sourceName: 'Example Blog',
        publishedAt: minutesAgo(5),
        severity: 'medium'
      }),
      price: {
        symbol: 'NVDA',
        session: 'regular',
        activeChangePercent: 1.2,
        provider: 'cnbc'
      }
    });

    expect(impact.truthRisk).toBe('high');
    expect(impact.verification.level).toBe('rumor');
    expect(impact.marketAlignment).toBe('diverging');
    expect(impact.confidence).toBeLessThan(60);
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
