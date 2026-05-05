import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
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
  ShieldAlert,
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
type RiskLevel = 'calm' | 'watch' | 'risk-off' | 'opportunity';
type EarningsReportTime = 'BMO' | 'AMC' | 'TAS' | 'UNKNOWN';
type EarningsStatus = 'upcoming' | 'reported';
type EarningsSource = 'finnhub' | 'alpha-vantage' | 'sample';
type RankingType = 'turnover' | 'gainers' | 'losers' | 'foreign' | 'institution';
type RankingMarket = 'KOSPI' | 'KOSDAQ' | 'US';
type DisplayLanguage = 'ko' | 'en' | 'original';
type NewsImpactLevel = 'critical' | 'high' | 'medium' | 'low';
type NewsDeliveryMode = 'breaking' | 'priority' | 'watch' | 'normal';
type QuoteSession = 'pre' | 'regular' | 'post' | 'closed' | 'unknown';
type QuoteProvider = 'cnbc' | 'yahoo-chart' | 'nasdaq';
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
  const [lastCheckedAt, setLastCheckedAt] = useState<string>();
  const [nextCheckAt, setNextCheckAt] = useState<string>();
  const [pollIntervalMs, setPollIntervalMs] = useState<number>();
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [error, setError] = useState<string>();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState<string>();
  const [breakingAlert, setBreakingAlert] = useState<NewsItem>();
  const [rankingType, setRankingType] = useState<RankingType>('turnover');
  const [rankingMarket, setRankingMarket] = useState<RankingMarket>('US');
  const [selectedRankingSymbol, setSelectedRankingSymbol] = useState<string>();
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchSeqRef = useRef(0);
  const initialSearchStartedRef = useRef(false);

  useEffect(() => {
    setNotificationEnabled(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  }, []);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
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
    market: items.filter(isMarketImpact).length,
    direct: items.filter((item) => item.provider === 'direct-rss' || item.provider === 'source-search').length,
    unfavorable: items.filter((item) => fallbackImpact(item).positionEffect === 'unfavorable').length,
    favorable: items.filter((item) => fallbackImpact(item).positionEffect === 'favorable').length
  }), [items]);
  const priorityItems = useMemo(() => topImpactItems(items, 4), [items]);

  const signal = useMemo(() => buildSignal(items, newItemsCount), [items, newItemsCount]);
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
    staleTime: 12 * 60 * 60 * 1000
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
    staleTime: 3_000,
    refetchInterval: quoteSymbol ? 5_000 : false,
    retry: 1
  });

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
    setNewItemsCount(0);
    setLastUpdatedAt(undefined);
    setLastCheckedAt(undefined);
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
      setLastCheckedAt(result.generatedAt);
      setPollIntervalMs(result.pollIntervalMs);
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
      setLastCheckedAt(payload.generatedAt);
      setPollIntervalMs(payload.pollIntervalMs);
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
        setNewItemsCount((count) => count + payload.items.length);
        if (topIncoming && impactScore(topIncoming) >= 60) {
          setBreakingAlert(topIncoming);
        }
        notifyNewItems(payload.items);
      }
      setStatuses(payload.statuses);
      setLastCheckedAt(payload.generatedAt);
      if (payload.items.length > 0) setLastUpdatedAt(payload.generatedAt);
      setPollIntervalMs(payload.pollIntervalMs);
      setNextCheckAt(payload.nextCheckAt);
      setConnectionState('live');
    });
    stream.addEventListener('heartbeat', (event) => {
      if (searchSeq !== searchSeqRef.current) return;
      const payload = JSON.parse((event as MessageEvent).data) as HeartbeatEvent;
      setLastCheckedAt(payload.now);
      setPollIntervalMs(payload.pollIntervalMs);
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
        />
      )}

      <main className="terminal-layout">
        <SignalBoard
          signal={signal}
          counts={counts}
          priorityItems={priorityItems}
          statuses={statuses}
          providerHealth={providerHealth}
          nextCheckLabel={secondsToNextCheck === undefined ? '대기' : `${secondsToNextCheck}s`}
          onSelectNews={setSelectedNewsId}
        />

        <section className="feed-panel">
          <div className="feed-head">
            <div>
              <h2>{activeQuery || '검색어를 입력하세요'}</h2>
              <p>
                {lastUpdatedAt ? (
                  <>
                    <Clock3 size={14} aria-hidden />
                    {formatDateTime(lastUpdatedAt)}
                  </>
                ) : '수집 대기'}
              </p>
            </div>
            <div className="live-panel">
              <span>{providerHealth}</span>
              <span>{secondsToNextCheck === undefined ? '대기' : `${secondsToNextCheck}s`}</span>
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
                  onSelect={() => setSelectedNewsId(item.id)}
                />
              ))
            )}
          </div>
        </section>

        <aside className="detail-panel">
          <ArticlePanel
            item={selectedNews}
            detail={articleQuery.data}
            isLoading={articleQuery.isLoading}
            displayLanguage={displayLanguage}
          />
          <div className="system-line">
            <span>자동 확인 {lastCheckedAt ? formatDateTime(lastCheckedAt) : '-'}</span>
            <span>{pollIntervalMs ? `${Math.round(pollIntervalMs / 1000)}초 주기` : '주기 계산 중'}</span>
          </div>
        </aside>

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
          <SourceConsole statuses={statuses} />
        </aside>
      </main>
    </div>
  );
}

