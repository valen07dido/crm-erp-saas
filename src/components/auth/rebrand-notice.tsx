import React from 'react';
import { LineChart, Moon, Sparkles, X } from 'lucide-react';

// Bump this key (e.g. to `-2027`) if WALTI ever rebrands again and the
// notice should resurface for people who already dismissed this one.
const DISMISS_KEY = 'walti-rebrand-2026-dismissed';

export function hasSeenRebrandNotice(): boolean {
  if (typeof window === 'undefined') return true; // SSR: default closed, client decides after mount
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markRebrandNoticeSeen() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true');
  } catch { }
}

interface RebrandNoticeProps {
  open: boolean;
  onClose: () => void;
}

export function RebrandNotice({ open, onClose }: RebrandNoticeProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebrand-notice-title"
        className="relative w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>

        <h2 id="rebrand-notice-title" className="font-heading text-xl font-bold">
          Cambiamos nuestra imagen
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Si ya usabas Walti, vas a notar un diseño distinto — no es un error ni otro sistema. Seguís con la misma
          cuenta, los mismos datos y las mismas funciones de siempre.
        </p>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex gap-3">
            <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <p>
              <span className="font-medium">Por qué lo hicimos:</span> queríamos que Walti se vea tan profesional
              como el negocio que gestionás con él, y que la información que ya cargás todos los días (ventas,
              stock, clientes) se entienda de un vistazo, en vez de quedar perdida entre números sueltos.
            </p>
          </div>
          <div className="flex gap-3">
            <Moon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <p>
              De paso sumamos tema claro y oscuro (a elección tuya) y un Dashboard nuevo que muestra la evolución
              real de tus ventas, no solo totales sueltos.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-95 active:scale-[0.98]"
        >
          Entendido, vamos
        </button>
      </div>
    </div>
  );
}
