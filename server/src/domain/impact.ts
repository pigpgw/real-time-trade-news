export type NewsImpactLevel = 'critical' | 'high' | 'medium' | 'low';
export type NewsDeliveryMode = 'breaking' | 'priority' | 'watch' | 'normal';

export interface NewsImpactFactor {
  id: string;
  label: string;
  score: number;
  reason: string;
}

export interface NewsImpact {
  score: number;
  level: NewsImpactLevel;
  label: string;
  deliveryMode: NewsDeliveryMode;
  confidence: number;
  summary: string;
  affectedChannels: string[];
  factors: NewsImpactFactor[];
}
