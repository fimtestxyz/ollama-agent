"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const handleEvent = (event: CustomEvent) => {
      switch (event.detail.type) {
        case "AUTH_OK":
          window.dispatchEvent(new Event("NEXTAUTH_AUTH_READY"));
          setAuthReady(true);
          break;
        case "AUTH_ERROR":
          // On error, fall back to anonymous so the page renders usefully.
          setAuthReady(true);
          break;
        default:
          break;
      }
    };

    document.addEventListener("herdr-auth-message", handleEvent as EventListener);

    // Fallback: if no auth event fires, unblock rendering after a short delay.
    const fallback = setTimeout(() => setAuthReady(true), 500);

    return () => {
      document.removeEventListener("herdr-auth-message", handleEvent as EventListener);
      clearTimeout(fallback);
    };
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
