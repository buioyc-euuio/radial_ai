import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEmail, checkWhitelisted } from './_whitelist';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.json({ isWhitelisted: false });

  const email = await verifyEmail(credential);
  const isWhitelisted = !!email && checkWhitelisted(email);
  return res.json({ isWhitelisted });
}