function SignalBoard({
  signal,
  counts,
  priorityItems,
  statuses,
  providerHealth,
  nextCheckLabel,
  onSelectNews
}: {
  signal: ReturnType<typeof buildSignal>;
  counts: { all: number; high: number; market: number; direct: number; unfavorable: number; favorable: number };
  priorityItems: NewsItem[];
  statuses: ProviderStatus[];
  providerHealth: string;
  nextCheckLabel: string;
  onSelectNews: (id: string) => void;
}) {
  const sourceCounts = sourceStatusCounts(statuses);
  const topItem = priorityItems[0];
  const topImpact = topItem ? fallbackImpact(topItem) : undefined;

  return (
    <section className="signal-board">
      <div className={`signal-card primary ${signal.level}`}>
        <span className="tile-kicker">
          <ShieldAlert size={14} aria-hidden />
          Decision
        </span>
        <strong>{signal.label}</strong>
        <p>{signal.reason}</p>
        <div className="risk-stats">
          <Metric label="불리" value={counts.unfavorable} tone={counts.unfavorable > 0 ? 'danger' : undefined} />
          <Metric label="유리" value={counts.favorable} />
          <Metric label="시장" value={counts.market} tone={counts.market > 0 ? 'danger' : undefined} />
          <Metric label="원문" value={counts.direct} />
        </div>
      </div>

      <div className="signal-card queue">
        <div className="section-title">
          <Activity size={16} aria-hidden />
          <div>
            <h2>우선순위 큐</h2>
            <span>{topImpact ? `최고 영향도 ${topImpact.score}` : '대기'}</span>
          </div>
        </div>
        {priorityItems.length === 0 ? (
          <div className="compact-empty">아직 선별된 뉴스가 없습니다.</div>
        ) : (
          <div className="priority-list">
            {priorityItems.map((item) => {
              const impact = fallbackImpact(item);
              return (
                <button type="button" key={item.id} onClick={() => onSelectNews(item.id)}>
                  <span className={`impact-score small ${impact.level} effect-${impact.positionEffect}`}>{impact.score}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.sourceName} · {formatAge(item.publishedAt)}</small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="signal-card source">
        <div className="section-title">
          <Radio size={16} aria-hidden />
          <div>
            <h2>소스 상태</h2>
            <span>{providerHealth}</span>
          </div>
        </div>
        <div className="source-grid">
          <Metric label="정상" value={sourceCounts.ok} />
          <Metric label="오류" value={sourceCounts.error} tone={sourceCounts.error > 0 ? 'danger' : undefined} />
          <Metric label="비활성" value={sourceCounts.disabled} />
          <Metric label="다음" valueText={nextCheckLabel} />
        </div>
      </div>
    </section>
  );
}

function QuoteStrip({
  symbol,
  quote,
  isLoading,
  isError
}: {
  symbol: string;
  quote?: MarketQuote;
  isLoading: boolean;
  isError: boolean;
}) {
  const tone = quote ? (isNegativeNumber(quote.activeChangePercent) ? 'negative' : 'positive') : 'neutral';
  const session = quote ? quoteSessionLabel(quote.session) : '가격 대기';
  const price = quote?.activePrice;
  const change = quote?.activeChange;
  const changePercent = quote?.activeChangePercent;
  const currency = quote?.currency ?? 'USD';
  const lastTradeAt = quote?.activeTime ?? quote?.postMarketTime ?? quote?.preMarketTime ?? quote?.extendedTime ?? quote?.regularTime;
  const quoteStatus = quote ? quoteFreshnessLabel(quote) : '지연';
  const priceContext = quote ? quotePriceContextLabel(quote) : '가격 대기';
  const nextSession = quote?.nextSession && quote.nextSessionTime
    ? `다음 ${quoteSessionLabel(quote.nextSession)} ${formatKoreaTime(quote.nextSessionTime)}`
    : undefined;

  return (
    <section className={`quote-strip ${tone}`}>
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
      <div className="quote-metrics">
        <Metric label="정규장" valueText={formatMaybeCurrency(quote?.regularPrice, currency)} />
        <Metric label="프리마켓" valueText={formatMaybeCurrency(quote?.preMarketPrice, currency)} />
        <Metric label="애프터마켓" valueText={formatMaybeCurrency(quote?.postMarketPrice, currency)} />
        <Metric label="거래량" valueText={formatCompactNumber(quote?.volume)} />
        <Metric label="체결" valueText={lastTradeAt ? formatAge(lastTradeAt) : '-'} />
        <Metric label="수집" valueText={quote ? formatAge(quote.generatedAt) : '-'} />
      </div>
      <div className="quote-source">
        <span>{quoteStatus}</span>
        <small>{quote?.provider ?? 'quote'} · {quote?.exchange ?? 'US'}</small>
        {nextSession && <small>{nextSession}</small>}
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

function SourceConsole({ statuses }: { statuses: ProviderStatus[] }) {
  if (statuses.length === 0) return null;

  return (
    <section className="source-console">
      <div className="section-title">
        <Wifi size={16} aria-hidden />
        <div>
          <h2>뉴스 소스</h2>
          <span>장애 확인</span>
        </div>
      </div>
      <div className="source-status-list">
        {statuses.map((status) => (
          <div className={`source-status-row ${status.status}`} key={status.id}>
            <span>{status.label}</span>
            <strong>{sourceStatusLabel(status.status)}</strong>
            {status.message && <small>{status.message}</small>}
          </div>
        ))}
      </div>
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

function ArticlePanel({
  item,
  detail,
  isLoading,
  displayLanguage
}: {
  item?: NewsItem;
  detail?: ArticleDetail;
  isLoading: boolean;
  displayLanguage: DisplayLanguage;
}) {
  if (!item) {
    return (
      <section className="article-panel empty">
        <Newspaper size={28} aria-hidden />
        <span>뉴스를 선택하세요</span>
      </section>
    );
  }
  const impact = item.impact ?? detail?.impact;

  return (
    <section className="article-panel">
      <div className="article-meta">
        <span className={`severity ${item.severity}`}>{severityLabel(item.severity)}</span>
        <strong>{item.sourceName}</strong>
        <time>{formatDateTime(item.publishedAt)}</time>
      </div>
      <h2>{articleTitle(item, detail, displayLanguage)}</h2>
      {displayLanguage !== 'original' && detail?.translated && <p className="original-title">{detail.title}</p>}
      <ImpactBreakdown impact={impact} />
      <div className="article-body">
        {isLoading ? (
          <span>본문과 번역을 가져오는 중</span>
        ) : (
          <p>{articleExcerpt(item, detail, displayLanguage)}</p>
        )}
      </div>
      {detail?.message && <div className="detail-note">{detail.message}</div>}
      {detail?.translated && detail.excerpt && (
        <details>
          <summary>원문 보기</summary>
          <p>{detail.excerpt}</p>
        </details>
      )}
      <a className="source-link" href={item.url} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden />
        원문 열기
      </a>
    </section>
  );
}

function ImpactBreakdown({ impact }: { impact?: NewsImpact }) {
  const resolved = resolveImpact(impact);

  return (
    <div className={`impact-panel ${resolved.level} effect-${resolved.positionEffect}`}>
      <div className="impact-summary">
        <span className={`impact-score ${resolved.level} effect-${resolved.positionEffect}`}>{resolved.score}</span>
        <div>
          <strong>{resolved.summary}</strong>
          <span>{deliveryLabel(resolved.deliveryMode)} · 신뢰도 {resolved.confidence}% · {resolved.verification.label}</span>
        </div>
      </div>
      <div className="impact-tags">
        <span className={`position-effect ${resolved.positionEffect}`}>{resolved.positionLabel}</span>
        <span>{positionBiasLabel(resolved.positionBias)}</span>
        <span>{resolved.directionLabel} 재료</span>
        <span>{resolved.priceReaction.label}</span>
        <span>{truthRiskLabel(resolved.truthRisk)}</span>
      </div>
      {resolved.factors.length > 0 && (
        <div className="impact-factors">
          {resolved.factors.slice(0, 4).map((factor) => (
            <div className="impact-factor" key={factor.id}>
              <span>+{factor.score}</span>
              <strong>{factor.label}</strong>
              <em>{factor.reason}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, valueText, tone }: { label: string; value?: number; valueText?: string; tone?: 'danger' }) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{valueText ?? value ?? '-'}</strong>
    </div>
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
  onSelect
}: {
  item: NewsItem;
  translation?: NewsTranslation;
  displayLanguage: DisplayLanguage;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = translatedTitle(item, translation, displayLanguage);
  const snippet = translatedSnippet(item, translation, displayLanguage);
  const impact = fallbackImpact(item);
  const fresh = isFreshItem(item);
  const primaryFactor = impact.factors[0];

  return (
    <article className={`news-card ${item.severity} impact-${impact.level} effect-${impact.positionEffect} ${fresh ? 'fresh' : ''} ${selected ? 'selected' : ''}`} onClick={onSelect}>
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
      </div>
    </article>
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
  for (const ticker of tickerMatches) symbols.add(ticker);
  if (normalized.includes('SOXL') || normalized.includes('SEMICON') || query.includes('반도체')) {
    ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'].forEach((symbol) => symbols.add(symbol));
  }
  if (normalized.includes('TQQQ') || normalized.includes('NASDAQ') || query.includes('나스닥')) {
    ['AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'NVDA', 'TSLA'].forEach((symbol) => symbols.add(symbol));
  }
  if (symbols.size === 0) {
    ['NVDA', 'AMD', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'TSLA'].forEach((symbol) => symbols.add(symbol));
  }
  return Array.from(symbols).slice(0, 12);
}

const knownQuoteSymbols = new Set([
  'SOXL',
  'TQQQ',
  'SQQQ',
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
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function topImpactItem(items: NewsItem[]): NewsItem | undefined {
  return [...items].sort((a, b) => impactScore(b) - impactScore(a))[0];
}

function topImpactItems(items: NewsItem[], limit: number): NewsItem[] {
  return [...items]
    .sort((a, b) => impactScore(b) - impactScore(a) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
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

function buildSignal(items: NewsItem[], newItemsCount: number): {
  level: RiskLevel;
  label: string;
  reason: string;
} {
  const now = Date.now();
  const recentItems = items.filter((item) => now - new Date(item.publishedAt).getTime() <= 2 * 60 * 60 * 1000);
  const recentHigh = recentItems.filter((item) => item.severity === 'high').length;
  const topImpact = Math.max(0, ...recentItems.map(impactScore));
  const adverseItems = recentItems.filter((item) => fallbackImpact(item).positionEffect === 'unfavorable');
  const favorableItems = recentItems.filter((item) => fallbackImpact(item).positionEffect === 'favorable');
  const adverseTop = Math.max(0, ...adverseItems.map(impactScore));
  const favorableTop = Math.max(0, ...favorableItems.map(impactScore));
  const marketHits = recentItems.filter(isMarketImpact).length;
  const directHits = recentItems.filter((item) => item.provider === 'source-search' || item.provider === 'direct-rss').length;
  const score = Math.round(topImpact / 10) + adverseItems.length * 3 + recentHigh * 2 + marketHits * 2 + directHits + Math.min(newItemsCount, 5);

  if (adverseTop >= 70 || score >= 14) return { level: 'risk-off', label: '손절 경계', reason: `포지션 불리 최고 ${adverseTop}. 가격 하락/악재성 뉴스가 우선입니다.` };
  if (favorableTop >= 70 && favorableTop > adverseTop + 10) return { level: 'opportunity', label: '상승 재료', reason: `포지션 유리 최고 ${favorableTop}. 호재와 가격 반응을 같이 확인하세요.` };
  if (topImpact >= 60 || score >= 5) return { level: 'watch', label: 'WATCH', reason: `최고 영향도 ${topImpact}. 방향성 확인이 필요한 뉴스 밀도가 있습니다.` };
  return { level: 'calm', label: 'CALM', reason: '최근 2시간 기준 급한 신호가 적습니다.' };
}

function buildProviderHealth(statuses: ProviderStatus[]): string {
  if (statuses.length === 0) return '소스 대기';
  const ok = statuses.filter((status) => status.status === 'ok').length;
  const error = statuses.filter((status) => status.status === 'error').length;
  return error > 0 ? `소스 ${ok}/${statuses.length} · 오류 ${error}` : `소스 ${ok}/${statuses.length}`;
}

function sourceStatusCounts(statuses: ProviderStatus[]): { ok: number; error: number; disabled: number } {
  return {
    ok: statuses.filter((status) => status.status === 'ok').length,
    error: statuses.filter((status) => status.status === 'error').length,
    disabled: statuses.filter((status) => status.status === 'disabled').length
  };
}

function sourceStatusLabel(status: ProviderStatus['status']): string {
  if (status === 'ok') return '정상';
  if (status === 'error') return '오류';
  if (status === 'disabled') return '꺼짐';
  return '대기';
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

function positionBiasLabel(positionBias: PositionBias): string {
  if (positionBias === 'long') return '상승형 기준';
  if (positionBias === 'inverse') return '인버스 기준';
  return '포지션 미지정';
}

function truthRiskLabel(truthRisk: TruthRisk): string {
  if (truthRisk === 'high') return '사실위험 높음';
  if (truthRisk === 'medium') return '사실위험 중간';
  return '사실위험 낮음';
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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatEarningsTime(item: EarningsEvent): string {
  const base = item.koreaTime ? formatKoreaDateTime(item.koreaTime) : item.reportDate;
  return item.isEstimatedTime ? `${base}` : `${base} 미정`;
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

function quoteSessionLabel(session: QuoteSession): string {
  if (session === 'pre') return '프리마켓';
  if (session === 'regular') return '정규장';
  if (session === 'post') return '애프터마켓';
  if (session === 'closed') return '장마감';
  return '확인중';
}

function quoteFreshnessLabel(quote: MarketQuote): string {
  if (!quote.isRealtime) return '지연 수집';

  const collectedAt = new Date(quote.generatedAt).getTime();
  if (!Number.isFinite(collectedAt)) return '수집중';

  const ageMs = Date.now() - collectedAt;
  const freshWindowMs = Math.max(60_000, quote.cacheTtlMs * 3);
  return ageMs <= freshWindowMs ? '수집중' : '수집 지연';
}

function quotePriceContextLabel(quote: MarketQuote): string {
  const sessionLabel = quoteSessionLabel(quote.session);
  if (quote.session === 'closed') {
    const source = quote.activeSession && quote.activeSession !== 'regular'
      ? `${quoteSessionLabel(quote.activeSession)} 마지막`
      : '정규장 마지막';
    return `${source} · ${sessionLabel}`;
  }

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

function articleTitle(item: NewsItem, detail: ArticleDetail | undefined, displayLanguage: DisplayLanguage): string {
  if (!detail) return item.title;
  if (displayLanguage === 'original') return detail.title;
  if (displayLanguage === 'ko') return detail.titleKo || detail.titleTranslated || detail.title;
  return detail.titleTranslated || detail.title;
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
