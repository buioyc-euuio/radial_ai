import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWhitelistedEmails, forceRefreshWhitelist } from './_whitelist.js';

function diagnosEnvVars() {
  const key = process.env.GOOGLE_PRIVATE_KEY ?? '';
  const cleaned = key.replace(/\\n/g, '\n').trim();
  const keyValid = cleaned.includes('BEGIN') && cleaned.includes('PRIVATE KEY') && cleaned.length > 200;
  // List all env var keys available in this function (values hidden for security)
  const allKeys = Object.keys(process.env).sort();
  return {
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasKey: !!key,
    keyValid,
    keyLength: key.length,
    hasSheetId: !!process.env.GOOGLE_SHEET_ID,
    allEnvKeys: allKeys,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const force = req.query.force === '1' || req.query.force === 'true';
  const diag = diagnosEnvVars();

  try {
    const emails = force ? await forceRefreshWhitelist() : await getWhitelistedEmails();
    return res.json({ count: emails.length, emails, diag });
  } catch (err) {
    return res.status(500).json({ error: String(err), diag });
  }
}
