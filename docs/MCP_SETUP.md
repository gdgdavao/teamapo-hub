# Model Context Protocol (MCP) Setup Guide

This guide details the Model Context Protocol (MCP) servers configured for the TeamApo Hub repository and provides instructions for connecting any AI coding assistant: **Antigravity (AGY)**, **OpenCode**, **Claude (Code & Desktop)**, **Cursor**, and other agentic environments.

---

## 1. Configured MCP Servers Overview

| Server Name | Command | Purpose & Capabilities |
| :--- | :--- | :--- |
| `chrome-devtools` | `bunx chrome-devtools-mcp@latest` | **Chrome DevTools Protocol (CDP)**: Inspect DOM elements, inspect styles/computed layout, capture full-page & element screenshots, monitor live console logs/errors, inspect network traffic & headers, evaluate JavaScript, and audit accessibility tree (WCAG 2.2). |
| `apohub-dev` | `bun run scripts/mcp/server.ts` | **Local Apohub Stack & Emulators**: Check Firebase emulator statuses (Firestore :8080, Auth :9099, Functions :5001, Storage :9199, UI :4000), execute local Python Cloud Functions, inspect Firestore collections with automatic PII sanitization (DPA 2012 compliance), seed data, and run quality gates. |
| `firebase` | `bunx firebase-tools mcp` | **Firebase Platform Integration**: Official Firebase CLI MCP server for managing security rules, projects, remote config, Firestore indexes, and authentication. |
| `memory-map` | `bun run scripts/mcp/memory-server.ts` | **Interconnected Markdown Memory Map**: Create, update, link, and search Markdown memory nodes with automatic bidirectional backlinks, category clustering, and dynamic Mermaid graph rendering in `.memory/MEMORY_MAP.md`. |
| `google-pay-wallet-dev` | `https://paydeveloper.googleapis.com/mcp` (remote, OAuth 2.0) | **Official Google Pay & Wallet Developer MCP**: Search official Google Pay/Wallet docs, list pass issuers (`list_pass_issuers`) and pass classes, inspect Google Pay integration status/error metrics, and manage merchant accounts — the console-side companion to the Wallet passes integration (see [docs/GoogleWalletPasses.md](./GoogleWalletPasses.md)). |

> [!IMPORTANT]
> **Strict Bun Invariant**: All MCP servers in this repository execute using `bun` or `bunx`. Never invoke with `npx` or `npm`.
> **Zero Absolute Paths**: All workspace commands and scripts use relative project paths (`scripts/mcp/server.ts`, `scripts/mcp/memory-server.ts`) for cross-machine portability.

---

## 2. Agent Setup Matrix

### 2.1 Antigravity (AGY)
Antigravity automatically detects and registers all MCP servers defined in the workspace root [`.mcp.json`](file:///Users/gab/Developer/apohub/.mcp.json):

```json
{
  "mcpServers": {
    "apohub-dev": {
      "command": "bun",
      "args": ["run", "scripts/mcp/server.ts"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
        "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
        "GCLOUD_PROJECT": "demo-apohub"
      }
    },
    "firebase": {
      "command": "bunx",
      "args": ["firebase-tools", "mcp"]
    },
    "chrome-devtools": {
      "command": "bunx",
      "args": ["chrome-devtools-mcp@latest"]
    },
    "memory-map": {
      "command": "bun",
      "args": ["run", "scripts/mcp/memory-server.ts"]
    }
  }
}
```
*No additional configuration needed. AGY connects automatically upon workspace load.*

---

### 2.2 OpenCode
OpenCode detects the root [`opencode.json`](file:///Users/gab/Developer/apohub/opencode.json) configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "apohub-dev": {
      "type": "local",
      "command": ["bun", "run", "scripts/mcp/server.ts"],
      "enabled": true,
      "cwd": ".",
      "timeout": 30000,
      "environment": {
        "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
        "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
        "GCLOUD_PROJECT": "demo-apohub"
      }
    },
    "firebase": {
      "type": "local",
      "command": ["bunx", "firebase-tools", "mcp"],
      "enabled": true,
      "cwd": ".",
      "timeout": 30000
    },
    "chrome-devtools": {
      "type": "local",
      "command": ["bunx", "chrome-devtools-mcp@latest"],
      "enabled": true,
      "cwd": ".",
      "timeout": 60000
    },
    "memory-map": {
      "type": "local",
      "command": ["bun", "run", "scripts/mcp/memory-server.ts"],
      "enabled": true,
      "cwd": ".",
      "timeout": 30000
    }
  }
}
```

---

### 2.3 Claude (Code CLI & Claude Desktop)

#### Claude Code (CLI)
Claude Code automatically loads MCP servers from either:
- Project root: [`.mcp.json`](file:///Users/gab/Developer/apohub/.mcp.json)
- Project Claude directory: [`.claude/mcp.json`](file:///Users/gab/Developer/apohub/.claude/mcp.json)

Both configuration files are included in the repository. Simply start Claude Code in the project root:
```bash
claude
```
Verify loaded tools by typing `/mcp` in Claude Code.

#### Claude Desktop
Claude Desktop reads configuration from your system user profile:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the following block to your `claude_desktop_config.json` (replace `/path/to/apohub` with your local repository path):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "bunx",
      "args": ["chrome-devtools-mcp@latest"]
    },
    "apohub-dev": {
      "command": "bun",
      "args": ["run", "/path/to/apohub/scripts/mcp/server.ts"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
        "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
        "GCLOUD_PROJECT": "demo-apohub"
      }
    },
    "firebase": {
      "command": "bunx",
      "args": ["firebase-tools", "mcp"]
    },
    "memory-map": {
      "command": "bun",
      "args": ["run", "/path/to/apohub/scripts/mcp/memory-server.ts"]
    }
  }
}
```

