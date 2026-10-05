// Gemini model ids churn fast — preview ids are shut down within months, and a
// hard-coded id then 404s for everyone. This module is the single place that
// names the default model, and it self-heals: when a generateContent call says
// the model is gone, it asks the API which models the key can actually use
// (ListModels), picks the closest live one, and retries.
//
// Shared by the serverless proxy (api/chat.ts) and the browser BYOK path
// (src/store/canvasStore.ts), so it must stay dependency-free.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Free-tier-friendly default; also the model the dev-key proxy is locked to. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

type Tier = 'flash-lite' | 'flash' | 'pro';

interface ParsedModel {
  id: string;
  version: number[];
  tier: Tier;
  stable: boolean;
}

// Plain text models only: gemini-<version>-<tier>[-preview[-MM-DD]|-NNN].
// Anything with another suffix (image, tts, live, …) is deliberately excluded.
const MODEL_ID_RE = /^gemini-(\d+(?:\.\d+)*)-(flash-lite|flash|pro)(-preview(?:-\d{2}-\d{2,4})?|-\d{3})?$/;

// Which tiers may stand in for a retired model, in order of preference.
const TIER_FALLBACK: Record<Tier, Tier[]> = {
  'flash-lite': ['flash-lite', 'flash'],
  'flash': ['flash', 'flash-lite'],
  'pro': ['pro', 'flash'],
};

function parseModelId(id: string): ParsedModel | null {
  const m = MODEL_ID_RE.exec(id);
  if (!m) return null;
  return {
    id,
    version: m[1].split('.').map(Number),
    tier: m[2] as Tier,
    stable: !m[3]?.startsWith('-preview'),
  };
}

function compareVersionDesc(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Picks the best live stand-in for `requested` from the ids the API reports:
 * same tier if possible, newest version first, stable before preview.
 * Returns null when nothing suitable is available.
 */
export function pickReplacementModel(requested: string, availableIds: string[]): string | null {
  const wantTier = parseModelId(requested)?.tier ?? 'flash-lite';
  const candidates = availableIds
    .filter(id => id !== requested)
    .map(parseModelId)
    .filter((p): p is ParsedModel => !!p);

  for (const tier of TIER_FALLBACK[wantTier]) {
    const inTier = candidates
      .filter(c => c.tier === tier)
      .sort((a, b) => compareVersionDesc(a.version, b.version) || Number(b.stable) - Number(a.stable));
    if (inTier.length > 0) return inTier[0].id;
  }
  return null;
}

/** True when a failed generateContent response means "this model id is gone". */
export function isModelUnavailableError(status: number, body: unknown): boolean {
  const err = (body as { error?: { status?: string; message?: string } } | null)?.error;
  if (status === 404 || err?.status === 'NOT_FOUND') return true;
  return /is not found for API version|not supported for generateContent|no longer available|has been (deprecated|retired|shut down)/i
    .test(err?.message ?? '');
}

/** Ids of every model this key can call generateContent on. */
export async function listGenerateContentModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/models?pageSize=1000&key=${apiKey}`);
  if (!res.ok) throw new Error(`ListModels failed: ${res.status}`);
  const data = await res.json() as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean);
}

// retired id → live replacement, remembered for this runtime instance so the
// failed call + ListModels round-trip is paid only once.
const resolvedModels = new Map<string, string>();

/**
 * generateContent with automatic model-name recovery. Returns the final
 * Response (ok or not) and the model id that was actually called.
 */
export async function geminiGenerateContent(
  apiKey: string, model: string, body: unknown,
): Promise<{ res: Response; model: string }> {
  const call = (m: string) => fetch(`${API_BASE}/models/${m}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const first = resolvedModels.get(model) ?? model;
  const res = await call(first);
  if (res.ok) return { res, model: first };

  const errBody = await res.clone().json().catch(() => null);
  if (!isModelUnavailableError(res.status, errBody)) return { res, model: first };

  let replacement: string | null = null;
  try {
    const available = (await listGenerateContentModels(apiKey)).filter(id => id !== first);
    replacement = pickReplacementModel(model, available);
  } catch {
    // Can't discover models (bad key, network) — surface the original error.
  }
  if (!replacement) return { res, model: first };

  console.warn(`[gemini] model "${first}" unavailable — falling back to "${replacement}"`);
  resolvedModels.set(model, replacement);
  return { res: await call(replacement), model: replacement };
}
