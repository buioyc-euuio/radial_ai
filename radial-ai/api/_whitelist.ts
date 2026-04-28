import { google } from 'googleapis';

// ── Google Sheet config ───────────────────────────────────────────────────────
const SHEET_RANGE = "'表單回覆 1'!C2:C";

// ── In-memory cache (5-minute TTL) ───────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cachedEmails: string[] = [];
let _cacheTs = 0;
let _fetchPromise: Promise<string[]> | null = null;

async function fetchFromSheet(): Promise<string[]> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !rawKey || !sheetId) {
    console.warn('[whitelist] Missing Google Sheet env vars — returning cached list.');
    return _cachedEmails;
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
  });

  const rows = res.data.values ?? [];
  return rows
    .map((row: string[]) => (row[0] ?? '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the current whitelist, fetching from Google Sheet if the cache is
 * stale. Concurrent callers share a single in-flight fetch promise.
 * Falls back to the last successful cache (or empty array) on error.
 */
export async function getWhitelistedEmails(): Promise<string[]> {
  if (Date.now() - _cacheTs < CACHE_TTL_MS) return _cachedEmails;

  if (!_fetchPromise) {
    _fetchPromise = fetchFromSheet()
      .then((emails) => {
        _cachedEmails = emails;
        _cacheTs = Date.now();
        return emails;
      })
      .catch((err) => {
        console.error('[whitelist] Failed to fetch from Google Sheet:', err);
        return _cachedEmails; // return stale cache on error
      })
      .finally(() => { _fetchPromise = null; });
  }

  return _fetchPromise;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export async function verifyEmail(credential: string): Promise<string | null> {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!r.ok) return null;
    const d = await r.json() as { email?: string; email_verified?: string };
    return d.email_verified === 'true' ? (d.email ?? null) : null;
  } catch { return null; }
}

/** Bypasses the cache and immediately fetches fresh data from the Sheet. */
export async function forceRefreshWhitelist(): Promise<string[]> {
  _cacheTs = 0;
  _fetchPromise = null;
  return getWhitelistedEmails();
}

export async function checkWhitelisted(email: string): Promise<boolean> {
  const sheetEmails = await getWhitelistedEmails();
  const fromEnv = (process.env.WHITELISTED_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const all = new Set([...sheetEmails, ...fromEnv]);
  return all.has(email.toLowerCase());
}
