import "./globals.css";
import type { Metadata } from "next";
import AuthHashRedirect from "@/components/AuthHashRedirect";

export const metadata: Metadata = {
  title: "Agenda de Citas",
  description: "Reserva tu cita en línea",
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
