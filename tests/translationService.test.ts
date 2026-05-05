import { describe, expect, it } from 'vitest';
import { detectLanguage, isUsableTranslation } from '../server/src/services/translationService';

describe('translation service', () => {
  it('rejects provider quota and length-limit messages', () => {
    expect(isUsableTranslation('QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS', 'hello')).toBe(false);
    expect(isUsableTranslation('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY', 'hello')).toBe(false);
    expect(isUsableTranslation('Too Many Requests: quota exceeded', 'hello')).toBe(false);
  });

  it('rejects unchanged fallback text', () => {
    expect(isUsableTranslation('Stocks rise after chip shares rally', 'Stocks rise after chip shares rally')).toBe(false);
  });

  it('accepts actual translated text', () => {
    expect(isUsableTranslation('엔비디아 실적 이후 반도체 주가 상승', 'Stocks rise after Nvidia results')).toBe(true);
  });

  it('detects Korean and English text', () => {
    expect(detectLanguage('반도체 뉴스')).toBe('ko');
    expect(detectLanguage('semiconductor news')).toBe('en');
    expect(detectLanguage('semiconductor news', 'ko-KR')).toBe('ko');
  });
});
