export type RankingType = 'turnover' | 'gainers' | 'losers' | 'foreign' | 'institution';
export type RankingMarket = 'KOSPI' | 'KOSDAQ';

export interface RankingItem {
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

export interface RankingResult {
  generatedAt: string;
  source: 'naver-mobile' | 'sample';
  market: RankingMarket;
  type: RankingType;
  cacheTtlMs: number;
  providerMessage: string;
  items: RankingItem[];
}
