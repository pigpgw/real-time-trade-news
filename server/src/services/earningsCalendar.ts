import { config } from '../config';
import {
  type EarningsCalendarResult,
  type EarningsEvent,
  type EarningsReportTime,
  type EarningsSource,
  normalizeReportTime,
  toKoreaEarningsTime
} from '../domain/earnings';
import { fetchJson, fetchText } from '../providers/http';

interface CalendarRequest {
  symbols?: string[];
  from?: string;
  to?: string;
}

interface FinnhubEarningsResponse {
  earningsCalendar?: FinnhubEarningsRow[];
}

interface FinnhubEarningsRow {
  symbol?: string;
  date?: string;
  hour?: string;
  year?: number;
  quarter?: number;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
}

interface AlphaCalendarRow {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding?: string;
  estimate?: string;
  currency?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'TSLA'];
const cache = new Map<string, { expiresAt: number; result: EarningsCalendarResult }>();

export async function getEarningsCalendar(request: CalendarRequest): Promise<EarningsCalendarResult> {
  const symbols = normalizeSymbols(request.symbols);
  const range = normalizeRange(request.from, request.to);
  const cacheKey = JSON.stringify({ symbols, ...range });
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const providerResult = await loadProviderEvents(symbols, range.from, range.to);
  const items = providerResult.items
    .filter((item) => symbols.includes(item.symbol))
    .filter((item) => item.reportDate >= range.from && item.reportDate <= range.to)
    .sort(compareEarnings);

  const result: EarningsCalendarResult = {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Seoul',
    source: providerResult.source,
    items,
    providerMessage: providerResult.message,
    cacheTtlMs: CACHE_TTL_MS
  };

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

async function loadProviderEvents(
  symbols: string[],
  from: string,
  to: string
): Promise<{ source: EarningsSource; items: EarningsEvent[]; message: string }> {
  if (config.finnhub.apiKey) {
    try {
      const items = await fetchFinnhubEarnings(symbols, from, to);
      return {
        source: 'finnhub',
        items,
        message: 'Finnhub earnings calendar, 30분 캐시'
      };
    } catch (error) {
      return fallbackProviderResult(symbols, from, to, `Finnhub 오류: ${errorMessage(error)}`);
    }
  }

  if (config.alphaVantage.apiKey) {
    try {
      const items = await fetchAlphaVantageEarnings(symbols);
      return {
        source: 'alpha-vantage',
        items,
        message: 'Alpha Vantage earnings calendar, 30분 캐시'
      };
    } catch (error) {
      return fallbackProviderResult(symbols, from, to, `Alpha Vantage 오류: ${errorMessage(error)}`);
    }
  }

  return fallbackProviderResult(symbols, from, to, 'FINNHUB_API_KEY 또는 ALPHA_VANTAGE_API_KEY 없음');
}

async function fetchFinnhubEarnings(symbols: string[], from: string, to: string): Promise<EarningsEvent[]> {
  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const params = new URLSearchParams({
        from,
        to,
        symbol,
        token: config.finnhub.apiKey
      });
      const payload = await fetchJson<FinnhubEarningsResponse>(
        `https://finnhub.io/api/v1/calendar/earnings?${params.toString()}`,
        {},
        12_000
      );
      return (payload.earningsCalendar ?? []).map((row) => fromFinnhubRow(row, symbol));
    })
  );

  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function fetchAlphaVantageEarnings(symbols: string[]): Promise<EarningsEvent[]> {
  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const params = new URLSearchParams({
        function: 'EARNINGS_CALENDAR',
        symbol,
        horizon: '3month',
        apikey: config.alphaVantage.apiKey
      });
      const csv = await fetchText(`https://www.alphavantage.co/query?${params.toString()}`, {}, 12_000);
      return parseAlphaCsv(csv).map(fromAlphaRow);
    })
  );

  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

function fromFinnhubRow(row: FinnhubEarningsRow, fallbackSymbol: string): EarningsEvent {
  const symbol = normalizeSymbol(row.symbol ?? fallbackSymbol);
  const reportDate = row.date ?? new Date().toISOString().slice(0, 10);
  const reportTime = normalizeReportTime(row.hour);

  return buildEarningsEvent({
    symbol,
    companyName: symbol,
    reportDate,
    reportTime,
    quarter: row.year && row.quarter ? `Q${row.quarter} ${row.year}` : undefined,
    epsEstimate: row.epsEstimate,
    epsActual: row.epsActual,
    revenueEstimate: row.revenueEstimate,
    revenueActual: row.revenueActual,
    source: 'finnhub'
  });
}

function fromAlphaRow(row: AlphaCalendarRow): EarningsEvent {
  const epsEstimate = parseOptionalNumber(row.estimate);

  return buildEarningsEvent({
    symbol: normalizeSymbol(row.symbol),
    companyName: row.name || normalizeSymbol(row.symbol),
    reportDate: row.reportDate,
    reportTime: 'UNKNOWN',
    quarter: row.fiscalDateEnding,
    epsEstimate,
    source: 'alpha-vantage'
  });
}

function fallbackProviderResult(
  symbols: string[],
  from: string,
  to: string,
  reason: string
): { source: EarningsSource; items: EarningsEvent[]; message: string } {
  return {
    source: 'sample',
    items: buildSampleEvents(symbols, from, to),
    message: `${reason}. 샘플 캘린더 표시 중`
  };
}

