import wait from '../../common/wait'
import { runAgentLoop, stopAgentRun } from './agent'
import { appendMandatoryGuardrails } from './ai-guardrails'
import { buildSessionMessages, summarizeContext } from './ai-context'
import { shouldAutoCompress, canCompact, splitPendingTurn, compactAskMessages } from './ai-auto-compress'
import { summarizeMessages, autoCompressSession, autoCompressEnabled } from './ai-compress'

// Only this renderer can stop its live requests. History can also contain
// entries restored from disk or from another window.
const liveRequests = new Map()

export function isChatRequestStreaming (item) {
  return !!liveRequests.get(item.id)?.streaming
}

function setStreaming (id, run, streaming) {
  if (run.streaming === streaming) return
  run.streaming = streaming
  window.store.updateAiHistoryEntry(id, { isStreaming: streaming })
}

async function compactBeforeSending (item, config, messages) {
  const { context } = splitPendingTurn(messages)
  if (!canCompact(context)) return messages
  window.store.updateAiHistoryEntry(item.id, { autoCompressCount: 1 })
  const summary = await summarizeMessages(context, config)
  if (summary) return compactAskMessages(messages, summary)
  window.store.updateAiHistoryEntry(item.id, { autoCompressCount: 0 })
  return messages
}

async function sendAskRequest (item, config, role, messages, run) {
  if (messages && autoCompressEnabled() && shouldAutoCompress(summarizeContext(messages, {
    model: config.modelAI,
    contextLength: config.contextLengthAI
  }))) {
    messages = await compactBeforeSending(item, config, messages)
  }
  const result = await window.pre.runGlobalAsync(
    'AIchat', item.prompt, config.modelAI, role, config.baseURLAI,
    config.apiPathAI, config.apiKeyAI, config.proxyAI, true, config.authHeaderNameAI, messages
  )
  if (result?.error) throw new Error(result.error)
  if (result?.isStream && result.sessionId) {
    run.sessionId = result.sessionId
    setStreaming(item.id, run, true)
    window.store.updateAiHistoryEntry(item.id, {
      sessionId: result.sessionId,
      response: result.content || ''
    })
    while (!run.current) {
      const stream = await window.pre.runGlobalAsync('getStreamContent', run.sessionId)
      if (run.current || stream.error === 'Session not found') return
      if (stream.error) throw new Error(stream.error)
      window.store.updateAiHistoryEntry(item.id, { response: stream.content || '' })
      if (!stream.hasMore) break
      await wait(200)
    }
    if (run.current) return
    setStreaming(item.id, run, false)
  } else if (result?.response) {
    window.store.updateAiHistoryEntry(item.id, { response: result.response })
  } else {
    return
  }
  // Now the answer belongs to the stored context for the next turn.
  await autoCompressSession(item.chatSessionId, config)
}

// The submitter has already appended this turn and captured its provider
// settings. Navigation can unmount any transcript while the request runs.
export async function startChatRequest (item, config) {
  const { store } = window
  if (!config) {
    store.onError(new Error('The AI configuration for this message is unavailable.'))
    return
  }
  if (liveRequests.has(item.id)) return
  const run = { current: false, streaming: false }
  liveRequests.set(item.id, run)
  try {
    const lang = config.languageAI || store.getLangName()
    const role = appendMandatoryGuardrails((config.roleAI || '') + `;用[${lang}]回复`)
    const messages = buildSessionMessages({
      history: store.aiChatHistory,
      chatSessionId: item.chatSessionId,
      upto: item.timestamp,
      excludeId: item.id,
      role
    })
    if (item.mode === 'agent') {
      await runAgentLoop(item, config, run, streaming => setStreaming(item.id, run, streaming), messages)
    } else {
      await sendAskRequest(item, config, role, messages, run)
    }
  } catch (error) {
    if (!run.current) {
      if (item.mode !== 'agent') store.removeAiHistory(item.id)
      store.onError(error)
    }
  } finally {
    setStreaming(item.id, run, false)
    liveRequests.delete(item.id)
  }
}

export async function stopChatRequest (item) {
  const run = liveRequests.get(item.id)
  if (!run?.streaming) return
  if (item.mode === 'agent') {
    setStreaming(item.id, run, false)
    await stopAgentRun(run)
  } else {
    try {
      await window.pre.runGlobalAsync('stopStream', run.sessionId)
      run.current = true
      setStreaming(item.id, run, false)
    } catch (error) {
      console.error('Error stopping stream:', error)
    }
  }
}
