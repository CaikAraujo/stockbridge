import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/users',
        destination: '/admin?tab=usuarios',
        permanent: true,
      },
      {
        source: '/settings/totp',
        destination: '/admin?tab=seguranca',
        permanent: true,
      },
      {
        source: '/deposito',
        destination: '/estoque?tab=deposito',
        permanent: true,
      },
      {
        source: '/articles',
        destination: '/estoque?tab=artigos',
        permanent: true,
      },
      {
        source: '/gas-bottles',
        destination: '/estoque?tab=gas',
        permanent: true,
      },
      {
        source: '/movements',
        destination: '/estoque?tab=movimentacoes',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
