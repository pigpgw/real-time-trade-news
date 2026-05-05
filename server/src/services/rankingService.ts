import type { RankingItem, RankingMarket, RankingResult, RankingType } from '../domain/ranking';
import { fetchJson } from '../providers/http';

interface NaverStockListResponse {
  stocks?: NaverStockRow[];
}

interface NaverStockRow {
  itemCode?: string;
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  fluctuationsRatio?: string;
  accumulatedTradingVolume?: string;
  accumulatedTradingValueKrwHangeul?: string;
  accumulatedTradingValueRaw?: string;
  marketValueHangeul?: string;
  localTradedAt?: string;
  endUrl?: string;
}

interface NaverIntegrationResponse {
  dealTrendInfos?: Array<{
    foreignerPureBuyQuant?: string;
    foreignerHoldRatio?: string;
    organPureBuyQuant?: string;
    individualPureBuyQuant?: string;
  }>;
}

interface YahooScreenerResponse {
  finance?: {
    result?: Array<{
      quotes?: YahooQuote[];
    }>;
  };
}

interface YahooQuote {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  regularMarketTime?: number;
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expiresAt: number; result: RankingResult }>();

export async function getMarketRanking(market: RankingMarket, type: RankingType): Promise<RankingResult> {
  const cacheKey = `${market}:${type}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = market === 'US'
    ? await fetchYahooRanking(type).catch(() => sampleRanking(market, type))
    : await fetchNaverRanking(market, type).catch(() => sampleRanking(market, type));
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

async function fetchYahooRanking(type: RankingType): Promise<RankingResult> {
  const screenerId = yahooScreenerId(type);
  const payload = await fetchJson<YahooScreenerResponse>(
    `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?${new URLSearchParams({
      scrIds: screenerId,
      count: '30'
    }).toString()}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1'
      }
    },
    10_000
  );

  const quotes = payload.finance?.result?.[0]?.quotes ?? [];
  const items = quotes
    .map((quote) => fromYahooQuote(quote, type))
    .filter((item) => item.symbol && item.name)
    .sort((a, b) => {
      if (type === 'turnover' || type === 'foreign' || type === 'institution') {
        return parseUsdTurnover(b.turnover) - parseUsdTurnover(a.turnover);
      }
      return Math.abs(Number.parseFloat(b.changeRate ?? '0')) - Math.abs(Number.parseFloat(a.changeRate ?? '0'));
    });

  return {
    generatedAt: new Date().toISOString(),
    source: 'yahoo-finance',
    market: 'US',
    type,
    cacheTtlMs: CACHE_TTL_MS,
    providerMessage: type === 'foreign' || type === 'institution'
      ? 'Yahoo Finance 공개 screener 기준. 미국 무료 공개 데이터에서는 외국인/기관 순매수 수급을 직접 제공하지 않아 거래대금 상위로 대체'
      : 'Yahoo Finance 공개 screener 기준, 60초 캐시',
    items: items.slice(0, 12)
  };
}

