import type {
  MarketAlignment,
  NewsDirection,
  NewsImpact,
  NewsImpactFactor,
  NewsImpactLevel,
  PositionBias,
  PositionEffect,
  PriceReaction,
  PriceReactionDirection,
  TruthRisk,
  VerificationLevel
} from './impact';
import type { NewsItem, NewsProviderId, NewsSeverity } from './news';
import { expandQuery, matchesExpandedQuery } from './queryExpansion';

interface ImpactInput {
  query: string;
  item: Pick<NewsItem, 'provider' | 'title' | 'publishedAt' | 'snippet' | 'severity' | 'matchedKeywords' | 'sourceName'>;
  peers?: Array<Pick<NewsItem, 'title' | 'snippet' | 'publishedAt' | 'severity' | 'sourceName'>>;
  body?: string;
  marketTurnoverRank?: number;
  price?: PriceContext;
}

export interface PriceContext {
  symbol?: string;
  session?: string;
  activeChangePercent?: number;
  regularChangePercent?: number;
  provider?: string;
  isRealtime?: boolean;
}

interface DirectionAnalysis {
  direction: NewsDirection;
  bullishScore: number;
  bearishScore: number;
  bullishHits: string[];
  bearishHits: string[];
}

interface VerificationAnalysis {
  level: VerificationLevel;
  truthRisk: TruthRisk;
  confidence: number;
  corroboratingReports: number;
  reason: string;
}

const directionalRules = [
  {
    direction: 'bearish' as const,
    weight: 26,
    channel: '지정학/전쟁',
    terms: ['missile', 'missiles', 'attack', 'airstrike', 'strike', 'explosion', 'war', 'uav', 'drone', 'hormuz', 'strait of hormuz', 'iran attacks', 'israel attacks', '미사일', '공격', '공습', '폭발', '전쟁', '호르무즈']
  },
  {
    direction: 'bearish' as const,
    weight: 24,
    channel: '시장 하락',
    terms: ['futures fall', 'futures drop', 'stocks fall', 'stocks fell', 'stocks drop', 'stocks sink', 'selloff', 'plunge', 'risk-off', 'dow drops', 'nasdaq falls', '급락', '폭락', '하락']
  },
  {
    direction: 'bearish' as const,
    weight: 24,
    channel: '기업 리스크',
    terms: ['downgrade', 'cuts guidance', 'guidance cut', 'misses estimates', 'probe', 'investigation', 'lawsuit', 'halt', 'recall', 'bankruptcy', 'default', 'sanction', 'export control', 'tariff', '하향', '조사', '소송', '제재', '관세']
  },
  {
    direction: 'bearish' as const,
    weight: 18,
    channel: '금리/원자재 압박',
    terms: ['oil jumps', 'oil surges', 'oil spike', 'yields rise', 'yields jump', 'rates rise', 'inflation hot', '유가 급등', '금리 상승']
  },
  {
    direction: 'bullish' as const,
    weight: 26,
    channel: '실적/가이던스 호재',
    terms: ['beats estimates', 'beat estimates', 'raises guidance', 'raises outlook', 'strong guidance', 'record revenue', 'eps beat', 'revenue beat', '실적 호조', '가이던스 상향', '어닝 서프라이즈']
  },
  {
    direction: 'bullish' as const,
    weight: 22,
    channel: '시장 상승',
    terms: ['futures rise', 'futures gain', 'stocks rise', 'stocks rally', 'nasdaq rises', 'surge', 'jumps', 'rallies', 'breakout', '급등', '반등', '상승']
  },
  {
    direction: 'bullish' as const,
    weight: 22,
    channel: '기업/섹터 호재',
    terms: ['upgrade', 'target raised', 'price target raised', 'approval', 'contract win', 'partnership', 'acquisition', 'chip demand', 'ai demand', 'data center demand', '상향', '승인', '계약', '수요 증가']
  },
  {
    direction: 'bullish' as const,
    weight: 18,
    channel: '매크로 완화',
    terms: ['ceasefire', 'tensions ease', 'oil falls', 'oil slides', 'yields fall', 'rate cut', 'tariff delay', '휴전', '긴장 완화', '유가 하락', '금리 인하']
  }
];

