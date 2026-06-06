import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuthStore } from '../store/authStore';
import { useCanvasStore } from '../store/canvasStore';
import { decodeJwt, fetchAccessStatus } from './HomePage';
import { LOCKED_MODEL } from './ApiKeyModal';

// Shown when a chat/usage request fails because the stored Google ID-token has
// expired (~1h lifetime). Lets the user re-authenticate in place without losing
// their canvas, instead of seeing a misleading "not whitelisted" error.
export default function ReloginBanner() {
  const { authExpired, user, login, setWhitelisted, setTrial, setDevMode, logout } = useAuthStore();
  const setModel = useCanvasStore((s) => s.setModel);

  if (!authExpired) return null;

  const handleCredential = async (resp: CredentialResponse) => {
    if (!resp.credential) return;
    const payload = decodeJwt(resp.credential);
    login({ name: payload.name, email: payload.email, picture: payload.picture }, resp.credential);
    const { isWhitelisted: wl, trial: t } = await fetchAccessStatus(resp.credential);
    setWhitelisted(wl);
    setTrial(t);
    if (!wl && t?.active) { setDevMode(true); setModel(LOCKED_MODEL); }
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-xl"
      style={{
        background: 'var(--bg-topbar)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #fde68a',
        boxShadow: '0 6px 28px var(--shadow-sm)',
      }}
    >
      <span className="text-xs font-semibold" style={{ color: '#92400e' }}>
        登入已過期{user ? `，${user.name.split(' ')[0]}` : ''} — 請重新登入以繼續使用
      </span>

      {/* Overlay pattern: invisible Google button receives the real click. */}
      <div style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'linear-gradient(90deg,#f472b6,#60a5fa)', color: 'white', pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          重新登入
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden' }}>
          <GoogleLogin onSuccess={handleCredential} onError={() => {}} useOneTap={false} />
        </div>
      </div>

      <button
        onClick={logout}
        className="text-xs px-2 py-1 rounded-lg transition-all"
        style={{ color: 'var(--text-faint)', border: '1px solid var(--border-base)' }}
        title="登出"
      >
        登出
      </button>
    </div>
  );
}
