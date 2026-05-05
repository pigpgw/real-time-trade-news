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
    expect(quote.extendedVolume).toBe(983795);
  });
});
