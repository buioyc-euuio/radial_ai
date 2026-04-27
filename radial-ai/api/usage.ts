import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { verifyEmail, checkWhitelisted } from './_whitelist.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(401).json({ error: 'Missing credential' });

  const email = await verifyEmail(credential);
  if (!email || !checkWhitelisted(email)) {
    return res.status(403).json({ error: 'Not whitelisted' });
  }

  const month = new Date().toISOString().slice(0, 7);

  try {
    const [pCost, pInput, pOutput, tCost] = await Promise.all([
      kv.get(`usage:${month}:${email}:cost`),
      kv.get(`usage:${month}:${email}:inputTokens`),
      kv.get(`usage:${month}:${email}:outputTokens`),
      kv.get(`usage:${month}:__total__:cost`),
    ]);

    const toNum = (v: unknown) => parseFloat(String(v ?? '0')) || 0;
    const toInt = (v: unknown) => parseInt(String(v ?? '0'), 10) || 0;

    return res.json({
      personal: {
        cost: toNum(pCost),
        inputTokens: toInt(pInput),
        outputTokens: toInt(pOutput),
      },
      total: { cost: toNum(tCost) },
    });
  } catch {
    return res.json({
      personal: { cost: 0, inputTokens: 0, outputTokens: 0 },
      total: { cost: 0 },
    });
  }
}
