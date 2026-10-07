import type { NextConfig } from "next";

// Headers de segurança em todas as respostas (inclusive arquivos estáticos,
// que o proxy não intercepta). A CSP fica no proxy porque precisa de um nonce
// novo por requisição.
const headersSeguranca = [
  // Só HTTPS por 2 anos, inclusive subdomínios (ignorado em http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Clickjacking: navegadores antigos que não entendem frame-ancestors da CSP.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // URLs do painel têm ids de paciente: não vazam para sites externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: headersSeguranca }];
  },
};

export default nextConfig;
