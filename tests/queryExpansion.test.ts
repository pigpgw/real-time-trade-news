import { describe, expect, it } from 'vitest';
import { expandQuery, matchesExpandedQuery, newsSearchTerms } from '../server/src/domain/queryExpansion';

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

  it('expands leveraged semiconductor ETFs into sector and component terms', () => {
    expect(expandQuery('soxl')).toEqual(expect.arrayContaining(['semiconductor', 'Nvidia', 'AMD', 'TSMC']));
    expect(matchesExpandedQuery('SOXL', 'Nvidia and AMD chip stocks move before the open')).toBe(true);
    expect(matchesExpandedQuery('SOXL', 'US stock futures slip after Iran missile attack')).toBe(true);
  });

  it('prioritizes liquid ETF proxy terms for live news search', () => {
    expect(newsSearchTerms('soxl').slice(0, 5)).toEqual([
      'SOXL',
      'semiconductor stocks',
      'Nasdaq futures',
      'stock futures',
      'semiconductor',
    ]);
  });

  it('does not let generic market words block urgent geopolitical matches', () => {
    expect(matchesExpandedQuery('Iran missile stocks', 'Iran fires missiles near the Strait of Hormuz')).toBe(true);
    expect(matchesExpandedQuery('Iran missile stocks', 'A generic stocks update with no geopolitical catalyst')).toBe(false);
  });
});
