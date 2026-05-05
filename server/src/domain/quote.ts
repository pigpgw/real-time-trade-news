export type QuoteSession = 'day' | 'pre' | 'regular' | 'post' | 'closed' | 'unknown';
export type QuoteProvider = 'cnbc' | 'yahoo-chart' | 'nasdaq' | 'tradingview' | 'robinhood';

export interface MarketQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  currency: string;
  provider: QuoteProvider;
  isRealtime: boolean;
  marketState: string;
  session: QuoteSession;
  activeSession?: QuoteSession;
  activePrice?: number;
  activeChange?: number;
  activeChangePercent?: number;
  activeTime?: string;
  activeInterpolated?: boolean;
  dayMarketPrice?: number;
  dayMarketChange?: number;
  dayMarketChangePercent?: number;
  dayMarketTime?: string;
  dayMarketVolume?: number;
  dayMarketInterpolated?: boolean;
  dayMarketSource?: string;
  regularPrice?: number;
  regularChange?: number;
  regularChangePercent?: number;
  regularTime?: string;
  extendedPrice?: number;
  extendedChange?: number;
  extendedChangePercent?: number;
  extendedTime?: string;
  extendedSession?: QuoteSession;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  preMarketTime?: string;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  postMarketTime?: string;
  previousClose?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  extendedVolume?: number;
  generatedAt: string;
  cacheTtlMs: number;
  nextSession?: QuoteSession;
  nextSessionTime?: string;
  message?: string;
}

export type QuoteChartRange = 'minute' | 'day' | 'week' | 'month' | 'year';

export interface QuoteCandle {
  time: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface QuoteChartResult {
  symbol: string;
  range: QuoteChartRange;
  provider: 'yahoo-chart';
  generatedAt: string;
  currency: string;
  previousClose?: number;
  candles: QuoteCandle[];
}
