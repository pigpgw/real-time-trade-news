import type { NewsImpact, NewsImpactFactor, NewsImpactLevel } from './impact';
import type { NewsItem, NewsProviderId, NewsSeverity } from './news';
import { expandQuery, matchesExpandedQuery } from './queryExpansion';

interface ImpactInput {
  query: string;
  item: Pick<NewsItem, 'provider' | 'title' | 'publishedAt' | 'snippet' | 'severity' | 'matchedKeywords' | 'sourceName'>;
  peers?: Array<Pick<NewsItem, 'title' | 'snippet' | 'publishedAt' | 'severity'>>;
  body?: string;
  marketTurnoverRank?: number;
}

const eventWeights = [
  { terms: ['missile', 'missiles', 'attack', 'airstrike', 'strike', 'explosion', 'war', 'uav', 'drone', 'sanction', 'strait of hormuz', 'hormuz', '미사일', '공격', '공습', '폭발', '전쟁', '제재', '호르무즈'], score: 32, channel: '지정학/전쟁' },
  { terms: ['earnings', 'guidance', 'revenue', 'eps', 'downgrade', 'upgrade', 'target', '실적', '가이던스', '매출', '하향', '상향'], score: 24, channel: '기업 이벤트' },
  { terms: ['halt', 'recall', 'probe', 'investigation', 'lawsuit', 'bankruptcy', 'default', '거래정지', '리콜', '조사', '소송', '파산'], score: 30, channel: '기업 리스크' },
  { terms: ['fed', 'rate', 'yield', 'inflation', 'cpi', 'pce', 'dollar', '금리', '국채', '인플레이션', '환율'], score: 20, channel: '금리/환율' },
  { terms: ['oil', 'brent', 'wti', 'crude', 'gas', '유가', '원유'], score: 18, channel: '원자재' },
  { terms: ['semiconductor', 'chip', 'ai chip', 'nvidia', 'amd', 'hbm', '반도체', '엔비디아'], score: 18, channel: '섹터/테마' },
  { terms: ['nasdaq', 's&p', 'dow', 'futures', 'stock futures', 'selloff', 'plunge', 'surge', '나스닥', '선물', '급락', '급등'], score: 16, channel: '시장 전반' }
];

