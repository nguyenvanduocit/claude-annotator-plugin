# Claude Annotator Plugin

Claude Code plugin for InstantCode Annotator - enables AI-human collaboration through visual element selection and annotation.

## Overview

This plugin provides Claude Code with knowledge about InstantCode Annotator, a tool that bridges the gap between AI assistants and web development by allowing:

- Visual element selection in the browser
- Adding comments/annotations to selected elements
- Capturing screenshots
- Injecting CSS/JS for testing
- Real-time collaboration between AI and humans

## Installation

### Prerequisites

1. **InstantCode package** installed in your project:
   ```bash
   bun add instantcode
   # or
   npm install instantcode
   ```

2. **MCP server** configured in Claude Code settings

### Install the Plugin

```bash
# Clone the plugin
git clone https://github.com/anthropics/claude-annotator-plugin.git

# Use with Claude Code
claude --plugin-dir /path/to/claude-annotator-plugin
```

Or add to your project's `.claude/plugins/` directory.

## Features

### Skill: annotator

The `annotator` skill provides comprehensive guidance on:

- Setting up InstantCode in your project
- Configuring the MCP server
- Using all available MCP tools
- Best practices for AI-human collaboration

**Trigger phrases:**
- "How do I use annotator?"
- "Set up InstantCode"
- "Select elements in browser"
- "Capture screenshot from browser"

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `annotator_list_sessions` | List connected browser sessions |
| `annotator_set_active_session` | Set active browser session |
| `annotator_get_page_context` | Get current page URL, title, selection count |
| `annotator_select_element` | Enter inspect mode or select by CSS/XPath |
| `annotator_get_selected_elements` | Get data about selected elements |
| `annotator_capture_screenshot` | Capture viewport or element screenshot |
| `annotator_clear_selection` | Clear all selections |
| `annotator_inject_css` | Inject CSS styles into page |
| `annotator_inject_js` | Execute JavaScript in page context |
| `annotator_get_console` | Get captured console logs |

## License

MIT
