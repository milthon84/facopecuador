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
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
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
              // No iframes
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