---

### 2.4 Cursor
Cursor automatically detects [`.cursor/mcp.json`](file:///Users/gab/Developer/apohub/.cursor/mcp.json) or [`.mcp.json`](file:///Users/gab/Developer/apohub/.mcp.json) in the repository root.

The included [`.cursor/mcp.json`](file:///Users/gab/Developer/apohub/.cursor/mcp.json) provides instant plug-and-play support for Cursor Composer and Chat.

---

### 2.5 Agent-Agnostic Config (Windsurf, Zed, Continue, Copilot)
Any MCP-compliant tool can use the project-root [`.mcp.json`](file:///Users/gab/Developer/apohub/.mcp.json).

- **Windsurf**: Reads `mcpServers` from `~/.codeium/windsurf/mcp_config.json` or project `.mcp.json`.
- **Zed**: Add to `.zed/settings.json` under `context_servers` pointing to `bunx chrome-devtools-mcp@latest`.
- **Direct Terminal Execution**:
  ```bash
  # Run Chrome DevTools MCP standalone
  bun run devtools:mcp

  # Run Apohub Dev Emulator MCP standalone
  bun run mcp

  # Run Firebase MCP standalone
  bun run firebase:mcp

  # Run Interconnected Memory Map MCP standalone
  bun run memory:mcp
  ```

---

### 2.6 Google Pay & Wallet Developer MCP (`google-pay-wallet-dev`)

Official Google remote MCP server (`https://paydeveloper.googleapis.com/mcp`, HTTP transport, **OAuth 2.0 — no API keys**). Tools: doc search, pass issuer/class listing, Google Pay integration status & error metrics, merchant account management. Console-side companion to [docs/GoogleWalletPasses.md](./GoogleWalletPasses.md).

**One-time Google Cloud prerequisites (per contributor):**

1. Select/create the Google Cloud project to use with Wallet (the one that will hold the Issuer account).
2. Enable the **Pay & Wallet Developer API** (`paydeveloper.googleapis.com`) on that project.
3. In **Google Auth Platform → Clients → Create client**, create an OAuth client (Google does **not** support dynamic client registration for this server, so credentials are pre-registered per client type):
   - **Antigravity** (desktop app) → *Web application* with redirect URI `https://antigravity.google/oauth-callback`
   - **OpenCode** → *Web application* with redirect URI `http://127.0.0.1:19876/mcp/oauth/callback` (OpenCode's default MCP OAuth callback port `19876`)
4. OAuth scopes used by the server: `https://www.googleapis.com/auth/paydeveloper.merchant` and `https://www.googleapis.com/auth/paydeveloper.issuer.readonly`.

**Agent wiring** (already present in this repo — nothing to commit):

| Agent | Config | Auth step |
| :--- | :--- | :--- |
| **OpenCode** (project) | [`opencode.json`](file:///Users/gab/Developer/apohub/opencode.json) → `mcp."google-pay-wallet-dev"` (remote URL, no secrets) | `/mcps` in the TUI → select the server → sign in (browser OAuth). If dynamic registration is rejected, add `"oauth": { "clientId": "…", "clientSecret": "…" }` from your Google Auth Platform client to the server entry — **in your global `~/.config/opencode/opencode.json(c)`, never committed**. |
| **OpenCode** (global) | `~/.config/opencode/opencode.json(c)` → same entry for all projects | Same sign-in flow. |
| **Antigravity** (global) | `~/.gemini/config/mcp_config.json` → official shape: `{ "google-pay-wallet-dev": { "serverUrl": "https://paydeveloper.googleapis.com/mcp", "oauth": { "clientId": "…", "clientSecret": "…" } } }` | `/mcp` (CLI) or **MCP Servers → Authenticate** (IDE/app); paste the authorization code where Antigravity asks. Fill in your own client credentials — **never commit a real client secret.** |
| **Any agent** | Project-root [`.mcp.json`](file:///Users/gab/Developer/apohub/.mcp.json) → `{ "google-pay-wallet-dev": { "url": "https://paydeveloper.googleapis.com/mcp" } }` | Follows that agent's MCP OAuth flow. |

> [!IMPORTANT]
> The repo-committed configs deliberately contain **only the server URL**. OAuth client IDs/secrets are per-contributor, live outside the repository (global configs), and a leaked Wallet-issuer OAuth secret gives read access to your Google Wallet issuer data. Sample prompts: "List my Google Wallet pass classes." / "Show Google Pay error metrics for the last 30 days."

---

## 3. Chrome DevTools MCP Capabilities & Best Practices

Chrome DevTools MCP enables AI models to perform real browser actions and diagnostics on the local Vite dev server (`http://localhost:5173`):

1. **Visual QA & Screenshots**:
   - `take_screenshot`: Capture full page or selector-scoped viewport images to verify UI layout, responsive breakpoints, and dark/light themes.
2. **Console Error Triage**:
   - `list_console_messages`: Read uncaught exceptions, React 19 hydration/render warnings, and Firebase emulator connection issues directly.
3. **Network Inspection**:
   - `list_network_requests`: Trace API endpoints, Cloud Function calls, and static asset latencies.
4. **DOM & CSS Inspection**:
   - Inspect element hierarchy, Tailwind CSS class computed styles, and accessibility attributes (`aria-expanded`, `aria-label`, `role`).
5. **Accessibility Verification**:
   - `get_accessibility_tree`: Audit page structure according to WCAG 2.2 standards, ensuring interactive elements have proper accessible names and roles.

---

## 4. Interconnected Memory Map MCP Capabilities & Workflow

The `memory-map` MCP server enables AI agents to maintain persistent, interconnected project memory in Markdown:

1. **Memory Node Storage**:
   - Each memory is saved as an individual Markdown file in `.memory/nodes/<id>.md` with YAML frontmatter (`id`, `title`, `category`, `tags`, `links`, timestamps).
   - Links can be defined in frontmatter or in markdown body using `[[wikilinks]]` or standard markdown links (`[Title](./node.md)`).
2. **Automatic Bidirectional Backlinks**:
   - When memory A links to memory B, the engine automatically registers A as an inbound backlink for B.
3. **Compiled Knowledge Map**:
   - Every creation or update automatically rebuilds `.memory/MEMORY_MAP.md`, containing connection metrics, a visual Mermaid flowchart, and an indexed directory table.
4. **Tools Provided**:
   - `create_memory`: Store a new memory note with tags, category, and links.
   - `update_memory`: Edit or append new discoveries/notes to an existing node.
   - `read_memory`: Fetch node contents, outbound links, and computed backlinks.
   - `link_memories`: Connect two memories with an optional relation label.
   - `search_memories`: Full-text search and tag/category filtering.
   - `get_memory_map`: Retrieve the overall graph and Mermaid diagram.
   - `list_memories`: List all stored memory nodes with connection metrics.

