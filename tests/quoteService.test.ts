import { describe, expect, it } from 'vitest';
import { parseCnbcQuotePayload } from '../server/src/services/quoteService';

describe('quote service', () => {
  it('uses extended market quote as active price during post market', () => {
    const quote = parseCnbcQuotePayload({
      QuickQuoteResult: {
        QuickQuote: [{
          symbol: 'SOXL',
          name: 'Direxion Daily Semiconductor Bull 3X Shares',
          exchange: 'NYSE Arca',
          currencyCode: 'USD',
          last: '127.55',
          change: '-2.85',
          change_pct: '-2.1856',
          fullVolume: '46455721',
          realTime: 'true',
          curmktstatus: 'POST_MKT',
          ExtendedMktQuote: {
            type: 'POST_MKT',
            last: '126.3501',
            change: '-1.1999',
            change_pct: '-0.9407',
            fullchange: '-4.0499',
            fullchange_pct: '-3.1058',
            volume: '983795'
          }
        }]
      }
    }, 'SOXL');

    expect(quote.session).toBe('post');
    expect(quote.activePrice).toBe(126.3501);
    expect(quote.activeChange).toBe(-4.0499);
    expect(quote.activeChangePercent).toBe(-3.1058);
    expect(quote.regularPrice).toBe(127.55);
    expect(quote.postMarketPrice).toBe(126.3501);
    expect(quote.postMarketChangePercent).toBe(-3.1058);
    expect(quote.preMarketPrice).toBeUndefined();
    expect(quote.extendedVolume).toBe(983795);
  });

  it('separates pre market quote from after market quote', () => {
    const quote = parseCnbcQuotePayload({
      QuickQuoteResult: {
        QuickQuote: [{
          symbol: 'SOXL',
          name: 'Direxion Daily Semiconductor Bull 3X Shares',
          exchange: 'NYSE Arca',
          currencyCode: 'USD',
          last: '127.55',
          change: '-2.85',
          change_pct: '-2.1856',
          realTime: 'true',
          curmktstatus: 'PRE_MKT',
          ExtendedMktQuote: {
            type: 'PRE_MKT',
            last: '129.10',
            change: '1.55',
            change_pct: '1.2152',
            fullchange: '-1.30',
            fullchange_pct: '-0.9969',
            volume: '320000'
          }
        }]
      }
    }, 'SOXL');

    expect(quote.session).toBe('pre');
    expect(quote.activePrice).toBe(129.10);
    expect(quote.preMarketPrice).toBe(129.10);
    expect(quote.preMarketChangePercent).toBe(-0.9969);
    expect(quote.postMarketPrice).toBeUndefined();
  });
});
