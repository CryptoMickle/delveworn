import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://vercel.live https://*.vercel.live`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://dream-rpc.somnia.network",
    "https://testnet.riselabs.xyz",
    "wss://testnet.riselabs.xyz",
    "https://*.thirdweb.com",
    "wss://*.thirdweb.com",
    "https://*.walletconnect.com",
    "wss://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.org",
    "https://*.reown.com",
    "wss://*.reown.com",
    "https://*.metamask.io",
    "wss://*.metamask.io",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
    "https://*.vercel.live",
    "wss://*.vercel.live",
    ...(isDevelopment
      ? [
          "http://localhost:*",
          "http://127.0.0.1:*",
          "ws://localhost:*",
          "ws://127.0.0.1:*",
        ]
      : []),
  ].join(" "),
  [
    "frame-src 'self'",
    "https://*.thirdweb.com",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "https://*.reown.com",
    "https://vercel.live",
    "https://*.vercel.live",
  ].join(" "),
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/practice",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/onchain",
        destination: "/",
      },
      {
        source: "/rise-testnet-demo",
        destination: "/",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/rise-testnet-demo",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
