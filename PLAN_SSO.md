# PLAN_SSO.md — Single Sign-On (Google / GitHub) for Herdr

**Status:** Planning · **Author:** Claude · **Date:** 2026-08-12
**Scope:** Add OAuth SSO so each signed-in user gets their own chat sessions, files, and UI preferences. This is a plan only — no code.

---

## 1. Context

Herdr is a single-user web app today:

- **Next.js 15 (App Router)** frontend streaming chat to a local Ollama; runs behind a Cloudflare named tunnel at **`https://herdr.gobblemon.com`** → `localhost:3001`.
- **Python backend** (`python/`, FastAPI on `:8000`) owns file understanding (markdown → chunks → embeddings → PageRank). Next.js proxies to it server-to-server.
- **Persistence:** all sessions/files/messages live in one `data/store.json` (`StoreShape { sessions: Session[] }`). `Session` has **no owner**.
- **UI prefs** (theme, Ollama base URL, embed model, selected model, last session) live in `localStorage`, not on the server.
- The app is publicly reachable (anyone with the URL can use it) — auth is now a real requirement.

**Goal:** sign-in with **GitHub** (primary) or **Google** via OAuth. After sign-in, the user sees **only their own** sessions and files, and their UI preferences are **saved per user** (so they follow across devices).

---

## 2. Goals / Non-Goals

**Goals**
- OAuth sign-in with GitHub and/or Google (one click "Continue with …").
- Per-user isolation of sessions, messages, files, and Python document indexes.
- Per-user UI preferences (theme, model, Ollama URL, embed model, last active session) stored server-side.
- Minimal disruption to the existing single-user code paths.
- Works behind the existing Cloudflare tunnel (HTTPS + stable hostname).

**Non-Goals**
- No multi-tenant admin console, roles, or billing.
- No database migration — stays file-based (matches the current lightweight store).
- No password/email auth (OAuth only).
- Not converting the Python backend into an auth boundary (it stays local, gated by Next.js).

---

## 3. Key Decisions

| Decision | Choice | Why |
|---|---|---|
| **Provider** | **GitHub first**, Google optional (both via one library) | GitHub OAuth app creation is the least friction (no Google Cloud project/consent screen). Enable Google later by adding one provider + a client ID. |
| **Auth library** | **Auth.js v5** (`next-auth@beta`) | First-class Next.js App Router support; built-in GitHub/Google providers, JWT sessions, middleware, no DB required (matches file-based store). |
| **Session strategy** | **JWT** (`session: { strategy: "jwt" }`) | No user table needed; user identity (id, name, email, image) rides in the signed JWT. |
| **Redirect host** | `https://herdr.gobblemon.com` (existing named tunnel) | OAuth requires a stable HTTPS callback URL — the named tunnel already gives us this. |
| **Ownership source of truth** | Server-side `auth()` in every API route; **never** trust a client-sent user id | Prevents cross-user data access even if a client is tampered with. |
| **Data layout** | Keep `data/store.json`; add `userId` to `Session` + a `prefs` map in the store | Minimal change to the existing persistence singleton; one file to migrate. |
| **Python backend** | Unchanged; Next.js gates ownership before every call | Session ids are globally unique UUIDs, so ownership at the Next.js layer is sufficient. |

---

## 4. Architecture

```
Browser ── login page ──▶ /api/auth/[...nextauth] ──▶ GitHub/Google OAuth
     │                       (Auth.js)                   │
     │ JWT cookie                                         │ callback (redirect URI)
     ▼                                                    ▼
Chat app  ──▶ protected /api/sessions/*   (auth() → userId → filter store)
                 │
                 └─▶ lib/store.ts  (sessions tagged with userId; prefs map)
                 │
                 └─▶ python backend :8000  (unchanged — already keyed by session UUID)
```

- **Auth boundary:** Next.js `middleware.ts` protects `/` and all `/api/*` except `/api/auth/*`. Unauthenticated requests → redirect to `/login`.
- **Login page:** `/login` (public) with "Continue with GitHub" (and optionally Google). Post-success redirect → `/`.
- **Session plumbing:** `SessionProvider` wraps the app; client reads `useSession()` for the signed-in user; server reads `auth()` for the user id.
- **All API routes** (`sessions`, `sessions/[id]`, `upload`, `chat`, `files`, `models`) resolve the user via `auth()` and scope every store call to that user.

