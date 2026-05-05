import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173',
  quotePollIntervalMs: Number(process.env.QUOTE_POLL_INTERVAL_MS ?? 2_000),
  quoteCacheTtlMs: Number(process.env.QUOTE_CACHE_TTL_MS ?? 1_500),
  newsPollIntervalMs: Number(process.env.NEWS_POLL_INTERVAL_MS ?? 10_000),
  newsLookbackHours: Number(process.env.NEWS_LOOKBACK_HOURS ?? 24),
  naver: {
    clientId: process.env.NAVER_CLIENT_ID ?? '',
    clientSecret: process.env.NAVER_CLIENT_SECRET ?? ''
  },
  newsApi: {
    apiKey: process.env.NEWSAPI_KEY ?? ''
  },
  finnhub: {
    apiKey: process.env.FINNHUB_API_KEY ?? ''
  },
  alphaVantage: {
    apiKey: process.env.ALPHA_VANTAGE_API_KEY ?? ''
  },
  sec: {
    userAgent: process.env.SEC_USER_AGENT ?? 'stock-issue-monitor/0.1 contact@example.com'
  }
};

export function hasKeys(provider: 'naver' | 'newsApi'): boolean {
  if (provider === 'naver') return Boolean(config.naver.clientId && config.naver.clientSecret);
  return Boolean(config.newsApi.apiKey);
}
