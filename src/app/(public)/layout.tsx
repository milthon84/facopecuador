import type { Metadata } from "next";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "FACOP - Ecuador";

export const metadata: Metadata = {
  title: clinicName,
  description: "Referentes en odontología clínica avanzada y formación académica de especialistas de alto nivel en Ecuador.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
