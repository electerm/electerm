import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import AIOutput from './ai-output'
import AIStopIcon from './ai-stop-icon'
import AgentToolCallCard from './agent-tool-call-card'
import { runAgentLoop } from './agent'
import { appendMandatoryGuardrails } from './ai-guardrails'
import {
  Alert,
  Tooltip
} from 'antd'
import {
  CopyOutlined,
  CloseOutlined,
  CaretDownOutlined,
  CaretRightOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'

export default function AIChatHistoryItem ({ item }) {
  const [showOutput, setShowOutput] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
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
    toolCalls
  } = item

  function toggleOutput () {
    setShowOutput(!showOutput)
  }

  function buildRole () {
    const lang = languageAI || window.store.getLangName()
    return appendMandatoryGuardrails(roleAI + `;用[${lang}]回复`)
  }

  const conversationMessages = useMemo(() => {
    if (!chatSessionId) {
      return null
    }
    const sessionEntries = window.store.aiChatHistory
      .filter(h => h.chatSessionId === chatSessionId && h.timestamp <= item.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp)

    // Find the last compress entry
    let lastCompressIndex = -1
    for (let i = sessionEntries.length - 1; i >= 0; i--) {
      if (sessionEntries[i].compressed) {
        lastCompressIndex = i
        break
      }
    }

    const messages = [
      { role: 'system', content: buildRole() }
    ]

    // Start from the last compress entry (if any), skip older history
    const startIndex = lastCompressIndex >= 0 ? lastCompressIndex : 0
    for (let i = startIndex; i < sessionEntries.length; i++) {
      const entry = sessionEntries[i]
      if (entry.compressed) {
        messages.push({
          role: 'user',
          content: `Here is a summary of our previous conversation for context:\n\n${entry.response}`
        })
        messages.push({
          role: 'assistant',
          content: 'Understood. I will use this context as we continue.'
        })
      } else {
        messages.push({ role: 'user', content: entry.prompt })
        if (entry.response && entry.id !== item.id) {
          messages.push({ role: 'assistant', content: entry.response })
        }
      }
    }
    return messages
  }, [chatSessionId, item.id, item.timestamp])

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

      const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
      if (index !== -1) {
        window.store.aiChatHistory[index].response = streamResponse.content || ''
        window.store.aiChatHistory = [...window.store.aiChatHistory]
      }
      setIsStreaming(streamResponse.hasMore)
      if (streamResponse.hasMore) {
        setTimeout(() => pollStreamContent(sid), 200)
      }
    } catch (error) {
      window.store.removeAiHistory(item.id)
      window.store.onError(error)
    }
  }, [item.id])

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
        conversationMessages
      )

      if (aiResponse && aiResponse.error) {
        window.store.removeAiHistory(item.id)
        return window.store.onError(new Error(aiResponse.error))
      }

      if (aiResponse && aiResponse.isStream && aiResponse.sessionId) {
        setIsStreaming(true)
        const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
        if (index !== -1) {
          window.store.aiChatHistory[index].sessionId = aiResponse.sessionId
          window.store.aiChatHistory[index].response = aiResponse.content || ''
        }
        pollStreamContent(aiResponse.sessionId)
      } else if (aiResponse && aiResponse.response) {
        const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
        if (index !== -1) {
          window.store.aiChatHistory[index].response = aiResponse.response
        }
      }
    } catch (error) {
      window.store.removeAiHistory(item.id)
      window.store.onError(error)
    }
  }, [prompt, modelAI, baseURLAI, apiPathAI, apiKeyAI, proxyAI, authHeaderNameAI, item.id, pollStreamContent, conversationMessages])

  const startAgentRequest = useCallback(async () => {
    abortRef.current = false
    const config = {
      modelAI,
      roleAI,
      baseURLAI,
      apiPathAI,
      apiKeyAI,
      proxyAI,
      languageAI,
      authHeaderNameAI
    }
    await runAgentLoop(item, config, abortRef, setIsStreaming, conversationMessages)
  }, [modelAI, roleAI, baseURLAI, apiPathAI, apiKeyAI, proxyAI, languageAI, authHeaderNameAI, item.id, conversationMessages])

  useEffect(() => {
    if (item.pending) {
      const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
      if (index !== -1) {
        window.store.aiChatHistory[index].pending = false
      }
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
      abortRef.current = true
      setIsStreaming(false)
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

  function renderToolCalls () {
    if (mode !== 'agent' || !toolCalls || !toolCalls.length) {
      return null
    }
    return (
      <div className='agent-tool-calls'>
        {toolCalls.map((tc) => (
          <AgentToolCallCard key={tc.id} toolCall={tc} />
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
      {renderToolCalls()}
      {showOutput && <AIOutput item={item} />}
      {renderStopButton()}
    </div>
  )
}
