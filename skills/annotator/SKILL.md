---
name: annotator
description: Use when the user mentions "annotator", "ai-annotator", "vite-plugin-ai-annotator", "browser feedback", "select elements in browser", "capture screenshot from browser", "inject CSS/JS", or wants to act on UI feedback that arrived as a `<channel source="ai-annotator">` event. Provides REST API + channel event reference for the live browser session.
---

# vite-plugin-ai-annotator

`vite-plugin-ai-annotator` injects an annotation toolbar into the browser. The user picks UI elements, attaches comments, then either copies a prompt to clipboard or — when the channel plugin is enabled — pushes a `<channel source="ai-annotator">` event straight into your running Claude Code session.

You interact with the live browser session through a **REST API** on `http://localhost:7318` (default). The MCP `annotator_*` tools that earlier versions exposed are gone — use the REST API.

## Architecture

```
┌─────────────────┐    Socket.IO      ┌──────────────────┐
│  Browser Page   │◄─────────────────►│  ws-server       │
│  (toolbar UI)   │                   │  (Express, :7318)│
└─────────────────┘                   └────────┬─────────┘
                                               │ REST /api/*
                                               │
                                               │ Socket.IO room "channels"
                                               │
                                      ┌────────▼─────────────┐
                                      │  channel.ts (this    │
                                      │  plugin's MCP server)│
                                      └────────┬─────────────┘
                                               │ stdio (claude/channel)
                                      ┌────────▼─────────┐
                                      │   Claude Code    │
                                      │   session        │
                                      └──────────────────┘
```

## Channel push event

When the user clicks a "Send to Claude" button in the toolbar, the channel server pushes:

```
<channel source="ai-annotator" session_id="<uuid>" page_url="<url>" count="<N>">
User submitted <N> feedback item(s) on <url> ("<title>"). Fetch GET http://localhost:7318/api/sessions/<session_id>/feedback?fields=xpath,attributes for details, apply the changes the comments describe, then DELETE the same endpoint. Use notify_user(session_id="<session_id>", ...) to report progress.
</channel>
```

When you see this event:

1. Fetch full feedback: `GET /api/sessions/<session_id>/feedback?fields=xpath,attributes` (add `styles,children` if you need them)
2. Each item carries `componentData.componentLocation` — file path with line number — open the file at that location
3. Apply the changes the user's `comment` describes
4. Call `notify_user` to surface progress in the browser toast
5. `DELETE /api/sessions/<session_id>/feedback` after the change ships, so the same items don't fire next time

## REST API

All endpoints under `/api/`. Default base URL: `http://localhost:7318` (override with the `AI_ANNOTATOR_PORT` or `INSPECTOR_PORT` env var).

| Method | Endpoint | Body / Query | Returns |
|--------|----------|--------------|---------|
| `GET` | `/api/sessions` | — | Array of `BrowserSession` |
| `GET` | `/api/sessions/:id/page-context` | — | `{url, title, selectionCount, isInspecting}` |
| `POST` | `/api/sessions/:id/select` | `{mode?: 'inspect'\|'selector', selector?: string, selectorType?: 'css'\|'xpath'}` | `{success, count, error?}` |
| `GET` | `/api/sessions/:id/feedback` | `?fields=xpath,attributes,styles,children` | Array of `ElementData` |
| `DELETE` | `/api/sessions/:id/feedback` | — | `{success: true}` |
| `POST` | `/api/sessions/:id/screenshot` | `{type?: 'viewport'\|'element', selector?, quality?}` | `{success, filePath}` (WebP saved to tmpdir) |
| `POST` | `/api/sessions/:id/inject-css` | `{css: string}` | `{success, error?}` |
| `POST` | `/api/sessions/:id/inject-js` | `{code: string}` | `{success, result?, error?}` |
| `GET` | `/api/sessions/:id/console` | `?clear=true` | Array of `{type, args, timestamp}` |

