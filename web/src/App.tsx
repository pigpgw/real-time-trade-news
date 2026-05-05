import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  Newspaper,
  Radio,
  RefreshCw,
  Search,
  TrendingDown,
  Zap,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type NewsProviderId = 'direct-rss' | 'source-search' | 'gdelt' | 'google-news' | 'naver' | 'newsapi' | 'sec';
type NewsSeverity = 'low' | 'medium' | 'high';
type FeedFilter = 'all' | 'high' | 'market' | NewsProviderId;
type ConnectionState = 'idle' | 'connecting' | 'live' | 'error';
type EarningsReportTime = 'BMO' | 'AMC' | 'TAS' | 'UNKNOWN';
type EarningsStatus = 'upcoming' | 'reported';
type EarningsSource = 'finnhub' | 'alpha-vantage' | 'sample';
type RankingType = 'turnover' | 'gainers' | 'losers' | 'foreign' | 'institution';
type RankingMarket = 'KOSPI' | 'KOSDAQ' | 'US';
type DisplayLanguage = 'ko' | 'en' | 'original';
type NewsImpactLevel = 'critical' | 'high' | 'medium' | 'low';
type NewsDeliveryMode = 'breaking' | 'priority' | 'watch' | 'normal';
type QuoteSession = 'day' | 'pre' | 'regular' | 'post' | 'closed' | 'unknown';
type QuoteProvider = 'cnbc' | 'yahoo-chart' | 'nasdaq' | 'tradingview' | 'robinhood';
type ChartRange = 'minute' | 'day' | 'week' | 'month' | 'year';
type NewsDirection = 'bullish' | 'bearish' | 'mixed' | 'neutral';
type PositionBias = 'long' | 'inverse' | 'unknown';
type PositionEffect = 'favorable' | 'unfavorable' | 'mixed' | 'neutral';
type TruthRisk = 'low' | 'medium' | 'high';
type PriceReactionDirection = 'up' | 'down' | 'flat' | 'unknown';
type MarketAlignment = 'confirming' | 'diverging' | 'neutral' | 'unknown';

interface NewsImpactFactor {
  id: string;
  label: string;
  score: number;
  reason: string;
}

interface NewsImpact {
  score: number;
  level: NewsImpactLevel;
  label: string;
  deliveryMode: NewsDeliveryMode;
  confidence: number;
  summary: string;
  direction: NewsDirection;
  directionLabel: string;
  positionBias: PositionBias;
  positionEffect: PositionEffect;
  positionLabel: string;
  actionHint: string;
  verification: {
    level: 'confirmed' | 'corroborated' | 'single-source' | 'rumor' | 'disputed';
    label: string;
    confidence: number;
    truthRisk: TruthRisk;
    reason: string;
    corroboratingReports: number;
  };
  truthRisk: TruthRisk;
  priceReaction: {
    direction: PriceReactionDirection;
    changePercent?: number;
    session?: string;
    aligned: boolean;
    label: string;
    reason: string;
  };
  marketAlignment: MarketAlignment;
  affectedChannels: string[];
  factors: NewsImpactFactor[];
}

interface NewsItem {
  id: string;
  query: string;
  provider: NewsProviderId;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  snippet?: string;
  language?: string;
  country?: string;
  severity: NewsSeverity;
  matchedKeywords: string[];
  impact?: NewsImpact;
}

interface ProviderStatus {
  id: NewsProviderId;
  label: string;
  enabled: boolean;
  status: 'idle' | 'ok' | 'disabled' | 'error';
  message?: string;
}

interface NewsSearchResult {
  query: string;
  generatedAt: string;
  items: NewsItem[];
  statuses: ProviderStatus[];
  pollIntervalMs?: number;
  nextCheckAt?: string;
}

interface HeartbeatEvent {
  now: string;
  pollIntervalMs?: number;
  nextCheckAt?: string;
}

interface ArticleDetail {
  url: string;
  sourceName?: string;
  title: string;
  titleKo: string;
  titleTranslated: string;
  excerpt: string;
  excerptKo: string;
  excerptTranslated: string;
  language: string;
  targetLanguage: DisplayLanguage;
  translated: boolean;
  impact?: NewsImpact;
  fetchedAt: string;
  message?: string;
}

interface NewsTranslation {
  id: string;
  title: string;
  snippet?: string;
  translated: boolean;
  sourceLanguage: 'ko' | 'en';
  targetLanguage: DisplayLanguage;
}

interface NewsTranslationResult {
  generatedAt: string;
  targetLanguage: DisplayLanguage;
  items: NewsTranslation[];
}

interface EarningsEvent {
  id: string;
  symbol: string;
  companyName: string;
  reportDate: string;
  reportTime: EarningsReportTime;
  koreaTime?: string;
  isEstimatedTime: boolean;
  status: EarningsStatus;
  quarter?: string;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  summary: string;
  source: EarningsSource;
}

interface EarningsCalendarResult {
  generatedAt: string;
  timezone: 'Asia/Seoul';
  source: EarningsSource;
  items: EarningsEvent[];
  providerMessage: string;
  cacheTtlMs: number;
}

interface RankingItem {
  symbol: string;
  name: string;
  price?: string;
  change?: string;
  changeRate?: string;
  volume?: string;
  turnover?: string;
  turnoverText?: string;
  marketCap?: string;
  tradedAt?: string;
  endUrl?: string;
  foreignPureBuy?: string;
  institutionPureBuy?: string;
  individualPureBuy?: string;
  foreignHoldRatio?: string;
  reason: string;
}

interface RankingResult {
  generatedAt: string;
  source: 'naver-mobile' | 'yahoo-finance' | 'sample';
  market: RankingMarket;
  type: RankingType;
  cacheTtlMs: number;
  providerMessage: string;
  items: RankingItem[];
}