---

## 5. Data Model Changes

Extend the existing store with an owner and a prefs map:

```ts
// lib/store.ts
type Session = {
  id: string;
  userId: string;            // NEW
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  files: FileDoc[];
};

type UserPrefs = {
  theme: "dark" | "light";
  baseUrl: string;           // Ollama server URL
  embedModel: string;
  model: string;             // selected chat model
  lastSessionId?: string;
};

type StoreShape = {
  sessions: Session[];
  prefs: Record<string, UserPrefs>;   // keyed by userId  (NEW)
};
```

- `getSession(id)` → becomes `getSessionForUser(id, userId)`; all mutations require ownership match, else 404.
- `listSessions(userId)`, `createSession(userId)`, `deleteSession(id, userId)`, `addMessage(id, userId, …)`, `addFileRecord/removeFile(id, userId, …)` — every existing store function gains a `userId` parameter.
- New prefs API: `getPrefs(userId)`, `setPrefs(userId, patch)`.

**Python backend:** no structural change. Session ids are UUIDs and already unique per session; Next.js only ever calls Python with a session id that belongs to the authenticated user. (Optional hardening later: pass `user_id` and scope the on-disk cache — noted, not required.)

---

## 6. Auth Flow (Auth.js v5)

1. **Install:** `next-auth@beta` + `@auth/core`. Add `GITHUB_ID` / `GITHUB_SECRET` (+ `GOOGLE_ID`/`GOOGLE_SECRET` if enabled) and `AUTH_SECRET` to `.env.local` (already gitignored). Generate with `npx auth secret`.
2. **Config** `auth.ts` at repo root:
   ```ts
   NextAuth({
     providers: [GitHub, ...(google? [Google] : [])],
     session: { strategy: "jwt" },
     trustHost: true,               // works behind Cloudflare tunnel
     pages: { signIn: "/login" },
   })
   ```
3. **Route:** `app/api/auth/[...nextauth]/route.ts` → export `handlers`.
4. **Middleware:** `middleware.ts` → `auth` middleware protecting `/` and `/api/*` except `/api/auth`, redirect to `/login`.
5. **Provider setup:**
   - **GitHub:** Settings → Developer settings → OAuth Apps → New OAuth App → Homepage `https://herdr.gobblemon.com`, callback `https://herdr.gobblemon.com/api/auth/callback/github`. Copy ID/secret to env.
   - **Google:** Cloud Console → OAuth Client → authorized redirect URI `…/api/auth/callback/google`.
6. **Dev note:** in local dev (`localhost:3001`) OAuth still redirects to the public callback URL, so set `AUTH_URL=https://herdr.gobblemon.com` (or run the whole flow through the tunnel). For local-only testing, either use the tunnel or add a second redirect URI to the OAuth app.

---

## 7. API Changes (Next.js routes)

| Route | Change |
|---|---|
| `api/auth/[...nextauth]` | **New** — Auth.js handlers. |
| `api/sessions` (GET/POST) | Scope by `auth().user.id`; create sets `userId`. |
| `api/sessions/[id]` (GET/DELETE/PATCH) | Ownership check → 404 if not owned. |
| `api/sessions/[id]/chat` | Ownership check **before** starting the long-lived stream. |
| `api/sessions/[id]/upload` | Ownership check; forward `userId` context only if Python is extended (not required). |
| `api/sessions/[id]/files/[fileId]` (DELETE) | Ownership check. |
| `api/models` | Leave as-is (reads Ollama tags; no user data), or require auth for consistency. |
| `api/prefs` (GET/PUT) | **New** — per-user prefs. |

**Critical:** the streaming chat route must verify ownership synchronously before it begins streaming, so a crafted request can't read another user's history or inject another user's files into context.

---

## 8. UI Changes

- **Login page** `/login`: centered "Continue with GitHub" button (+ Google if enabled). Apple-style to match the app. After success → redirect to `/`.
- **SessionProvider + `useSession`** in `ChatApp`:
  - While `status === "loading"` → show the existing loading state (never flash a session list that belongs to someone else).
  - On sign-out (add a "Sign out" action in the sidebar footer) → clear local state, redirect to `/login`.