**Session ID**: required in path. Use `GET /api/sessions` to discover. The channel event hands you `session_id` directly via `meta`.

## `notify_user` reply tool

Two-way channel exposes one MCP tool:

```
notify_user(session_id: string, message: string, status?: 'info' | 'progress' | 'done' | 'error')
```

The toolbar shows a toast prefixed by status icon (`✓` done, `✗` error, `…` progress). Call it to acknowledge receipt, report progress on long fixes, or signal completion. Pass `session_id` from the inbound channel tag verbatim.

## ElementData shape

```typescript
interface ElementData {
  index: number
  tagName: string
  cssSelector: string
  textContent: string
  selectedText?: string          // when user highlighted specific text
  comment?: string               // user's annotation — the actionable instruction
  componentData?: {
    componentLocation: string    // "src/Foo.vue:42" — open this
    componentName?: string
    framework?: 'vue' | 'react' | 'angular' | 'svelte' | 'vanilla'
  }
  // Returned only when requested via ?fields=...
  xpath?: string
  attributes?: Record<string, string>
  computedStyles?: { width, height, fontSize, fontFamily, color?, backgroundColor?, display?, position? }
  children?: ElementData[]
}
```

## Workflows

### A — React to a channel push (channel mode)

1. Channel event arrives → read `session_id`, `page_url`, `count` from tag attributes
2. `GET /api/sessions/<session_id>/feedback?fields=xpath,attributes` → list of `ElementData`
3. For each item: open file at `componentData.componentLocation`, apply change driven by `comment`
4. `notify_user(session_id, "Applied 3 changes", status="done")`
5. `DELETE /api/sessions/<session_id>/feedback`

### B — Pull on demand (no channel; user pasted the copy-to-clipboard prompt)

1. `GET /api/sessions` → list sessions
2. `GET /api/sessions/<id>/feedback?fields=xpath,attributes` → details
3. Apply changes
4. `DELETE /api/sessions/<id>/feedback`

### C — Programmatic element selection

1. `POST /api/sessions/<id>/select` with `{mode: 'selector', selector: '.btn-primary'}` (CSS) or `{mode: 'selector', selector: '//button', selectorType: 'xpath'}`
2. `GET /api/sessions/<id>/feedback?fields=styles,attributes` to inspect

### D — Style debugging

1. `POST /api/sessions/<id>/inject-css` with `{css: '.foo { color: red }'}` to test
2. `POST /api/sessions/<id>/screenshot` with `{type: 'element', selector: '.foo'}` to verify visually

## Tips

- Always include `session_id` from the channel `meta` when calling REST. If multiple browsers connected and you call without it, you get an error listing available IDs.
- `componentData.componentLocation` ends with `:line` — use it directly in `Read` tool (`Read("src/Foo.vue", offset: 42)`) instead of grep.
- Console logs are buffered (max 1000, trimmed to 500). Use `?clear=true` after read to avoid duplicates next call.
- Screenshot files are WebP at `$TMPDIR/ai-annotator-screenshots/screenshot-<ts>.webp`.
- The vite plugin only runs during `vite serve`, never during `vite build` — no production overhead.

## Setup (for the user, not for you)

If the user is asking how to install:

```bash
bun add -d vite-plugin-ai-annotator
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import annotator from 'vite-plugin-ai-annotator'

export default defineConfig({
  plugins: [annotator({ port: 7318 })],
})
```

Then for the channel push experience:

```bash
/plugin marketplace add nguyenvanduocit/claude-annotator-plugin
/plugin install claude-annotator-plugin@claude-annotator-plugin
# Restart Claude Code with the channel flag (research preview)
claude --dangerously-load-development-channels plugin:claude-annotator-plugin@claude-annotator-plugin
```

Channels require Claude Code v2.1.80+ and Anthropic auth (claude.ai or Console API key). Not available on Bedrock / Vertex / Foundry.
