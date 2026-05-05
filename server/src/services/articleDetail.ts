import crypto from 'node:crypto';
import type { ArticleDetail } from '../domain/article';
import { decodeHtml, stripHtml } from '../domain/newsUtils';
import { fetchJson, fetchText } from '../providers/http';

interface ArticleRequest {
  url: string;
  title?: string;
  snippet?: string;
  sourceName?: string;
  language?: string;
}

interface TranslationResponse {
  responseData?: {
    translatedText?: string;
  };
}

const DETAIL_TTL_MS = 30 * 60 * 1000;
const TRANSLATION_TTL_MS = 12 * 60 * 60 * 1000;
const detailCache = new Map<string, { expiresAt: number; detail: ArticleDetail }>();
const translationCache = new Map<string, { expiresAt: number; text: string }>();

export async function getArticleDetail(request: ArticleRequest): Promise<ArticleDetail> {
  const cacheKey = hash(`${request.url}:${request.title ?? ''}:${request.snippet ?? ''}`);
  const cached = detailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.detail;

  const fallbackTitle = stripHtml(request.title ?? '');
  const fallbackSnippet = stripHtml(request.snippet ?? '');
  const page = isGoogleNewsUrl(request.url)
    ? {
      title: fallbackTitle,
      excerpt: fallbackSnippet,
      message: 'Google News 중계 URL은 원문 본문 대신 RSS 요약을 표시합니다. 원문검색/직접RSS 항목은 공개 본문을 더 길게 보여줍니다.'
    }
    : await fetchReadableArticle(request.url).catch((error) => ({
      title: fallbackTitle,
      excerpt: fallbackSnippet,
      message: `본문 직접 수집 실패: ${error instanceof Error ? error.message : String(error)}`
    }));

  const title = page.title || fallbackTitle || request.sourceName || '제목 없음';
  const excerpt = normalizeExcerpt(page.excerpt || fallbackSnippet || title);
  const language = detectLanguage(`${title} ${excerpt}`, request.language);
  const shouldTranslate = language !== 'ko';
  const [titleKo, excerptKo] = shouldTranslate
    ? await Promise.all([translateToKorean(title), translateToKorean(excerpt)])
    : [title, excerpt];

  const detail: ArticleDetail = {
    url: request.url,
    sourceName: request.sourceName,
    title,
    titleKo,
    excerpt,
    excerptKo,
    language,
    translated: shouldTranslate,
    fetchedAt: new Date().toISOString(),
    message: page.message
  };

  detailCache.set(cacheKey, { expiresAt: Date.now() + DETAIL_TTL_MS, detail });
  return detail;
}

async function fetchReadableArticle(url: string): Promise<{ title: string; excerpt: string; message?: string }> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('지원하지 않는 URL');
  }

  const html = await fetchText(
    url,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1',
        Accept: 'text/html,application/xhtml+xml'
      }
    },
    10_000
  );

  const safeHtml = html.slice(0, 1_500_000);
  const title = extractMeta(safeHtml, 'og:title') || extractTagText(safeHtml, 'title');
  const description = extractMeta(safeHtml, 'og:description') || extractMeta(safeHtml, 'description');
  const articleBody = extractJsonLdArticleBody(safeHtml);
  const articleParagraphs = extractArticleParagraphs(safeHtml);
  const excerpt = articleBody || articleParagraphs || description || '';

  return {
    title: stripHtml(title),
    excerpt: normalizeExcerpt(stripHtml(excerpt)),
    message: excerpt ? undefined : '공개 본문이 없어 RSS/검색 요약을 표시합니다.'
  };
}

function extractMeta(html: string, key: string): string {
  const propertyPattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegExp(key)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const reversedPattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  return decodeHtml(propertyPattern.exec(html)?.[1] ?? reversedPattern.exec(html)?.[1] ?? '');
}

function extractTagText(html: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(html);
  return match ? decodeHtml(match[1]) : '';
}

function extractJsonLdArticleBody(html: string): string {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const raw = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const body = findArticleBody(parsed);
      if (body) return body;
    } catch {
      // Some publishers embed invalid JSON-LD. Fall back to paragraph extraction.
    }
  }
  return '';
}

function findArticleBody(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findArticleBody(item);
      if (found) return found;
    }
    return '';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.articleBody === 'string') return record.articleBody;
  if (Array.isArray(record['@graph'])) return findArticleBody(record['@graph']);
  return '';
}

function extractArticleParagraphs(html: string): string {
  const article = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ?? html;
  const paragraphs = article.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  return paragraphs
    .map((paragraph) => stripHtml(paragraph))
    .filter((text) => text.length >= 40)
    .slice(0, 8)
    .join(' ');
}

function normalizeExcerpt(value: string): string {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/ADVERTISEMENT|Advertisement|Sign up for.*newsletter/gi, ' ')
    .trim();
  return cleaned.length > 1_400 ? `${cleaned.slice(0, 1_400).trim()}...` : cleaned;
}

function detectLanguage(text: string, provided?: string): string {
  if (/[가-힣]/.test(text)) return 'ko';
  if (provided?.toLowerCase().startsWith('ko')) return 'ko';
  return 'en';
}

function isGoogleNewsUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('news.google.');
  } catch {
    return false;
  }
}

async function translateToKorean(text: string): Promise<string> {
  if (!text || /[가-힣]/.test(text)) return text;
  const normalized = text.slice(0, 900);
  const key = hash(normalized);
  const cached = translationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  try {
    const params = new URLSearchParams({
      q: normalized,
      langpair: 'en|ko'
    });
    const response = await fetchJson<TranslationResponse>(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      {},
      8_000
    );
    const translated = stripHtml(response.responseData?.translatedText ?? normalized);
    translationCache.set(key, { expiresAt: Date.now() + TRANSLATION_TTL_MS, text: translated });
    return translated || normalized;
  } catch {
    return normalized;
  }
}

function hash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
