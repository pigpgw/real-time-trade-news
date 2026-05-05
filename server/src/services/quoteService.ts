import type { MarketQuote, QuoteSession } from '../domain/quote';
import { fetchJson } from '../providers/http';

interface CnbcQuoteResponse {
  QuickQuoteResult?: {
    QuickQuote?: CnbcQuote[] | CnbcQuote;
  };
}

interface CnbcQuote {
  symbol?: string;
  name?: string;
  shortName?: string;
  exchange?: string;
  currencyCode?: string;
  last?: string;
  change?: string;
  change_pct?: string;
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
  fullVolume?: string;
  reg_last_time?: string;
  last_time_msec?: string;
  source?: string;
  realTime?: string;
  curmktstatus?: string;
  mainmktstatus?: string;
  previous_day_closing?: string;
  todays_closing?: string;
  prev_prev_closing?: string;
  ExtendedMktQuote?: {
    type?: string;
    last?: string;
    change?: string;
    change_pct?: string;
    volume?: string;
    fullchange?: string;
    fullchange_pct?: string;
    last_time_msec?: string;
    afthrs_last_time?: string;
    source?: string;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        marketState?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

interface NasdaqQuoteResponse {
  data?: {
    symbol?: string;
    companyName?: string;
    exchange?: string;
    marketStatus?: string;
    primaryData?: {
      lastSalePrice?: string;
      netChange?: string;
      percentageChange?: string;
      lastTradeTimestamp?: string;
      isRealTime?: boolean;
      volume?: string;
    };
    secondaryData?: {
      lastSalePrice?: string;
      netChange?: string;
      percentageChange?: string;
      lastTradeTimestamp?: string;
    } | null;
  };
}

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, { expiresAt: number; quote: MarketQuote }>();
const inFlight = new Map<string, Promise<MarketQuote>>();
const headers = {
  Accept: 'application/json,text/plain,*/*',
  'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1'
};

export async function getMarketQuote(symbol: string): Promise<MarketQuote> {
  const normalized = normalizeSymbol(symbol);
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const pending = inFlight.get(normalized);
  if (pending) return pending;

  const request = fetchCnbcQuote(normalized)
    .catch(() => fetchYahooChartQuote(normalized))
    .catch(() => fetchNasdaqQuote(normalized))
    .then((quote) => {
      cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, quote });
      return quote;
    })
    .finally(() => {
      inFlight.delete(normalized);
    });

  inFlight.set(normalized, request);
  return request;
}

