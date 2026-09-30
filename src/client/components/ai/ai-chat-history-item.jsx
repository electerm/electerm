import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import AIOutput from './ai-output'
import AIStopIcon from './ai-stop-icon'
import AgentToolCallCard from './agent-tool-call-card'
import { runAgentLoop, stopAgentRun } from './agent'
import { appendMandatoryGuardrails } from './ai-guardrails'
import { buildSessionMessages, summarizeContext } from './ai-context'
import {
  shouldAutoCompress,
  canCompact,
  splitPendingTurn,
  compactAskMessages
} from './ai-auto-compress'
import { summarizeMessages, autoCompressSession, autoCompressEnabled } from './ai-compress'
import {
  Alert,
  Tooltip,
  Tag
} from 'antd'
import {
  CopyOutlined,
  CloseOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CompressOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { formatSize } from './ai-attachments'

// memo()'d: the panel holds the draft prompt in its own state, so every
// keystroke re-renders the whole transcript. Without this the keystroke also
// re-rendered (and re-parsed the markdown of) every message in it -- 50ms+ per
// character in a long agent session. Entries are updated immutably
// (store.updateAiHistoryEntry), so the reference comparison is meaningful.
export default memo(function AIChatHistoryItem ({ item }) {
  const [showOutput, setShowOutput] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  // `current` is the stop flag; `requestId` is the HTTP request currently in
  // flight (agent mode), so that stopping can cancel it rather than wait for it
  // to come back.
  const abortRef = useRef(false)
  const {
    prompt,
    sessionId,
    chatSessionId,
    nameAI,
    modelAI,
    roleAI,
    baseURLAI,
    apiPathAI,
    apiKeyAI,
    proxyAI,
    authHeaderNameAI,
    languageAI,
    mode,
    toolCalls,
    autoCompressCount
  } = item

  function toggleOutput () {
    setShowOutput(!showOutput)
  }

  function buildRole () {
    const lang = languageAI || window.store.getLangName()
    return appendMandatoryGuardrails(roleAI + `;用[${lang}]回复`)
  }

  // The context this turn sends: the session history up to and including the
  // previous turns, but not this turn's own (still streaming) response.
  // Shared with the context size indicator in ai-chat.jsx so the number shown
  // is built from the same message list that goes out.
  const conversationMessages = useMemo(() => buildSessionMessages({
    history: window.store.aiChatHistory,
    chatSessionId,
    upto: item.timestamp,
    role: buildRole(),
    excludeId: item.id
  }), [chatSessionId, item.id, item.timestamp])

  // Everything a request needs beyond the message list; also what the
  // compressor uses to reach the same provider (see ai-compress.js).
  const requestConfig = useMemo(() => ({
    modelAI,
    roleAI,
    baseURLAI,
    apiPathAI,
    apiKeyAI,
    proxyAI,
    languageAI,
    authHeaderNameAI
  }), [
    modelAI,
    roleAI,
    baseURLAI,
    apiPathAI,
    apiKeyAI,
    proxyAI,
    languageAI,
    authHeaderNameAI
  ])

  // The message list this turn actually sends. Normally the memoized session
  // messages above, but when auto compress is on and the request would not fit
  // the window, the earlier turns are replaced by a summary first. The live
  // prompt survives untouched -- it is the question being answered, not
  // history. The stored session is compacted separately once the answer is in
  // (autoCompressSession below), so this is only about the request leaving now.
  const buildOutgoingMessages = useCallback(async () => {
    if (!autoCompressEnabled() || !conversationMessages) {
      return conversationMessages
    }
    const info = summarizeContext(conversationMessages, {
      model: modelAI,
      contextLength: window.store.config.contextLengthAI
    })
    if (!shouldAutoCompress(info)) {
      return conversationMessages
    }
    const { context } = splitPendingTurn(conversationMessages)
    if (!canCompact(context)) {
      return conversationMessages
    }
    // Marked before the request: summarizing a nearly full window takes a
    // while, and the badge is the only sign that this turn is waiting on it.
    // Cleared again if the summary comes back unusable.
    window.store.updateAiHistoryEntry(item.id, { autoCompressCount: 1 })
    const summary = await summarizeMessages(context, requestConfig)
    if (!summary) {
      window.store.updateAiHistoryEntry(item.id, { autoCompressCount: 0 })
      return conversationMessages
    }
    return compactAskMessages(conversationMessages, summary)
  }, [conversationMessages, modelAI, requestConfig, item.id])

  const pollStreamContent = useCallback(async (sid) => {
    try {
      const streamResponse = await window.pre.runGlobalAsync('getStreamContent', sid)

      if (streamResponse && streamResponse.error) {
        if (streamResponse.error === 'Session not found') {
          return
        }
        window.store.removeAiHistory(item.id)
        return window.store.onError(new Error(streamResponse.error))
      }

      window.store.updateAiHistoryEntry(item.id, {
        response: streamResponse.content || ''
      })
      setIsStreaming(streamResponse.hasMore)
      if (streamResponse.hasMore) {
        setTimeout(() => pollStreamContent(sid), 200)
      } else {
        // The answer is in the store now, so the session can be summarized for
        // the turns that follow this one.
        autoCompressSession(chatSessionId, requestConfig)
      }
    } catch (error) {
      window.store.removeAiHistory(item.id)
      window.store.onError(error)
    }
  }, [item.id, chatSessionId, requestConfig])

  const startRequest = useCallback(async () => {
    try {
      const aiResponse = await window.pre.runGlobalAsync(
        'AIchat',
        prompt,
        modelAI,
        buildRole(),
        baseURLAI,
        apiPathAI,
        apiKeyAI,
        proxyAI,
        true,
        authHeaderNameAI,
        await buildOutgoingMessages()
      )

      if (aiResponse && aiResponse.error) {
        window.store.removeAiHistory(item.id)
        return window.store.onError(new Error(aiResponse.error))
      }

      if (aiResponse && aiResponse.isStream && aiResponse.sessionId) {
        setIsStreaming(true)
        window.store.updateAiHistoryEntry(item.id, {
          sessionId: aiResponse.sessionId,
          response: aiResponse.content || ''
        })
        pollStreamContent(aiResponse.sessionId)
      } else if (aiResponse && aiResponse.response) {
        window.store.updateAiHistoryEntry(item.id, {
          response: aiResponse.response
        })
        // No stream to poll: the answer is in the store, so the session can be
        // summarized for the turns that follow this one.
        autoCompressSession(chatSessionId, requestConfig)
      }
    } catch (error) {
      window.store.removeAiHistory(item.id)
      window.store.onError(error)
    }
  }, [prompt, modelAI, baseURLAI, apiPathAI, apiKeyAI, proxyAI, authHeaderNameAI, item.id, chatSessionId, requestConfig, pollStreamContent, buildOutgoingMessages])

  const startAgentRequest = useCallback(async () => {
    abortRef.current = false
    abortRef.requestId = null
    await runAgentLoop(item, requestConfig, abortRef, setIsStreaming, conversationMessages)
  }, [item, requestConfig, conversationMessages])

  useEffect(() => {
    if (item.pending) {
      window.store.updateAiHistoryEntry(item.id, { pending: false })
      if (mode === 'agent') {
        startAgentRequest()
      } else {
        startRequest()
      }
    }
  }, [])

  async function handleStop (e) {
    e.stopPropagation()
    if (mode === 'agent') {
      setIsStreaming(false)
      await stopAgentRun(abortRef)
      return
    }
    if (!sessionId) return

    try {
      await window.pre.runGlobalAsync('stopStream', sessionId)
      setIsStreaming(false)
    } catch (error) {
      console.error('Error stopping stream:', error)
    }
  }

  function renderStopButton () {
    if (!isStreaming) {
      return null
    }
    return (
      <AIStopIcon
        onClick={handleStop}
        title='Stop this AI request'
      />
    )
  }

  const alertProps = {
    title: (
      <div className='ai-history-item-title'>
        <span className='pointer mg1r' onClick={toggleOutput}>
          {showOutput ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
        <span>{prompt}</span>
      </div>
    ),
    type: 'info'
  }

  function handleDel (e) {
    e.stopPropagation()
    window.store.removeAiHistory(item.id)
  }

  function handleCopy () {
    copy(prompt)
  }

  function renderTitle () {
    return (
      <div>
        {nameAI && (
          <p>
            <b>Name:</b> {nameAI}
          </p>
        )}
        <p>
          <b>Model:</b> {modelAI}
        </p>
        <p>
          <b>Role:</b> {roleAI}
        </p>
        <p>
          <b>Base URL:</b> {baseURLAI}
        </p>
        <p>
          <b>Time:</b> {new Date(item.timestamp).toLocaleString()}
        </p>
        <p>
          <CopyOutlined
            className='pointer'
            onClick={handleCopy}
          />
          <CloseOutlined
            className='pointer mg1l'
            onClick={handleDel}
          />
        </p>
      </div>
    )
  }

  function renderAttachments () {
    if (!item.attachments || !item.attachments.length) {
      return null
    }
    return (
      <div className='ai-chat-item-attachments mg1b'>
        {item.attachments.map(a => (
          <Tag key={a.name + a.size} title={`${a.name} (${formatSize(a.size)})`}>
            <PaperClipOutlined /> {a.name}
          </Tag>
        ))}
      </div>
    )
  }

  // Auto compress happens on its own, with no visible step of its own, so the
  // turn says so: the conversation was summarized and the request continued
  // from the summary instead of the full history. Ask mode summarizes before
  // sending, agent mode in the middle of the run (possibly more than once).
  function renderAutoCompressBadge () {
    if (!autoCompressCount) {
      return null
    }
    return (
      <div className='ai-auto-compress-badge mg1b'>
        <Tag
          color='blue'
          title='The context filled up and was summarized automatically, this turn continued from the summary'
        >
          <CompressOutlined /> {window.translate('autoCompress')}
          {autoCompressCount > 1 ? ` x${autoCompressCount}` : ''}
        </Tag>
      </div>
    )
  }

  function renderToolCalls () {
    if (mode !== 'agent' || !toolCalls || !toolCalls.length) {
      return null
    }
    return (
      <div className='agent-tool-calls'>
        {toolCalls.map((tc) => (
          <AgentToolCallCard key={tc.id} toolCall={tc} autoCollapse={!isStreaming} />
        ))}
      </div>
    )
  }

  return (
    <div className='chat-history-item'>
      <div className='mg1y'>
        <Tooltip title={renderTitle()}>
          <Alert {...alertProps} />
        </Tooltip>
      </div>
      {renderAttachments()}
      {renderAutoCompressBadge()}
      {renderToolCalls()}
      {showOutput && <AIOutput item={item} />}
      {renderStopButton()}
    </div>
  )
})
