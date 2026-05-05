import { normalizeReportTime, toKoreaEarningsTime } from '../server/src/domain/earnings';

describe('earnings calendar time conversion', () => {
  it('converts US after-market earnings to next-day Korea time during DST', () => {
    const koreaTime = toKoreaEarningsTime('2026-05-05', 'AMC');

    expect(formatKoreaTime(koreaTime)).toBe('2026. 05. 06. 05:30');
  });

  it('converts US before-market earnings to same-day Korea evening during DST', () => {
    const koreaTime = toKoreaEarningsTime('2026-05-05', 'BMO');

    expect(formatKoreaTime(koreaTime)).toBe('2026. 05. 05. 21:00');
  });

  it('normalizes common provider time labels', () => {
    expect(normalizeReportTime('bmo')).toBe('BMO');
    expect(normalizeReportTime('After Market Close')).toBe('AMC');
    expect(normalizeReportTime('during market hours')).toBe('TAS');
  });
});

function formatKoreaTime(value?: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}