const rumorTerms = ['rumor', 'rumour', 'unconfirmed', 'social media', 'may', 'could', 'reportedly', 'alleged', 'claims', '소문', '미확인', '가능성'];
const disputedTerms = ['denies', 'denied', 'disputed', 'false', 'fake', 'hoax', 'retract', 'correction', '부인', '허위', '가짜', '정정'];
const officialTerms = ['official', 'confirmed', 'filed', 'filing', 'sec', 'earnings release', 'company says', 'guidance', '실적 발표', '공시', '확인'];
const inverseTerms = ['sqqq', 'soxs', 'spxs', 'sh', 'psq', 'qid', 'tza', 'inverse', 'short', 'bear 3x', '인버스', '숏'];
const leveragedTerms = ['soxl', 'tqqq', 'sqqq', 'soxs', 'upro', 'spxl', '3x', 'leveraged', '레버리지'];

export function scoreNewsImpact(input: ImpactInput): NewsImpact {
  const factors: NewsImpactFactor[] = [];
  const text = `${input.item.title} ${input.item.snippet ?? ''} ${input.body ?? ''}`.toLowerCase();
  const profile = inferPositionBias(input.query);
  const direction = analyzeDirection(text);
  const priceReaction = analyzePriceReaction(input.price, direction.direction);
  const marketAlignment = resolveMarketAlignment(direction.direction, priceReaction.direction);
  const positionEffect = resolvePositionEffect(profile, direction.direction, priceReaction);
  const verification = analyzeVerification(input, text, marketAlignment, priceReaction);

  addFactor(factors, relevanceFactor(input.query, text));
  addFactor(factors, directionFactor(direction));
  addFactor(factors, freshnessFactor(input.item.publishedAt));
  addFactor(factors, sourceFactor(input.item.provider, input.item.sourceName));
  addFactor(factors, pressureFactor(input.peers, direction.direction));
  addFactor(factors, leverageFactor(input.query, text));
  addFactor(factors, priceReactionFactor(priceReaction, profile));
  addFactor(factors, turnoverFactor(input.marketTurnoverRank));

  const rawScore = factors.reduce((sum, factor) => sum + factor.score, 0);
  const verifiedScore = rawScore * verificationMultiplier(verification.truthRisk, marketAlignment, priceReaction);
  const positionBoost = positionEffect === 'unfavorable' ? 8 : positionEffect === 'favorable' ? 4 : 0;
  const score = clamp(Math.round(verifiedScore + positionBoost), 0, 100);
  const level = impactLevel(score, positionEffect);
  const confidence = clamp(verification.confidence, 20, 95);
  const affectedChannels = Array.from(new Set(factors.filter((factor) => factor.score > 0).map((factor) => factor.label)));

  return {
    score,
    level,
    label: positionEffectLabel(positionEffect),
    deliveryMode: deliveryMode(level, positionEffect),
    confidence,
    summary: impactSummary(score, positionEffect, direction.direction, priceReaction, verification.truthRisk),
    direction: direction.direction,
    directionLabel: directionLabel(direction.direction),
    positionBias: profile,
    positionEffect,
    positionLabel: positionEffectLabel(positionEffect),
    actionHint: actionHint(positionEffect, profile, priceReaction),
    verification: {
      level: verification.level,
      label: verificationLabel(verification.level),
      confidence,
      truthRisk: verification.truthRisk,
      reason: verification.reason,
      corroboratingReports: verification.corroboratingReports
    },
    truthRisk: verification.truthRisk,
    priceReaction,
    marketAlignment,
    affectedChannels,
    factors: factors.filter((factor) => factor.score > 0)
  };
}

