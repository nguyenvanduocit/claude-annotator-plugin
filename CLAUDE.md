# claude-annotator-plugin

Claude Code plugin for `vite-plugin-ai-annotator`. Provides:

1. **A skill** (`skills/annotator/SKILL.md`) — teaches Claude how to call the REST API on the live ws-server and how to react to channel push events.
2. **A channel MCP server** (`channel.ts`) — pushes browser feedback events into the running Claude Code session via the `claude/channel` capability, with a `notify_user` reply tool that surfaces toasts back to the toolbar.

**Status:** Active (the README still says "Archived" — that line is stale, predates the channel runtime).

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
                                          │ broadcast 'feedback:submitted'
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

# Local-dev shortcut without marketplace round-trip:
claude --plugin-dir ./claude-annotator-plugin
```

Requires Claude Code **v2.1.80+** and Anthropic auth (claude.ai or Console API key). Not on Bedrock / Vertex / Foundry. Team / Enterprise orgs need admin to set `channelsEnabled: true`.

## Channel event format

When the user clicks the toolbar's "Send to Claude" button, Claude sees:

```
<channel source="ai-annotator" session_id="<uuid>" page_url="<url>" count="<N>">
User submitted <N> feedback item(s) on <url>. Fetch GET http://localhost:7318/api/sessions/<uuid>/feedback ...
</channel>
```

Claude follows the skill's instructions: fetch via REST, apply changes, optionally call `notify_user(session_id, message, status)` to toast progress, then DELETE the feedback to clear it.

## Editing the channel server

`channel.ts` is a single-file Bun script. Re-run `bun install` only if dependencies change. No build step — Bun loads TypeScript directly. The `.mcp.json` invokes it via `bun ${CLAUDE_PLUGIN_ROOT}/channel.ts`, so the file path stays portable.

To debug stderr from the channel process, look at `~/.claude/debug/<session-id>.txt` (per the channels-reference doc).

## Editing the skill

`skills/annotator/SKILL.md` triggers on terms in its `description` frontmatter (annotator, ai-annotator, browser feedback, etc.). Edit the description carefully — too broad = false positive on every web-related task; too narrow = misses obvious user intent.

The skill body is the REST API reference + workflows. When `vite-plugin-ai-annotator`'s API changes (new endpoint, new field), update the table here.

## Gotchas

- **README.md says "Archived" — out of date.** This plugin is active and now ships runtime code.
- `marketplace.json` uses author `nguyenvanduocit`; `plugin.json` uses `InstantCode` — same person, two names. Don't "fix" by aligning them without checking.
- Sender gating is implicit: ws-server binds `127.0.0.1` by default, so only local processes can push. If the user opens `listenAddress: '0.0.0.0'` for team collab, the channel will relay events from any browser that connects — add explicit gating before recommending that mode.
- Channel events only fire while Claude Code is running with `--channels`. Closed terminal = lost events. The `UserPromptSubmit` hook in `vite-plugin-ai-annotator/CLAUDE.md` is the PULL-on-prompt fallback.
- `count: 0` arrives from the `copySessionId` button (which doesn't know how many elements are selected). Treat it as "go check `/api/sessions/<id>/feedback`", not "no items".
- The MCP tool `notify_user` is the only outbound. The skill's Workflow A explains when to call it. Don't fabricate other tool names — there are none.
