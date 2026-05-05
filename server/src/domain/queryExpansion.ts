const staticExpansions: Record<string, string[]> = {
  AAPL: ['Apple', 'Apple Inc', 'iPhone'],
  TSLA: ['Tesla', 'Elon Musk'],
  SOXL: ['semiconductor ETF', 'semiconductor stocks', 'chip stocks', 'Direxion Daily Semiconductor Bull 3X'],
  TQQQ: ['Nasdaq 100', 'QQQ', 'Nasdaq futures', 'technology stocks'],
  NVDA: ['Nvidia', 'NVIDIA', 'AI chips'],
  MSFT: ['Microsoft'],
  AMD: ['Advanced Micro Devices', 'AMD'],
  GOOGL: ['Alphabet', 'Google'],
  GOOG: ['Alphabet', 'Google'],
  META: ['Meta', 'Facebook', 'Instagram'],
  AMZN: ['Amazon', 'AWS'],
  삼성전자: ['Samsung Electronics', 'Samsung', 'semiconductor', 'HBM'],
  엔비디아: ['Nvidia', 'NVIDIA', 'AI chips'],
  애플: ['Apple', 'AAPL', 'iPhone'],
  테슬라: ['Tesla', 'TSLA', 'Elon Musk'],
  마이크로소프트: ['Microsoft', 'MSFT'],
  반도체: ['semiconductor', 'chip', 'chips', 'HBM'],
  이란: ['Iran', 'Iranian'],
  전쟁: ['war', 'conflict', 'attack', 'missile'],
  미사일: ['missile', 'missiles', 'rocket', 'ballistic missile'],
  드론: ['drone', 'UAV'],
  공습: ['airstrike', 'strike', 'attack'],
  호르무즈: ['Strait of Hormuz', 'Hormuz', 'Gulf shipping'],
  이스라엘: ['Israel', 'Israeli'],
  중동: ['Middle East', 'Gulf'],
  러시아: ['Russia', 'Russian'],
  우크라이나: ['Ukraine', 'Ukrainian'],
  중국: ['China', 'Chinese'],
  대만: ['Taiwan', 'TSMC'],
  유가: ['oil', 'crude', 'Brent', 'WTI'],
  원유: ['oil', 'crude', 'Brent', 'WTI'],
  금리: ['interest rate', 'Fed', 'Federal Reserve', 'Treasury yield'],
  관세: ['tariff', 'trade war'],
  환율: ['currency', 'foreign exchange', 'FX', 'dollar', 'won']
};

export function expandQuery(query: string): string[] {
  return Array.from(new Set(expandQueryGroups(query).flat()));
}

export function expandQueryGroups(query: string): string[][] {
  const compact = query.trim().replace(/\s+/g, ' ');
  if (!compact) return [];

  const tokens = compact.split(/\s+/).filter((token) => token.length >= 2);
  const groups = tokens.length > 1 ? tokens.map((token) => expandToken(token)) : [expandToken(compact)];

  if (compact.includes('이란') && compact.includes('전쟁')) {
    groups[0].push('Iran war', 'Israel Iran', 'Iran conflict');
  }

  return groups.map((group) => Array.from(new Set(group)).filter((term) => term.length >= 2));
}

export function matchesExpandedQuery(query: string, ...values: Array<string | undefined>): boolean {
  const text = values.join(' ').toLowerCase();
  const groups = expandQueryGroups(query);
  if (groups.length === 0) return false;
  return groups.every((group) => group.some((term) => termMatches(text, term)));
}

function expandToken(token: string): string[] {
  const terms = new Set<string>([token]);
  for (const expansion of staticExpansions[token] ?? staticExpansions[token.toUpperCase()] ?? []) {
    terms.add(expansion);
  }
  return Array.from(terms);
}

function termMatches(lowerText: string, term: string): boolean {
  const lowerTerm = term.toLowerCase();
  if (/[가-힣]/.test(lowerTerm)) return lowerText.includes(lowerTerm);
  const escaped = lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lowerText);
}
