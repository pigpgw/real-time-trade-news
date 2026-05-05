import type { NewsImpact } from './impact';

export interface ArticleDetail {
  url: string;
  sourceName?: string;
  title: string;
  titleKo: string;
  titleTranslated: string;
  excerpt: string;
  excerptKo: string;
  excerptTranslated: string;
  language: string;
  targetLanguage: 'ko' | 'en' | 'original';
  translated: boolean;
  impact?: NewsImpact;
  fetchedAt: string;
  message?: string;
}
