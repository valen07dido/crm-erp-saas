import '@/styles/globals.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { Analytics } from '@vercel/analytics/react';
import { installDemoFetchInterceptor, isDemoMode } from '@/lib/demo-mode';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// If a "Probar Walti" demo session is active (survives full page reloads),
// make sure every /api/* call is answered from the local demo data before
// anything else on the page (SessionProvider included) fires its first fetch.
if (typeof window !== 'undefined' && isDemoMode()) {
  installDemoFetchInterceptor();
}

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <main className={`${inter.variable} font-sans`}>
        <Component {...pageProps} />
      </main>
      <Analytics />
    </SessionProvider>
  );
}
