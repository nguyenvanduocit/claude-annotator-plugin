# claude-annotator-plugin

Claude Code plugin for [vite-plugin-ai-annotator](https://www.npmjs.com/package/vite-plugin-ai-annotator). Pick UI elements in your browser, attach comments, and Claude reacts immediately — no copy-paste needed.

Two parts:

1. **Channel runtime** (`channel.ts`) — pushes a `<channel source="ai-annotator">` event into your running Claude Code session the moment you press *Send* in the toolbar.
2. **Skill** (`skills/annotator/SKILL.md`) — teaches Claude how to call the REST API on the live `vite-plugin-ai-annotator` server: read feedback, capture screenshots, inject CSS/JS, read console logs.

## Requirements

- Claude Code **v2.1.80+** (channels are in [research preview](https://code.claude.com/docs/en/channels#research-preview))
- Anthropic auth (claude.ai or Console API key) — channels are **not** available on Bedrock / Vertex / Foundry
- A Vite (or Nuxt) project running [`vite-plugin-ai-annotator`](https://www.npmjs.com/package/vite-plugin-ai-annotator) `>= 1.15.0` (earlier versions don't broadcast the events the channel listens for). `>= 3.1.0` ships the element data inside the push, so Claude acts without a REST read; on older servers the push carries a fetch instruction instead and the flow still works
- [Bun](https://bun.sh) (the channel server is a Bun script)

## Install

```bash
# 1. Add the marketplace and install
/plugin marketplace add nguyenvanduocit/claude-annotator-plugin
/plugin install claude-annotator-plugin@claude-annotator-plugin

# 2. Restart Claude Code with the channel flag
#    (development flag is required until the plugin lands on Anthropic's
#    approved channel allowlist)
claude --dangerously-load-development-channels plugin:claude-annotator-plugin@claude-annotator-plugin
```

For local-dev shortcut without going through a marketplace round-trip:

```bash
git clone https://github.com/nguyenvanduocit/claude-annotator-plugin.git
claude --plugin-dir ./claude-annotator-plugin --dangerously-load-development-channels plugin:claude-annotator-plugin@claude-annotator-plugin
```

## How it works

```
Browser toolbar  ── Socket.IO ──►  ws-server (port 7318)
                                         │ broadcast 'feedback:submitted'
                                         │ to Socket.IO room 'channels'
                                         ▼
                                  channel.ts (this plugin)
                                         │ mcp.notification(
                                         │   'notifications/claude/channel'
                                         │ )
                                         ▼ (stdio)
                                  Claude Code session
                                         │ tool: notify_user(...)
                                         ▼ (stdio)
                                  channel.ts
                                         │ socket.emit('channel:notify')
                                         ▼
                                  ws-server ── relays to source browser
                                         │
                                         ▼
                                  toolbar.showToast(prefix + message)
```

When you click *Send to Claude* in the toolbar, Claude sees the element data inline — no API round-trip to read it:

```
<channel source="ai-annotator" session_id="<uuid>" page_url="<url>" count="<N>">
User submitted <N> feedback item(s) on <url>.
Element data (inline — no API call needed to read it):
```json
[{ "comment": "make this button red", "selectedText": "Place order",
   "componentData": { "componentLocation": "src/Checkout.vue:42" },
   "cssSelector": ".btn-primary", "xpath": "/html/body/...", "attributes": { ... } }]
```
For each item: open the "file:line" path in componentData.componentLocation and apply the change its comment asks for. Then clear the selection: DELETE http://localhost:7318/api/sessions/<uuid>/feedback ...
</channel>
```

Claude reads the data straight from the event, opens the source files (each item carries `componentData.componentLocation` — file path with line number), applies the requested changes, optionally calls `notify_user(session_id, message, status)` to surface progress as a toast, then `DELETE`s the feedback to clear the browser's selection.

Computed styles and child elements are excluded from the push to keep it small — Claude fetches `?fields=styles,children` over REST on the rare occasions it needs them.

## Tools exposed

The channel exposes one MCP tool:

| Tool | Purpose |
|------|---------|
| `notify_user(session_id, message, status?)` | Send a toast back to the user's browser toolbar. `status` is one of `info`, `progress`, `done`, `error` — the toolbar prefixes the message with `… / ✓ / ✗` accordingly. Pass `session_id` verbatim from the inbound channel tag. |

The full data surface (sessions, feedback, screenshots, console, CSS/JS injection) lives on the `vite-plugin-ai-annotator` REST API at `http://localhost:7318/api/*`. The skill documents every endpoint.

## Skill: `annotator`

Triggers on terms like *annotator*, *ai-annotator*, *browser feedback*, *select elements in browser*, *capture screenshot from browser*, *inject CSS/JS*, or when an inbound `<channel source="ai-annotator">` event arrives.

When triggered, Claude loads the REST API table, the channel event format reference, and four workflows (react to channel push, pull on demand, programmatic select, style debugging).

## Framework support

The companion `vite-plugin-ai-annotator` detects the source framework so feedback items carry usable `componentData.componentLocation`:

- **React**, **Vue**, **Angular**, **Svelte**, **Vanilla JS**, **Nuxt** (4+)

## Without the channel

If you can't run with `--channels` (older Claude Code, Bedrock/Vertex/Foundry, org policy), the skill still works in PULL mode: clicking the toolbar button copies a prompt to your clipboard, and the skill teaches Claude to call the REST API on demand. You also have a `UserPromptSubmit` hook variant documented in [vite-plugin-ai-annotator's CLAUDE.md](https://github.com/nguyenvanduocit/vite-plugin-ai-annotator/blob/master/CLAUDE.md) that pulls feedback automatically on every prompt.

## License

MIT
