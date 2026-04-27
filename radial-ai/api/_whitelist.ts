// ── Editable whitelist of tester Gmail accounts ──────────────────────────────
// To grant access, add the tester's Gmail address to this array.
// Emails are case-insensitive. This list merges with the WHITELISTED_EMAILS
// environment variable (set in the Vercel dashboard).
//
// Location: api/_whitelist.ts
export const HARDCODED_WHITELIST: string[] = [
  // 'tester@gmail.com',
  // 'friend@example.com',
  'buioyc1129euuio@gmail.com',
];

// ── Shared helpers ────────────────────────────────────────────────────────────

export async function verifyEmail(credential: string): Promise<string | null> {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!r.ok) return null;
    const d = await r.json() as { email?: string; email_verified?: string };
    return d.email_verified === 'true' ? (d.email ?? null) : null;
  } catch { return null; }
}

export function checkWhitelisted(email: string): boolean {
  const fromEnv = (process.env.WHITELISTED_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const all = [...HARDCODED_WHITELIST.map(e => e.toLowerCase()), ...fromEnv];
  return all.includes(email.toLowerCase());
}