function analyzeDirection(text: string): DirectionAnalysis {
  const bullishHits: string[] = [];
  const bearishHits: string[] = [];
  let bullishScore = 0;
  let bearishScore = 0;

  for (const rule of directionalRules) {
    const hits = rule.terms.filter((term) => text.includes(term.toLowerCase()));
    if (hits.length === 0) continue;
    const score = rule.weight + Math.min(8, hits.length * 2);
    if (rule.direction === 'bullish') {
      bullishScore += score;
      bullishHits.push(...hits);
    } else {
      bearishScore += score;
      bearishHits.push(...hits);
    }
  }

  const spread = Math.abs(bullishScore - bearishScore);
  const direction: NewsDirection = bullishScore === 0 && bearishScore === 0
    ? 'neutral'
    : bullishScore > 0 && bearishScore > 0 && spread <= 12
      ? 'mixed'
      : bullishScore > bearishScore
        ? 'bullish'
        : 'bearish';

  return {
    direction,
    bullishScore,
    bearishScore,
    bullishHits: Array.from(new Set(bullishHits)),
    bearishHits: Array.from(new Set(bearishHits))
  };
}

function analyzePriceReaction(price: PriceContext | undefined, direction: NewsDirection): PriceReaction {
  const changePercent = price?.activeChangePercent ?? price?.regularChangePercent;
  if (changePercent === undefined || !Number.isFinite(changePercent)) {
    return {
      direction: 'unknown',
      aligned: false,
      label: '가격 반응 없음',
      reason: '현재가 데이터가 없어 뉴스만 기준으로 판단'
    };
  }

  const abs = Math.abs(changePercent);
  const priceDirection: PriceReactionDirection = abs < 0.25 ? 'flat' : changePercent > 0 ? 'up' : 'down';
  const aligned = (direction === 'bullish' && priceDirection === 'up')
    || (direction === 'bearish' && priceDirection === 'down')
    || direction === 'neutral'
    || direction === 'mixed'
    || priceDirection === 'flat';

  return {
    direction: priceDirection,
    changePercent,
    session: price?.session,
    aligned,
    label: priceDirection === 'up' ? '가격 상승' : priceDirection === 'down' ? '가격 하락' : '가격 보합',
    reason: `${price?.symbol ?? '종목'} ${price?.session ?? '현재'} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%${price?.isRealtime ? ' · 실시간' : ''}`
  };
}

function analyzeVerification(
  input: ImpactInput,
  text: string,
  marketAlignment: MarketAlignment,
  priceReaction: PriceReaction
): VerificationAnalysis {
  const trustedSource = isTrustedSource(input.item.provider, input.item.sourceName);
  const hasRumor = rumorTerms.some((term) => text.includes(term));
  const hasDispute = disputedTerms.some((term) => text.includes(term));
  const hasOfficial = officialTerms.some((term) => text.includes(term)) || input.item.provider === 'sec';
  const recentPeers = (input.peers ?? []).filter((peer) =>
    Date.now() - new Date(peer.publishedAt).getTime() <= 2 * 60 * 60 * 1000
  );
  const corroboratingReports = Math.max(0, recentPeers.length - 1);
  const priceConfirmed = marketAlignment === 'confirming' && priceReaction.direction !== 'flat';

  let level: VerificationLevel = 'single-source';
  if (hasDispute) level = 'disputed';
  else if (hasRumor && !priceConfirmed && corroboratingReports < 2) level = 'rumor';
  else if (hasOfficial || (trustedSource && corroboratingReports >= 2)) level = 'confirmed';
  else if (trustedSource || corroboratingReports >= 2 || priceConfirmed) level = 'corroborated';

  const truthRisk: TruthRisk = level === 'disputed' || level === 'rumor'
    ? 'high'
    : level === 'single-source'
      ? 'medium'
      : 'low';

  const confidence = clamp(
    38
      + (trustedSource ? 16 : 6)
      + Math.min(18, corroboratingReports * 5)
      + (hasOfficial ? 14 : 0)
      + (priceConfirmed ? 12 : 0)
      - (hasRumor ? 14 : 0)
      - (hasDispute ? 24 : 0)
      - (marketAlignment === 'diverging' ? 10 : 0),
    20,
    95
  );

  return {
    level,
    truthRisk,
    confidence,
    corroboratingReports,
    reason: verificationReason(level, trustedSource, corroboratingReports, priceConfirmed)
  };
}