interface MarketQuote {
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

interface QuoteCandle {
  time: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

interface QuoteChartResult {
  symbol: string;
  range: ChartRange;
  provider: 'yahoo-chart';
  generatedAt: string;
  currency: string;
  previousClose?: number;
  candles: QuoteCandle[];
}

const examples = ['SOXL', 'TQQQ', 'Iran missile stocks', 'Strait of Hormuz oil', 'NVDA'];
const scoutQueries = ['Nasdaq futures missile', 'Iran Israel attack oil', 'NVDA earnings', 'semiconductor sanctions'];
const providerLabels: Record<NewsProviderId, string> = {
  'direct-rss': 'Direct',
  'source-search': 'Source',
  gdelt: 'GDELT',
  'google-news': 'Google',
  naver: 'Naver',
  newsapi: 'NewsAPI',
  sec: 'SEC'
};

const chartRanges: Array<{ value: ChartRange; label: string }> = [
  { value: 'minute', label: '분간' },
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
  { value: 'year', label: '연간' }
];

export function App() {
  const queryClient = useQueryClient();
  const initialQuery = getInitialQuery();
  const initialLanguage = getInitialLanguage();
  const [input, setInput] = useState(initialQuery);
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguage>(initialLanguage);
  const [activeQuery, setActiveQuery] = useState('');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>();
  const [nextCheckAt, setNextCheckAt] = useState<string>();
  const [nowMs, setNowMs] = useState(Date.now());
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [error, setError] = useState<string>();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState<string>();
  const [breakingAlert, setBreakingAlert] = useState<NewsItem>();
  const [rankingType, setRankingType] = useState<RankingType>('turnover');
  const [rankingMarket, setRankingMarket] = useState<RankingMarket>('US');
  const [selectedRankingSymbol, setSelectedRankingSymbol] = useState<string>();
  const [chartRange, setChartRange] = useState<ChartRange>('minute');
  const [quoteFlash, setQuoteFlash] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const quoteEventSourceRef = useRef<EventSource | null>(null);
  const searchSeqRef = useRef(0);
  const initialSearchStartedRef = useRef(false);

  useEffect(() => {
    setNotificationEnabled(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      quoteEventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!breakingAlert) return undefined;
    const timer = window.setTimeout(() => setBreakingAlert(undefined), 25_000);
    return () => window.clearTimeout(timer);
  }, [breakingAlert]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'high') return items.filter((item) => impactScore(item) >= 60);
    if (filter === 'market') return items.filter(isMarketImpact);
    return items.filter((item) => item.provider === filter);
  }, [filter, items]);

  const selectedNews = useMemo(
    () => items.find((item) => item.id === selectedNewsId) ?? items[0],
    [items, selectedNewsId]
  );

  const counts = useMemo(() => ({
    all: items.length,
    high: items.filter((item) => impactScore(item) >= 60).length,
    market: items.filter(isMarketImpact).length
  }), [items]);

  const providerHealth = useMemo(() => buildProviderHealth(statuses), [statuses]);
  const secondsToNextCheck = useMemo(() => {
    if (!nextCheckAt) return undefined;
    return Math.max(0, Math.ceil((new Date(nextCheckAt).getTime() - nowMs) / 1000));
  }, [nextCheckAt, nowMs]);

  const articleQuery = useQuery({
    queryKey: ['article-detail', selectedNews?.id, selectedNews?.url, displayLanguage],
    queryFn: ({ signal }) => fetchArticleDetail(selectedNews!, displayLanguage, signal),
    enabled: Boolean(selectedNews),
    staleTime: 30 * 60 * 1000
  });

  const translationQuery = useQuery({
    queryKey: ['news-translations', displayLanguage, items.map((item) => item.id).slice(0, 30).join(',')],
    queryFn: ({ signal }) => fetchNewsTranslations(items.slice(0, 30), displayLanguage, signal),
    enabled: displayLanguage !== 'original' && items.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1
  });
  const translations = useMemo(() => {
    return new Map((translationQuery.data?.items ?? []).map((item) => [item.id, item]));
  }, [translationQuery.data?.items]);

  const rankingQuery = useQuery({
    queryKey: ['market-ranking', rankingMarket, rankingType],
    queryFn: ({ signal }) => fetchMarketRanking(rankingMarket, rankingType, signal),
    staleTime: 30_000,
    refetchInterval: 60_000
  });

  const selectedRanking = useMemo(() => {
    const rankingItems = rankingQuery.data?.items ?? [];
    return rankingItems.find((item) => item.symbol === selectedRankingSymbol) ?? rankingItems[0];
  }, [rankingQuery.data?.items, selectedRankingSymbol]);

  const earningsSymbols = useMemo(() => inferEarningsSymbols(activeQuery || input), [activeQuery, input]);
  const earningsQuery = useQuery({
    queryKey: ['earnings-calendar', earningsSymbols.join(',')],
    queryFn: ({ signal }) => fetchEarningsCalendar(earningsSymbols, signal),
    enabled: earningsSymbols.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000
  });
  const quoteSymbol = useMemo(() => inferQuoteSymbol(activeQuery || input), [activeQuery, input]);
  const quoteQuery = useQuery({
    queryKey: ['market-quote', quoteSymbol],
    queryFn: ({ signal }) => fetchMarketQuote(quoteSymbol!, signal),
    enabled: Boolean(quoteSymbol),
    staleTime: 1_000,
    refetchInterval: quoteSymbol ? 30_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1
  });
  const chartQuery = useQuery({
    queryKey: ['quote-chart', quoteSymbol, chartRange],
    queryFn: ({ signal }) => fetchQuoteChart(quoteSymbol!, chartRange, signal),
    enabled: Boolean(quoteSymbol),
    staleTime: chartRange === 'minute' || chartRange === 'day' ? 5_000 : 60_000,
    refetchInterval: quoteSymbol && (chartRange === 'minute' || chartRange === 'day') ? 10_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1
  });

  useEffect(() => {
    if (!quoteQuery.data?.generatedAt) return undefined;
    setQuoteFlash(true);
    const timer = window.setTimeout(() => setQuoteFlash(false), 650);
    return () => window.clearTimeout(timer);
  }, [quoteQuery.data?.generatedAt, quoteQuery.data?.activePrice]);

