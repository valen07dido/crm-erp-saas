/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://api.cloudinary.com; font-src 'self' data:; frame-ancestors 'self';",
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
