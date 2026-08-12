"use client";

import { IconSparkles } from "./icons";

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.26.82-.57v-2.02c-3.34.71-4.04-1.57-4.04-1.57-.55-1.36-1.34-1.72-1.34-1.72-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.79 2.81 1.27 3.5.97.1-.76.42-1.27.76-1.57-2.67-.3-5.47-1.31-5.47-5.82 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.5.12-3.12 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 6 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.62.25 2.82.12 3.12.77.83 1.24 1.88 1.24 3.17 0 4.52-2.8 5.51-5.48 5.8.43.37.81 1.1.81 2.21v3.28c0 .32.22.69.83.57A12.04 12.04 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export default function LoginClient({ configured }: { configured: boolean }) {
  const callbackUrl =
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("callbackUrl")) ||
    "/";

  const clientId = process.env.NEXT_PUBLIC_GITHUB_ID;
  const redirectUri = "https://herdr.gobblemon.com/api/auth/callback/github";

  const handleGitHubSignIn = () => {
    if (!clientId) return;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      response_type: "code",
      state: Math.random().toString(36).slice(2),
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="empty-mark">
          <IconSparkles size={30} />
        </div>
        <h1>Welcome to Herdr</h1>
        <p className="login-sub">
          Sign in to access your chat sessions, files, and preferences.
        </p>

        {configured ? (
          <button
            className="btn-ghost login-btn"
            onClick={handleGitHubSignIn}
          >
            <GitHubMark />
            Continue with GitHub
          </button>
        ) : (
          <div className="login-setup">
            <p>
              <strong>SSO isn&apos;t configured yet.</strong>
            </p>
            <p>
              In GitHub → Settings → Developer settings → OAuth Apps, create an
              app with callback URL{" "}
              <code>https://herdr.gobblemon.com/api/auth/callback/github</code>,
              then set <code>GITHUB_ID</code>, <code>GITHUB_SECRET</code>, and{" "}
              <code>AUTH_SECRET</code> in <code>.env.local</code> and restart.
            </p>
            <p className="login-hint">
              Until then, the app runs in anonymous single-user mode.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
