import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Mail, Lock, User, AtSign, Building2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', businessName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Emails and usernames are always stored lowercase — normalize as the
    // user types so what they see matches what actually gets saved.
    const lowercased = name === 'username' || name === 'email' ? value.toLowerCase() : value;
    setForm({ ...form, [name]: lowercased });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push('/auth/login');
      } else {
        const data = await res.json();
        setError(data.error || 'Error al registrarse');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl bg-white px-6 py-5 shadow-lg shadow-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_completo.png" alt="Walti" className="h-auto w-64" />
          </div>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          <h2 className="mb-6 text-xl font-semibold">Crear cuenta</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-red-400 animate-fade-in">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nombre</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input name="name" type="text" value={form.name} onChange={handleChange} placeholder="Tu nombre" required className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Usuario</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input name="username" type="text" value={form.username} onChange={handleChange} placeholder="tu_usuario" required className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Vas a poder iniciar sesión con tu email o con este usuario.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@email.com" required className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••" required className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-10 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" />
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

            <div>
              <label className="mb-1.5 block text-sm font-medium">Nombre del negocio</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input name="businessName" type="text" value={form.businessName} onChange={handleChange} placeholder="Mi Kiosco" required className="flex h-11 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
