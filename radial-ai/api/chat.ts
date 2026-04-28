import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { verifyEmail, checkWhitelisted } from './_whitelist.js';

const PROD_API_KEY = process.env.PROD_API_KEY ?? '';
const LOCKED_MODEL = 'gemini-3.1-flash-lite-preview';

const INPUT_COST_PER_TOKEN = 0.075 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.30 / 1_000_000;

async function recordUsage(email: string, inputTokens: number, outputTokens: number) {
  const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  try {
    await Promise.all([
      kv.incrbyfloat(`usage:${month}:${email}:cost`, cost),
      kv.incrby(`usage:${month}:${email}:inputTokens`, inputTokens),
      kv.incrby(`usage:${month}:${email}:outputTokens`, outputTokens),
      kv.incrbyfloat(`usage:${month}:__total__:cost`, cost),
    ]);
  } catch {
    // KV not configured — skip usage tracking silently
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential, messages, system } = req.body as {
    credential?: string;
    messages: { role: string; content: string }[];
    system?: string;
  };

  if (!credential) return res.status(401).json({ error: 'Missing credential' });
  const email = await verifyEmail(credential);
  if (!email || !await checkWhitelisted(email)) {
    return res.status(403).json({ error: 'Not whitelisted' });
  }

  if (!PROD_API_KEY) return res.status(503).json({ error: 'Server API key not configured' });

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${LOCKED_MODEL}:generateContent?key=${PROD_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  const data = await geminiRes.json() as {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  if (!geminiRes.ok) return res.status(geminiRes.status).json(data);

  const meta = data.usageMetadata;
  if (meta) {
    void recordUsage(email, meta.promptTokenCount ?? 0, meta.candidatesTokenCount ?? 0);
  }

  return res.json(data);
}
