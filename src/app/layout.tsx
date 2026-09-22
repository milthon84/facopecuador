import "./globals.css";
import type { Metadata } from "next";
import AuthHashRedirect from "@/components/AuthHashRedirect";

export const metadata: Metadata = {
  title: "FACOP - Ecuador",
  description: "Reserva tu cita en línea",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-ink-900 antialiased">
        <AuthHashRedirect />
        {children}
      </body>
    </html>
  );
}
