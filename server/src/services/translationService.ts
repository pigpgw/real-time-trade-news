import crypto from 'node:crypto';
import { stripHtml } from '../domain/newsUtils';
import { fetchJson } from '../providers/http';

export type DisplayLanguage = 'ko' | 'en' | 'original';

export interface NewsTranslationInput {
  id: string;
  title: string;
  snippet?: string;
  language?: string;
}

export interface NewsTranslationOutput {
  id: string;
  title: string;
  snippet?: string;
  translated: boolean;
  sourceLanguage: 'ko' | 'en';
  targetLanguage: DisplayLanguage;
}

interface TranslationResponse {
  responseData?: {
    translatedText?: string;
  };
}

const TRANSLATION_TTL_MS = 12 * 60 * 60 * 1000;
const translationCache = new Map<string, { expiresAt: number; text: string }>();

export async function translateNewsItems(
  items: NewsTranslationInput[],
  targetLanguage: DisplayLanguage
): Promise<NewsTranslationOutput[]> {
  const limitedItems = items.slice(0, 30);
  return Promise.all(
    limitedItems.map(async (item) => {
      const [title, snippet] = await Promise.all([
        translateText(item.title, targetLanguage, item.language),
        item.snippet ? translateText(item.snippet, targetLanguage, item.language) : Promise.resolve(undefined)
      ]);
      const sourceLanguage = detectLanguage(`${item.title} ${item.snippet ?? ''}`, item.language);
      return {
        id: item.id,
        title,
        snippet,
        translated: targetLanguage !== 'original' && (title !== item.title || snippet !== item.snippet),
        sourceLanguage,
        targetLanguage
      };
    })
  );
}

export async function translateText(
  text: string,
  targetLanguage: DisplayLanguage,
  providedLanguage?: string
): Promise<string> {
  const normalized = stripHtml(text).replace(/\s+/g, ' ').trim();
  if (!normalized || targetLanguage === 'original') return normalized;

  const sourceLanguage = detectLanguage(normalized, providedLanguage);
  if (sourceLanguage === targetLanguage) return normalized;

  const cacheKey = `${sourceLanguage}:${targetLanguage}:${hash(normalized)}`;
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  try {
    const params = new URLSearchParams({
      q: normalized.slice(0, 900),
      langpair: `${sourceLanguage}|${targetLanguage}`
    });
    const response = await fetchJson<TranslationResponse>(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      {},
      8_000
    );
    const translated = stripHtml(response.responseData?.translatedText ?? normalized);
    translationCache.set(cacheKey, { expiresAt: Date.now() + TRANSLATION_TTL_MS, text: translated });
    return translated || normalized;
  } catch {
    return normalized;
  }
}

export function detectLanguage(text: string, provided?: string): 'ko' | 'en' {
  if (provided?.toLowerCase().startsWith('ko')) return 'ko';
  if (provided?.toLowerCase().startsWith('en')) return 'en';
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function hash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}
