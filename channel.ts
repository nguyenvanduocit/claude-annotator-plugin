#!/usr/bin/env bun
/**
 * ai-annotator channel — pushes browser-toolbar feedback events into the
 * running Claude Code session via the `claude/channel` MCP capability.
 *
 * Flow:
 *   1. Browser toolbar emits `feedback:submitted` over Socket.IO when the user
 *      hits the "send to Claude" button.
 *   2. The vite-plugin-ai-annotator ws-server broadcasts that event to every
 *      connected client whose handshake carries `role=channel`.
 *   3. This process receives the broadcast and calls `mcp.notification(...)`
 *      with method `notifications/claude/channel`, which Claude Code surfaces
 *      to the assistant as a `<channel source="ai-annotator" ...>` event.
 *   4. Claude calls the `notify_user` tool to surface progress/completion as a
 *      toast inside the browser toolbar (relayed back through Socket.IO).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { io as ioClient, type Socket } from 'socket.io-client'

const PORT = process.env.AI_ANNOTATOR_PORT ?? process.env.INSPECTOR_PORT ?? '7318'
const SERVER_URL = `http://localhost:${PORT}`

const socket: Socket = ioClient(SERVER_URL, {
  transports: ['websocket'],
  query: { role: 'channel' },
  reconnection: true,
  reconnectionDelay: 1000,
})

const mcp = new Server(
  { name: 'ai-annotator', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions:
      `Events from the ai-annotator channel arrive as <channel source="ai-annotator" session_id="..." page_url="..." count="N">. ` +
      `When you receive one, fetch GET ${SERVER_URL}/api/sessions/<session_id>/feedback?fields=xpath,attributes for full details, ` +
      `apply the requested code changes, then DELETE ${SERVER_URL}/api/sessions/<session_id>/feedback to clear it. ` +
      `Use the notify_user tool to send progress/completion toasts back to the user's browser toolbar — ` +
      `pass session_id verbatim from the inbound channel tag.`,
  },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'notify_user',
      description:
        "Send a toast notification to the user's browser toolbar. Use to report progress, completion, or errors while addressing feedback.",
      inputSchema: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The session_id from the inbound channel event',
          },
          message: {
            type: 'string',
            description: 'Text to display in the toast (~200 chars max)',
          },
          status: {
            type: 'string',
            enum: ['info', 'progress', 'done', 'error'],
            description: 'Toast visual style (default: info)',
          },
        },
        required: ['session_id', 'message'],
      },
    },
  ],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'notify_user') {
    const { session_id, message, status = 'info' } = req.params.arguments as {
      session_id: string
      message: string
      status?: string
    }
    socket.emit('channel:notify', { sessionId: session_id, message, status })
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})

interface FeedbackSubmittedPayload {
  sessionId: string
  pageUrl: string
  pageTitle: string
  count: number
}

socket.on('feedback:submitted', async (payload: FeedbackSubmittedPayload) => {
  const titleSuffix = payload.pageTitle ? ` ("${payload.pageTitle}")` : ''
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content:
        `User submitted ${payload.count} feedback item(s) on ${payload.pageUrl}${titleSuffix}. ` +
        `Fetch GET ${SERVER_URL}/api/sessions/${payload.sessionId}/feedback?fields=xpath,attributes for details, ` +
        `apply the changes the comments describe, then DELETE the same endpoint. ` +
        `Use notify_user(session_id="${payload.sessionId}", ...) to report progress.`,
      meta: {
        session_id: payload.sessionId,
        page_url: payload.pageUrl,
        count: String(payload.count),
      },
    },
  })
})

await mcp.connect(new StdioServerTransport())