export function parseCnbcQuotePayload(payload: CnbcQuoteResponse, symbol: string, now = new Date()): MarketQuote {
  const quote = firstQuote(payload.QuickQuoteResult?.QuickQuote);
  if (!quote) throw new Error('CNBC quote not found');

  const regularPrice = toNumber(quote.last);
  const regularChange = toNumber(quote.change);
  const regularChangePercent = toNumber(quote.change_pct);
  const previousClose = regularPrice !== undefined && regularChange !== undefined
    ? regularPrice - regularChange
    : toNumber(quote.todays_closing ?? quote.prev_prev_closing ?? quote.previous_day_closing);
  const extended = quote.ExtendedMktQuote;
  const marketState = extended?.type ?? quote.curmktstatus ?? quote.mainmktstatus ?? 'UNKNOWN';
  const reportedSession = cnbcSession(marketState);
  const clock = usEquitySession(now);
  const session = clock.session;
  const extendedPrice = toNumber(extended?.last);
  const extendedChange = toNumber(extended?.change);
  const extendedChangePercent = toNumber(extended?.change_pct);
  const extendedFullChange = toNumber(extended?.fullchange);
  const extendedFullChangePercent = toNumber(extended?.fullchange_pct);
  const extendedTime = parseMillis(extended?.last_time_msec ?? quote.last_time_msec) ?? parseDate(extended?.afthrs_last_time);
  const extendedSession = reportedSession === 'pre' || reportedSession === 'post' ? reportedSession : undefined;
  const preMarketPrice = extendedSession === 'pre' ? extendedPrice : undefined;
  const preMarketChange = extendedSession === 'pre' ? extendedFullChange ?? extendedChange : undefined;
  const preMarketChangePercent = extendedSession === 'pre' ? extendedFullChangePercent ?? extendedChangePercent : undefined;
  const preMarketTime = extendedSession === 'pre' ? extendedTime : undefined;
  const postMarketPrice = extendedSession === 'post' ? extendedPrice : undefined;
  const postMarketChange = extendedSession === 'post' ? extendedFullChange ?? extendedChange : undefined;
  const postMarketChangePercent = extendedSession === 'post' ? extendedFullChangePercent ?? extendedChangePercent : undefined;
  const postMarketTime = extendedSession === 'post' ? extendedTime : undefined;
  const useExtended = extendedSession !== undefined && extendedPrice !== undefined;
  const activeSession = useExtended ? extendedSession : 'regular';
  const activePrice = useExtended ? extendedPrice : regularPrice;
  const activeChange = useExtended
    ? extendedFullChange ?? computeChange(extendedPrice, previousClose)
    : regularChange;
  const activeChangePercent = useExtended
    ? extendedFullChangePercent ?? computeChangePercent(activeChange, previousClose)
    : regularChangePercent;

  return {
    symbol: quote.symbol ?? symbol,
    name: quote.name ?? quote.shortName,
    exchange: quote.exchange,
    currency: quote.currencyCode ?? 'USD',
    provider: 'cnbc',
    isRealtime: quote.realTime === 'true',
    marketState,
    session,
    activeSession,
    activePrice,
    activeChange,
    activeChangePercent,
    activeTime: useExtended ? extendedTime : parseDate(quote.reg_last_time),
    regularPrice,
    regularChange,
    regularChangePercent,
    regularTime: parseDate(quote.reg_last_time),
    extendedPrice,
    extendedChange,
    extendedChangePercent,
    extendedTime,
    extendedSession,
    preMarketPrice,
    preMarketChange,
    preMarketChangePercent,
    preMarketTime,
    postMarketPrice,
    postMarketChange,
    postMarketChangePercent,
    postMarketTime,
    previousClose,
    open: toNumber(quote.open),
    high: toNumber(quote.high),
    low: toNumber(quote.low),
    volume: toNumber(quote.fullVolume ?? quote.volume),
    extendedVolume: toNumber(extended?.volume),
    generatedAt: now.toISOString(),
    cacheTtlMs: CACHE_TTL_MS,
    nextSession: clock.nextSession,
    nextSessionTime: clock.nextSessionTime,
    message: extended?.source ?? quote.source
  };
}

async function fetchCnbcQuote(symbol: string): Promise<MarketQuote> {
  const payload = await fetchJson<CnbcQuoteResponse>(
    `https://quote.cnbc.com/quote-html-webservice/quote.htm?${new URLSearchParams({
      symbols: symbol,
      requestMethod: 'quick',
      noform: '1',
      output: 'json',
      exthrs: '1'
    }).toString()}`,
    { headers },
    8_000
  );
  return parseCnbcQuotePayload(payload, symbol);
}