- **Per-user data:** `loadSummaries`, `openSession`, upload, delete all run against the scoped APIs; the sidebar shows only the user's sessions.
- **Preferences sync (replace `localStorage`):**
  - Load prefs on sign-in (`GET /api/prefs`) and apply: theme, model, Ollama URL, embed model, last session.
  - Save on change (`PUT /api/prefs`) debounced.
  - **Theme boot (FOUC avoidance):** the existing inline `<head>` script reads a `herdr-theme` **cookie** first (server-set from prefs), then `localStorage`, then system preference. Writing the cookie on every prefs save means the correct theme is applied before paint on any device.
  - Keep `localStorage` as the anonymous fallback for pre-login theming only.

---

## 9. Security Notes

- **Never trust client-sent user ids.** Every route derives the user from the verified Auth.js session.
- **JWT secrets:** `AUTH_SECRET` via env; never committed (`.env.local` already gitignored; double-check the new lines are ignored).
- **`trustHost: true`** so Auth.js accepts the tunnel hostname; keep `AUTH_URL` correct to avoid callback mismatch.
- **Ownership on streaming:** check before streaming (see §7) to prevent cross-user context leaks.
- **Rate limiting:** GitHub/Google OAuth endpoints are rate-limited by the providers; Auth.js does its own token validation. No additional limiter in scope, but note it for public deployment.
- **Account adoption (migration) must be explicit** (§10) so legacy data never auto-assigns to the wrong person.

---

## 10. Migration of Existing Data

Current `data/store.json` sessions have no owner.

- **One-time adoption:** set `OWNER_EMAIL=<your email>` in `.env.local`. On the first successful login by a user with that email, all ownerless sessions are assigned to that user (`userId = <that user>`). Any other user starts with an empty chat page.
- Existing **Python indexes** remain valid: they key by session UUID, which is unchanged after adoption, so migrated sessions keep their file context.
- After migration, `python/index/` and `data/store.json` both carry the adopted sessions — no re-embedding needed.
- Prefs have no legacy data (they were localStorage); new users get defaults.

---

## 11. Rollout Steps (when approved)

1. `npm i next-auth@beta` (+ google provider if used) — package.json updates.
2. Add `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`, `app/login/page.tsx`, `app/api/prefs/route.ts`.
3. Create the GitHub OAuth app; set env vars in `.env.local`.
4. Extend `lib/store.ts` (userId on Session, prefs map, ownership in every function) and thread `userId` through all API routes.
5. Update `ChatApp`/`Sidebar` for `useSession`, prefs loading/saving, theme cookie, sign-out.
6. Set `OWNER_EMAIL`, restart the stack (`./manage_all.sh restart`).
7. Verify (below); commit + push.

---

## 12. Verification

- Sign in with GitHub → redirects back, chat page loads with **your** (adopted) sessions.
- In a private/incognito window, sign in as a second account → sees **no** other user's sessions; create/upload works and is invisible to user A.
- Cross-user tamper test: as user A, call `GET/POST/DELETE` on user B's session id → expect 404/redirect, and confirm user B's files never enter user A's context.
- Prefs: change theme/model on device 1 → reload on device 2 (same account) → applied. Sign out → local state cleared; sign in as another user → their prefs load.
- Migrated legacy session still answers with its uploaded-file context (Python index intact).
- `./manage_all.sh restart` and the public URL keep working; `/login` reachable, `/` requires auth.

---

## 13. Open Questions

1. **Google now or later?** GitHub-first is recommended; Google is a ~30-min add after. Decide whether to enable both on day one.
2. **`OWNER_EMAIL` vs "first user adopts all":** prefer the explicit email so a stranger logging in first can't claim the legacy data.
3. **Multi-device pref behavior for the Ollama URL:** the backend URL is machine-local — should `baseUrl`/`embedModel` sync per-user (default) or stay per-device? Recommend per-user with the local default when unset.
4. **Sign-out UX:** session-scoped sign-out (Auth.js default) is fine; no "sign out everywhere" needed now.
5. **Should `/api/models` require auth?** It leaks only model names; recommend requiring auth for consistency once SSO is on.
