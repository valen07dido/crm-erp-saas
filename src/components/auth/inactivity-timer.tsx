import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signOut, getSession } from 'next-auth/react';
import { AlertTriangle, LogOut } from 'lucide-react';

// The JWT session has a fixed (non-sliding) expiry — see maxAge in src/lib/auth.ts.
// This timer is scheduled off that real expiry timestamp, not off user activity,
// so the warning/logout actually fire even if the cashier never stops clicking.
const WARNING_LEAD_MS = 2 * 60 * 1000; // show the dialog 2 min before the token expires

export function InactivityTimer() {
  const { update } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(120); // seconds until logout
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countRef.current) clearInterval(countRef.current);
  }, []);

  const scheduleFromExpiry = useCallback((expiresAt: number) => {
    clearAllTimers();
    setShowWarning(false);
    const msLeft = expiresAt - Date.now();

    if (msLeft <= 0) {
      signOut({ callbackUrl: '/auth/login?reason=expired' });
      return;
    }

    const warnIn = Math.max(msLeft - WARNING_LEAD_MS, 0);
    warnTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.round(Math.min(WARNING_LEAD_MS, msLeft) / 1000));
      countRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }, warnIn);

    logoutTimer.current = setTimeout(() => {
      signOut({ callbackUrl: '/auth/login?reason=expired' });
    }, msLeft);
  }, [clearAllTimers]);

  const refreshFromSession = useCallback(async () => {
    const session = await getSession();
    if (!session?.expires) return;
    scheduleFromExpiry(new Date(session.expires).getTime());
  }, [scheduleFromExpiry]);

  useEffect(() => {
    refreshFromSession();
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    await update();
    await refreshFromSession();
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md animate-slide-up rounded-2xl border border-amber-500/30 bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="mb-2 text-xl font-bold">Sesión a punto de expirar</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Tu sesión cerrará en:
          </p>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-400/40 text-3xl font-black tabular-nums text-amber-400">
            {countdown}
          </div>
          <p className="mb-6 text-xs text-muted-foreground">
            Haz clic en continuar para mantener tu sesión activa.
          </p>
          <div className="flex w-full gap-3">
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
            <button
              onClick={handleContinue}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg gradient-primary py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:brightness-110"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