async function fetchYahooChartQuote(symbol: string): Promise<MarketQuote> {
  const now = new Date();
  const payload = await fetchJson<YahooChartResponse>(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${new URLSearchParams({
      interval: '1m',
      range: '1d',
      includePrePost: 'true'
    }).toString()}`,
    { headers },
    8_000
  );
  const result = payload.chart?.result?.[0];
  if (!result?.meta) throw new Error(payload.chart?.error?.description ?? 'Yahoo chart quote not found');

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const last = lastNumber(quote?.close);
  const previousClose = result.meta.chartPreviousClose ?? result.meta.previousClose;
  const activePrice = last ?? result.meta.regularMarketPrice;
  const activeChange = computeChange(activePrice, previousClose);
  const activeChangePercent = computeChangePercent(activeChange, previousClose);
  const clock = usEquitySession(now);
  const reportedSession = yahooSession(result.meta.marketState);
  const session = clock.session;
  const extendedPrice = activePrice !== result.meta.regularMarketPrice ? activePrice : undefined;
  const extendedTime = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1] * 1000).toISOString() : undefined;
  const extendedSession = reportedSession === 'pre' || reportedSession === 'post'
    ? reportedSession
    : session === 'pre' || session === 'post'
      ? session
      : undefined;
  const activeSession = extendedPrice !== undefined ? extendedSession : 'regular';
  const preMarketPrice = extendedSession === 'pre' ? extendedPrice : undefined;
  const preMarketTime = extendedSession === 'pre' ? extendedTime : undefined;
  const postMarketPrice = extendedSession === 'post' ? extendedPrice : undefined;
  const postMarketTime = extendedSession === 'post' ? extendedTime : undefined;

  return {
    symbol: result.meta.symbol ?? symbol,
    name: result.meta.shortName ?? result.meta.longName,
    exchange: result.meta.fullExchangeName ?? result.meta.exchangeName,
    currency: result.meta.currency ?? 'USD',
    provider: 'yahoo-chart',
    isRealtime: false,
    marketState: result.meta.marketState ?? 'UNKNOWN',
    session,
    activeSession,
    activePrice,
    activeChange,
    activeChangePercent,
    activeTime: extendedPrice !== undefined ? extendedTime : result.meta.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : undefined,
    regularPrice: result.meta.regularMarketPrice,
    regularTime: result.meta.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : undefined,
    extendedPrice,
    extendedChange: extendedSession !== undefined ? activeChange : undefined,
    extendedChangePercent: extendedSession !== undefined ? activeChangePercent : undefined,
    extendedTime,
    extendedSession,
    preMarketPrice,
    preMarketChange: session === 'pre' ? activeChange : undefined,
    preMarketChangePercent: session === 'pre' ? activeChangePercent : undefined,
    preMarketTime,
    postMarketPrice,
    postMarketChange: session === 'post' ? activeChange : undefined,
    postMarketChangePercent: session === 'post' ? activeChangePercent : undefined,
    postMarketTime,
    previousClose,
    volume: lastNumber(quote?.volume),
    generatedAt: now.toISOString(),
    cacheTtlMs: CACHE_TTL_MS,
    nextSession: clock.nextSession,
    nextSessionTime: clock.nextSessionTime,
    message: 'Yahoo Finance chart, includePrePost=true'
  };
}

async function fetchNasdaqQuote(symbol: string): Promise<MarketQuote> {
  const now = new Date();
  const payload = await fetchJson<NasdaqQuoteResponse>(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=etf`,
    { headers },
    8_000
  );
  const data = payload.data;
  const primary = data?.primaryData;
  if (!data || !primary) throw new Error('Nasdaq quote not found');

  const regularPrice = toNumber(primary.lastSalePrice);
  const regularChange = toNumber(primary.netChange);
  const regularChangePercent = toNumber(primary.percentageChange);
  const secondaryPrice = toNumber(data.secondaryData?.lastSalePrice);
  const secondaryChange = toNumber(data.secondaryData?.netChange);
  const secondaryChangePercent = toNumber(data.secondaryData?.percentageChange);
  const secondaryTime = parseDate(data.secondaryData?.lastTradeTimestamp);
  const clock = usEquitySession(now);
  const reportedSession = data.marketStatus?.toLowerCase().includes('pre')
    ? 'pre'
    : data.marketStatus?.toLowerCase().includes('after')
      ? 'post'
      : data.marketStatus?.toLowerCase().includes('open')
        ? 'regular'
        : 'closed';
  const session = clock.session;
  const extendedSession = reportedSession === 'pre' || reportedSession === 'post' ? reportedSession : undefined;

  return {
    symbol: data.symbol ?? symbol,
    name: data.companyName,
    exchange: data.exchange,
    currency: 'USD',
    provider: 'nasdaq',
    isRealtime: Boolean(primary.isRealTime),
    marketState: data.marketStatus ?? 'UNKNOWN',
    session,
    activeSession: secondaryPrice !== undefined ? extendedSession : 'regular',
    activePrice: secondaryPrice ?? regularPrice,
    activeChange: secondaryPrice !== undefined ? secondaryChange : regularChange,
    activeChangePercent: secondaryPrice !== undefined ? secondaryChangePercent : regularChangePercent,
    activeTime: secondaryPrice !== undefined ? secondaryTime : parseDate(primary.lastTradeTimestamp),
    regularPrice,
    regularChange,
    regularChangePercent,
    regularTime: parseDate(primary.lastTradeTimestamp),
    extendedPrice: secondaryPrice,
    extendedChange: secondaryChange,
    extendedChangePercent: secondaryChangePercent,
    extendedTime: secondaryTime,
    extendedSession,
    preMarketPrice: extendedSession === 'pre' ? secondaryPrice : undefined,
    preMarketChange: extendedSession === 'pre' ? secondaryChange : undefined,
    preMarketChangePercent: extendedSession === 'pre' ? secondaryChangePercent : undefined,
    preMarketTime: extendedSession === 'pre' ? secondaryTime : undefined,
    postMarketPrice: extendedSession === 'post' ? secondaryPrice : undefined,
    postMarketChange: extendedSession === 'post' ? secondaryChange : undefined,
    postMarketChangePercent: extendedSession === 'post' ? secondaryChangePercent : undefined,
    postMarketTime: extendedSession === 'post' ? secondaryTime : undefined,
    volume: toNumber(primary.volume),
    generatedAt: now.toISOString(),
    cacheTtlMs: CACHE_TTL_MS,
    nextSession: clock.nextSession,
    nextSessionTime: clock.nextSessionTime,
    message: 'Nasdaq public quote'
  };
}

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.=-]{1,12}$/.test(normalized)) throw new Error('invalid quote symbol');
  return normalized;
}

