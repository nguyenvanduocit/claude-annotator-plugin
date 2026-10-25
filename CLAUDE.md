# claude-annotator-plugin

Claude Code plugin for `vite-plugin-ai-annotator`. Provides:

1. **A skill** (`skills/annotator/SKILL.md`) — teaches Claude how to call the REST API on the live ws-server and how to react to channel push events.
2. **A channel MCP server** (`channel.ts`) — pushes browser feedback events into the running Claude Code session via the `claude/channel` capability, with a `notify_user` reply tool that surfaces toasts back to the toolbar.

**Status:** Active — ships runtime code, not just docs.

## Directory Structure

```
claude-annotator-plugin/
  .claude-plugin/
    plugin.json          # Plugin metadata
    marketplace.json     # Marketplace listing
  .mcp.json              # Spawn config: bun ${CLAUDE_PLUGIN_ROOT}/channel.ts
  channel.ts             # MCP channel server (claude/channel capability + notify_user tool)
  package.json           # Deps: @modelcontextprotocol/sdk + socket.io-client
  skills/
    annotator/SKILL.md   # REST API + channel event reference (loaded on trigger)
  README.md
  .gitignore
```

## How the channel works

```
Browser toolbar  ── Socket.IO ──►  ws-server (port 7318)
   (sends element data              │ filters to xpath+attributes, then
    with the event)                 │ broadcasts 'feedback:submitted'
                                          │ to room 'channels'
                                          ▼
                                   channel.ts (this plugin)
                                          │ mcp.notification(
                                          │   'notifications/claude/channel'
                                          │ )
                                          ▼ (stdio)
                                   Claude Code session
                                          │ tool call: notify_user(...)
                                          ▼ (stdio)
                                   channel.ts
                                          │ socket.emit('channel:notify')
                                          ▼
                                   ws-server ── relays to specific browser
                                          │
                                          ▼
                                   toolbar.showToast(prefix + message)
```

The channel server connects to ws-server with `?role=channel` so it joins the `channels` room and is excluded from `/api/sessions`.

## Install / Run

```bash
# Install plugin
/plugin marketplace add nguyenvanduocit/claude-annotator-plugin     # (or local path during dev)
/plugin install claude-annotator-plugin@claude-annotator-plugin

# Restart Claude Code with the channel flag — REQUIRED until plugin is on the
# Anthropic-maintained allowlist
claude --dangerously-load-development-channels plugin:claude-annotator-plugin@claude-annotator-plugin

# Local-dev shortcut without marketplace round-trip. The channel flag is still
# required: a server absent from the --channels list is gated out with
# kind="session", so the plugin loads but no channel events ever arrive.
claude --plugin-dir ./claude-annotator-plugin \
  --dangerously-load-development-channels plugin:claude-annotator-plugin@claude-annotator-plugin
```

Requires Claude Code **v2.1.80+** and Anthropic auth (claude.ai or Console API key). Not on Bedrock / Vertex / Foundry. Team / Enterprise orgs need admin to set `channelsEnabled: true`.

## Channel event format

When the user clicks the toolbar's "Send to Claude" button, Claude sees:

```
<channel source="ai-annotator" session_id="<uuid>" page_url="<url>" count="<N>">
User submitted <N> feedback item(s) on <url>.
Element data (inline — no API call needed to read it):
```json
[{ "comment": "...", "selectedText": "...", "componentData": { "componentLocation": "src/Foo.vue:42" },
   "cssSelector": "...", "xpath": "...", "attributes": { ... } }]
```
For each item: open the "file:line" path ... Then clear the selection: DELETE http://localhost:7318/api/sessions/<uuid>/feedback ...
</channel>
```

Claude follows the skill's instructions: read the inline data, apply changes, optionally call `notify_user(session_id, message, status)` to toast progress, then DELETE the feedback to clear it.

## Editing the channel server

`channel.ts` is a single-file Bun script. Re-run `bun install` only if dependencies change. No build step — Bun loads TypeScript directly. The `.mcp.json` invokes it via `bun ${CLAUDE_PLUGIN_ROOT}/channel.ts`, so the file path stays portable.

To debug stderr from the channel process, look at `~/.claude/debug/<session-id>.txt` (per the channels-reference doc).

## Editing the skill

`skills/annotator/SKILL.md` triggers on terms in its `description` frontmatter (annotator, ai-annotator, browser feedback, etc.). Edit the description carefully — too broad = false positive on every web-related task; too narrow = misses obvious user intent.

The skill body is the REST API reference + workflows. When `vite-plugin-ai-annotator`'s API changes (new endpoint, new field), update the table here.

## Gotchas

- `marketplace.json` uses author `nguyenvanduocit`; `plugin.json` uses `InstantCode` — same person, two names. Don't "fix" by aligning them without checking.
- Sender gating is implicit: ws-server binds `127.0.0.1` by default, so only local processes can push. If the user opens `listenAddress: '0.0.0.0'` for team collab, the channel will relay events from any browser that connects — add explicit gating before recommending that mode.
- Channel events only fire while Claude Code is running with `--channels`. Closed terminal = lost events. The `UserPromptSubmit` hook in `vite-plugin-ai-annotator/CLAUDE.md` is the PULL-on-prompt fallback.
- The push carries the element data inline, so Claude acts without a REST read. `DELETE /api/sessions/<id>/feedback` is still required — the push can't clear the browser's selection, and skipping it replays the same items on the next send.
- `count` mirrors the real selection, and `elements` rides along with it. A page running a cached older toolbar bundle sends neither; the channel then emits the `Fetch GET ...` instruction instead, which is why `elements` is optional on the wire.
- The MCP tool `notify_user` is the only outbound. The skill's Workflow A explains when to call it. Don't fabricate other tool names — there are none.
