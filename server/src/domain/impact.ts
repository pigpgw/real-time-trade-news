export type NewsImpactLevel = 'critical' | 'high' | 'medium' | 'low';
export type NewsDeliveryMode = 'breaking' | 'priority' | 'watch' | 'normal';
export type NewsDirection = 'bullish' | 'bearish' | 'mixed' | 'neutral';
export type PositionBias = 'long' | 'inverse' | 'unknown';
export type PositionEffect = 'favorable' | 'unfavorable' | 'mixed' | 'neutral';
export type VerificationLevel = 'confirmed' | 'corroborated' | 'single-source' | 'rumor' | 'disputed';
export type TruthRisk = 'low' | 'medium' | 'high';
export type PriceReactionDirection = 'up' | 'down' | 'flat' | 'unknown';
export type MarketAlignment = 'confirming' | 'diverging' | 'neutral' | 'unknown';

export interface NewsImpactFactor {
  id: string;
  label: string;
  score: number;
  reason: string;
}

export interface NewsVerification {
  level: VerificationLevel;
  label: string;
  confidence: number;
  truthRisk: TruthRisk;
  reason: string;
  corroboratingReports: number;
}

export interface PriceReaction {
  direction: PriceReactionDirection;
  changePercent?: number;
  session?: string;
  aligned: boolean;
  label: string;
  reason: string;
}

export interface NewsImpact {
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
  verification: NewsVerification;
  truthRisk: TruthRisk;
  priceReaction: PriceReaction;
  marketAlignment: MarketAlignment;
  affectedChannels: string[];
  factors: NewsImpactFactor[];
}
