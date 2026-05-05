import { describe, expect, it } from 'vitest';
import { expandQuery, matchesExpandedQuery } from '../server/src/domain/queryExpansion';

describe('query expansion', () => {
  it('expands Korean geopolitical terms into English monitoring terms', () => {
    const terms = expandQuery('이란 전쟁');

    expect(terms).toContain('Iran');
    expect(terms).toContain('war');
    expect(terms).toContain('Iran war');
    expect(matchesExpandedQuery('이란 전쟁', 'Oil prices rise as Israel Iran conflict escalates')).toBe(true);
    expect(matchesExpandedQuery('이란 전쟁', 'A generic war headline without the country')).toBe(false);
  });

  it('expands common stock tickers into company names', () => {
    expect(expandQuery('AAPL')).toEqual(expect.arrayContaining(['Apple', 'Apple Inc', 'iPhone']));
    expect(matchesExpandedQuery('NVDA', 'Nvidia shares rise after chip demand report')).toBe(true);
  });
});
