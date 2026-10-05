import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEmail } from './_whitelist.js';
import { getPassStatus, openPassRequest, cancelPassRequest } from './_pass.js';

const NTFY_SERVER = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/+$/, '');
// The topic name is the only thing protecting the notifications (and the
// approval links inside them) — keep it long, random and out of the repo.
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? '';

async function notifyDeveloper(email: string, approveUrl: string): Promise<boolean> {
  const r = await fetch(NTFY_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: NTFY_TOPIC,
      title: 'Radial AI：一小時使用申請',
      message: `${email} 申請使用開發者 API Key 一小時`,
      tags: ['key'],
      priority: 4,
      click: approveUrl,
      actions: [
        { action: 'http', label: '核准 1 小時', url: approveUrl, method: 'POST', clear: true },
        { action: 'view', label: '開啟頁面', url: approveUrl },
      ],
    }),
  });
  return r.ok;
}

// Asks the developer for a one-hour pass. While a request is already open it
// just reports the current status instead of notifying again.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(401).json({ error: '登入已過期，請重新登入', code: 'AUTH_EXPIRED' });
  const email = await verifyEmail(credential);
  if (!email) return res.status(401).json({ error: '登入已過期，請重新登入', code: 'AUTH_EXPIRED' });

  const current = await getPassStatus(email);
  if (current.active || current.pending) return res.json({ pass: current });

  if (!NTFY_TOPIC) return res.status(503).json({ error: '申請功能尚未設定', code: 'NOT_CONFIGURED' });

  let id: string | null;
  try {
    id = await openPassRequest(email);
  } catch {
    return res.status(503).json({ error: '暫時無法送出申請，請稍後再試', code: 'KV_UNAVAILABLE' });
  }
  if (id) {
    const approveUrl = `https://${req.headers.host}/api/approve-pass?id=${id}`;
    const sent = await notifyDeveloper(email, approveUrl).catch(() => false);
    if (!sent) {
      await cancelPassRequest(email, id).catch(() => {});
      return res.status(502).json({ error: '通知開發者失敗，請稍後再試', code: 'NOTIFY_FAILED' });
    }
  }
  return res.json({ pass: { active: false, expiresAt: null, pending: true } });
}