function buildSampleEvents(symbols: string[], from: string, to: string): EarningsEvent[] {
  const today = new Date();
  const templates = [
    { symbol: 'NVDA', name: 'NVIDIA', offsetDays: 2, reportTime: 'AMC' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', offsetDays: -3, reportTime: 'AMC' },
    { symbol: 'AVGO', name: 'Broadcom', offsetDays: 9, reportTime: 'AMC' },
    { symbol: 'TSM', name: 'Taiwan Semiconductor', offsetDays: 14, reportTime: 'BMO' },
    { symbol: 'ASML', name: 'ASML Holding', offsetDays: -9, reportTime: 'BMO' },
    { symbol: 'AAPL', name: 'Apple', offsetDays: 5, reportTime: 'AMC' },
    { symbol: 'MSFT', name: 'Microsoft', offsetDays: -6, reportTime: 'AMC' },
    { symbol: 'AMZN', name: 'Amazon', offsetDays: 11, reportTime: 'AMC' },
    { symbol: 'META', name: 'Meta Platforms', offsetDays: -1, reportTime: 'AMC' },
    { symbol: 'GOOGL', name: 'Alphabet', offsetDays: 17, reportTime: 'AMC' },
    { symbol: 'TSLA', name: 'Tesla', offsetDays: 8, reportTime: 'AMC' },
    { symbol: 'MU', name: 'Micron Technology', offsetDays: 21, reportTime: 'AMC' }
  ] satisfies Array<{ symbol: string; name: string; offsetDays: number; reportTime: EarningsReportTime }>;

  return templates
    .filter((template) => symbols.includes(template.symbol))
    .map((template) =>
      buildEarningsEvent({
        symbol: template.symbol,
        companyName: template.name,
        reportDate: addDays(today, template.offsetDays),
        reportTime: template.reportTime,
        source: 'sample'
      })
    )
    .filter((item) => item.reportDate >= from && item.reportDate <= to);
}

function buildEarningsEvent(input: {
  symbol: string;
  companyName: string;
  reportDate: string;
  reportTime: EarningsReportTime;
  quarter?: string;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  source: EarningsSource;
}): EarningsEvent {
  const koreaTime = toKoreaEarningsTime(input.reportDate, input.reportTime);
  const status = new Date(`${input.reportDate}T23:59:59Z`).getTime() < Date.now() ? 'reported' : 'upcoming';
  const summary = buildSummary(input, status);

  return {
    id: `${input.source}:${input.symbol}:${input.reportDate}:${input.reportTime}`,
    symbol: input.symbol,
    companyName: input.companyName,
    reportDate: input.reportDate,
    reportTime: input.reportTime,
    koreaTime,
    isEstimatedTime: input.reportTime !== 'UNKNOWN',
    status,
    quarter: input.quarter,
    epsEstimate: input.epsEstimate,
    epsActual: input.epsActual,
    revenueEstimate: input.revenueEstimate,
    revenueActual: input.revenueActual,
    summary,
    source: input.source
  };
}

function buildSummary(
  input: {
    source: EarningsSource;
    epsEstimate?: number;
    epsActual?: number;
    revenueEstimate?: number;
    revenueActual?: number;
  },
  status: 'upcoming' | 'reported'
): string {
  if (input.source === 'sample') {
    return status === 'reported'
      ? '샘플 항목입니다. 실제 발표 EPS, 매출, 가이던스 요약은 FINNHUB_API_KEY 또는 ALPHA_VANTAGE_API_KEY 연결 후 표시됩니다.'
      : '샘플 항목입니다. API 키 연결 시 실제 예정일, 예상 EPS, 발표 시간으로 교체됩니다.';
  }

  if (status === 'reported') {
    const parts = [
      formatActualVsEstimate('EPS', input.epsActual, input.epsEstimate),
      formatActualVsEstimate('Revenue', input.revenueActual, input.revenueEstimate)
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '발표 완료. 공급자에 실제 수치가 들어오면 자동 갱신됩니다.';
  }

  return '예정 실적입니다. 발표 후 실제 EPS/매출이 공급자 데이터에 반영되면 상세가 갱신됩니다.';
}

function formatActualVsEstimate(label: string, actual?: number, estimate?: number): string | undefined {
  if (actual === undefined && estimate === undefined) return undefined;
  if (actual === undefined) return `${label} 예상 ${formatNumber(estimate)}`;
  if (estimate === undefined) return `${label} 실제 ${formatNumber(actual)}`;
  return `${label} 실제 ${formatNumber(actual)} / 예상 ${formatNumber(estimate)}`;
}

function normalizeSymbols(symbols?: string[]): string[] {
  const normalized = (symbols && symbols.length > 0 ? symbols : DEFAULT_SYMBOLS)
    .map(normalizeSymbol)
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 20);
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
}

function normalizeRange(from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const start = isIsoDate(from) ? from : addDays(today, -14);
  const end = isIsoDate(to) ? to : addDays(today, 60);
  return { from: start, to: end };
}

function isIsoDate(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addDays(date: Date, days: number): string {
  const next = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + days));
  return next.toISOString().slice(0, 10);
}

function compareEarnings(a: EarningsEvent, b: EarningsEvent): number {
  const aTime = new Date(a.koreaTime ?? `${a.reportDate}T12:00:00Z`).getTime();
  const bTime = new Date(b.koreaTime ?? `${b.reportDate}T12:00:00Z`).getTime();
  return aTime - bTime;
}

function parseAlphaCsv(csv: string): AlphaCalendarRow[] {
  const rows = csv.trim().split(/\r?\n/).map(parseCsvLine);
  const [header, ...body] = rows;
  if (!header || header.length === 0) return [];

  return body.map((row) => {
    const record = Object.fromEntries(header.map((key, index) => [key, row[index] ?? '']));
    return {
      symbol: record.symbol ?? '',
      name: record.name ?? '',
      reportDate: record.reportDate ?? '',
      fiscalDateEnding: record.fiscalDateEnding,
      estimate: record.estimate,
      currency: record.currency
    };
  }).filter((row) => row.symbol && row.reportDate);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value?: number): string {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
