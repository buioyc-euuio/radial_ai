import type { VercelRequest, VercelResponse } from '@vercel/node';
import { approvePassRequest, peekPassRequest } from './_pass.js';

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function page(body: string): string {
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Radial AI</title>
<body style="font-family:system-ui,sans-serif;max-width:26rem;margin:18vh auto;padding:0 1.25rem;text-align:center;color:#1f2937">
${body}</body></html>`;
}

const GONE = page('<p>這個申請不存在、已處理或已過期。</p>');

// The developer's side of the one-hour pass. Reached from the ntfy
// notification: the "核准" action POSTs here directly; tapping the notification
// opens the GET confirmation page. GET never grants anything, so link
// previewers / prefetchers can't approve by accident.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const email = id ? await peekPassRequest(id).catch(() => null) : null;
    if (!email) return res.status(404).send(GONE);
    return res.send(page(`<p><b>${esc(email)}</b><br>申請使用開發者 API Key 一小時</p>
<form method="post"><button style="font-size:1rem;padding:.7rem 1.4rem;border:0;border-radius:.75rem;background:#f472b6;color:#fff">核准 1 小時</button></form>`));
  }

  if (req.method !== 'POST') return res.status(405).end();
  const granted = id ? await approvePassRequest(id).catch(() => null) : null;
  if (!granted) return res.status(404).send(GONE);
  const until = new Date(granted.expiresAt)
    .toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' });
  return res.send(page(`<p>✅ 已核准 <b>${esc(granted.email)}</b><br>可使用至 ${until}（台北時間）</p>`));
}
