import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEmail } from './_whitelist.js';
import { getTrialStatus } from './_trial.js';

// Explicit opt-in: starts the 3-day free-trial clock for this email (atomic
// NX write, so re-calling never resets or extends it). Returns the resulting
// trial status.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(401).json({ error: '登入已過期，請重新登入', code: 'AUTH_EXPIRED' });

  const email = await verifyEmail(credential);
  if (!email) return res.status(401).json({ error: '登入已過期，請重新登入', code: 'AUTH_EXPIRED' });

  const trial = await getTrialStatus(email, { establish: true });
  return res.json({ trial });
}
