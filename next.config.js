/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  // Only set for WALTI Desktop's own build (`npm run build:desktop`) — never
  // for the normal Vercel deploy (`npm run build`), which must keep behaving
  // exactly as it did before this existed. `output: 'standalone'` bundles a
  // self-contained `.next/standalone/server.js` that WALTI Desktop's
  // Electron shell spawns locally instead of pointing at Vercel.
  ...(process.env.WALTI_DESKTOP_BUILD === '1' ? { output: 'standalone' } : {}),
  // `dev:desktop` runs in the same project folder as the normal `dev`
  // script — without this, both would fight over the same `.next/` cache
  // (seen as EBUSY file-lock errors when run at the same time).
  ...(process.env.WALTI_RUNTIME === 'desktop' ? { distDir: '.next-desktop' } : {}),
  webpack: (config, { isServer }) => {
    // better-sqlite3 (WALTI Desktop's local DB driver) loads a native .node
    // binary via its own runtime path-detection logic — webpack can't
    // statically bundle that, and trying to produces a broken module instead
    // of a clean error (observed: requiring it through the bundle silently
    // resolved to `{}`). Marking it external makes webpack leave a plain
    // `require('better-sqlite3')` in the output, resolved by Node directly,
    // same as how native modules are normally used server-side.
    if (isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            // connect-src allows http://localhost:9898 — the local print-agent
            // (see /print-agent) that lets the POS print tickets silently
            // instead of through the browser's print dialog; see src/lib/printTicket.ts.
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; media-src 'self' blob: https://res.cloudinary.com; connect-src 'self' https://api.cloudinary.com http://localhost:9898; font-src 'self' data:; frame-ancestors 'self';",
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://crm-erp-saas.vercel.app',
          }
        ],
      },
    ];
  },
};

module.exports = nextConfig;