function relevanceFactor(query: string, text: string): NewsImpactFactor {
  const expanded = expandQuery(query);
  const exactTerms = expanded.filter((term) => term.length >= 2 && text.includes(term.toLowerCase()));
  const matched = matchesExpandedQuery(query, text);
  const score = exactTerms.length >= 3 ? 18 : exactTerms.length >= 1 ? 12 : matched ? 8 : 0;
  return {
    id: 'relevance',
    label: '종목/테마 관련성',
    score,
    reason: score > 0 ? `검색어와 ${exactTerms.slice(0, 3).join(', ') || '확장 키워드'} 매칭` : '직접 관련성 낮음'
  };
}

function directionFactor(direction: DirectionAnalysis): NewsImpactFactor {
  const score = clamp(Math.max(direction.bullishScore, direction.bearishScore, Math.min(direction.bullishScore, direction.bearishScore)) / 2, 0, 34);
  const hits = direction.direction === 'bullish'
    ? direction.bullishHits
    : direction.direction === 'bearish'
      ? direction.bearishHits
      : [...direction.bullishHits, ...direction.bearishHits];
  return {
    id: 'direction',
    label: '상승/하락 재료',
    score,
    reason: hits.length > 0 ? `${directionLabel(direction.direction)} · ${hits.slice(0, 4).join(', ')}` : '방향성 키워드 약함'
  };
}

function freshnessFactor(publishedAt: string): NewsImpactFactor {
  const ageMinutes = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 60_000);
  const score = ageMinutes <= 10 ? 18 : ageMinutes <= 30 ? 15 : ageMinutes <= 120 ? 11 : ageMinutes <= 360 ? 7 : ageMinutes <= 1440 ? 3 : 0;
  return {
    id: 'freshness',
    label: '신선도',
    score,
    reason: score > 0 ? `${Math.round(ageMinutes)}분 전 공개` : '24시간 이상 경과'
  };
}

function sourceFactor(provider: NewsProviderId, sourceName: string): NewsImpactFactor {
  const trustedSource = isTrustedSource(provider, sourceName);
  const baseByProvider: Record<NewsProviderId, number> = {
    sec: 18,
    'source-search': 14,
    'direct-rss': 13,
    gdelt: 10,
    'google-news': 8,
    naver: 8,
    newsapi: 9
  };
  const score = baseByProvider[provider] + (trustedSource ? 5 : 0);
  return {
    id: 'source',
    label: '출처 신뢰도',
    score: clamp(score, 0, 20),
    reason: trustedSource ? `${sourceName} 주요/원문 소스` : `${sourceName} · ${provider}`
  };
}

function pressureFactor(peers: ImpactInput['peers'], direction: NewsDirection): NewsImpactFactor {
  if (!peers || peers.length === 0) {
    return { id: 'pressure', label: '동시 보도 압력', score: 0, reason: '비교 뉴스 없음' };
  }
  const recent = peers.filter((peer) => Date.now() - new Date(peer.publishedAt).getTime() <= 2 * 60 * 60 * 1000);
  const sameDirection = direction === 'neutral' || direction === 'mixed'
    ? recent.length
    : recent.filter((peer) => analyzeDirection(`${peer.title} ${peer.snippet ?? ''}`.toLowerCase()).direction === direction).length;
  const high = recent.filter((peer) => peer.severity === 'high').length;
  const score = Math.min(14, sameDirection * 2 + high);
  return {
    id: 'pressure',
    label: '동시 보도 압력',
    score,
    reason: score > 0 ? `최근 2시간 같은 방향 ${sameDirection}건, 긴급 ${high}건` : '최근 동시 보도 적음'
  };
}

