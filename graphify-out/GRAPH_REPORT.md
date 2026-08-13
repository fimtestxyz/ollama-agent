# Graph Report - .  (2026-08-13)

## Corpus Check
- Corpus is ~15,531 words - fits in a single context window. You may not need a graph.

## Summary
- 331 nodes · 587 edges · 19 communities (13 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `getSession()` - 14 edges
3. `IndexStore` - 10 edges
4. `isAuthConfigured()` - 8 edges
5. `touch()` - 8 edges
6. `log()` - 8 edges
7. `retrieve()` - 8 edges
8. `POST()` - 7 edges
9. `rawStore()` - 7 edges
10. `createSession()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `PUT()` --calls--> `getUserId()`  [EXTRACTED]
  app/api/prefs/route.ts → lib/auth.ts
- `POST()` --calls--> `addMessage()`  [EXTRACTED]
  app/api/sessions/[id]/chat/route.ts → lib/store.ts
- `POST()` --calls--> `getSession()`  [EXTRACTED]
  app/api/sessions/[id]/chat/route.ts → lib/store.ts
- `DELETE()` --calls--> `removeFile()`  [EXTRACTED]
  app/api/sessions/[id]/files/[fileId]/route.ts → lib/store.ts
- `DELETE()` --calls--> `deleteSession()`  [EXTRACTED]
  app/api/sessions/[id]/route.ts → lib/store.ts

## Import Cycles
- None detected.

## Communities (19 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (39): ChatApp(), loadSettings(), ToastState, ChatView(), Composer(), FileChips(), formatBytes(), formatTime() (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (45): Ctx, DELETE(), runtime, Ctx, DELETE(), GET(), PATCH(), runtime (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (41): delete, FastAPI, get, ndarray, post, chunk_markdown(), _lineage(), Hard-split a single oversized block with a sliding tail overlap. (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): dependencies, mammoth, next, pdf-parse, react, react-dom, react-markdown, remark-gfm (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (20): GET(), runtime, buildSystemPrompt(), Ctx, dynamic, fetchPythonContext(), POST(), runtime (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (21): alive_pid(), banner(), cmd_clean(), cmd_logs(), cmd_pid(), cmd_start(), cmd_status(), cmd_stop() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (12): GET(), PUT(), runtime, LoginPage(), metadata, { handlers, auth, signIn, signOut }, isAuthConfigured(), LoginClient() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.42
Nodes (8): Exception, ConvertError, _ext(), is_supported(), _markitdown_to_md(), _pdf_to_md(), Convert an uploaded file's bytes to markdown text., to_markdown()

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (3): metadata, viewport, Providers()

## Knowledge Gaps
- **81 isolated node(s):** `runtime`, `runtime`, `runtime`, `dynamic`, `Ctx` (+76 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IndexStore` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `IconSparkles()` connect `Community 0` to `Community 7`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `runtime`, `runtime`, `runtime` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07769423558897243 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08144796380090498 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08144796380090498 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._