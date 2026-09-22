import React from 'react';
import Link from 'next/link';
import { MailQuestion, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-login.png" alt="Walti" className="h-auto w-56" />
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <MailQuestion className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Registro por invitación</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Las cuentas se crean únicamente desde la administración. Si tu negocio todavía no tiene una cuenta, contactanos para darte de alta.
          </p>
          <Link
            href="/auth/login"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg gradient-primary text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:brightness-110 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