function leverageFactor(query: string, text: string): NewsImpactFactor {
  const combined = `${query} ${text}`.toLowerCase();
  const isLeveraged = leveragedTerms.some((term) => combined.includes(term));
  const isHighBeta = /semiconductor|chip|nasdaq|ai|nvidia|amd|반도체|나스닥/.test(combined);
  const score = isLeveraged ? 12 : isHighBeta ? 7 : 0;
  return {
    id: 'sensitivity',
    label: '상품 민감도',
    score,
    reason: isLeveraged ? '3배/레버리지 상품 민감도 반영' : isHighBeta ? '고베타 섹터 민감도 반영' : '민감도 보정 없음'
  };
}

function priceReactionFactor(priceReaction: PriceReaction, positionBias: PositionBias): NewsImpactFactor {
  const abs = Math.abs(priceReaction.changePercent ?? 0);
  const multiplier = positionBias === 'long' || positionBias === 'inverse' ? 7 : 5;
  const score = clamp(abs * multiplier, 0, 22);
  return {
    id: 'price',
    label: '실제 가격 반응',
    score,
    reason: priceReaction.direction === 'unknown' ? '가격 데이터 없음' : priceReaction.reason
  };
}

function turnoverFactor(rank?: number): NewsImpactFactor {
  if (!rank) {
    return {
      id: 'turnover',
      label: '거래대금/수급',
      score: 0,
      reason: '실시간 거래대금 직접 매칭 없음'
    };
  }
  const score = rank <= 3 ? 10 : rank <= 8 ? 7 : 4;
  return {
    id: 'turnover',
    label: '거래대금/수급',
    score,
    reason: `거래대금/수급 랭킹 ${rank}위권`
  };
}

function inferPositionBias(query: string): PositionBias {
  const text = query.toLowerCase();
  if (inverseTerms.some((term) => text.includes(term))) return 'inverse';
  if (/^[a-z0-9.=-]{1,12}$/i.test(query.trim()) || leveragedTerms.some((term) => text.includes(term))) return 'long';
  return 'unknown';
}

function resolvePositionEffect(positionBias: PositionBias, direction: NewsDirection, priceReaction: PriceReaction): PositionEffect {
  const newsEffect = effectFromDirection(positionBias, direction);
  const priceEffect = effectFromPrice(positionBias, priceReaction.direction);
  const priceMove = Math.abs(priceReaction.changePercent ?? 0);

  if (priceMove >= 0.5 && priceEffect !== 'neutral') {
    if (newsEffect === 'neutral') return priceEffect;
    if (newsEffect === priceEffect) return priceEffect;
    return priceEffect === 'unfavorable' ? 'unfavorable' : 'mixed';
  }

  return newsEffect;
}

function effectFromDirection(positionBias: PositionBias, direction: NewsDirection): PositionEffect {
  if (direction === 'mixed') return 'mixed';
  if (direction === 'neutral' || positionBias === 'unknown') return 'neutral';
  const bullishIsFavorable = positionBias === 'long';
  return (direction === 'bullish') === bullishIsFavorable ? 'favorable' : 'unfavorable';
}

function effectFromPrice(positionBias: PositionBias, priceDirection: PriceReactionDirection): PositionEffect {
  if (priceDirection === 'unknown' || priceDirection === 'flat' || positionBias === 'unknown') return 'neutral';
  return priceDirection === 'up' ? 'favorable' : 'unfavorable';
}

function resolveMarketAlignment(direction: NewsDirection, priceDirection: PriceReactionDirection): MarketAlignment {
  if (priceDirection === 'unknown') return 'unknown';
  if (direction === 'neutral' || direction === 'mixed' || priceDirection === 'flat') return 'neutral';
  if ((direction === 'bullish' && priceDirection === 'up') || (direction === 'bearish' && priceDirection === 'down')) {
    return 'confirming';
  }
  return 'diverging';
}

function verificationMultiplier(truthRisk: TruthRisk, marketAlignment: MarketAlignment, priceReaction: PriceReaction): number {
  const priceMove = Math.abs(priceReaction.changePercent ?? 0);
  if (truthRisk === 'high' && marketAlignment !== 'confirming') return priceMove >= 1 ? 0.82 : 0.68;
  if (truthRisk === 'medium' && marketAlignment === 'diverging') return 0.82;
  if (truthRisk === 'medium') return 0.9;
  return 1;
}

