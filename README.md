# Claude Annotator Plugin

Claude Code plugin for [vite-plugin-ai-annotator](https://www.npmjs.com/package/vite-plugin-ai-annotator) - enables AI-human collaboration through visual element selection and annotation.

[![Watch the Tutorial](https://img.youtube.com/vi/OuKnfCbmfTg/maxresdefault.jpg)](https://youtu.be/OuKnfCbmfTg)
> [Watch the Tutorial Video](https://youtu.be/OuKnfCbmfTg) - See the plugin in action!

## Overview

This plugin provides Claude Code with knowledge about AI Annotator, a tool that bridges the gap between AI assistants and web development by allowing:

- Visual element selection in the browser
- Adding comments/annotations to selected elements
- Capturing screenshots
- Injecting CSS/JS for testing
- Real-time collaboration between AI and humans

## Installation

### Install the Plugin

In Claude Code, first add the marketplace, then install the plugin:

```bash
/plugin marketplace add nguyenvanduocit/claude-annotator-plugin
/plugin install claude-annotator-plugin@claude-annotator-plugin
```

Then ask Claude: *"Set up ai-annotator for my project"* - it will handle everything!

### Alternative: Local Development

```bash
git clone https://github.com/nguyenvanduocit/claude-annotator-plugin.git
claude --plugin-dir ./claude-annotator-plugin
```

### Installation Scopes

```bash
# User scope (default) - available across all projects
/plugin install claude-annotator-plugin@claude-annotator-plugin --scope user

# Project scope - shared with team via version control
/plugin install claude-annotator-plugin@claude-annotator-plugin --scope project
```

## What the Plugin Does

When you ask Claude to set up ai-annotator, it will:

1. Install `vite-plugin-ai-annotator` as a dev dependency
2. Configure your `vite.config.ts` with the annotator plugin
3. Set up the MCP server connection in Claude Code settings
4. Guide you through using all features

**Framework Support:**
- React - Detects components, props, and state
- Vue - Understands composition/options API
- Angular - Recognizes components and directives
- Svelte - Identifies components and stores
- Vanilla JS - Works with plain HTML/CSS/JS

### Skill: annotator

The `annotator` skill provides comprehensive guidance on:

- Setting up AI Annotator in your project
- Configuring the MCP server
- Using all available MCP tools
- Best practices for AI-human collaboration

**Trigger phrases:**
- "Set up ai-annotator"
- "How do I use annotator?"
- "Select elements in browser"
- "Capture screenshot from browser"

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `annotator_list_sessions` | List connected browser sessions |
| `annotator_get_page_context` | Get current page URL, title, selection count |
| `annotator_select_feedback` | Enter inspect mode or select by CSS/XPath |
| `annotator_get_feedback` | Get data about selected elements |
| `annotator_capture_screenshot` | Capture viewport or element screenshot |
| `annotator_clear_feedback` | Clear all selections |
| `annotator_inject_css` | Inject CSS styles into page |
| `annotator_inject_js` | Execute JavaScript in page context |
| `annotator_get_console` | Get captured console logs |

Note: All tools (except `annotator_list_sessions`) accept an optional `sessionId` parameter. If only one browser is connected, it auto-selects.

## License

MIT
