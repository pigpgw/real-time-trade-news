import crypto from 'node:crypto';
import { stripHtml } from '../domain/newsUtils';
import { fetchJson } from '../providers/http';

export type DisplayLanguage = 'ko' | 'en' | 'original';
type TranslationLanguage = Exclude<DisplayLanguage, 'original'>;

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
  responseStatus?: number;
  responseDetails?: string;
}

const TRANSLATION_TTL_MS = 12 * 60 * 60 * 1000;
const TRANSLATION_CHUNK_SIZE = 450;
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

  const translated = await translateChunks(normalized, sourceLanguage, targetLanguage);
  if (translated) {
    translationCache.set(cacheKey, { expiresAt: Date.now() + TRANSLATION_TTL_MS, text: translated });
    return translated;
  }

  return normalized;
}

async function translateChunks(text: string, sourceLanguage: TranslationLanguage, targetLanguage: TranslationLanguage): Promise<string | undefined> {
  const chunks = splitForTranslation(text);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const translated = await translateChunk(chunk, sourceLanguage, targetLanguage);
    if (!translated) return undefined;
    translatedChunks.push(translated);
  }

  return translatedChunks.join(' ').replace(/\s+/g, ' ').trim();
}

async function translateChunk(text: string, sourceLanguage: TranslationLanguage, targetLanguage: TranslationLanguage): Promise<string | undefined> {
  const google = await translateWithGoogle(text, sourceLanguage, targetLanguage).catch(() => undefined);
  if (isUsableTranslation(google, text)) return google;

  const myMemory = await translateWithMyMemory(text, sourceLanguage, targetLanguage).catch(() => undefined);
  if (isUsableTranslation(myMemory, text)) return myMemory;

  return undefined;
}

async function translateWithGoogle(text: string, sourceLanguage: TranslationLanguage, targetLanguage: TranslationLanguage): Promise<string | undefined> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: 't',
    q: text
  });
  const response = await fetchJson<unknown>(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 stock-news-monitor/0.1' } },
    8_000
  );
  return stripHtml(parseGoogleTranslation(response));
}

async function translateWithMyMemory(text: string, sourceLanguage: TranslationLanguage, targetLanguage: TranslationLanguage): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLanguage}|${targetLanguage}`
    });
    const response = await fetchJson<TranslationResponse>(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      {},
      8_000
    );
    if (response.responseStatus && response.responseStatus >= 400) return undefined;
    return stripHtml(response.responseData?.translatedText ?? response.responseDetails ?? '');
  } catch {
    return undefined;
  }
}

function splitForTranslation(text: string): string[] {
  if (text.length <= TRANSLATION_CHUNK_SIZE) return [text];

  const parts = text
    .split(/(?<=[.!?。！？])\s+/)
    .flatMap((part) => part.length <= TRANSLATION_CHUNK_SIZE ? [part] : splitLongPart(part));

  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    const next = current ? `${current} ${part}` : part;
    if (next.length <= TRANSLATION_CHUNK_SIZE) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLongPart(text: string): string[] {
  const words = text.split(/\s+/).flatMap((word) => {
    if (word.length <= TRANSLATION_CHUNK_SIZE) return [word];
    const chunks: string[] = [];
    for (let index = 0; index < word.length; index += TRANSLATION_CHUNK_SIZE) {
      chunks.push(word.slice(index, index + TRANSLATION_CHUNK_SIZE));
    }
    return chunks;
  });
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= TRANSLATION_CHUNK_SIZE) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function parseGoogleTranslation(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
  return payload[0]
    .map((segment) => Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : '')
    .join('');
}

export function isUsableTranslation(text: string | undefined, original: string): text is string {
  const cleaned = text?.replace(/\s+/g, ' ').trim() ?? '';
  if (!cleaned) return false;
  if (cleaned === original) return false;

  const lower = cleaned.toLowerCase();
  return ![
    'query length limit exceeded',
    'mymemory warning',
    'available free translations',
    'too many requests',
    'quota',
    'usagelimits'
  ].some((marker) => lower.includes(marker));
}

export function detectLanguage(text: string, provided?: string): 'ko' | 'en' {
  if (provided?.toLowerCase().startsWith('ko')) return 'ko';
  if (provided?.toLowerCase().startsWith('en')) return 'en';
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function hash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}
