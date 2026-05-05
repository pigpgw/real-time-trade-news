export async function fetchJson<T>(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchText(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<string> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = mergeSignals(options.signal, controller.signal);

  try {
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timeout);
  }
}

function mergeSignals(signalA?: AbortSignal | null, signalB?: AbortSignal | null): AbortSignal {
  if (!signalA) return signalB ?? new AbortController().signal;
  if (!signalB) return signalA;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signalA.addEventListener('abort', abort, { once: true });
  signalB.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
