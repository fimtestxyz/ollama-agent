# TODO — GitHub SSO for Herdr

**Status:** implemented, anonymous-mode verified · **Branch:** `feat/github-sso` · **Ref:** [`PLAN_SSO.md`](./PLAN_SSO.md)
**Decision:** GitHub OAuth only. (Google later, non-blocking.)

## P0 — Auth foundation ✅
- [x] Add deps: `next-auth@beta` (5.0.0-beta.32) to `package.json`
- [x] `auth.ts` — GitHub provider, jwt strategy, `trustHost`, `pages.signIn = /login`
- [x] `app/api/auth/[...nextauth]/route.ts` handlers
- [x] `middleware.ts` — protects page routes once configured; API routes self-guard
- [x] `types/next-auth.d.ts` — `session.user.id`
- [x] `AUTH_SECRET` generated into `.env.local` (so `/api/auth/session` works)
- [ ] **MANUAL:** create GitHub OAuth App → fill `GITHUB_ID` / `GITHUB_SECRET` in `.env.local`

## P1 — Data model ✅
- [x] `Session.userId`
- [x] `prefs: Record<userId, UserPrefs>` in store
- [x] Ownership param on all store fns (`getSessionForUser`, list/create/delete/rename/addMessage/addFileRecord/removeFile)
- [x] `getPrefs` / `setPrefs`
- [x] Legacy rows adopted to the anonymous `local` user on load

## P2 — API isolation ✅
- [x] `api/sessions` GET/POST scoped to signed-in user
- [x] `api/sessions/[id]` GET/PATCH/DELETE ownership
- [x] `api/sessions/[id]/chat` ownership before streaming
- [x] upload + files delete ownership
- [x] `api/prefs` GET/PUT (GET also triggers OWNER_EMAIL adoption)
- [x] `api/models` left public (Ollama tags only)

## P3 — UI ✅
- [x] `/login` page — "Continue with GitHub" (or setup instructions when unconfigured)
- [x] `SessionProvider` in layout
- [x] Prefs load on mount + applied (theme/model/baseUrl/embedModel/last session)
- [x] Prefs saved debounced (`PUT /api/prefs`) incl. `lastSessionId`
- [x] Theme cookie `herdr-theme`; boot script reads cookie → localStorage → system
- [x] Sidebar footer: user chip + sign out (or "Anonymous mode" + sign in link)

## P4 — Migration & ops ✅
- [x] `OWNER_EMAIL` adoption wired into `api/prefs` GET
- [x] `./manage_all.sh restart` — stack healthy; tunnel live
- [x] Python backend unchanged, still serving session context
- [ ] Set `OWNER_EMAIL` in `.env.local` (your GitHub email)

## P5 — Verify (in progress)
- [x] Anonymous mode: `/`, sessions, chat streaming + usage, prefs, login page — all work
- [ ] Sign in with GitHub → redirects back, `/` loads with adopted sessions
- [ ] Second account (incognito) sees no other user's data; create + upload isolated
- [ ] Cross-user tamper test (user A hits user B's session → 404/redirect)
- [ ] Prefs follow across devices
- [ ] Migrated legacy session keeps file context
- [ ] Commit on `feat/github-sso`, PR → `main`

---

## Blocked on (manual, needs you)
1. **Create the GitHub OAuth App** — full step-by-step guide: [`GITHUB_SSO_SETUP.md`](./GITHUB_SSO_SETUP.md)
   - Homepage URL: `https://herdr.gobblemon.com`
   - Authorization callback URL: `https://herdr.gobblemon.com/api/auth/callback/github`
2. Put the Client ID / Secret in `.env.local` (`GITHUB_ID`, `GITHUB_SECRET`), set `OWNER_EMAIL` to your GitHub email, then `./manage_all.sh restart`.
3. SSO turns on automatically — until then the app runs in anonymous mode.

## Notes
- Python backend unchanged — Next.js is the ownership boundary (session UUIDs unique).
- All secrets live in `.env.local` (gitignored); nothing sensitive in git.