import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const MONTHLY_BUDGET = 5.00;

interface UsageData {
  personal: { cost: number; inputTokens: number; outputTokens: number };
  total: { cost: number };
}

function fmtCost(n: number): string {
  if (n === 0) return '$0.000';
  if (n < 0.001) return '<$0.001';
  return `$${n.toFixed(3)}`;
}

export default function UsageBar() {
  const { isWhitelisted, credential } = useAuthStore();
  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!credential) return;
    try {
      const r = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (r.ok) setUsage(await r.json() as UsageData);
    } catch { /* ignore */ }
  }, [credential]);

  useEffect(() => {
    if (!isWhitelisted || !credential) return;
    void fetchUsage();
    const id = setInterval(() => void fetchUsage(), 60_000);
    return () => clearInterval(id);
  }, [isWhitelisted, credential, fetchUsage]);

  if (!isWhitelisted || !credential || !usage) return null;

  const personalPct = Math.min((usage.personal.cost / MONTHLY_BUDGET) * 100, 100);
  const totalPct = Math.min((usage.total.cost / MONTHLY_BUDGET) * 100, 100);

  const barColor = (pct: number, hue: string) =>
    pct > 80
      ? 'linear-gradient(90deg,#f87171,#fb923c)'
      : hue === 'pink'
        ? 'linear-gradient(90deg,#f472b6,#60a5fa)'
        : 'linear-gradient(90deg,#a78bfa,#60a5fa)';

  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex flex-col gap-2.5 p-3 rounded-xl"
      style={{
        background: 'var(--bg-topbar)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-base)',
        boxShadow: '0 4px 24px var(--shadow-sm)',
        minWidth: 200,
      }}
    >
      {/* Personal */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>
            我的用量
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {fmtCost(usage.personal.cost)} / $5
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(personalPct, 0.5)}%`, background: barColor(personalPct, 'pink') }}
          />
        </div>
      </div>

      {/* Total */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>
            所有測試者
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {fmtCost(usage.total.cost)} / $5
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(totalPct, 0.5)}%`, background: barColor(totalPct, 'purple') }}
          />
        </div>
      </div>
    </div>
  );
}