function addFactor(factors: NewsImpactFactor[], factor: NewsImpactFactor): void {
  factors.push({ ...factor, score: clamp(Math.round(factor.score), 0, 40) });
}

function impactLevel(score: number, effect: PositionEffect): NewsImpactLevel {
  if (score >= 82 || (effect === 'unfavorable' && score >= 74)) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function deliveryMode(level: NewsImpactLevel, effect: PositionEffect): NewsImpact['deliveryMode'] {
  if (level === 'critical' || (effect === 'unfavorable' && level === 'high')) return 'breaking';
  if (level === 'high') return 'priority';
  if (level === 'medium') return 'watch';
  return 'normal';
}

function impactSummary(
  score: number,
  effect: PositionEffect,
  direction: NewsDirection,
  priceReaction: PriceReaction,
  truthRisk: TruthRisk
): string {
  const base = `${positionEffectLabel(effect)} · 영향도 ${score}. ${directionLabel(direction)} 재료`;
  const price = priceReaction.direction === 'unknown' ? '가격 확인 전' : priceReaction.reason;
  const caution = truthRisk === 'high' ? ' 미확인/반박 가능성이 커서 사실 확인 전 과신 금지.' : truthRisk === 'medium' ? ' 단일 출처 가능성을 감안.' : '';
  if (effect === 'unfavorable') return `${base}. 손절/축소 판단이 필요한 방향입니다. ${price}.${caution}`;
  if (effect === 'favorable') return `${base}. 보유 포지션에는 우호적이나 추격 전 가격 반응을 확인하세요. ${price}.${caution}`;
  if (effect === 'mixed') return `${base}. 뉴스 방향과 가격 반응이 엇갈릴 수 있습니다. ${price}.${caution}`;
  return `${base}. 아직 포지션 방향성은 약합니다. ${price}.${caution}`;
}

function actionHint(effect: PositionEffect, positionBias: PositionBias, priceReaction: PriceReaction): string {
  const product = positionBias === 'inverse' ? '인버스' : positionBias === 'long' ? '상승형' : '선택 종목';
  if (effect === 'unfavorable') return `${product} 기준 불리. 가격 ${priceReaction.label} 확인 후 손절/비중축소 우선.`;
  if (effect === 'favorable') return `${product} 기준 유리. 추격매수보다 새 뉴스와 거래량 확인.`;
  if (effect === 'mixed') return `${product} 기준 혼재. 뉴스보다 실제 가격 흐름 우선.`;
  return `${product} 기준 중립. 추가 보도 또는 가격 돌파 대기.`;
}

function directionLabel(direction: NewsDirection): string {
  if (direction === 'bullish') return '상승';
  if (direction === 'bearish') return '하락';
  if (direction === 'mixed') return '혼재';
  return '중립';
}

function positionEffectLabel(effect: PositionEffect): string {
  if (effect === 'favorable') return '포지션 유리';
  if (effect === 'unfavorable') return '포지션 불리';
  if (effect === 'mixed') return '혼재';
  return '중립';
}

function verificationLabel(level: VerificationLevel): string {
  if (level === 'confirmed') return '확인 강함';
  if (level === 'corroborated') return '교차 확인';
  if (level === 'rumor') return '루머 주의';
  if (level === 'disputed') return '반박/정정 주의';
  return '단일 출처';
}

function verificationReason(level: VerificationLevel, trustedSource: boolean, corroboratingReports: number, priceConfirmed: boolean): string {
  const parts = [
    trustedSource ? '주요 소스' : '일반 소스',
    `동시 보도 ${corroboratingReports}건`,
    priceConfirmed ? '가격 반응 확인' : '가격 확인 약함'
  ];
  return `${verificationLabel(level)} · ${parts.join(' · ')}`;
}

function isTrustedSource(provider: NewsProviderId, sourceName: string): boolean {
  if (provider === 'sec') return true;
  return /reuters|associated press|ap news|bloomberg|wall street journal|cnbc|marketwatch|sec|dart|financial times|investing\.com|al jazeera|bbc/i.test(sourceName);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
