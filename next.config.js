const dns = require("dns");
if (dns && typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    middlewareClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },

  images: {
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  webpack: (config) => {
    config.infrastructureLogging = { level: "error" };
    return config;
  },

  // ── Cabeceras de seguridad HTTP ─────────────────────────────────────────
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options",        value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(self), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Supabase (auth + data)
              "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co",
              // Estilos inline que usa Tailwind/Next
              "style-src 'self' 'unsafe-inline'",
              // Scripts Next.js (necesita unsafe-inline para hydration)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Imágenes: self + datos inline (logos, etc.)
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.com",
              // Multimedia (videos/audios): Supabase + blob
              "media-src 'self' data: blob: https://*.supabase.co https://*.supabase.com",
              // Fuentes
              "font-src 'self'",
              // Visor interno de PDFs y multimedia
              "frame-src 'self' blob: data:",
              // Permitir iframes del mismo sitio (bloqueando embebido de sitios externos)
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
