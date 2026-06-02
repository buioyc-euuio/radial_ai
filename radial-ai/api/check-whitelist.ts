import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEmail, checkWhitelisted } from './_whitelist.js';
import { getTrialStatus } from './_trial.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.json({ isWhitelisted: false, trial: null });

  const email = await verifyEmail(credential);
  if (!email) return res.json({ isWhitelisted: false, trial: null });

  const isWhitelisted = await checkWhitelisted(email);
  // First login establishes the 3-day trial clock for this email.
  const trial = await getTrialStatus(email, { establish: true });
  return res.json({ isWhitelisted, trial });
}
