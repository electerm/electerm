import { agentTools, executeToolCall } from './agent-tools'
import { appendMandatoryGuardrails } from './ai-guardrails'
import { buildAgentMessages, summarizeContext, CONTEXT_DANGER_PERCENT } from './ai-context'
import {
  shouldAutoCompress,
  canCompact,
  applySummary
} from './ai-auto-compress'
import {
  autoCompressEnabled,
  summarizeMessages,
  autoCompressSession
} from './ai-compress'
import uid from '../../common/uid'

const MAX_ITERATIONS = 150

// A summary request that failed (provider hiccup, rate limit) must not be
// retried on every following iteration -- that would turn a full window into a
// call per tool result. Only try again once the estimate has grown by this
// share of the window.
const AUTO_COMPRESS_RETRY_GROWTH_PERCENT = 5

// Which loop currently owns `store.agentRunning`. A stopped run keeps
// unwinding for a moment (its last request has to settle), and it must not
// clear the flag of a run the user started in the meantime.
let activeRunId = null

function buildAgentSystemPrompt (config) {
  const lang = config.languageAI || window.store.getLangName()
  const baseRole = config.roleAI || 'You are a helpful assistant.'
  return appendMandatoryGuardrails(`${baseRole}

You are operating inside electerm, a terminal/SSH client. You have access to tools that let you:
- Run commands in terminal tabs and read their output
- Open new terminal tabs (local or SSH)
- Manage bookmarks (create, list, open connections)
- Switch between tabs
- Transfer files via SFTP (upload, download, list, read, delete remote files)

When the user asks you to perform terminal operations, use the available tools.
Always explain what you are doing before executing commands.
If a command produces errors, analyze the output and try to fix the issue.
Prefer using the active terminal unless the user specifies otherwise.
For SSH connections, prefer using open_tab to connect directly, or create a bookmark with add_bookmark and open it with open_bookmark if the user wants to save the connection.
For file transfers, use the sftp_upload and sftp_download tools. The tab must be an SSH/FTP connection with SFTP initialized.

Reply in ${lang} language.`)
}

function updateChatEntry (chatEntry, updates) {
  window.store.updateAiHistoryEntry(chatEntry.id, updates)
}

async function callBackendAIchatWithTools (messages, config, requestId) {
  return window.pre.runGlobalAsync(
    'AIchatWithTools',
    messages,
    config.modelAI,
    config.baseURLAI,
    config.apiPathAI,
    config.apiKeyAI,
    config.proxyAI,
    agentTools,
    config.authHeaderNameAI,
    // `format` stays undefined (the main process detects it); `requestId` is
    // the last argument so that exact request can be cancelled on stop.
    undefined,
    requestId
  )
}

// Publish the size of the context the agent is carrying so the panel can show
// it. An agent request is not just the conversation: it also carries every
// tool schema, and each iteration appends the tool results, which is what
// actually fills the window. `usage` is the provider's own count for the
// previous request and is kept for comparison -- the estimate is what the
// *next* request will cost, so that is the number on display.
function publishContext (messages, config, usage) {
  const info = summarizeContext(messages, {
    model: config.modelAI,
    contextLength: window.store.config.contextLengthAI,
    tools: agentTools
  })
  if (usage && usage.promptTokens) {
    info.measuredTokens = usage.promptTokens
  }
  window.store.aiContextInfo = info
}

