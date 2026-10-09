import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, getSession } from 'next-auth/react';
import { User, Lock, ArrowRight, Eye, EyeOff, ScanBarcode, Package, BarChart3, Store, UserCog, Sparkles } from 'lucide-react';
import { startDemo } from '@/lib/demo-mode';

const PITCH_POINTS = [
  { icon: ScanBarcode, text: 'Punto de Venta rápido: escaneás o buscás y cobrás en segundos.' },
  { icon: Package, text: 'Control de stock, precios, vencimientos y productos por peso.' },
  { icon: BarChart3, text: 'Caja, gastos y reportes para saber cómo le va a tu negocio.' },
  { icon: Store, text: 'Tienda online propia para que te encuentren tus clientes.' },
  { icon: UserCog, text: 'Hasta 4 vendedores cobrando a la vez, cada uno con su propio turno.' },
];

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (router.query.reason === 'expired' || router.query.reason === 'timeout') {
      setError('Tu sesión expiró. Volvé a iniciar sesión.');
    }
  }, [router.query.reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        identifier,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email/usuario o contraseña incorrectos');
      } else if (result?.ok) {
        const session = await getSession();
        if (session?.user?.email === 'valendido69@gmail.com') {
          router.push('/superadmin');
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleTryDemo = () => {
    startDemo();
    // Full reload so the fetch interceptor is installed before anything else
    // on /dashboard (SessionProvider included) makes its first API call.
    window.location.href = '/dashboard';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-10 lg:flex-row lg:items-stretch lg:justify-center">
        {/* Pitch panel */}
        <div className="w-full max-w-md animate-fade-in lg:flex lg:flex-col lg:justify-center">
          <h1 className="text-center text-2xl font-bold leading-tight sm:text-left">
            El sistema de gestión para kioscos y almacenes
          </h1>
          <p className="mt-3 text-center text-muted-foreground sm:text-left">
            Walti junta en un solo lugar el punto de venta, el stock, la caja y la tienda online de tu negocio —
            para que dejes de anotar en un cuaderno y empieces a ver números de verdad.
          </p>
          <ul className="mt-6 space-y-3">
            {PITCH_POINTS.map(({ icon: Icon, text }, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm animate-slide-up"
                style={{ animationDelay: `${150 + i * 90}ms`, animationFillMode: 'backwards' }}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 hover:scale-110">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleTryDemo}
            className="group mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 text-sm font-semibold text-primary transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            Probar Walti sin registrarte
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
            Navegá todo el sistema con datos de ejemplo — no hace falta cuenta ni se guarda nada real.
          </p>
        </div>

        {/* Login card */}
        <div className="w-full max-w-md animate-slide-up lg:flex lg:flex-col lg:justify-center">
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-login.png" alt="Walti" className="h-auto w-40 sm:w-48" />
          </div>
          <div className="glass rounded-2xl p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-semibold">Iniciar sesión</h2>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-red-400 animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email o Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.toLowerCase())}
                    placeholder="tu@email.com o tu_usuario"
                    required
                    className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-10 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    Ingresar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