  useEffect(() => {
    quoteEventSourceRef.current?.close();
    if (!quoteSymbol) return undefined;

    const stream = new EventSource(`/api/quotes/${encodeURIComponent(quoteSymbol)}/stream`);
    quoteEventSourceRef.current = stream;

    stream.addEventListener('quote', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as MarketQuote;
      queryClient.setQueryData<MarketQuote>(['market-quote', quoteSymbol], payload);
    });
    stream.addEventListener('error', () => {
      void queryClient.invalidateQueries({ queryKey: ['market-quote', quoteSymbol] });
    });

    return () => {
      stream.close();
      if (quoteEventSourceRef.current === stream) quoteEventSourceRef.current = null;
    };
  }, [queryClient, quoteSymbol]);

  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const searchSeq = searchSeqRef.current + 1;
    searchSeqRef.current = searchSeq;
    await queryClient.cancelQueries({ queryKey: ['news-search'] });
    eventSourceRef.current?.close();
    localStorage.setItem('last-news-query', trimmed);
    syncQueryParam(trimmed);
    setActiveQuery(trimmed);
    setConnectionState('connecting');
    setError(undefined);
    setItems([]);
    setSelectedNewsId(undefined);
    setBreakingAlert(undefined);
    setLastUpdatedAt(undefined);
    setNextCheckAt(undefined);

    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['news-search', trimmed],
        queryFn: ({ signal }) => fetchNewsSearch(trimmed, signal),
        staleTime: 5_000
      });
      if (searchSeq !== searchSeqRef.current) return;
      setItems(result.items);
      setSelectedNewsId(result.items[0]?.id);
      setStatuses(result.statuses);
      setLastUpdatedAt(result.generatedAt);
      setNextCheckAt(result.nextCheckAt);
      openStream(trimmed, searchSeq);
    } catch (err) {
      if (searchSeq !== searchSeqRef.current) return;
      setConnectionState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openStream = (query: string, searchSeq: number) => {
    eventSourceRef.current?.close();
    const stream = new EventSource(`/api/news/stream?${new URLSearchParams({ query }).toString()}`);
    eventSourceRef.current = stream;

    stream.addEventListener('open', () => {
      if (searchSeq === searchSeqRef.current) setConnectionState('live');
    });
    stream.addEventListener('snapshot', (event) => {
      if (searchSeq !== searchSeqRef.current) return;
      const payload = JSON.parse((event as MessageEvent).data) as NewsSearchResult;
      setItems((current) => {
        const mergedItems = mergeNews(current, payload.items);
        queryClient.setQueryData<NewsSearchResult>(['news-search', query], { ...payload, items: mergedItems });
        setSelectedNewsId((selected) => selected ?? mergedItems[0]?.id);
        return mergedItems;
      });
      setStatuses(payload.statuses);
      setLastUpdatedAt(payload.generatedAt);
      setNextCheckAt(payload.nextCheckAt);
      setConnectionState('live');
    });
    stream.addEventListener('news', (event) => {
      if (searchSeq !== searchSeqRef.current) return;
      const payload = JSON.parse((event as MessageEvent).data) as NewsSearchResult;
      if (payload.items.length > 0) {
        const topIncoming = topImpactItem(payload.items);
        setItems((current) => {
          const mergedItems = mergeNews(payload.items, current);
          queryClient.setQueryData<NewsSearchResult>(['news-search', query], { ...payload, items: mergedItems });
          setSelectedNewsId(topIncoming?.id ?? payload.items[0]?.id);
          return mergedItems;
        });
        if (topIncoming && impactScore(topIncoming) >= 60) {
          setBreakingAlert(topIncoming);
        }
        notifyNewItems(payload.items);
      }
      setStatuses(payload.statuses);
      if (payload.items.length > 0) setLastUpdatedAt(payload.generatedAt);
      setNextCheckAt(payload.nextCheckAt);
      setConnectionState('live');
    });
    stream.addEventListener('heartbeat', (event) => {
      if (searchSeq !== searchSeqRef.current) return;
      const payload = JSON.parse((event as MessageEvent).data) as HeartbeatEvent;
      setNextCheckAt(payload.nextCheckAt);
    });
    stream.addEventListener('error', () => {
      if (searchSeq !== searchSeqRef.current) return;
      setConnectionState('error');
      setError('실시간 연결이 끊겼습니다. 자동 재연결을 기다리거나 다시 검색하세요.');
    });
  };

  const notifyNewItems = (freshItems: NewsItem[]) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const urgent = topImpactItem(freshItems) ?? freshItems[0];
    if (!urgent) return;
    const impact = impactScore(urgent);
    new Notification(`${urgent.sourceName} · 영향도 ${impact}`, {
      body: urgent.impact?.summary ?? urgent.title,
      tag: urgent.id
    });
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === 'granted');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(input);
  };

  const changeDisplayLanguage = (language: DisplayLanguage) => {
    setDisplayLanguage(language);
    localStorage.setItem('display-language', language);
  };

  useEffect(() => {
    if (initialSearchStartedRef.current) return;
    initialSearchStartedRef.current = true;
    void runSearch(initialQuery);
    // Restore the monitor immediately after reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`app-shell ${breakingAlert ? `alert-${impactLevel(breakingAlert)}` : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Radio size={20} aria-hidden />
          <div>
            <h1>뉴스 시그널</h1>
            <span>{activeQuery || '검색 대기'}</span>
          </div>
        </div>
        <form className="top-search" onSubmit={onSubmit}>
          <Search size={17} aria-hidden />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="종목, 티커, 전쟁, 유가, 호르무즈"
            aria-label="뉴스 검색어"
          />
          <button type="submit">검색</button>
        </form>
        <div className="language-select" aria-label="표시 언어">
          <button className={displayLanguage === 'ko' ? 'active' : ''} type="button" onClick={() => changeDisplayLanguage('ko')}>
            한국어
          </button>
          <button className={displayLanguage === 'en' ? 'active' : ''} type="button" onClick={() => changeDisplayLanguage('en')}>
            English
          </button>
          <button className={displayLanguage === 'original' ? 'active' : ''} type="button" onClick={() => changeDisplayLanguage('original')}>
            원문
          </button>
        </div>
        <div className={`connection ${connectionState}`}>
          {connectionState === 'live' ? <Wifi size={17} /> : <WifiOff size={17} />}
          <span>{connectionLabel(connectionState)}</span>
        </div>
      </header>

      {breakingAlert && (
        <BreakingAlert
          item={breakingAlert}
          translation={translations.get(breakingAlert.id)}
          displayLanguage={displayLanguage}
          onOpen={() => setSelectedNewsId(breakingAlert.id)}
          onClose={() => setBreakingAlert(undefined)}
        />
      )}

      {quoteSymbol && (
        <QuoteStrip
          symbol={quoteSymbol}
          quote={quoteQuery.data}
          isLoading={quoteQuery.isLoading}
          isError={quoteQuery.isError}
          flash={quoteFlash}
        />
      )}

      <main className="terminal-layout">
        {quoteSymbol && (
          <QuoteChart
            result={chartQuery.data}
            range={chartRange}
            quote={quoteQuery.data}
            isLoading={chartQuery.isLoading}
            onRangeChange={setChartRange}
          />
        )}

        <section className="feed-panel">
          <div className="feed-head">
            <div>
              <h2>수집 뉴스</h2>
              <p>
                {lastUpdatedAt ? (
                  <>
                    <Clock3 size={14} aria-hidden />
                    {activeQuery || input} · {formatDateTime(lastUpdatedAt)}
                  </>
                ) : '수집 대기'}
              </p>
            </div>
            <div className="live-panel">
              <span>{providerHealth}</span>
              <span>{secondsToNextCheck === undefined ? '대기' : `뉴스 ${secondsToNextCheck}s`}</span>
              {displayLanguage !== 'original' && translationQuery.isFetching && <span>번역 중</span>}
              <button type="button" onClick={() => activeQuery && runSearch(activeQuery)}>
                <RefreshCw size={16} aria-hidden />
                즉시
              </button>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="filter-strip" aria-label="피드 필터">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>전체 {counts.all}</FilterButton>
            <FilterButton active={filter === 'high'} onClick={() => setFilter('high')}>긴급</FilterButton>
            <FilterButton active={filter === 'market'} onClick={() => setFilter('market')}>시장영향</FilterButton>
            <FilterButton active={filter === 'source-search'} onClick={() => setFilter('source-search')}>원문검색</FilterButton>
            <FilterButton active={filter === 'direct-rss'} onClick={() => setFilter('direct-rss')}>직접RSS</FilterButton>
            <FilterButton active={filter === 'google-news'} onClick={() => setFilter('google-news')}>Google</FilterButton>
          </div>

          <div className="feed-list">
            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <Newspaper size={30} aria-hidden />
                <span>{connectionState === 'connecting' ? '수집 중' : '현재 필터에 잡힌 뉴스가 없습니다'}</span>
                <p>{providerHealth}. Google/GDELT 제한이 있으면 원문검색 또는 직접RSS가 회복될 때까지 대체 검색어를 돌려보세요.</p>
                <div>
                  {scoutQueries.slice(0, 3).map((query) => (
                    <button
                      type="button"
                      key={query}
                      onClick={() => {
                        setInput(query);
                        void runSearch(query);
                      }}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              filteredItems.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  translation={translations.get(item.id)}
                  displayLanguage={displayLanguage}
                  selected={selectedNews?.id === item.id}
                  detail={selectedNews?.id === item.id ? articleQuery.data : undefined}
                  isDetailLoading={selectedNews?.id === item.id && articleQuery.isLoading}
                  onSelect={() => setSelectedNewsId(item.id)}
                />
              ))
            )}
          </div>
        </section>

        <aside className="context-rail">
          <section className="action-panel">
            <div className="section-title">
              <Zap size={16} aria-hidden />
              <div>
                <h2>빠른 스카우트</h2>
                <span>미장·지정학 우선</span>
              </div>
            </div>
            <div className="quick-list" aria-label="빠른 검색">
              {[...examples, ...scoutQueries].map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => {
                    setInput(example);
                    void runSearch(example);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
            <button className="notify-button" type="button" onClick={enableNotifications}>
              <Bell size={17} aria-hidden />
              {notificationEnabled ? '알림 켜짐' : '알림 켜기'}
            </button>
          </section>

          <RankingPanel
            result={rankingQuery.data}
            isLoading={rankingQuery.isLoading}
            market={rankingMarket}
            type={rankingType}
            selected={selectedRanking}
            selectedSymbol={selectedRanking?.symbol}
            onMarketChange={setRankingMarket}
            onTypeChange={setRankingType}
            onSelect={setSelectedRankingSymbol}
          />

          <EarningsMini result={earningsQuery.data} />
        </aside>
      </main>
    </div>
  );
}

function QuoteStrip({
  symbol,
  quote,
  isLoading,
  isError,
  flash
}: {
  symbol: string;
  quote?: MarketQuote;
  isLoading: boolean;
  isError: boolean;
  flash: boolean;
}) {
  const tone = quote ? (isNegativeNumber(quote.activeChangePercent) ? 'negative' : 'positive') : 'neutral';
  const session = quote ? quoteSessionLabel(quote.session) : '가격 대기';
  const price = quote?.activePrice;
  const change = quote?.activeChange;
  const changePercent = quote?.activeChangePercent;
  const lastTradeAt = quote?.activeTime ?? quote?.postMarketTime ?? quote?.preMarketTime ?? quote?.extendedTime ?? quote?.regularTime;
  const quoteStatus = quote ? quoteFreshnessLabel(quote) : '지연';
  const priceContext = quote ? quotePriceContextLabel(quote) : '가격 대기';
  const nextSession = quote?.nextSession && quote.nextSessionTime
    ? `다음 ${quoteSessionLabel(quote.nextSession)} ${formatKoreaTime(quote.nextSessionTime)}`
    : undefined;

  return (
    <section className={`quote-strip ${tone} ${flash ? 'quote-flash' : ''}`}>
      <div className="quote-identity">
        <span className={`session-pill ${quote?.session ?? 'unknown'}`}>{session}</span>
        <div>
          <strong>{quote?.symbol ?? symbol}</strong>
          <small>{quote?.name ?? (isLoading ? '실시간 가격 수집 중' : isError ? '가격 수집 실패' : '미국 종목')}</small>
        </div>
      </div>
      <div className="quote-price">
        <small>{priceContext}</small>
        <strong>{price === undefined ? '-' : formatCurrency(price, quote?.currency ?? 'USD')}</strong>
        <span className={tone}>{formatSignedNumber(change)} · {formatSignedPercent(changePercent)}</span>
      </div>
      <div className="quote-meta">
        <span>{quoteStatus}</span>
        <small>거래량 {formatCompactNumber(quote?.volume)}</small>
        {lastTradeAt && <small>체결 {formatAge(lastTradeAt)}</small>}
        {nextSession && <small>{nextSession}</small>}
      </div>
    </section>
  );
}

function QuoteChart({
  result,
  range,
  quote,
  isLoading,
  onRangeChange
}: {
  result?: QuoteChartResult;
  range: ChartRange;
  quote?: MarketQuote;
  isLoading: boolean;
  onRangeChange: (range: ChartRange) => void;
}) {
  const candles = result?.candles ?? [];
  const displayCandles = withActiveQuote(candles, quote);
  const latest = displayCandles[displayCandles.length - 1];
  const tone = isNegativeNumber(quote?.activeChangePercent) ? 'negative' : 'positive';
  const linePath = buildChartPath(displayCandles);
  const volumeBars = buildVolumeBars(displayCandles);
  const stats = buildChartStats(displayCandles, quote, result?.previousClose, result?.currency ?? quote?.currency ?? 'USD');

  return (
    <section className={`quote-chart ${tone}`}>
      <div className="chart-head">
        <div>
          <h2>가격 차트</h2>
          <span>{latest ? `${formatMaybeCurrency(latest.close, result?.currency)} · ${formatDateTime(latest.time)}` : isLoading ? '차트 수집 중' : '데이터 대기'}</span>
        </div>
        <div className="chart-tabs" aria-label="차트 범위">
          {chartRanges.map((item) => (
            <button
              key={item.value}
              className={range === item.value ? 'active' : ''}
              type="button"
              onClick={() => onRangeChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-stats" aria-label="차트 주요 지표">
        {stats.map((stat) => (
          <span key={stat.label}>
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
          </span>
        ))}
      </div>
      <div className="chart-surface">
        {linePath ? (
          <svg viewBox="0 0 640 220" role="img" aria-label="가격 차트">
            <path className="chart-grid" d="M0 44H640M0 88H640M0 132H640M0 176H640" />
            <path className="chart-line-shadow" d={linePath} />
            <path className="chart-line" d={linePath} />
            {volumeBars.map((bar) => (
              <rect key={bar.key} className="volume-bar" x={bar.x} y={bar.y} width={bar.width} height={bar.height} />
            ))}
          </svg>
        ) : (
          <div className="compact-empty">차트 데이터를 기다리는 중입니다.</div>
        )}
      </div>
    </section>
  );
}

function RankingPanel({
  result,
  isLoading,
  market,
  type,
  selected,
  selectedSymbol,
  onMarketChange,
  onTypeChange,
  onSelect
}: {
  result?: RankingResult;
  isLoading: boolean;
  market: RankingMarket;
  type: RankingType;
  selected?: RankingItem;
  selectedSymbol?: string;
  onMarketChange: (market: RankingMarket) => void;
  onTypeChange: (type: RankingType) => void;
  onSelect: (symbol: string) => void;
}) {
  const items = result?.items ?? [];

  return (
    <section className="ranking-panel">
      <div className="section-title">
        <TrendingDown size={16} aria-hidden />
        <div>
          <h2>수급·거래대금</h2>
          <span>{result ? formatDateTime(result.generatedAt) : '60초 캐시'}</span>
        </div>
      </div>
      <div className="segmented">
        <button className={market === 'US' ? 'active' : ''} type="button" onClick={() => onMarketChange('US')}>US</button>
        <button className={market === 'KOSPI' ? 'active' : ''} type="button" onClick={() => onMarketChange('KOSPI')}>KOSPI</button>
        <button className={market === 'KOSDAQ' ? 'active' : ''} type="button" onClick={() => onMarketChange('KOSDAQ')}>KOSDAQ</button>
      </div>
      <div className="segmented wrap">
        <button className={type === 'turnover' ? 'active' : ''} type="button" onClick={() => onTypeChange('turnover')}>거래대금</button>
        <button className={type === 'foreign' ? 'active' : ''} type="button" onClick={() => onTypeChange('foreign')}>외국인</button>
        <button className={type === 'institution' ? 'active' : ''} type="button" onClick={() => onTypeChange('institution')}>기관</button>
        <button className={type === 'gainers' ? 'active' : ''} type="button" onClick={() => onTypeChange('gainers')}>급등</button>
      </div>

      {isLoading && <div className="compact-empty">순위 수집 중</div>}
      <div className="ranking-list">
        {items.slice(0, 8).map((item, index) => (
          <button
            key={item.symbol}
            className={`ranking-row ${selectedSymbol === item.symbol ? 'active' : ''}`}
            type="button"
            onClick={() => onSelect(item.symbol)}
          >
            <span>{index + 1}</span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.symbol}</small>
            </div>
            <em className={isNegative(item.changeRate) ? 'negative' : 'positive'}>{formatSignedRate(item.changeRate)}</em>
          </button>
        ))}
      </div>

      {selected && (
        <div className="ranking-detail">
          <strong>{selected.name}</strong>
          <dl>
            <div><dt>거래대금</dt><dd>{selected.turnoverText ?? '-'}</dd></div>
            <div><dt>거래량</dt><dd>{selected.volume ?? '-'}</dd></div>
            {market === 'US' ? (
              <div><dt>시총</dt><dd>{selected.marketCap ?? '-'}</dd></div>
            ) : (
              <>
                <div><dt>외국인</dt><dd>{selected.foreignPureBuy ?? '-'}</dd></div>
                <div><dt>기관</dt><dd>{selected.institutionPureBuy ?? '-'}</dd></div>
                <div><dt>개인</dt><dd>{selected.individualPureBuy ?? '-'}</dd></div>
              </>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}

function EarningsMini({ result }: { result?: EarningsCalendarResult }) {
  const items = result?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section className="earnings-mini">
      <div className="section-title">
        <CalendarDays size={16} aria-hidden />
        <div>
          <h2>실적</h2>
          <span>한국시간</span>
        </div>
      </div>
      {items.slice(0, 4).map((item) => (
        <div className="earnings-line" key={item.id}>
          <strong>{item.symbol}</strong>
          <span>{formatEarningsTime(item)}</span>
        </div>
      ))}
    </section>
  );
}

function BreakingAlert({
  item,
  translation,
  displayLanguage,
  onOpen,
  onClose
}: {
  item: NewsItem;
  translation?: NewsTranslation;
  displayLanguage: DisplayLanguage;
  onOpen: () => void;
  onClose: () => void;
}) {
  const impact = fallbackImpact(item);

  return (
    <section className={`breaking-alert ${impact.level} effect-${impact.positionEffect}`} role="status" aria-live="assertive">
      <div className="breaking-icon">
        <AlertTriangle size={19} aria-hidden />
      </div>
      <div className="breaking-copy" onClick={onOpen}>
        <div>
          <span>{deliveryLabel(impact.deliveryMode)}</span>
          <strong>{impact.positionLabel} {impact.score}</strong>
          <em>{impact.directionLabel} 재료</em>
        </div>
        <h2>{translatedTitle(item, translation, displayLanguage)}</h2>
        <p>{impact.actionHint}</p>
      </div>
      <button className="breaking-open" type="button" onClick={onOpen}>상세</button>
      <button className="breaking-close" type="button" aria-label="긴급 알림 닫기" onClick={onClose}>
        <X size={17} aria-hidden />
      </button>
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={active ? 'active' : ''} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function NewsCard({
  item,
  translation,
  displayLanguage,
  selected,
  detail,
  isDetailLoading,
  onSelect
}: {
  item: NewsItem;
  translation?: NewsTranslation;
  displayLanguage: DisplayLanguage;
  selected: boolean;
  detail?: ArticleDetail;
  isDetailLoading: boolean;
  onSelect: () => void;
}) {
  const title = translatedTitle(item, translation, displayLanguage);
  const snippet = translatedSnippet(item, translation, displayLanguage);
  const impact = fallbackImpact(item);
  const fresh = isFreshItem(item);
  const primaryFactor = impact.factors[0];
  const detailSummary = selected
    ? isDetailLoading
      ? '뉴스 요약을 가져오는 중입니다.'
      : articleExcerpt(item, detail, displayLanguage)
    : undefined;

  return (
    <article
      className={`news-card ${item.severity} impact-${impact.level} effect-${impact.positionEffect} ${fresh ? 'fresh' : ''} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-expanded={selected}
    >
      <div className="news-topline">
        <time>{formatAge(item.publishedAt)}</time>
        <span className="provider-chip">{providerLabels[item.provider]}</span>
        <span className={`impact-score small ${impact.level} effect-${impact.positionEffect}`}>{impact.score}</span>
        <span className={`effect-chip ${impact.positionEffect}`}>{impact.positionLabel}</span>
        {fresh && <span className="fresh-chip">NEW</span>}
        {isMarketImpact(item) && <span className="impact-chip">시장영향</span>}
        {item.country && (
          <span className="country">
            <Globe2 size={12} aria-hidden />
            {item.country}
          </span>
        )}
      </div>
      <h3>{title}</h3>
      {displayLanguage !== 'original' && translation?.translated && <p className="original-title compact">{item.title}</p>}
      {snippet && <p>{snippet}</p>}
      <div className="news-footer">
        <span className={`severity ${item.severity}`}>{severityLabel(item.severity)}</span>
        <span className={`delivery-chip ${impact.level} effect-${impact.positionEffect}`}>{deliveryLabel(impact.deliveryMode)}</span>
        <span className="factor-chip">{impact.directionLabel}</span>
        {primaryFactor && <span className="factor-chip">{primaryFactor.label}</span>}
        <strong>{item.sourceName}</strong>
        <a
          className="news-card-link"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink size={13} aria-hidden />
          원문
        </a>
      </div>
      {selected && (
        <div className="news-detail-card" onClick={(event) => event.stopPropagation()}>
          <div className="news-detail-head">
            <div>
              <strong>뉴스 요약</strong>
              <span>{detail ? `${item.sourceName} · ${formatDateTime(detail.fetchedAt)}` : item.sourceName}</span>
            </div>
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} aria-hidden />
              뉴스 링크
            </a>
          </div>
          <NewsDetailImpact impact={impact} />
          <p>{detailSummary}</p>
          {detail?.message && <div className="detail-note compact">{detail.message}</div>}
          {displayLanguage !== 'original' && detail?.translated && detail.excerpt && (
            <details>
              <summary>원문 요약 보기</summary>
              <p>{detail.excerpt}</p>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function NewsDetailImpact({ impact }: { impact: NewsImpact }) {
  return (
    <div className={`news-detail-impact ${impact.level} effect-${impact.positionEffect}`}>
      <span>{impact.actionHint}</span>
      <span>{impact.verification.label} · 신뢰도 {impact.confidence}%</span>
      <span>{impact.priceReaction.reason}</span>
    </div>
  );
}

async function fetchNewsSearch(query: string, signal?: AbortSignal): Promise<NewsSearchResult> {
  const response = await fetch(`/api/news/search?${new URLSearchParams({ query }).toString()}`, { signal });
  if (!response.ok) throw new Error(`검색 실패: HTTP ${response.status}`);
  return response.json() as Promise<NewsSearchResult>;
}

async function fetchArticleDetail(
  item: NewsItem,
  targetLanguage: DisplayLanguage,
  signal?: AbortSignal
): Promise<ArticleDetail> {
  const params = new URLSearchParams({
    url: item.url,
    query: item.query,
    title: item.title,
    snippet: item.snippet ?? '',
    sourceName: item.sourceName,
    provider: item.provider,
    publishedAt: item.publishedAt,
    severity: item.severity,
    language: item.language ?? '',
    targetLanguage
  });
  const response = await fetch(`/api/news/detail?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`기사 상세 실패: HTTP ${response.status}`);
  return response.json() as Promise<ArticleDetail>;
}

async function fetchNewsTranslations(
  items: NewsItem[],
  targetLanguage: DisplayLanguage,
  signal?: AbortSignal
): Promise<NewsTranslationResult> {
  const response = await fetch('/api/news/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      targetLanguage,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        snippet: item.snippet,
        language: item.language
      }))
    })
  });
  if (!response.ok) throw new Error(`뉴스 번역 실패: HTTP ${response.status}`);
  return response.json() as Promise<NewsTranslationResult>;
}

async function fetchMarketRanking(
  market: RankingMarket,
  type: RankingType,
  signal?: AbortSignal
): Promise<RankingResult> {
  const response = await fetch(`/api/market/rankings?${new URLSearchParams({ market, type }).toString()}`, { signal });
  if (!response.ok) throw new Error(`순위 조회 실패: HTTP ${response.status}`);
  return response.json() as Promise<RankingResult>;
}

async function fetchMarketQuote(symbol: string, signal?: AbortSignal): Promise<MarketQuote> {
  const response = await fetch(`/api/quotes/${encodeURIComponent(symbol)}`, { signal });
  if (!response.ok) throw new Error(`가격 조회 실패: HTTP ${response.status}`);
  return response.json() as Promise<MarketQuote>;
}

async function fetchQuoteChart(
  symbol: string,
  range: ChartRange,
  signal?: AbortSignal
): Promise<QuoteChartResult> {
  const response = await fetch(
    `/api/quotes/${encodeURIComponent(symbol)}/candles?${new URLSearchParams({ range }).toString()}`,
    { signal }
  );
  if (!response.ok) throw new Error(`차트 조회 실패: HTTP ${response.status}`);
  return response.json() as Promise<QuoteChartResult>;
}

async function fetchEarningsCalendar(symbols: string[], signal?: AbortSignal): Promise<EarningsCalendarResult> {
  const response = await fetch(
    `/api/earnings/calendar?${new URLSearchParams({ symbols: symbols.join(',') }).toString()}`,
    { signal }
  );
  if (!response.ok) throw new Error(`실적 캘린더 실패: HTTP ${response.status}`);
  return response.json() as Promise<EarningsCalendarResult>;
}

function inferEarningsSymbols(query: string): string[] {
  const normalized = query.toUpperCase();
  const symbols = new Set<string>();
  const tickerMatches = normalized.match(/\b[A-Z]{1,5}\b/g) ?? [];
  for (const ticker of tickerMatches) {
    if (earningsSymbolUniverse.has(ticker)) symbols.add(ticker);
  }
  if (normalized.includes('SOXL') || normalized.includes('SEMICON') || query.includes('반도체')) {
    ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'].forEach((symbol) => symbols.add(symbol));
  }
  if (normalized.includes('SOXS')) {
    ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'].forEach((symbol) => symbols.add(symbol));
  }
  if (normalized.includes('TQQQ') || normalized.includes('SQQQ') || normalized.includes('NASDAQ') || query.includes('나스닥')) {
    ['AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'NVDA', 'TSLA'].forEach((symbol) => symbols.add(symbol));
  }
  return Array.from(symbols).slice(0, 12);
}

const earningsSymbolUniverse = new Set([
  'AAPL',
  'AMD',
  'AMZN',
  'ASML',
  'AVGO',
  'GOOG',
  'GOOGL',
  'META',
  'MSFT',
  'MU',
  'NVDA',
  'TSLA',
  'TSM'
]);

const knownQuoteSymbols = new Set([
  'SOXL',
  'TQQQ',
  'SQQQ',
  'SOXS',
  'UPRO',
  'SPXL',
  'SPXS',
  'QQQ',
  'SPY',
  'NVDA',
  'AMD',
  'AVGO',
  'TSM',
  'ASML',
  'MU',
  'AAPL',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'GOOG',
  'TSLA'
]);

function inferQuoteSymbol(query: string): string | undefined {
  const compact = query.trim().toUpperCase();
  if (/^[A-Z0-9.=-]{1,12}$/.test(compact)) return compact;
  const tokens = compact.match(/\b[A-Z][A-Z0-9.=-]{0,11}\b/g) ?? [];
  return tokens.find((token) => knownQuoteSymbols.has(token));
}

function mergeNews(primary: NewsItem[], secondary: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const item of [...primary, ...secondary]) map.set(item.id, item);
  return Array.from(map.values()).sort(compareNewsForTrading);
}

function topImpactItem(items: NewsItem[]): NewsItem | undefined {
  return [...items].sort(compareNewsForTrading)[0];
}

function compareNewsForTrading(a: NewsItem, b: NewsItem): number {
  const priority = tradingPriority(b) - tradingPriority(a);
  if (priority !== 0) return priority;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

function tradingPriority(item: NewsItem): number {
  const ageMinutes = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 60_000);
  const freshness = ageMinutes <= 5 ? 30 : ageMinutes <= 15 ? 24 : ageMinutes <= 60 ? 15 : ageMinutes <= 180 ? 8 : 0;
  const impact = fallbackImpact(item);
  const deliveryBoost = impact.deliveryMode === 'breaking' ? 16 : impact.deliveryMode === 'priority' ? 10 : 0;
  const positionBoost = impact.positionEffect === 'unfavorable' ? 12 : impact.positionEffect === 'mixed' ? 8 : 0;
  const sourceBoost = item.provider === 'direct-rss' || item.provider === 'source-search' || item.provider === 'sec' ? 6 : 0;
  return impact.score * 2 + freshness + deliveryBoost + positionBoost + sourceBoost;
}

function impactScore(item?: NewsItem): number {
  return fallbackImpact(item).score;
}

function impactLevel(item?: NewsItem): NewsImpactLevel {
  return fallbackImpact(item).level;
}

function fallbackImpact(item?: Pick<NewsItem, 'impact' | 'severity'>): NewsImpact {
  if (item?.impact) return item.impact;
  const score = item?.severity === 'high' ? 65 : item?.severity === 'medium' ? 42 : 18;
  return resolveImpact(undefined, score);
}

function resolveImpact(impact?: NewsImpact, fallbackScore = 18): NewsImpact {
  if (impact) return impact;
  const level: NewsImpactLevel = fallbackScore >= 80 ? 'critical' : fallbackScore >= 60 ? 'high' : fallbackScore >= 40 ? 'medium' : 'low';
  return {
    score: fallbackScore,
    level,
    label: level === 'critical' ? '긴급' : level === 'high' ? '강함' : level === 'medium' ? '주의' : '일반',
    deliveryMode: level === 'critical' ? 'breaking' : level === 'high' ? 'priority' : level === 'medium' ? 'watch' : 'normal',
    confidence: 45,
    summary: level === 'high' || level === 'critical' ? '중요 키워드 기반 긴급 확인 대상입니다.' : '일반 모니터링 항목입니다.',
    direction: 'neutral',
    directionLabel: '중립',
    positionBias: 'unknown',
    positionEffect: 'neutral',
    positionLabel: '중립',
    actionHint: '추가 보도와 가격 반응을 확인하세요.',
    verification: {
      level: 'single-source',
      label: '단일 출처',
      confidence: 45,
      truthRisk: 'medium',
      reason: '영향도 상세 데이터 없음',
      corroboratingReports: 0
    },
    truthRisk: 'medium',
    priceReaction: {
      direction: 'unknown',
      aligned: false,
      label: '가격 반응 없음',
      reason: '가격 데이터 없음'
    },
    marketAlignment: 'unknown',
    affectedChannels: [],
    factors: []
  };
}

function buildProviderHealth(statuses: ProviderStatus[]): string {
  if (statuses.length === 0) return '소스 대기';
  const ok = statuses.filter((status) => status.status === 'ok').length;
  const error = statuses.filter((status) => status.status === 'error').length;
  return error > 0 ? `소스 ${ok}/${statuses.length} · 오류 ${error}` : `소스 ${ok}/${statuses.length}`;
}

function isMarketImpact(item: NewsItem): boolean {
  const text = `${item.title} ${item.snippet ?? ''} ${item.matchedKeywords.join(' ')}`.toLowerCase();
  return marketImpactTerms.some((term) => text.includes(term));
}

const marketImpactTerms = [
  'stock', 'stocks', 'futures', 'nasdaq', 's&p', 'dow', 'oil', 'brent', 'wti', 'dollar', 'yield',
  'rate', 'inflation', 'selloff', 'sell-off', 'surge', 'plunge', 'drop', 'missile', 'warship',
  'strait of hormuz', 'tariff', '주가', '증시', '선물', '나스닥', '다우', '유가', '환율', '금리',
  '급락', '급등', '폭락', '미사일', '호르무즈', '관세'
];

function connectionLabel(state: ConnectionState): string {
  if (state === 'live') return 'LIVE';
  if (state === 'connecting') return '연결 중';
  if (state === 'error') return '오류';
  return '대기';
}

function severityLabel(severity: NewsSeverity): string {
  if (severity === 'high') return '긴급';
  if (severity === 'medium') return '주의';
  return '일반';
}

function deliveryLabel(mode: NewsDeliveryMode): string {
  if (mode === 'breaking') return '즉시 확인';
  if (mode === 'priority') return '우선 확인';
  if (mode === 'watch') return '관찰';
  return '일반';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatAge(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return formatDateTime(value);
}

function isFreshItem(item: NewsItem): boolean {
  return Date.now() - new Date(item.publishedAt).getTime() <= 15 * 60 * 1000;
}

function formatKoreaDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatKoreaReportDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatEarningsTime(item: EarningsEvent): string {
  const base = item.koreaTime ? formatKoreaDateTime(item.koreaTime) : `${formatKoreaReportDate(item.reportDate)} 시간 미정`;
  return item.isEstimatedTime ? `${base} 예상` : base;
}

function formatSignedRate(value?: string): string {
  if (!value) return '-';
  const clean = value.replace('%', '');
  if (clean.startsWith('-') || clean.startsWith('+')) return `${clean}%`;
  return `${Number(clean) > 0 ? '+' : ''}${clean}%`;
}

function formatSignedPercent(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatSignedNumber(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

function formatMaybeCurrency(value?: number, currency = 'USD'): string {
  return value === undefined ? '-' : formatCurrency(value, currency);
}

function formatCompactNumber(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

function isNegative(value?: string): boolean {
  return Boolean(value?.trim().startsWith('-'));
}

function isNegativeNumber(value?: number): boolean {
  return value !== undefined && value < 0;
}

function withActiveQuote(candles: QuoteCandle[], quote?: MarketQuote): QuoteCandle[] {
  if (!quote?.activePrice || !Number.isFinite(quote.activePrice)) return candles;

  const activeTime = quote.activeTime ?? quote.dayMarketTime ?? quote.extendedTime ?? quote.generatedAt;
  const activeVolume = quote.dayMarketVolume ?? quote.extendedVolume ?? quote.volume;
  const last = candles[candles.length - 1];
  if (!last) {
    return [{ time: activeTime, close: quote.activePrice, volume: activeVolume }];
  }

  const activeMs = new Date(activeTime).getTime();
  const lastMs = new Date(last.time).getTime();
  if (Number.isFinite(activeMs) && Number.isFinite(lastMs) && Math.abs(activeMs - lastMs) < 60_000) {
    return [
      ...candles.slice(0, -1),
      {
        ...last,
        close: quote.activePrice,
        volume: activeVolume ?? last.volume
      }
    ];
  }

  return [
    ...candles,
    {
      time: activeTime,
      close: quote.activePrice,
      volume: activeVolume
    }
  ];
}

function buildChartPath(candles: QuoteCandle[]): string | undefined {
  const sampled = sampleCandles(candles, 190);
  if (sampled.length < 2) return undefined;

  const values = sampled.map((candle) => candle.close).filter(Number.isFinite);
  if (values.length < 2) return undefined;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.01);
  const top = 18;
  const height = 138;
  const width = 640;

  return sampled.map((candle, index) => {
    const x = (index / (sampled.length - 1)) * width;
    const y = top + (1 - (candle.close - min) / span) * height;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function buildVolumeBars(candles: QuoteCandle[]): Array<{ key: string; x: number; y: number; width: number; height: number }> {
  const sampled = sampleCandles(candles, 120);
  const volumes = sampled.map((candle) => candle.volume ?? 0);
  const maxVolume = Math.max(0, ...volumes);
  if (sampled.length === 0 || maxVolume === 0) return [];

  const width = Math.max(1.5, 640 / sampled.length - 1);
  return sampled.map((candle, index) => {
    const height = Math.max(1, ((candle.volume ?? 0) / maxVolume) * 34);
    return {
      key: `${candle.time}-${index}`,
      x: index * (640 / sampled.length),
      y: 212 - height,
      width,
      height
    };
  });
}

function buildChartStats(
  candles: QuoteCandle[],
  quote: MarketQuote | undefined,
  previousClose: number | undefined,
  currency: string
): Array<{ label: string; value: string }> {
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  const highs = candles.map((candle) => candle.high ?? candle.close).filter(Number.isFinite);
  const lows = candles.map((candle) => candle.low ?? candle.close).filter(Number.isFinite);
  const volumes = candles.map((candle) => candle.volume ?? 0);
  const latest = quote?.activePrice ?? closes.at(-1);
  const rangeChange = latest !== undefined && previousClose !== undefined ? ((latest - previousClose) / previousClose) * 100 : undefined;

  return [
    { label: '현재', value: formatMaybeCurrency(latest, currency) },
    { label: '등락', value: formatSignedPercent(quote?.activeChangePercent ?? rangeChange) },
    { label: '고가', value: formatMaybeCurrency(highs.length > 0 ? Math.max(...highs) : undefined, currency) },
    { label: '저가', value: formatMaybeCurrency(lows.length > 0 ? Math.min(...lows) : undefined, currency) },
    { label: '거래량', value: formatCompactNumber(quote?.dayMarketVolume ?? quote?.extendedVolume ?? quote?.volume ?? Math.max(0, ...volumes)) }
  ];
}

function sampleCandles(candles: QuoteCandle[], limit: number): QuoteCandle[] {
  if (candles.length <= limit) return candles;
  const step = Math.ceil(candles.length / limit);
  const sampled = candles.filter((_, index) => index % step === 0);
  const last = candles[candles.length - 1];
  return sampled[sampled.length - 1] === last ? sampled : [...sampled, last];
}

function quoteSessionLabel(session: QuoteSession): string {
  if (session === 'day') return '주간거래';
  if (session === 'pre') return '프리마켓';
  if (session === 'regular') return '정규장';
  if (session === 'post') return '애프터마켓';
  if (session === 'closed') return '장마감';
  return '확인중';
}

function quoteFreshnessLabel(quote: MarketQuote): string {
  if (quote.activeInterpolated) return '24h 보간';

  const priceAt = new Date(quote.activeTime ?? quote.generatedAt).getTime();
  if (!Number.isFinite(priceAt)) return quote.isRealtime ? '실시간 확인' : '공개 데이터';

  const ageMs = Date.now() - priceAt;
  const freshWindowMs = Math.max(60_000, quote.cacheTtlMs * 3);
  if (ageMs <= freshWindowMs) return quote.isRealtime ? '실시간' : '공개 데이터';
  return `마지막 체결 ${formatAge(new Date(priceAt).toISOString())}`;
}

function quotePriceContextLabel(quote: MarketQuote): string {
  const sessionLabel = quoteSessionLabel(quote.session);
  if (quote.session === 'closed') {
    const source = quote.activeSession && quote.activeSession !== 'regular'
      ? `${quoteSessionLabel(quote.activeSession)} 마지막`
      : '정규장 마지막';
    return `${source} · ${sessionLabel}`;
  }

  if (quote.session === 'day' && quote.activeSession !== 'day') {
    const source = quote.activeSession && quote.activeSession !== 'regular'
      ? `${quoteSessionLabel(quote.activeSession)} 마지막`
      : '정규장 마지막';
    return `${source} · ${sessionLabel}`;
  }

  if (quote.activeInterpolated) return `24h 차트 · ${sessionLabel}`;
  return `현재 · ${sessionLabel}`;
}

function formatKoreaTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function translatedTitle(item: NewsItem, translation: NewsTranslation | undefined, displayLanguage: DisplayLanguage): string {
  return displayLanguage === 'original' ? item.title : translation?.title ?? item.title;
}

function translatedSnippet(item: NewsItem, translation: NewsTranslation | undefined, displayLanguage: DisplayLanguage): string | undefined {
  return displayLanguage === 'original' ? item.snippet : translation?.snippet ?? item.snippet;
}

function articleExcerpt(item: NewsItem, detail: ArticleDetail | undefined, displayLanguage: DisplayLanguage): string {
  if (!detail) return item.snippet ?? '본문 미리보기를 가져올 수 없습니다.';
  if (displayLanguage === 'original') return detail.excerpt || item.snippet || '본문 미리보기를 가져올 수 없습니다.';
  if (displayLanguage === 'ko') return detail.excerptKo || detail.excerptTranslated || detail.excerpt;
  return detail.excerptTranslated || detail.excerpt || item.snippet || '본문 미리보기를 가져올 수 없습니다.';
}

function getInitialQuery(): string {
  const queryParam = new URLSearchParams(window.location.search).get('q')?.trim();
  if (queryParam) return queryParam;
  return localStorage.getItem('last-news-query') || 'SOXL';
}

function syncQueryParam(query: string): void {
  const params = new URLSearchParams(window.location.search);
  params.set('q', query);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function getInitialLanguage(): DisplayLanguage {
  const saved = localStorage.getItem('display-language');
  return saved === 'en' || saved === 'original' || saved === 'ko' ? saved : 'ko';
}
