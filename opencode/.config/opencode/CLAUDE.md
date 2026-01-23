# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an OpenCode configuration directory for a multi-agent AI orchestration system. OpenCode is an AI coding assistant similar to Claude Code, and this config defines custom agents, MCP servers, provider routing, and plugins.

## Architecture

### Multi-Agent System

The system uses specialized agents with different models optimized for specific tasks:

- **Orchestrators** (`Sisyphus`, `Sisyphus-Junior`): Coordinate work, never implement directly
- **Search Agents** (`@explore`, `@librarian`): Fast codebase/docs lookup via Antigravity (Gemini 3 Flash)
- **Implementation** (`OpenCode-Builder`): Code writing via GitHub Copilot
- **Deep Reasoning** (`@oracle`): Architecture decisions via Claude Opus (expensive, use sparingly)
- **Planning** (`Prometheus`, `Metis`, `Momus`): Strategy and review via OpenAI/Antigravity
- **Multimodal** (`@multimodal-looker`): Image/PDF analysis via Gemini

### Provider Distribution Strategy

Distribute work across paid providers to maximize throughput. Antigravity/free models for search.

| Provider | Role | Agents |
|----------|------|--------|
| Claude | Orchestration + Building | Sisyphus, Claude-Builder, oracle |
| Copilot | Building | OpenCode-Builder |
| OpenAI | Building + Planning | GPT-Builder, Prometheus, Metis |
| Antigravity | Search + Review | explore, librarian, Momus |

**Three builders rotate** to distribute implementation load: `Claude-Builder`, `OpenCode-Builder`, `GPT-Builder`

### Key Configuration Files

| File | Purpose |
|------|---------|
| `opencode.json` | Main config: MCP servers, plugins, provider definitions, watcher ignores |
| `oh-my-opencode.json` | Agent definitions, model concurrency limits, category fallbacks |
| `agent/*.md` | Individual agent system prompts |
| `agent-steering-instructions.md` | Global instructions injected into sessions |
| `plugins/agent-steering/` | Plugin that enforces delegation patterns |

### Agent Delegation Rules

1. **Search before implementing**: Search codebase before writing code
2. **Distribute load**: Split work across Claude/Copilot/OpenAI to avoid rate limits
3. **Parallel execution**: Fire multiple agents simultaneously when possible
4. **Fallback to Antigravity**: Use free models when paid providers are rate-limited

### MCP Servers

- `memory`: Persistent memory via `@modelcontextprotocol/server-memory`
- `fetch`: Web fetching via `mcp-server-fetch`
- `morph-mcp`: Fast file editing via Morph with `edit_file` and `warpgrep_codebase_search` tools

### Plugins

- `oh-my-opencode`: Agent management framework
- `opencode-antigravity-auth`: Antigravity provider authentication
- `opencode-openai-codex-auth`: OpenAI Codex authentication
- `@tarquinen/opencode-dcp`: DCP (Distributed Context Protocol) support
- `./plugins/agent-steering`: Enforcement plugin that:
  - Injects steering rules into system prompt via `experimental.chat.system.transform`
  - Tracks search/write patterns per session
  - Warns when writes occur without prior searches
  - Provides `agent_advisor` tool for routing recommendations

## Custom Commands

| Command | Model | Purpose |
|---------|-------|---------|
| `/review` | Grok | Review staged git changes for logic flaws, boilerplate, security issues |

## Adding New Agents

1. Create agent prompt in `agent/<name>.md`
2. Register in `oh-my-opencode.json` under `agents` with model, prompt path, description
3. Optionally add to a category in `categories` for fallback routing

## Plugin Development

Plugins use the `@opencode-ai/plugin` SDK. Key patterns:

```typescript
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"

const myTool = tool({
  description: "Tool description",
  args: {
    param: tool.schema.string().describe("Parameter description")
  },
  async execute({ param }) {
    return "result string"  // Must return string
  }
})

const plugin: Plugin = async (ctx) => {
  return {
    tool: { my_tool: myTool },
    "tool.execute.before": async (input, output) => { /* hook */ }
  }
}

export default plugin
```

Available hooks: `tool.execute.before`, `tool.execute.after`, `chat.message`, `chat.params`, `chat.headers`, `permission.ask`, `command.execute.before`, `experimental.chat.system.transform`, `experimental.chat.messages.transform`, `experimental.session.compacting`