function firstQuote(value: CnbcQuote[] | CnbcQuote | undefined): CnbcQuote | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function cnbcSession(value?: string): QuoteSession {
  const normalized = value?.toUpperCase() ?? '';
  if (normalized.includes('POST') || normalized.includes('AFTER')) return 'post';
  if (normalized.includes('PRE_MKT') || normalized.includes('PREMARKET')) return 'pre';
  if (normalized.includes('OPEN') || normalized.includes('REG')) return 'regular';
  if (normalized.includes('CLOSE')) return 'closed';
  return 'unknown';
}

function yahooSession(value?: string): QuoteSession {
  const normalized = value?.toUpperCase() ?? '';
  if (normalized.includes('PRE')) return 'pre';
  if (normalized.includes('POST')) return 'post';
  if (normalized.includes('REGULAR')) return 'regular';
  if (normalized.includes('CLOSED')) return 'closed';
  return 'unknown';
}

function toNumber(value?: string | number | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number.parseFloat(value.replace(/[$,%+\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function lastNumber(values?: Array<number | null>): number | undefined {
  if (!values) return undefined;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function computeChange(price?: number, previousClose?: number): number | undefined {
  if (price === undefined || previousClose === undefined) return undefined;
  return price - previousClose;
}

function computeChangePercent(change?: number, previousClose?: number): number | undefined {
  if (change === undefined || previousClose === undefined || previousClose === 0) return undefined;
  return (change / previousClose) * 100;
}

function parseMillis(value?: string): string | undefined {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

interface UsEquityClock {
  session: QuoteSession;
  nextSession?: QuoteSession;
  nextSessionTime?: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

const NY_TIME_ZONE = 'America/New_York';
const PRE_MARKET_OPEN = 4 * 60;
const REGULAR_OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;
const POST_MARKET_CLOSE = 20 * 60;

function usEquitySession(now: Date): UsEquityClock {
  const parts = zonedParts(now, NY_TIME_ZONE);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const weekday = weekdayIndex(parts.weekday);
  const isTradingWeekday = weekday >= 1 && weekday <= 5;

  if (isTradingWeekday && minuteOfDay >= PRE_MARKET_OPEN && minuteOfDay < REGULAR_OPEN) {
    return {
      session: 'pre',
      nextSession: 'regular',
      nextSessionTime: zonedDateTimeToUtc(parts.year, parts.month, parts.day, 9, 30, NY_TIME_ZONE)
    };
  }

  if (isTradingWeekday && minuteOfDay >= REGULAR_OPEN && minuteOfDay < REGULAR_CLOSE) {
    return {
      session: 'regular',
      nextSession: 'post',
      nextSessionTime: zonedDateTimeToUtc(parts.year, parts.month, parts.day, 16, 0, NY_TIME_ZONE)
    };
  }

  if (isTradingWeekday && minuteOfDay >= REGULAR_CLOSE && minuteOfDay < POST_MARKET_CLOSE) {
    return {
      session: 'post',
      nextSession: 'pre',
      nextSessionTime: nextTradingDayStart(parts, weekday)
    };
  }

  return {
    session: 'closed',
    nextSession: 'pre',
    nextSessionTime: minuteOfDay < PRE_MARKET_OPEN && isTradingWeekday
      ? zonedDateTimeToUtc(parts.year, parts.month, parts.day, 4, 0, NY_TIME_ZONE)
      : nextTradingDayStart(parts, weekday)
  };
}

function nextTradingDayStart(parts: ZonedParts, weekday: number): string {
  const currentUtcDay = Date.UTC(parts.year, parts.month - 1, parts.day);
  const daysToAdd = weekday >= 1 && weekday < 5
    ? 1
    : weekday === 5
      ? 3
      : weekday === 6
        ? 2
        : 1;
  const next = new Date(currentUtcDay + daysToAdd * 24 * 60 * 60 * 1000);
  return zonedDateTimeToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    4,
    0,
    NY_TIME_ZONE
  );
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: values.weekday
  };
}

function weekdayIndex(value: string): number {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedParts(utc, timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
    const delta = target - actualAsUtc;
    if (delta === 0) break;
    utc = new Date(utc.getTime() + delta);
  }

  return utc.toISOString();
}
