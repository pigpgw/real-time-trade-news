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

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expiresAt: number; result: RankingResult }>();

export async function getMarketRanking(market: RankingMarket, type: RankingType): Promise<RankingResult> {
  const cacheKey = `${market}:${type}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await fetchNaverRanking(market, type).catch(() => sampleRanking(market, type));
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
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

function sampleRanking(market: RankingMarket, type: RankingType): RankingResult {
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
