export type EarningsReportTime = 'BMO' | 'AMC' | 'TAS' | 'UNKNOWN';
export type EarningsStatus = 'upcoming' | 'reported';
export type EarningsSource = 'finnhub' | 'alpha-vantage' | 'sample';

export interface EarningsEvent {
  id: string;
  symbol: string;
  companyName: string;
  reportDate: string;
  reportTime: EarningsReportTime;
  koreaTime?: string;
  isEstimatedTime: boolean;
  status: EarningsStatus;
  quarter?: string;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  summary: string;
  source: EarningsSource;
}

export interface EarningsCalendarResult {
  generatedAt: string;
  timezone: 'Asia/Seoul';
  source: EarningsSource;
  items: EarningsEvent[];
  providerMessage: string;
  cacheTtlMs: number;
}

export function normalizeReportTime(raw?: string): EarningsReportTime {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'UNKNOWN';
  if (value === 'bmo' || value.includes('before')) return 'BMO';
  if (value === 'amc' || value.includes('after')) return 'AMC';
  if (value === 'dmh' || value.includes('during') || value.includes('market')) return 'TAS';
  if (value === 'tas' || value.includes('time')) return 'TAS';
  return 'UNKNOWN';
}

export function toKoreaEarningsTime(reportDate: string, reportTime: EarningsReportTime): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate);
  if (!match) return undefined;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const localTime = reportTimeToEasternClock(reportTime);
  if (!localTime) return undefined;

  const easternOffsetHours = getEasternUtcOffsetHours(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  const utcMs = Date.UTC(
    year,
    month - 1,
    day,
    localTime.hour - easternOffsetHours,
    localTime.minute,
    0
  );

  return new Date(utcMs).toISOString();
}

function reportTimeToEasternClock(reportTime: EarningsReportTime): { hour: number; minute: number } | undefined {
  if (reportTime === 'BMO') return { hour: 8, minute: 0 };
  if (reportTime === 'AMC') return { hour: 16, minute: 30 };
  if (reportTime === 'TAS') return { hour: 12, minute: 0 };
  return undefined;
}

function getEasternUtcOffsetHours(date: Date): number {
  const year = date.getUTCFullYear();
  const dstStart = nthWeekdayOfMonthUtc(year, 2, 0, 2, 7);
  const dstEnd = nthWeekdayOfMonthUtc(year, 10, 0, 1, 6);
  return date.getTime() >= dstStart.getTime() && date.getTime() < dstEnd.getTime() ? -4 : -5;
}

function nthWeekdayOfMonthUtc(
  year: number,
  monthIndex: number,
  weekday: number,
  occurrence: number,
  transitionUtcHour: number
): Date {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = firstDay.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const date = 1 + offset + (occurrence - 1) * 7;
  return new Date(Date.UTC(year, monthIndex, date, transitionUtcHour, 0, 0));
}
