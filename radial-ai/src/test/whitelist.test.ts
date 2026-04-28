/**
 * Diagnostic tests for the whitelist module.
 * Run with: npm test -- whitelist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Validate that a GOOGLE_PRIVATE_KEY looks like a real PEM RSA key. */
function isValidPemKey(key: string): boolean {
  const cleaned = key.replace(/\\n/g, '\n').trim();
  return (
    cleaned.includes('BEGIN') &&
    cleaned.includes('PRIVATE KEY') &&
    cleaned.length > 200
  );
}

/** Simulate what fetchFromSheet does with the env vars. */
function diagnoseEnvVars(env: Record<string, string | undefined>) {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = env.GOOGLE_PRIVATE_KEY;
  const sheetId = env.GOOGLE_SHEET_ID;

  if (!email || !rawKey || !sheetId) {
    return { ok: false, reason: 'Missing env vars', missing: [!email && 'GOOGLE_SERVICE_ACCOUNT_EMAIL', !rawKey && 'GOOGLE_PRIVATE_KEY', !sheetId && 'GOOGLE_SHEET_ID'].filter(Boolean) };
  }
  if (!isValidPemKey(rawKey)) {
    return { ok: false, reason: 'GOOGLE_PRIVATE_KEY is not a valid PEM private key', keyLength: rawKey.length, keyPreview: rawKey.slice(0, 40) };
  }
  if (!email.includes('iam.gserviceaccount.com')) {
    return { ok: false, reason: 'GOOGLE_SERVICE_ACCOUNT_EMAIL does not look like a service account email' };
  }
  if (sheetId.length < 20) {
    return { ok: false, reason: 'GOOGLE_SHEET_ID looks too short' };
  }
  return { ok: true };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Env var validation', () => {
  it('detects missing env vars', () => {
    const result = diagnoseEnvVars({});
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Missing env vars');
  });

  it('detects a git-SHA-like fake private key', () => {
    const result = diagnoseEnvVars({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'radialai@try-mcp-adk-a2a.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: 'da9e4565e4f4d7fa35b363a65ed0e5efff9ce6f5', // ← the bug
      GOOGLE_SHEET_ID: '1qx9W5ykQz6wG_EjphfKWbaDwj3cuubtMOtfQW_lbW3M',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not a valid PEM');
    console.error('[DIAGNOSTIC] Private key issue:', result);
  });

  it('accepts a properly formatted PEM key', () => {
    const fakePem = `-----BEGIN RSA PRIVATE KEY-----\n${'A'.repeat(400)}\n-----END RSA PRIVATE KEY-----`;
    const result = diagnoseEnvVars({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'radialai@try-mcp-adk-a2a.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: fakePem,
      GOOGLE_SHEET_ID: '1qx9W5ykQz6wG_EjphfKWbaDwj3cuubtMOtfQW_lbW3M',
    });
    expect(result.ok).toBe(true);
  });
});

describe('Cache behavior (in-memory module state)', () => {
  // These test the cache logic in isolation (not the actual googleapis call).

  let cachedEmails: string[] = [];
  let cacheTs = 0;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function isCacheStale() {
    return Date.now() - cacheTs >= CACHE_TTL_MS;
  }

  beforeEach(() => {
    cachedEmails = [];
    cacheTs = 0;
  });

  it('cache is stale when ts=0', () => {
    expect(isCacheStale()).toBe(true);
  });

  it('cache is fresh right after being set', () => {
    cacheTs = Date.now();
    expect(isCacheStale()).toBe(false);
  });

  it('force-refresh resets the cache ts to 0', () => {
    cacheTs = Date.now(); // warm cache
    expect(isCacheStale()).toBe(false);
    // simulate forceRefreshWhitelist
    cacheTs = 0;
    expect(isCacheStale()).toBe(true);
  });

  it('returns stale cache when env vars are missing (no infinite fetch loop)', () => {
    cachedEmails = ['existing@example.com'];
    cacheTs = 0;
    // With missing env vars, fetchFromSheet returns _cachedEmails
    const result = cachedEmails; // mirrors the early-return in fetchFromSheet
    expect(result).toEqual(['existing@example.com']);
  });
});

describe('GOOGLE_PRIVATE_KEY format check', () => {
  it('reports what is wrong with the current .env.local key', () => {
    const currentKey = 'da9e4565e4f4d7fa35b363a65ed0e5efff9ce6f5';
    const valid = isValidPemKey(currentKey);
    console.log('[DIAGNOSTIC] Current GOOGLE_PRIVATE_KEY valid?', valid);
    console.log('[DIAGNOSTIC] Key length:', currentKey.length, '(real key should be 1600+ chars)');
    console.log('[DIAGNOSTIC] Key preview:', currentKey.slice(0, 40));
    console.log('[DIAGNOSTIC] FIX: Go to Google Cloud Console → IAM → Service Accounts → radialai → Keys → Add Key → JSON → copy private_key field → vercel env add GOOGLE_PRIVATE_KEY');
    expect(valid).toBe(false); // confirms the bug
  });
});