async function fetchNaverRanking(market: RankingMarket, type: RankingType): Promise<RankingResult> {
  const sortType = naverSortType(type);
  const pageSize = type === 'foreign' || type === 'institution' ? 16 : 20;
  const payload = await fetchJson<NaverStockListResponse>(
    `https://m.stock.naver.com/api/stocks/${sortType}/${market}?${new URLSearchParams({
      page: '1',
      pageSize: String(pageSize)
    }).toString()}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1'
      }
    },
    10_000
  );

  const baseItems = (payload.stocks ?? []).map((row) => fromNaverStockRow(row, type));
  const items = type === 'foreign' || type === 'institution'
    ? await attachFlowAndSort(baseItems, type)
    : await attachFlow(baseItems);

  return {
    generatedAt: new Date().toISOString(),
    source: 'naver-mobile',
    market,
    type,
    cacheTtlMs: CACHE_TTL_MS,
    providerMessage: 'Naver 모바일 증권 공개 JSON 기준, 60초 캐시',
    items: items.slice(0, 12)
  };
}

function naverSortType(type: RankingType): string {
  if (type === 'gainers') return 'up';
  if (type === 'losers') return 'down';
  return 'priceTop';
}

function yahooScreenerId(type: RankingType): string {
  if (type === 'gainers') return 'day_gainers';
  if (type === 'losers') return 'day_losers';
  return 'most_actives';
}

function fromYahooQuote(quote: YahooQuote, type: RankingType): RankingItem {
  const price = quote.regularMarketPrice ?? 0;
  const volume = quote.regularMarketVolume ?? 0;
  const turnover = price * volume;
  return {
    symbol: quote.symbol ?? '',
    name: quote.shortName ?? quote.longName ?? quote.symbol ?? '',
    price: price ? price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : undefined,
    change: quote.regularMarketChange?.toFixed(2),
    changeRate: quote.regularMarketChangePercent?.toFixed(2),
    volume: volume ? volume.toLocaleString('en-US') : undefined,
    turnover: String(Math.round(turnover)),
    turnoverText: turnover ? formatUsdAmount(turnover) : undefined,
    marketCap: quote.marketCap ? formatUsdAmount(quote.marketCap) : undefined,
    tradedAt: quote.regularMarketTime ? new Date(quote.regularMarketTime * 1000).toISOString() : undefined,
    reason: type === 'turnover' || type === 'foreign' || type === 'institution'
      ? formatUsdAmount(turnover)
      : `${quote.regularMarketChangePercent?.toFixed(2) ?? '-'}%`
  };
}

async function attachFlowAndSort(items: RankingItem[], type: RankingType): Promise<RankingItem[]> {
  return (await attachFlow(items))
    .sort((a, b) => parseFlowValue(type === 'foreign' ? b.foreignPureBuy : b.institutionPureBuy)
      - parseFlowValue(type === 'foreign' ? a.foreignPureBuy : a.institutionPureBuy));
}

async function attachFlow(items: RankingItem[]): Promise<RankingItem[]> {
  const settled = await Promise.allSettled(
    items.slice(0, 12).map(async (item) => {
      const flow = await fetchIntegrationFlow(item.symbol);
      return { ...item, ...flow };
    })
  );

  const bySymbol = new Map(
    settled.flatMap((result) => (result.status === 'fulfilled' ? [[result.value.symbol, result.value]] : []))
  );

  return items.map((item) => bySymbol.get(item.symbol) ?? item);
}

async function fetchIntegrationFlow(symbol: string): Promise<Partial<RankingItem>> {
  const payload = await fetchJson<NaverIntegrationResponse>(
    `https://m.stock.naver.com/api/stock/${symbol}/integration`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1'
      }
    },
    8_000
  );
  const latest = payload.dealTrendInfos?.[0];
  return {
    foreignPureBuy: latest?.foreignerPureBuyQuant,
    institutionPureBuy: latest?.organPureBuyQuant,
    individualPureBuy: latest?.individualPureBuyQuant,
    foreignHoldRatio: latest?.foreignerHoldRatio
  };
}

function fromNaverStockRow(row: NaverStockRow, type: RankingType): RankingItem {
  const item: RankingItem = {
    symbol: row.itemCode ?? '',
    name: row.stockName ?? '',
    price: row.closePrice,
    change: row.compareToPreviousClosePrice,
    changeRate: row.fluctuationsRatio,
    volume: row.accumulatedTradingVolume,
    turnover: row.accumulatedTradingValueRaw,
    turnoverText: row.accumulatedTradingValueKrwHangeul,
    marketCap: row.marketValueHangeul,
    tradedAt: row.localTradedAt,
    endUrl: row.endUrl,
    reason: type === 'turnover'
      ? row.accumulatedTradingValueKrwHangeul ?? '거래대금 상위'
      : `${row.fluctuationsRatio ?? '-'}%`
  };
  return item;
}

function parseFlowValue(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  return Number(value.replace(/[,+]/g, '')) || Number.NEGATIVE_INFINITY;
}

function parseUsdTurnover(value?: string): number {
  if (!value) return 0;
  return Number(value) || 0;
}

function formatUsdAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function sampleRanking(market: RankingMarket, type: RankingType): RankingResult {
  if (market === 'US') {
    return {
      generatedAt: new Date().toISOString(),
      source: 'sample',
      market,
      type,
      cacheTtlMs: CACHE_TTL_MS,
      providerMessage: '미국 순위 공급자 응답 실패. 샘플 표시 중',
      items: [
        {
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          price: '0',
          changeRate: '+0.00',
          volume: '-',
          turnover: '0',
          turnoverText: '-',
          reason: '샘플'
        },
        {
          symbol: 'TSLA',
          name: 'Tesla, Inc.',
          price: '0',
          changeRate: '+0.00',
          volume: '-',
          turnover: '0',
          turnoverText: '-',
          reason: '샘플'
        }
      ]
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'sample',
    market,
    type,
    cacheTtlMs: CACHE_TTL_MS,
    providerMessage: '순위 공급자 응답 실패. 샘플 표시 중',
    items: [
      {
        symbol: '005930',
        name: '삼성전자',
        price: '232,500',
        changeRate: '+5.44',
        turnoverText: '7조 3,024억원',
        foreignPureBuy: '+5,214,979',
        institutionPureBuy: '+4,335,045',
        individualPureBuy: '-9,497,468',
        reason: '샘플'
      },
      {
        symbol: '000660',
        name: 'SK하이닉스',
        price: '1,447,000',
        changeRate: '+12.52',
        turnoverText: '7조 9,207억원',
        reason: '샘플'
      }
    ]
  };
}
