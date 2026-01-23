import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"

// Track session state for enforcement
const sessionState = new Map<string, {
  searchesDone: number
  writeAttempts: number
  lastSearchTime: number
  agentsDelegated: Set<string>
  lastAgentTime: number
}>()

const SEARCH_TOOLS = [
  "Glob", "Grep", "Read", "List", "Search",
  "mcp_fetch", "mcp_memory", "mcp_morph-mcp_warpgrep_codebase_search"
]

const WRITE_TOOLS = [
  "Write", "Edit", "NotebookEdit",
  "mcp_morph-mcp_edit_file", "mcp_write", "mcp_edit"
]

const AGENT_TOOLS = [
  "mcp_task", "mcp_call_omo_agent", "background_task", "Task",
  "mcp_omo_agent", "call_agent", "delegate"
]

// Exact agent names from oh-my-opencode.json
const NAMED_AGENTS = [
  "Claude-Builder",
  "OpenCode-Builder",
  "GPT-Builder",
  "oracle",
  "explore",
  "librarian",
  "Prometheus (Planner)",
  "Metis (Plan Consultant)",
  "Momus (Plan Reviewer)",
  "multimodal-looker",
  "Sisyphus",
  "Sisyphus-Junior"
]

function getSession(sessionID: string) {
  if (!sessionState.has(sessionID)) {
    sessionState.set(sessionID, {
      searchesDone: 0,
      writeAttempts: 0,
      lastSearchTime: 0,
      agentsDelegated: new Set(),
      lastAgentTime: 0
    })
  }
  return sessionState.get(sessionID)!
}

const STEERING_SYSTEM_PROMPT = `
<MANDATORY-AGENT-DELEGATION>
⛔ YOU ARE FORBIDDEN FROM USING Write/Edit/NotebookEdit ⛔

You MUST delegate ALL code work using background_task.
If an agent fails or hits rate limits, try a DIFFERENT agent.
NEVER do the work yourself.

## AGENTS:
explore, librarian, Claude-Builder, OpenCode-Builder, GPT-Builder, Prometheus (Planner), Momus (Plan Reviewer), oracle

## PARALLEL INVOCATION:
background_task("explore", "find X")
background_task("Claude-Builder", "subtask A")
background_task("OpenCode-Builder", "subtask B")
background_task("GPT-Builder", "subtask C")

## IF RATE LIMITED:
Try different builder: Claude-Builder → OpenCode-Builder → GPT-Builder
NEVER use Write/Edit yourself.
</MANDATORY-AGENT-DELEGATION>
`

const agentAdvisor = tool({
  description: "Returns exact agent names to invoke for a task.",
  args: {
    task: tool.schema.string().describe("What you need to accomplish")
  },
  async execute({ task }) {
    const lowerTask = task.toLowerCase()
    const invoke: string[] = []

    if (lowerTask.includes("implement") || lowerTask.includes("code") || lowerTask.includes("write") ||
        lowerTask.includes("create") || lowerTask.includes("add") || lowerTask.includes("fix") ||
        lowerTask.includes("edit") || lowerTask.includes("refactor")) {
      invoke.push('background_task("explore", "search codebase")')
      invoke.push('background_task("librarian", "check docs")')
      invoke.push("SPLIT implementation across builders IN PARALLEL:")
      invoke.push('background_task("Claude-Builder", "subtask A")')
      invoke.push('background_task("OpenCode-Builder", "subtask B")')
      invoke.push('background_task("GPT-Builder", "subtask C")')
    }

    if (lowerTask.includes("find") || lowerTask.includes("search") || lowerTask.includes("locate")) {
      invoke.push('background_task("explore", "...")')
    }

    if (lowerTask.includes("doc") || lowerTask.includes("how to") || lowerTask.includes("api")) {
      invoke.push('background_task("librarian", "...")')
    }

    if (lowerTask.includes("plan") || lowerTask.includes("strategy") || lowerTask.includes("design")) {
      invoke.push('background_task("Prometheus (Planner)", "...")')
    }

    if (lowerTask.includes("review") || lowerTask.includes("check")) {
      invoke.push('background_task("Momus (Plan Reviewer)", "...")')
    }

    if (lowerTask.includes("architect") || lowerTask.includes("debug") || lowerTask.includes("complex")) {
      invoke.push('background_task("oracle", "...")')
    }

    if (lowerTask.includes("image") || lowerTask.includes("pdf") || lowerTask.includes("screenshot")) {
      invoke.push('background_task("multimodal-looker", "...")')
    }

    if (invoke.length === 0) {
      invoke.push('background_task("explore", "understand codebase")')
      invoke.push('background_task("librarian", "find patterns")')
    }

    return JSON.stringify({
      task,
      invoke_agents: invoke,
      reminder: "Use background_task with exact agent names. Split work across Claude-Builder, OpenCode-Builder, GPT-Builder."
    }, null, 2)
  }
})

const plugin: Plugin = async () => {
  console.log("[agent-steering] Plugin loaded")
  return {
    tool: {
      agent_advisor: agentAdvisor
    },

    "experimental.chat.system.transform": async (input, output) => {
      output.system.push(STEERING_SYSTEM_PROMPT)
    },

    "tool.execute.before": async (input, output) => {
      const session = getSession(input.sessionID)

      if (SEARCH_TOOLS.some(t => input.tool.includes(t))) {
        session.searchesDone++
        session.lastSearchTime = Date.now()
      }

      if (AGENT_TOOLS.some(t => input.tool.includes(t))) {
        session.lastAgentTime = Date.now()
        const argsStr = JSON.stringify(output.args || {})
        for (const agent of NAMED_AGENTS) {
          if (argsStr.includes(agent)) {
            session.agentsDelegated.add(agent)
          }
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const session = getSession(input.sessionID)

      if (WRITE_TOOLS.some(t => input.tool.includes(t))) {
        session.writeAttempts++

        const timeSinceAgent = Date.now() - session.lastAgentTime
        const noAgentDelegation = session.agentsDelegated.size === 0
        const noRecentAgent = session.lastAgentTime === 0 || timeSinceAgent > 120000

        if (noAgentDelegation || noRecentAgent) {
          output.output = `${output.output}

⛔ DELEGATION VIOLATION: You used ${input.tool} directly.
Use: background_task("Claude-Builder", "...") or background_task("OpenCode-Builder", "...") or background_task("GPT-Builder", "...")
Agents used: ${session.agentsDelegated.size > 0 ? [...session.agentsDelegated].join(", ") : "NONE"}`
        }
      }
    }
  }
}

export default plugin
