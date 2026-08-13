Graph complete. Outputs in
 /Volumes/wwk_nvme/Users/wwkoon/pi-web-public/herdr_test/graphify-out/

   graph.json – raw graph data
   GRAPH_REPORT.md – audit report

 Corpus

- Corpus: 58 files · ~15,531 words
  - code: 53 files
  - docs: 5 files

 Graph

- 331 nodes · 587 edges · 19 communities

### God Nodes (most connected)

 1. compilerOptions – 16 edges
 2. getSession() – 14 edges
 3. IndexStore – 10 edges
 4. isAuthConfigured() – 8 edges
 5. touch() – 8 edges
 6. log() – 8 edges
 7. retrieve() – 8 edges
 8. POST() – 7 edges
 9. rawStore() – 7 edges
 10. createSession() – 7 edges

### Surprising Connections

- PUT() --calls--> getUserId() [EXTRACTED]
   app/api/prefs/route.ts → lib/auth.ts
- POST() --calls--> addMessage() [EXTRACTED]
   app/api/sessions/[id]/chat/route.ts → lib/store.ts
- POST() --calls--> getSession() [EXTRACTED]
   app/api/sessions/[id]/chat/route.ts → lib/store.ts
- DELETE() --calls--> removeFile() [EXTRACTED]
   app/api/sessions/[id]/files/[fileId]/route.ts → lib/store.ts
- DELETE() --calls--> deleteSession() [EXTRACTED]
   app/api/sessions/[id]/route.ts → lib/store.ts

### Suggested Questions

- Why does IndexStore connect Community 8 to Community 2?
   High betweenness centrality (0.012) - this node is a cross-community
   bridge.
- Why does IconSparkles() connect Community 0 to Community 7?
   High betweenness centrality (0.011) - this node is a cross-community
   bridge.
- What connects runtime, runtime, runtime to the rest of the system?
   81 weakly-connected nodes found - possible documentation gaps or missing
   edges.
- Should Community 0 be split into smaller, more focused modules?
   Cohesion score 0.07769423558897243 - nodes in this community are weakly
   interconnected.
- Should Community 1 be split into smaller, more focused modules?
   Cohesion score 0.08144796380090498 - nodes in this community are weakly
   interconnected.
- Should Community 2 be split into smaller, more focused modules?
   Cohesion score 0.08144796380090498 - nodes in this community are weakly
   interconnected.
- Should Community 3 be split into smaller, more focused modules?
   Cohesion score 0.06060606060606061 - nodes in this community are weakly
   interconnected.

 The most interesting question this graph can answer: Why does IndexStore
 connect Community 8 to Community 2?. Want me to trace it?
