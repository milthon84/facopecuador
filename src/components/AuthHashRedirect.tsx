"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AuthHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";

    // Si viene un token o tipo recovery en la URL y no estamos ya en /reset-password
    if ((hash.includes("type=recovery") || hash.includes("access_token=") || search.includes("type=recovery")) &&
        pathname !== "/reset-password" && pathname !== "/erp/reset-password") {
      window.location.href = "/reset-password" + search + hash;
    }
  }, [pathname]);

  return null;
}
