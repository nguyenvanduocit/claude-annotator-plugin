---
name: annotator
description: Guide for using vite-plugin-ai-annotator to enable AI-human collaboration through visual element selection. Use when user mentions "annotator", "ai-annotator", "vite-plugin-ai-annotator", "select elements", "browser selection", "capture screenshot from browser", "inject CSS/JS", or needs to work with web elements visually.
---

# vite-plugin-ai-annotator

AI-powered element annotator for Vite - enables real-time collaboration between AI and humans through visual element selection, annotation, and manipulation in the browser.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Browser Page   │◄──────────────────►│  Annotator       │
│  (Toolbar UI)   │                    │  Server (:7318)  │
└─────────────────┘                    └────────┬─────────┘
                                                │
                                           MCP Protocol
                                                │
                                       ┌────────▼─────────┐
                                       │   Claude Code    │
                                       │   (MCP Client)   │
                                       └──────────────────┘
```

## Setup

### 1. Install vite-plugin-ai-annotator

```bash
bun add -d vite-plugin-ai-annotator
```

### 2. Add Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import annotator from 'vite-plugin-ai-annotator'

export default defineConfig({
  plugins: [
    annotator({
      port: 7318,           // Default port
      verbose: false,       // Enable for debugging
    }),
  ],
})
```

**Team Collaboration (optional):** For network access, add:
```typescript
annotator({
  port: 7318,
  listenAddress: '0.0.0.0',                // Accept connections from network
  publicAddress: 'https://myapp.com:7318', // Public URL for the toolbar
})
```

### 3. Configure MCP Server

Add to Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "instantcode": {
      "url": "http://localhost:7318/mcp"
    }
  }
}
```

### 4. Start Development Server

```bash
bun dev
```

The annotator toolbar appears in the bottom-right corner of your app.

## MCP Tools

### Session Management

**annotator_list_sessions**
List all connected browser sessions.

```
Use: When multiple browser tabs are connected and you need to see which sessions are available.
```

Note: The MCP server is **stateless** - there's no "active session" concept. Each tool accepts an optional `sessionId` parameter. If only one browser session is connected, it auto-selects. If multiple sessions exist, you must pass `sessionId` to each tool call.

### Page Context

**annotator_get_page_context**
Get current page information.

```
Parameters:
- sessionId: (optional) Browser session ID

Returns:
- url: Current page URL
- title: Page title
- selectionCount: Number of selected elements
- isInspecting: Whether inspect mode is active

Use: Before selecting elements, to understand current page state.
```

### Element Selection

**annotator_select_element**
Enter inspect mode or select elements by selector.

```
Parameters:
- sessionId: (optional) Browser session ID
- mode: 'inspect' | 'selector' (default: 'inspect')
- selector: CSS or XPath selector (required when mode is 'selector')
- selectorType: 'css' | 'xpath' (default: 'css')

Examples:
- Inspect mode: { mode: 'inspect' }
- CSS selector: { mode: 'selector', selector: '.btn-primary' }
- XPath: { mode: 'selector', selector: '//button[@type="submit"]', selectorType: 'xpath' }
```

**annotator_get_selected_elements**
Get detailed data about selected elements.

```
Parameters:
- sessionId: (optional) Browser session ID

Returns array of ElementData:
- index: Selection order
- tagName: HTML tag
- xpath: Full XPath
- cssSelector: CSS selector
- textContent: Element text
- attributes: All attributes
- comment: User annotation (if any)
- computedStyles: Width, height, colors, fonts
- componentData: Framework component info (Vue, React, etc.)
- children: Nested selected elements
```

**annotator_clear_selection**
Clear all selected elements.

```
Parameters:
- sessionId: (optional) Browser session ID
```

### Screenshots

**annotator_capture_screenshot**
Capture viewport or specific element.

```
Parameters:
- sessionId: (optional) Browser session ID
- type: 'viewport' | 'element' (default: 'viewport')
- selector: CSS selector (required when type is 'element')
- format: 'png' | 'jpeg' (default: 'png')
- quality: 0-1 (default: 0.8)

Returns: File path to saved screenshot
```

### Code Injection

**annotator_inject_css**
Inject CSS styles into the page.

```
Parameters:
- sessionId: (optional) Browser session ID
- css: CSS code to inject

Use: Testing style changes, debugging layout issues.
```

**annotator_inject_js**
Execute JavaScript in page context.

```
Parameters:
- sessionId: (optional) Browser session ID
- code: JavaScript code to execute

Returns: Execution result or error

Use: Testing interactions, reading page state, debugging.
```

### Console

**annotator_get_console**
Get captured console logs from the browser.

```
Parameters:
- sessionId: (optional) Browser session ID
- clear: boolean - Clear buffer after reading (default: false)

Returns: Array of console entries with type, args, timestamp.
```

## Workflows

### Workflow 1: Understand Page Structure

1. Check page context: `annotator_get_page_context`
2. Enter inspect mode: `annotator_select_element({ mode: 'inspect' })`
3. Ask user to click elements they want to discuss
4. Get selected elements: `annotator_get_selected_elements`
5. Analyze structure and provide recommendations

### Workflow 2: Debug Styling Issues

1. Select problematic element: `annotator_select_element({ mode: 'selector', selector: '.problem-element' })`
2. Get element details including computedStyles
3. Inject test CSS: `annotator_inject_css('...')`
4. Capture screenshot to verify: `annotator_capture_screenshot({ type: 'element', selector: '.problem-element' })`

### Workflow 3: Implement User Feedback

1. User selects elements and adds comments via toolbar
2. Get selections with comments: `annotator_get_selected_elements`
3. Read component files based on `componentData.componentLocation`
4. Make code changes based on user comments
5. User verifies changes in browser

## Element Data Structure

```typescript
interface ElementData {
  index: number
  tagName: string
  xpath: string
  cssSelector: string
  textContent: string
  attributes: Record<string, string>
  imagePath?: string  // Screenshot path if captured
  comment?: string  // User annotation
  computedStyles?: {
    width: number
    height: number
    fontSize: string
    fontFamily: string
    color?: string
    backgroundColor?: string
    display?: string
    position?: string
  }
  componentData?: {
    componentLocation: string  // File path
    componentName?: string
    framework?: 'vue' | 'react' | 'angular' | 'svelte' | 'vanilla'
  }
  children: ElementData[]
}
```

## Tips

- Always call `annotator_get_page_context` first to verify connection
- Use inspect mode for user-driven selection, CSS/XPath for programmatic selection
- Element comments from users provide valuable context for code changes
- `componentData.componentLocation` points directly to the source file
- Screenshots are saved to temp directory and path is returned
- Console logs are buffered; use `clear: true` to prevent duplicates