export function scoreNewsImpact(input: ImpactInput): NewsImpact {
  const factors: NewsImpactFactor[] = [];
  const text = `${input.item.title} ${input.item.snippet ?? ''} ${input.body ?? ''}`.toLowerCase();

  addFactor(factors, relevanceFactor(input.query, text));
  addFactor(factors, eventFactor(text, input.item.matchedKeywords));
  addFactor(factors, freshnessFactor(input.item.publishedAt));
  addFactor(factors, sourceFactor(input.item.provider, input.item.sourceName));
  addFactor(factors, pressureFactor(input.peers));
  addFactor(factors, leverageFactor(input.query, text));
  addFactor(factors, turnoverFactor(input.marketTurnoverRank));

  const score = clamp(Math.round(factors.reduce((sum, factor) => sum + factor.score, 0)), 0, 100);
  const level = impactLevel(score);
  const affectedChannels = Array.from(new Set(factors.filter((factor) => factor.score > 0).map((factor) => factor.label)));
  const confidence = clamp(Math.round(45 + factors.filter((factor) => factor.score > 0).length * 9), 45, 95);

  return {
    score,
    level,
    label: impactLabel(level),
    deliveryMode: deliveryMode(level),
    confidence,
    summary: impactSummary(level, score),
    affectedChannels,
    factors: factors.filter((factor) => factor.score > 0)
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

function eventFactor(text: string, matchedKeywords: string[] = []): NewsImpactFactor {
  let best = { score: 0, channel: '이벤트', terms: [] as string[] };
  for (const group of eventWeights) {
    const hits = group.terms.filter((term) => text.includes(term.toLowerCase()));
    if (hits.length > 0 && group.score > best.score) {
      best = { score: group.score + Math.min(8, hits.length * 2), channel: group.channel, terms: hits };
    }
  }

  if (matchedKeywords.length > 0 && best.score < 18) {
    best = { score: 18, channel: '키워드', terms: matchedKeywords.slice(0, 3) };
  }

  return {
    id: 'event',
    label: '뉴스 이벤트 강도',
    score: clamp(best.score, 0, 38),
    reason: best.score > 0 ? `${best.channel} · ${best.terms.slice(0, 4).join(', ')}` : '강한 이벤트 키워드 없음'
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
  const trustedSource = /reuters|associated press|ap news|bloomberg|wall street journal|cnbc|marketwatch|sec|dart|financial times/i.test(sourceName);
  const baseByProvider: Record<NewsProviderId, number> = {
    sec: 18,
    'source-search': 14,
    'direct-rss': 13,
    gdelt: 11,
    'google-news': 8,
    naver: 8,
    newsapi: 9
  };
  const score = baseByProvider[provider] + (trustedSource ? 5 : 0);
  return {
    id: 'source',
    label: '소스 신뢰도',
    score: clamp(score, 0, 20),
    reason: trustedSource ? `${sourceName} 원문/주요 매체` : `${sourceName} · ${provider}`
  };
}

function pressureFactor(peers: ImpactInput['peers']): NewsImpactFactor {
  if (!peers || peers.length === 0) {
    return { id: 'pressure', label: '동시 보도 압력', score: 0, reason: '비교 뉴스 없음' };
  }
  const recent = peers.filter((peer) => Date.now() - new Date(peer.publishedAt).getTime() <= 2 * 60 * 60 * 1000);
  const high = recent.filter((peer) => peer.severity === 'high').length;
  const score = Math.min(12, recent.length + high * 2);
  return {
    id: 'pressure',
    label: '동시 보도 압력',
    score,
    reason: score > 0 ? `최근 2시간 ${recent.length}건, 긴급 ${high}건` : '최근 동시 보도 적음'
  };
}

function leverageFactor(query: string, text: string): NewsImpactFactor {
  const combined = `${query} ${text}`.toLowerCase();
  const isLeveraged = /soxl|tqqq|sqqq|upro|spxl|3x|leveraged|레버리지|인버스/.test(combined);
  const isHighBeta = /semiconductor|chip|nasdaq|ai|nvidia|amd|반도체|나스닥/.test(combined);
  const score = isLeveraged ? 10 : isHighBeta ? 6 : 0;
  return {
    id: 'sensitivity',
    label: '상품 민감도',
    score,
    reason: isLeveraged ? '3배/레버리지 상품 민감도 반영' : isHighBeta ? '고베타 섹터 민감도 반영' : '민감도 보정 없음'
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

function addFactor(factors: NewsImpactFactor[], factor: NewsImpactFactor): void {
  factors.push({ ...factor, score: clamp(Math.round(factor.score), 0, 40) });
}

function impactLevel(score: number): NewsImpactLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function impactLabel(level: NewsImpactLevel): string {
  if (level === 'critical') return '긴급';
  if (level === 'high') return '강함';
  if (level === 'medium') return '주의';
  return '일반';
}

function deliveryMode(level: NewsImpactLevel): NewsImpact['deliveryMode'] {
  if (level === 'critical') return 'breaking';
  if (level === 'high') return 'priority';
  if (level === 'medium') return 'watch';
  return 'normal';
}

function impactSummary(level: NewsImpactLevel, score: number): string {
  if (level === 'critical') return `영향도 ${score}. 즉시 확인이 필요한 긴급 뉴스입니다.`;
  if (level === 'high') return `영향도 ${score}. 가격 변동으로 이어질 가능성이 높은 뉴스입니다.`;
  if (level === 'medium') return `영향도 ${score}. 관련 종목/섹터를 관찰해야 하는 뉴스입니다.`;
  return `영향도 ${score}. 일반 모니터링 항목입니다.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
