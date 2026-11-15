import '@/styles/globals.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import type { AppProps } from 'next/app';
import { Manrope, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { installDemoFetchInterceptor, isDemoMode } from '@/lib/demo-mode';

// Manrope: headings and standout numbers. DM Sans: body copy, nav, forms —
// the default `font-sans`. IBM Plex Mono: money figures and percentages
// (used explicitly via `font-mono` where that matters, not globally).
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono' });

// If a "Probar Walti" demo session is active (survives full page reloads),
// make sure every /api/* call is answered from the local demo data before
// anything else on the page (SessionProvider included) fires its first fetch.
if (typeof window !== 'undefined' && isDemoMode()) {
  installDemoFetchInterceptor();
}

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <main className={`${manrope.variable} ${dmSans.variable} ${ibmPlexMono.variable} font-sans`}>
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
}
