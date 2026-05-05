import { describe, expect, it } from 'vitest';
import { compactQuery, dedupeNews, isRecent, parseGdeltDate, scoreNews, stripHtml } from '../server/src/domain/newsUtils';
import type { NewsItem } from '../server/src/domain/news';

describe('news utilities', () => {
  it('scores high-impact market news', () => {
    expect(scoreNews('AAPL shares plunge after China sanction report').severity).toBe('high');
    expect(scoreNews('삼성전자 실적 전망 상향').severity).toBe('high');
    expect(scoreNews('NVIDIA opens new developer event').severity).toBe('low');
  });

  it('normalizes provider markup', () => {
    expect(stripHtml('<b>삼성전자</b> &amp; 엔비디아')).toBe('삼성전자 & 엔비디아');
  });

  it('normalizes known ticker casing without uppercasing normal words', () => {
    expect(compactQuery('soxl iran missile')).toBe('SOXL iran missile');
  });

  it('parses GDELT timestamps', () => {
    expect(parseGdeltDate('20260505T012233Z')).toBe('2026-05-05T01:22:33.000Z');
  });

  it('deduplicates by URL and keeps newest ordering', () => {
    const first = item('1', 'https://example.com/a?utm=1', 'Tesla recall expands', '2026-05-05T01:00:00Z');
    const duplicate = item('2', 'https://example.com/a?utm=2', 'Tesla recall expands', '2026-05-05T02:00:00Z');
    const other = item('3', 'https://example.com/b', 'Apple earnings preview', '2026-05-05T03:00:00Z');

    const result = dedupeNews([first, duplicate, other]);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Apple earnings preview');
  });

  it('checks lookback window', () => {
    expect(isRecent(new Date().toISOString(), 1)).toBe(true);
    expect(isRecent('2020-01-01T00:00:00.000Z', 1)).toBe(false);
  });
});

function item(id: string, url: string, title: string, publishedAt: string): NewsItem {
  return {
    id,
    query: 'test',
    provider: 'gdelt',
    title,
    url,
    sourceName: 'Example',
    publishedAt,
    severity: 'low',
    matchedKeywords: []
  };
}
