import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEmail, checkWhitelisted } from './_whitelist.js';
import { getTrialStatus } from './_trial.js';
import { getPassStatus } from './_pass.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.json({ isWhitelisted: false, trial: null, pass: null });

  const email = await verifyEmail(credential);
  if (!email) return res.json({ isWhitelisted: false, trial: null, pass: null });

  const isWhitelisted = await checkWhitelisted(email);
  // Report-only: the trial clock is NOT started here. It starts when the user
  // explicitly opts in via /api/activate-trial. A `startedAt: null` trial means
  // "eligible but not yet activated".
  const trial = await getTrialStatus(email);
  const pass = await getPassStatus(email);
  return res.json({ isWhitelisted, trial, pass });
}
