import { useEffect, useState, useCallback, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { AlertTriangle, LogOut } from 'lucide-react';

const WARNING_MS = 28 * 60 * 1000;   // 28 min
const LOGOUT_MS  = 30 * 60 * 1000;   // 30 min

export function InactivityTimer() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(120); // seconds until logout
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warnTimer.current)  clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countRef.current)   clearInterval(countRef.current);
  }, []);

  const reset = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setCountdown(120);

    warnTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(120);
      // Start countdown
      countRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_MS);

    logoutTimer.current = setTimeout(() => {
      signOut({ callbackUrl: '/auth/login?reason=timeout' });
    }, LOGOUT_MS);
  }, [clearAllTimers]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => reset();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    reset(); // start timers
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearAllTimers();
    };
  }, [reset, clearAllTimers]);

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
            Tu sesión cerrará por inactividad en:
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
              onClick={reset}
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
