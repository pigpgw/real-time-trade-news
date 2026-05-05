import crypto from 'node:crypto';
import type { NewsItem, NewsSeverity } from './news';

const highImpactTerms = [
  'war',
  'warship',
  'missile',
  'attack',
  'strike',
  'explosion',
  'sanction',
  'lawsuit',
  'probe',
  'investigation',
  'bankruptcy',
  'default',
  'recall',
  'guidance',
  'earnings',
  'merger',
  'acquisition',
  'approval',
  'halt',
  'crash',
  'surge',
  'plunge',
  'stocks fall',
  'stocks fell',
  'stocks drop',
  'stocks sink',
  'stocks slump',
  'dow drops',
  'futures fall',
  'oil jumps',
  'oil surges',
  'oil spike',
  'strait of hormuz',
  '전쟁',
  '군함',
  '미사일',
  '공격',
  '타격',
  '폭발',
  '제재',
  '소송',
  '조사',
  '파산',
  '리콜',
  '실적',
  '가이던스',
  '인수',
  '합병',
  '승인',
  '급등',
  '급락',
  '폭락'
];

const mediumImpactTerms = [
  'contract',
  'supply',
  'launch',
  'partnership',
  'regulation',
  'tariff',
  'strike',
  'outage',
  'forecast',
  'stock futures',
  'oil prices',
  'brent',
  'wti',
  'nasdaq',
  's&p 500',
  'dow',
  'upgrade',
  'downgrade',
  '계약',
  '공급',
  '출시',
  '협력',
  '규제',
  '관세',
  '파업',
  '전망',
  '상향',
  '하향'
];

export function createNewsId(provider: string, url: string, title: string): string {
  return crypto.createHash('sha1').update(`${provider}:${normalizeForDedupe(url || title)}`).digest('hex');
}

export function normalizeForDedupe(value: string): string {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

export function scoreNews(title: string, snippet = ''): Pick<NewsItem, 'severity' | 'matchedKeywords'> {
  const text = `${title} ${snippet}`.toLowerCase();
  const high = highImpactTerms.filter((term) => text.includes(term.toLowerCase()));
  if (high.length > 0) {
    return { severity: 'high', matchedKeywords: high };
  }

  const medium = mediumImpactTerms.filter((term) => text.includes(term.toLowerCase()));
  if (medium.length > 0) {
    return { severity: 'medium', matchedKeywords: medium };
  }

  return { severity: 'low', matchedKeywords: [] };
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const item of items) {
    const key = normalizeForDedupe(item.url || item.title);
    const titleKey = normalizeForDedupe(item.title).slice(0, 90);
    const existing = seen.get(key) ?? seen.get(titleKey);
    if (!existing) {
      seen.set(key, item);
      seen.set(titleKey, item);
      continue;
    }

    if (severityWeight(item.severity) > severityWeight(existing.severity)) {
      seen.set(key, item);
      seen.set(titleKey, item);
    }
  }

  return Array.from(new Set(seen.values())).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function isRecent(isoDate: string, lookbackHours: number): boolean {
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= lookbackHours * 60 * 60 * 1000;
}

export function parseGdeltDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return new Date(value).toISOString();
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

export function compactQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function quotedQuery(query: string): string {
  const compact = compactQuery(query);
  return /\s/.test(compact) ? `"${compact}"` : compact;
}

function severityWeight(severity: NewsSeverity): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}