export async function runAgentLoop (chatEntry, config, abortRef, setIsStreaming, conversationMessages = null) {
  const runId = uid()
  activeRunId = runId
  window.store.agentRunning = true
  const isAborted = () => !!(abortRef && abortRef.current)
  // Auto compression bookkeeping, read by the finally block as well: how many
  // times this run compacted itself, whether it failed on the way, and the
  // size at the last summary attempt (AUTO_COMPRESS_RETRY_GROWTH_PERCENT)
  let autoCompressCount = 0
  let autoCompressAttemptTokens = 0
  let runErrored = false
  try {
    const messages = buildAgentMessages({
      systemPrompt: buildAgentSystemPrompt(config),
      conversationMessages,
      prompt: chatEntry.promptWithAttachments || chatEntry.prompt
    })
    const toolCallsLog = []
    let accumulatedContent = ''
    let lastUsage = null

    const markStopped = () => {
      setIsStreaming(false)
      updateChatEntry(chatEntry, {
        response: accumulatedContent + '\n\n*(Agent stopped by user)*'
      })
    }

    setIsStreaming(true)
    updateChatEntry(chatEntry, {
      toolCalls: [],
      response: ''
    })

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (isAborted()) {
        markStopped()
        return
      }

      publishContext(messages, config, lastUsage)

      // Auto compression, when the popover toggle is on: the request about to
      // go out carries the whole conversation plus a tool result per step, and
      // past ~90% of the window the provider rejects it outright. Replacing the
      // conversation with a summary first keeps the run alive; the stored
      // session is compacted at the end (autoCompressSession), because that is
      // what the next turn starts from.
      const info = window.store.aiContextInfo
      // A failed summary is only worth retrying once the context has grown by
      // this much -- but never more than the trigger itself, or a threshold
      // below it would let the retry floor decide when to compress.
      const growthPercent = Math.min(
        AUTO_COMPRESS_RETRY_GROWTH_PERCENT,
        CONTEXT_DANGER_PERCENT
      )
      const grewEnough = info &&
        info.tokens - autoCompressAttemptTokens >=
          (info.windowSize || 0) * growthPercent / 100
      if (
        autoCompressEnabled() &&
        canCompact(messages) &&
        shouldAutoCompress(info) &&
        grewEnough
      ) {
        autoCompressAttemptTokens = info.tokens
        // Shown before the request rather than after: summarizing a nearly full
        // window takes a while, and this badge is the only sign of why the run
        // is waiting. Taken back if the summary comes back unusable.
        updateChatEntry(chatEntry, { autoCompressCount: autoCompressCount + 1 })
        const summary = await summarizeMessages(messages, config)
        if (isAborted()) {
          markStopped()
          return
        }
        if (summary) {
          applySummary(messages, summary)
          autoCompressCount++
          lastUsage = null
          publishContext(messages, config, null)
        } else {
          updateChatEntry(chatEntry, { autoCompressCount })
        }
      }

      const requestId = uid()
      if (abortRef) {
        abortRef.requestId = requestId
      }
      const result = await callBackendAIchatWithTools(messages, config, requestId)
      if (abortRef && abortRef.requestId === requestId) {
        abortRef.requestId = null
      }

      // Re-check after the await, before anything from the answer is used:
      // stopping cancels the request, and neither the partial answer nor the
      // resulting error belongs in the transcript.
      if (isAborted()) {
        markStopped()
        return
      }

      if (result.usage) {
        lastUsage = result.usage
      }

      if (result.error) {
        runErrored = true
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent + `\n\n**Error:** ${result.error}`
        })
        return
      }

      const assistantMessage = result.message
      if (!assistantMessage) {
        runErrored = true
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent || 'No response from AI.'
        })
        return
      }

      messages.push(assistantMessage)
      publishContext(messages, config, lastUsage)

      if (assistantMessage.content) {
        accumulatedContent += (accumulatedContent ? '\n\n' : '') + assistantMessage.content
        updateChatEntry(chatEntry, {
          response: accumulatedContent
        })
      }

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent
        })
        return
      }

      for (const toolCall of assistantMessage.tool_calls) {
        if (isAborted()) {
          markStopped()
          return
        }

        let args
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        toolCallsLog.push({
          id: toolCall.id,
          name: toolCall.function.name,
          args,
          status: 'running',
          result: null
        })
        updateChatEntry(chatEntry, {
          toolCalls: [...toolCallsLog]
        })

        let finished
        try {
          const toolResult = await executeToolCall(toolCall.function.name, args)
          finished = { status: 'completed', result: toolResult }
        } catch (err) {
          finished = { status: 'error', result: err.message }
        }

        // Swap in a new entry object instead of mutating the running one: the
        // tool call card is memo()'d on that object's identity, so an in-place
        // mutation would leave the card showing "running" forever.
        toolCallsLog[toolCallsLog.length - 1] = {
          ...toolCallsLog[toolCallsLog.length - 1],
          ...finished
        }
        updateChatEntry(chatEntry, {
          toolCalls: [...toolCallsLog]
        })

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: finished.result
        })
      }
    }

    setIsStreaming(false)
    updateChatEntry(chatEntry, {
      response: accumulatedContent + '\n\n*(Agent reached maximum iterations)*'
    })
  } finally {
    if (abortRef) {
      abortRef.requestId = null
    }
    // Only the run that still owns the flag may clear it -- a stopped run
    // unwinds a moment later and must not unlock a newer one.
    const ownsRun = activeRunId === runId
    if (ownsRun) {
      activeRunId = null
      window.store.agentRunning = false
      // hand the panel back to the session based estimate: tool results are not
      // carried into the next turn, so the agent figure stops being meaningful
      window.store.aiContextInfo = null
    }
    // A run that compacted its live conversation leaves the stored session
    // untouched, so the next turn would start from the full history again and
    // pay for another summary. Compact the session as well -- once, after the
    // run, when the turns it summarizes are complete. Skipped for a stopped or
    // failed run: those transcripts are not a conversation worth keeping.
    if (ownsRun && autoCompressCount > 0 && !runErrored && !isAborted()) {
      await autoCompressSession(chatEntry.chatSessionId, config)
    }
  }
}

// Stop the running agent loop, called by the panel's stop button.
//
// The loop itself only looks at `abortRef` between iterations, so on its own
// that flag does nothing while a request is in flight -- and the panel keeps
// the composer locked for as long as the provider takes to answer (which is
// forever if it never does, these requests carry no timeout). So this also
// cancels the in-flight request and releases the composer right away; the loop
// then unwinds on its own and marks the entry as stopped.
export async function stopAgentRun (abortRef) {
  if (abortRef) {
    abortRef.current = true
  }
  const requestId = abortRef && abortRef.requestId
  if (abortRef) {
    abortRef.requestId = null
  }
  activeRunId = null
  window.store.agentRunning = false
  window.store.aiContextInfo = null
  if (requestId) {
    try {
      await window.pre.runGlobalAsync('abortAIRequest', requestId)
    } catch (error) {
      console.error('Error aborting agent request:', error)
    }
  }
}
