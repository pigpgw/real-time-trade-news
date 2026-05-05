import { describe, expect, it } from 'vitest';
import { applyRobinhoodDayMarket, parseCnbcQuotePayload } from '../server/src/services/quoteService';

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
    }, 'SOXL', new Date('2026-05-04T21:00:00.000Z'));

    expect(quote.session).toBe('post');
    expect(quote.activeSession).toBe('post');
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
    }, 'SOXL', new Date('2026-05-04T10:00:00.000Z'));

    expect(quote.session).toBe('pre');
    expect(quote.activeSession).toBe('pre');
    expect(quote.activePrice).toBe(129.10);
    expect(quote.preMarketPrice).toBe(129.10);
    expect(quote.preMarketChangePercent).toBe(-0.9969);
    expect(quote.postMarketPrice).toBeUndefined();
  });

  it('marks the Korean day market window separately from Nasdaq pre market', () => {
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
          curmktstatus: 'POST_MKT_PREV',
          ExtendedMktQuote: {
            type: 'POST_MKT_PREV',
            last: '126.3501',
            fullchange: '-4.0499',
            fullchange_pct: '-3.1058',
            last_time_msec: '1777939198721'
          }
        }]
      }
    }, 'SOXL', new Date('2026-05-05T06:35:00.000Z'));

    expect(quote.session).toBe('day');
    expect(quote.activeSession).toBe('post');
    expect(quote.activePrice).toBe(126.3501);
    expect(quote.preMarketPrice).toBeUndefined();
    expect(quote.postMarketPrice).toBe(126.3501);
    expect(quote.nextSession).toBe('pre');
    expect(quote.nextSessionTime).toBe('2026-05-05T08:00:00.000Z');
  });

  it('uses 24 hour chart price during the Korean day market when available', () => {
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
          curmktstatus: 'POST_MKT_PREV',
          ExtendedMktQuote: {
            type: 'POST_MKT_PREV',
            last: '126.3501',
            fullchange: '-4.0499',
            fullchange_pct: '-3.1058'
          }
        }]
      }
    }, 'SOXL', new Date('2026-05-05T06:35:00.000Z'));

    const enriched = applyRobinhoodDayMarket(quote, {
      previous_close_price: '127.55',
      previous_close_time: '2026-05-04T20:00:00Z',
      historicals: [{
        begins_at: '2026-05-05T06:35:00Z',
        close_price: '126.800000',
        volume: 0,
        session: 'pre',
        interpolated: true
      }]
    });

    expect(enriched.session).toBe('day');
    expect(enriched.activeSession).toBe('day');
    expect(enriched.activePrice).toBe(126.8);
    expect(enriched.dayMarketPrice).toBe(126.8);
    expect(enriched.activeInterpolated).toBe(true);
    expect(enriched.activeChange).toBeCloseTo(-0.75);
  });
});
