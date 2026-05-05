export interface ArticleDetail {
  url: string;
  sourceName?: string;
  title: string;
  titleKo: string;
  excerpt: string;
  excerptKo: string;
  language: string;
  translated: boolean;
  fetchedAt: string;
  message?: string;
}
