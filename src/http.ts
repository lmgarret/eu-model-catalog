const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} returned HTTP ${status}`);
    this.name = "HttpError";
  }
}

async function get(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      // Retry server errors only; 4xx won't fix itself.
      if (res.ok) return res;
      lastError = new HttpError(url, res.status);
      if (res.status < 500) break;
    } catch (err) {
      lastError = err;
    }
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 1_000 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

export async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await get(url, { accept: "application/json", ...headers });
  return res.json();
}

export async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await get(url, headers);
  return res.text();
}
