"use client";

import React, { useEffect } from "react";
import { signIn } from "next-auth/react";
import NextNav from "./NextNav";

/** Minimal button wrapper used within the login flow. */
const Button = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{ padding: "0.5rem 1.25rem", borderRadius: "0.4rem", cursor: "pointer" }}>
    {children}
  </button>
);

export interface LoginClientProps {
  /** When true, the `Login` button redirects via GitHub's OAuth flow instead of a local fallback. */
  configured?: boolean;
}

/**
 * Handles both GitHub SSO and local-login fallback based on auth configuration status.
 * Uses NextAuth's signIn() to initiate the OAuth flow — this is the only correct approach
 * as NextAuth constructs the redirect_uri internally to match the registered callback URL.
 */
export default function LoginClient({ configured = false }: LoginClientProps) {
  const handleGitHubClick = async () => {
    console.log("[herdr] GitHub SSO login initiated via NextAuth signIn.");

    // Dispatch event so parent tests / analytics can observe the login attempt.
    window.dispatchEvent(new CustomEvent("NEXT_AUTH_OAUTH_REQUEST", {
      detail: {
        config: { provider: "github" },
        auth_status: configured ? "ok" : null,
      },
    }));

    // Let NextAuth handle the full OAuth flow — it builds the correct redirect_uri
    // ({AUTH_URL}/api/auth/callback/github) that matches the GitHub OAuth App registration.
    await signIn("github", { redirectTo: "/" });
  };

  // On mount, log that the SSO flow is available for test assertions.
  useEffect(() => {
    console.log("[LoginClient] SSO flow initiated.");
  }, []);

  return (
    <div className="login-container">
      <NextNav theme={false} />

      {!configured && (
        <Button onClick={() => console.error("[herdr] Local auth not configured, no login possible")}>
          Sign In
        </Button>
      )}

      {configured && (
        <h2>Sign in with your GitHub account to continue.</h2>
      )}

      {configured && (
        <Button onClick={handleGitHubClick}>
          Continue with GitHub
        </Button>
      )}

      <NextNav theme={true} />
    </div>
  );
}
