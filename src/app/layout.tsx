import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SCRIPT_MODO_PRIVADO } from "@/components/ModoPrivado";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Gestão para Psicólogas",
    template: "%s · Gestão para Psicólogas",
  },
  description:
    "Agenda, prontuário e financeiro do seu consultório em um só lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // O modo privado (data-privado) é aplicado por script antes da hidratação.
      suppressHydrationWarning
    >
      <head>
        {/* Fica no layout raiz (nunca re-renderiza em navegação) — em AppShell,
            que é recriado a cada troca de página pelo (app)/layout.tsx (busca
            o banner de assinatura de novo), o React reconciliava esse script
            no cliente a cada navegação e disparava aviso (script inserido via
            innerHTML nunca executa fora do parse inicial do HTML). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODO_PRIVADO }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
