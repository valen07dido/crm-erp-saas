import React from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DesignStatus } from '@/lib/marketing/types';

// Small, Studio-only building blocks. They rely on the app's dark tokens
// (the Studio shell renders inside a `.dark` wrapper), so bg-card,
// border-border, text-muted-foreground, bg-primary (lime)… resolve to the
// brand's dark palette.

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export function Btn({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'bg-accent text-foreground hover:bg-accent/70',
        variant === 'outline' && 'border border-border text-foreground hover:bg-accent/60',
        variant === 'ghost' && 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
        variant === 'danger' && 'text-destructive hover:bg-destructive/10',
        className,
      )}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconBtn({
  label,
  active,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/60';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, 'h-10', props.className)} />;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} className={cn(inputCls, 'min-h-[84px] resize-y leading-relaxed', props.className)} />;
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, 'h-10 pr-8', props.className)} />;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-border bg-background/50 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-8 min-w-[2rem] items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors',
            value === o.value ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn('w-full rounded-2xl border border-border bg-card shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          <IconBtn label="Cerrar" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconBtn>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-muted-foreground">{icon}</div>
      <p className="font-heading text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export const DESIGN_STATUS: Record<DesignStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-accent text-muted-foreground' },
  REVIEW: { label: 'En revisión', cls: 'bg-warning/15 text-warning' },
  APPROVED: { label: 'Aprobado', cls: 'bg-primary/15 text-primary' },
};

export function StatusPill({ status }: { status: DesignStatus }) {
  const s = DESIGN_STATUS[status] ?? DESIGN_STATUS.DRAFT;
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', s.cls)}>{s.label}</span>;
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground', className)}>{children}</p>;
}
