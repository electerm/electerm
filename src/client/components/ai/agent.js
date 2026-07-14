import { agentTools, executeToolCall } from './agent-tools'

const MAX_ITERATIONS = 150

function buildAgentSystemPrompt (config) {
  const lang = config.languageAI || window.store.getLangName()
  const baseRole = config.roleAI || 'You are a helpful assistant.'
  return `${baseRole}

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

Reply in ${lang} language.`
}

function updateChatEntry (chatEntry, updates) {
  const index = window.store.aiChatHistory.findIndex(i => i.id === chatEntry.id)
  if (index !== -1) {
    Object.assign(window.store.aiChatHistory[index], updates)
    window.store.aiChatHistory = [...window.store.aiChatHistory]
  }
}

async function callBackendAIchatWithTools (messages, config) {
  return window.pre.runGlobalAsync(
    'AIchatWithTools',
    messages,
    config.modelAI,
    config.baseURLAI,
    config.apiPathAI,
    config.apiKeyAI,
    config.proxyAI,
    agentTools,
    config.authHeaderNameAI
  )
}

export async function runAgentLoop (chatEntry, config, abortRef, setIsStreaming, conversationMessages = null) {
  window.store.agentRunning = true
  try {
    let messages
    if (conversationMessages && conversationMessages.length > 1) {
      // Replace system message with agent system prompt, keep conversation history
      messages = [
        { role: 'system', content: buildAgentSystemPrompt(config) },
        ...conversationMessages.filter(m => m.role !== 'system')
      ]
    } else {
      messages = [
        { role: 'system', content: buildAgentSystemPrompt(config) },
        { role: 'user', content: chatEntry.prompt }
      ]
    }
    const toolCallsLog = []
    let accumulatedContent = ''

    setIsStreaming(true)
    updateChatEntry(chatEntry, {
      toolCalls: [],
      response: ''
    })

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (abortRef && abortRef.current) {
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent + '\n\n*(Agent stopped by user)*'
        })
        return
      }

      const result = await callBackendAIchatWithTools(messages, config)

      if (result.error) {
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent + `\n\n**Error:** ${result.error}`
        })
        return
      }

      const assistantMessage = result.message
      if (!assistantMessage) {
        setIsStreaming(false)
        updateChatEntry(chatEntry, {
          response: accumulatedContent || 'No response from AI.'
        })
        return
      }

      messages.push(assistantMessage)

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
        if (abortRef && abortRef.current) {
          setIsStreaming(false)
          updateChatEntry(chatEntry, {
            response: accumulatedContent + '\n\n*(Agent stopped by user)*'
          })
          return
        }

        let args
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        const toolEntry = {
          id: toolCall.id,
          name: toolCall.function.name,
          args,
          status: 'running',
          result: null
        }
        toolCallsLog.push(toolEntry)
        updateChatEntry(chatEntry, {
          toolCalls: [...toolCallsLog]
        })

        let toolResult
        try {
          toolResult = await executeToolCall(toolCall.function.name, args)
          toolEntry.status = 'completed'
          toolEntry.result = toolResult
        } catch (err) {
          toolEntry.status = 'error'
          toolEntry.result = err.message
        }

        updateChatEntry(chatEntry, {
          toolCalls: [...toolCallsLog]
        })

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolEntry.result
        })
      }
    }

    setIsStreaming(false)
    updateChatEntry(chatEntry, {
      response: accumulatedContent + '\n\n*(Agent reached maximum iterations)*'
    })
  } finally {
    window.store.agentRunning = false
  }
}
