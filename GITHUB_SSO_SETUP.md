# GitHub SSO Setup Guide

How to enable single sign-on for Herdr with GitHub. The SSO code is already in
the app (Auth.js / NextAuth v5) and runs in **anonymous mode** until these
credentials are configured — so nothing breaks before you finish.

**Time:** ~10 minutes · **Ref:** [`PLAN_SSO.md`](./PLAN_SSO.md)

---

## 1. Create the GitHub OAuth App

1. Go to **https://github.com/settings/developers**
2. Click **New OAuth App** (top right).
3. Fill in the form:

   | Field | Value |
   |---|---|
   | Application name | `Herdr` (anything you like) |
   | Homepage URL | `https://herdr.gobblemon.com` |
   | Application description | *(optional)* |
   | Authorization callback URL | `https://herdr.gobblemon.com/api/auth/callback/github` |

4. Click **Register application**.
5. On the app's page, copy the **Client ID** and click **Generate a new client secret**, then copy the **Client secret**. These are shown only once — keep them handy.

> ⚠️ The callback URL must exactly match the one Auth.js expects:
> `https://<host>/api/auth/callback/github`. Change the host if your tunnel
> hostname changes.

---

## 2. Set the env vars

Edit **`.env.local`** (already created, gitignored) and fill in the three values:

```env
AUTH_SECRET=<already set in .env.local — keep it>
GITHUB_ID=<the Client ID>
GITHUB_SECRET=<the Client secret>
OWNER_EMAIL=<your GitHub email>                                 # legacy data adoption
```

- **`AUTH_SECRET`** — JWT signing key. One is already generated in `.env.local`. Regenerate anytime with `npx auth secret` if you need to rotate it; a placeholder, never a real value, belongs in committed docs.
- **`GITHUB_ID` / `GITHUB_SECRET`** — from step 1.
- **`OWNER_EMAIL`** — the GitHub account whose email matches this adopts the pre-SSO anonymous sessions on first sign-in (see step 4).

> If `GITHUB_ID` or `GITHUB_SECRET` are empty, the app stays in anonymous mode
> and the login screen shows the setup instructions instead of the button.

---

## 3. Restart the stack

```bash
./manage_all.sh restart
```

Verify everything is healthy:

```bash
./manage_all.sh status
# backend / frontend / tunnel should all report up and http=200
```

The login button now appears on **https://herdr.gobblemon.com/login**.

---

## 4. Sign in — legacy data adoption

1. Open **https://herdr.gobblemon.com** (use the **public URL**, not `localhost` — OAuth callbacks and cookies are tied to the hostname).
2. Click **Continue with GitHub**, approve, and you'll be redirected back to your chat page.
3. If the signed-in account's email matches **`OWNER_EMAIL`**, all pre-SSO sessions/files are automatically adopted into that account (they appear right away). Other accounts start with an empty chat page.

> **Testing a second user:** GitHub won't allow two accounts in the same normal
> browser session. Open a **private/incognito window** and sign in there to
> confirm isolation.

---

## 5. Verify

- **Switch-off check:** with credentials unset, `/` loads without a redirect and the footer shows "Anonymous mode".
- **Sign-in:** Clicking GitHub on `/login` redirects to github.com, then back to `/` with all your adopted sessions.
- **Isolation:** in an incognito window, a different account sees only its own sessions/files; creating/uploading stays invisible to the first account.
- **Prefs:** change the theme or model on one device → reflected on the next visit (they're stored per user, and the theme is applied pre-paint via a cookie).
- **Tamper:** a request for another user's session id returns 404/401 — ownership is enforced server-side on every route (including before chat streaming).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Button says "SSO isn't configured yet" | `GITHUB_ID`/`GITHUB_SECRET` empty — fill `.env.local`, restart. |
| `redirect_uri_mismatch` on GitHub | Callback URL doesn't match exactly. It must be `https://herdr.gobblemon.com/api/auth/callback/github`. |
| Infinite redirect to `/login` | Auth.js can't read the session — confirm `AUTH_SECRET` is set and you're hitting the **public** URL (not `localhost`). |
| `/api/auth/session` returns `500` | Missing `AUTH_SECRET`. |
| Signing in from `localhost:3001` doesn't stick | OAuth cookies live on the tunnel host. Always sign in via `https://herdr.gobblemon.com`. |
| Legacy sessions missing after sign-in | `OWNER_EMAIL` doesn't match the signed-in email, or adoption ran before sign-in. Sign in again with the matching account. |
| `UntrustedHost` error | Pass `trustHost` (already configured in `auth.ts`). |

---

## Security notes

- All secrets live in **`.env.local`** (gitignored) — they never enter git. Keep the client secret private.
- `GITHUB_SECRET` is shown once at creation. If you lose it, regenerate it in the GitHub OAuth app settings.
- Rotate `AUTH_SECRET` (`npx auth secret`) if you suspect it leaked; rotating signs everyone out.
- The Python backend is not an auth boundary — Next.js enforces ownership on every call, keyed by session UUID.