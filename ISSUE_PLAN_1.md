# ISSUE_PLAN_1 — Fix Plan for Issues #2 and #3

## Overview
Two high-impact security findings from the initial code review / security scan:
- #2 ReactMarkdown XSS via unsanitized markdown rendering
- #3 File upload size validation missing on primary path

Both are fixable with minimal code changes, no schema migrations, and safe rollout.

---

## Issue #2 — [Security] ReactMarkdown renders untrusted content without sanitization → XSS risk

### Problem
`components/Markdown.tsx` renders `children` via `ReactMarkdown` with only `remark-gfm`. By default ReactMarkdown allows raw HTML. `MessageBubble` passes `message.content` directly from chat history / file previews. No sanitization pipeline is present.

### Decision
Disable raw HTML entirely for user content. Use `remark-html` disabled + `rehype-sanitize` with an allowlist as defense-in-depth. Prefer compile-time opt-out over runtime parsing overhead.

Chosen stack:
- Keep `react-markdown` + `remark-gfm`
- Add `rehype-raw` disabled? Actually we want no HTML at all → set `allowDangerousHtml: false` (default in v9? check). Safer: add `rehype-sanitize` with default schema, and `rehype-raw` only if needed.
Simpler boring option: `ReactMarkdown` prop `rehypePlugins={[rehypeSanitize]}` and never enable raw HTML.

### Implementation Steps
1. Install deps
```bash
npm i rehype-sanitize rehype-raw
npm i -D @types/rehype-sanitize
```
2. Update `components/Markdown.tsx`
```tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from 'hast-util-sanitize';

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        // explicitly forbid dangerous HTML
        // allowDangerousHtml defaults false in recent versions
      >{children}</ReactMarkdown>
    </div>
  );
}
```
3. Audit other render paths
- `components/MessageBubble.tsx` already uses Markdown.
- Search for other places rendering user content: `grep -r ReactMarkdown`.
4. Add regression test
- Create unit test rendering `<Markdown>{'<img src=x onerror=alert(1)>'}</Markdown>` and assert output contains escaped text, not `<img>`.
5. Update docs
- Note sanitization in README security section.

### Verification
- Start dev server, send message with payload `<script>alert(1)</script>` and markdown with `<img src=x onerror=alert(1)>`. Verify no script execution, tags stripped/escaped.
- Run existing lint/build: `npm run build` passes.
- Check console for ReactMarkdown warnings.

### Risks
- Over-sanitization may strip legitimate tables/links. `rehype-sanitize` default schema is conservative; adjust if needed.
- Performance negligible.

---

## Issue #3 — [Security] File upload lacks size validation before forwarding to Python backend

### Problem
`app/api/sessions/[id]/upload/route.ts` forwards file to Python backend without checking `file.size`. Node fallback in `lib/extract.ts` enforces 20 MB, but primary path does not. Large uploads can OOM Node or saturate Python.

### Decision
Enforce size limit at API edge before any I/O. Reuse existing constant `MAX_FILE_BYTES = 20 * 1024 * 1024` from `lib/extract`.

Return 413 Payload Too Large with clear error.

### Implementation Steps
1. Import limit
```ts
import { MAX_FILE_BYTES } from "@/lib/extract";
```
2. Add early guard in POST handler after file extraction, before FormData creation:
```ts
if (file.size > MAX_FILE_BYTES) {
  return NextResponse.json(
    { error: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB limit.` },
    { status: 413 }
  );
}
```
Place guard immediately after `const file = form.get("file")` validation.

3. Mirror guard in fallback path – already present, keep.

4. Optional hardening
- Add `Content-Length` check in middleware for multipart.
- Log rejected oversized uploads.

### Verification
- Test with 1 MB file → succeeds.
- Test with 21 MB file → returns 413 JSON, no backend request made. Verify via logs / mock fetch spy.
- Ensure Python backend still receives valid sized files and processes correctly.

### Risks
- Client may rely on large file support; 20 MB limit is existing documented behavior in fallback, so consistent.
- If Python backend has different limit, align constants.

---

## Rollout Checklist
- [ ] Create branch `fix/issue2-xss-markdown`
- [ ] Apply changes, run `npm run lint && npm run build`
- [ ] Manual XSS test in dev
- [ ] Create branch `fix/issue3-upload-size`
- [ ] Apply guard, test 413 response
- [ ] Update CHANGELOG.md with security fixes
- [ ] Link PRs to issues #2 and #3 via `Closes #2`

## Acceptance Criteria
- Markdown rendering strips/escapes `<script>`, `<img onerror>`, `javascript:` URLs.
- Upload >20 MB rejected with 413 before fetch to Python backend.
- No regressions in existing session/chat flows.

---

*Generated from code review scan 2026-08-12.*
