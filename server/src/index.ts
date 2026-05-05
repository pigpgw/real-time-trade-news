import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from './config';
import { getArticleDetail } from './services/articleDetail';
import { getEarningsCalendar } from './services/earningsCalendar';
import { getMarketRanking } from './services/rankingService';
import { newsMonitor } from './services/newsMonitor';
import { translateNewsItems } from './services/translationService';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: [config.webOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']
});

const searchQuerySchema = z.object({
  query: z.string().min(1),
  lookbackHours: z.coerce.number().min(1).max(168).optional()
});

const earningsQuerySchema = z.object({
  symbols: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const articleDetailQuerySchema = z.object({
  url: z.string().url(),
  query: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  sourceName: z.string().optional(),
  provider: z.enum(['direct-rss', 'source-search', 'gdelt', 'google-news', 'naver', 'newsapi', 'sec']).optional(),
  publishedAt: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  language: z.string().optional(),
  targetLanguage: z.enum(['ko', 'en', 'original']).default('ko')
});

const translationBodySchema = z.object({
  targetLanguage: z.enum(['ko', 'en', 'original']).default('ko'),
  items: z.array(z.object({
    id: z.string().min(1),
    title: z.string(),
    snippet: z.string().optional(),
    language: z.string().optional()
  })).max(30)
});

const rankingQuerySchema = z.object({
  market: z.enum(['KOSPI', 'KOSDAQ', 'US']).default('KOSPI'),
  type: z.enum(['turnover', 'gainers', 'losers', 'foreign', 'institution']).default('turnover')
});

app.get('/api/health', async () => ({
  ok: true,
  now: new Date().toISOString()
}));

app.get('/api/providers', async () => ({
  providers: newsMonitor.getStatuses()
}));

app.get('/api/news/search', async (request, reply) => {
  const parsed = searchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'query is required' });
  }

  return newsMonitor.search(parsed.data.query, parsed.data.lookbackHours);
});

app.get('/api/news/detail', async (request, reply) => {
  const parsed = articleDetailQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'valid url is required' });
  }

  return getArticleDetail(parsed.data);
});

app.post('/api/news/translations', async (request, reply) => {
  const parsed = translationBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid translation request' });
  }

  return {
    generatedAt: new Date().toISOString(),
    targetLanguage: parsed.data.targetLanguage,
    items: await translateNewsItems(parsed.data.items, parsed.data.targetLanguage)
  };
});

app.get('/api/earnings/calendar', async (request, reply) => {
  const parsed = earningsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid earnings calendar query' });
  }

  return getEarningsCalendar({
    symbols: parseSymbols(parsed.data.symbols),
    from: parsed.data.from,
    to: parsed.data.to
  });
});

app.get('/api/market/rankings', async (request, reply) => {
  const parsed = rankingQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid ranking query' });
  }

  return getMarketRanking(parsed.data.market, parsed.data.type);
});

app.get('/api/news/stream', streamNews);
app.get('/api/stream', streamNews);

async function streamNews(request: FastifyRequest, reply: FastifyReply) {
  const parsed = searchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'query is required' });
  }

  const query = parsed.data.query;
  const lookbackHours = parsed.data.lookbackHours ?? config.newsLookbackHours;
  const intervalMs = Math.max(5_000, config.newsPollIntervalMs);
  const seen = new Set<string>();
  let closed = false;
  let timer: NodeJS.Timeout | undefined;

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const send = (event: string, payload: unknown) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const poll = async (initial = false) => {
    if (closed) return;
    try {
      const result = await newsMonitor.search(query, lookbackHours);
      const freshItems = result.items.filter((item) => !seen.has(item.id));
      for (const item of result.items) seen.add(item.id);

      send(initial ? 'snapshot' : 'news', {
        query: result.query,
        generatedAt: result.generatedAt,
        items: initial ? result.items : freshItems,
        statuses: result.statuses,
        pollIntervalMs: intervalMs,
        nextCheckAt: new Date(Date.now() + intervalMs).toISOString()
      });
    } catch (error) {
      send('error', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  request.raw.on('close', () => {
    closed = true;
    if (timer) clearInterval(timer);
  });

  await poll(true);
  if (closed) return;
  timer = setInterval(() => {
    send('heartbeat', {
      now: new Date().toISOString(),
      pollIntervalMs: intervalMs,
      nextCheckAt: new Date(Date.now() + intervalMs).toISOString()
    });
    void poll(false);
  }, intervalMs);
}

function parseSymbols(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map((symbol) => symbol.trim()).filter(Boolean);
}

app.listen({ port: config.port, host: '127.0.0.1' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
