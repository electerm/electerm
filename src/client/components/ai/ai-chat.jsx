import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Flex, Input, Segmented, Button, Tag, message, Popover } from 'antd'
import TabSelect from '../footer/tab-select'
import AiChatHistory from './ai-chat-history'
import { startChatRequest } from './ai-chat-request'
import AiChatSessions from './ai-chat-sessions'
import AiContextIndicator from './ai-context-indicator'
import AgentApprovalModeSelect from './agent-approval-mode-select'
import ActiveAIConfigSelect from './active-ai-config-select'
import SwitchLabel from '../common/switch'
import { buildSessionMessages, summarizeContext, getUsageLevel } from './ai-context'
import { appendMandatoryGuardrails } from './ai-guardrails'
import uid from '../../common/uid'
import { getAIHistoryConfig } from './ai-config-props'
import {
  SettingOutlined,
  SendOutlined,
  PlusOutlined,
  HistoryOutlined,
  CompressOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import {
  aiConfigWikiLink,
  aiChatModeLsKey
} from '../../common/constants'
import { getItem, setItem } from '../../common/safe-local-storage.js'
import HelpIcon from '../common/help-icon'
import { refsStatic } from '../common/ref'
import {
  readTextAttachment,
  validateAttachmentTotal,
  buildAttachmentsBlock,
  formatSize
} from './ai-attachments'
import './ai.styl'

const { TextArea } = Input
const MAX_HISTORY = 500

// The composer keeps a hint in its placeholder once the transcript is no
// longer empty (the empty state, ai-chat-empty.jsx, is what shows examples
// before that). Agent mode can act, so its example is a tool-using one.
const promptPlaceholder = {
  ask: 'Enter your prompt here\ne.g. Explain the current terminal output',
  agent: 'Enter your prompt here\ne.g. Export all SSH bookmarks with a private key'
}

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState(() => getItem(aiChatModeLsKey) || 'ask')
  const isAgent = mode === 'agent'
  const autoCompress = !!props.aiAutoCompress
  const submitDisabled = isAgent && props.agentRunning

  const currentChatSessionId = props.currentChatSessionId || ''

  useEffect(() => {
    if (!window.store.currentChatSessionId && props.rightPanelTab === 'ai') {
      window.store.startNewChat()
    }
  }, [currentChatSessionId, props.rightPanelTab])

  // Memoized on purpose: `prompt` lives in this component's state, so every
  // keystroke re-renders it. `AIChatHistory` is memo()'d, and a fresh array on
  // each keystroke defeated that -- which also meant its scroll-to-bottom
  // layout effect re-ran while typing, yanking the view down mid-scroll.
  // Entries are updated immutably, so a new array identity really does mean
  // the transcript changed.
  const sessionHistory = useMemo(
    () => (props.aiChatHistory || []).filter(
      h => h.chatSessionId === currentChatSessionId
    ),
    [props.aiChatHistory, currentChatSessionId]
  )

  const config = props.activeAIConfig || {}

  // Size of the context the *next* message will carry: every entry of this
  // session, from the last compression onwards, built by the same helper the
  // sender uses. While an agent loop is running its own, much larger, figure
  // is published to the store (tool schemas and tool results included) and
  // takes precedence.
  const sessionContextInfo = useMemo(() => {
    if (!currentChatSessionId) {
      return null
    }
    const lang = config.languageAI || window.store.getLangName()
    const role = appendMandatoryGuardrails(
      (config.roleAI || '') + `;用[${lang}]回复`
    )
    const messages = buildSessionMessages({
      history: props.aiChatHistory,
      chatSessionId: currentChatSessionId,
      role
    })
    if (!messages || messages.length < 2) {
      return null
    }
    return summarizeContext(messages, {
      model: config.modelAI,
      contextLength: config.contextLengthAI
    })
  }, [
    props.aiChatHistory,
    // length as well as identity: sending a message pushes onto the existing
    // array, so the reference alone would not change
    props.aiChatHistory.length,
    currentChatSessionId,
    config.roleAI,
    config.languageAI,
    config.modelAI,
    config.contextLengthAI
  ])

  const contextInfo = props.aiContextInfo || sessionContextInfo
  const contextLevel = getUsageLevel(contextInfo && contextInfo.percent)

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  function handleModeChange (val) {
    const m = val === 'Ask' ? 'ask' : 'agent'
    setItem(aiChatModeLsKey, m)
    setMode(m)
  }

  const e = window.translate

  async function handleFiles (files) {
    const notText = []
    let totalTooLarge = false
    const next = [...attachments]
    for (const file of Array.from(files)) {
      if (next.some(a => a.name === file.name && a.size === file.size)) {
        continue
      }
      if (!validateAttachmentTotal(next, file.size)) {
        totalTooLarge = true
        continue
      }
      const { attachment, error } = await readTextAttachment(file)
      if (error === 'notTextFile') {
        notText.push(file.name)
        continue
      }
      if (attachment) {
        next.push(attachment)
      }
    }
    setAttachments(next)
    if (totalTooLarge) {
      message.error('attachment too big')
    }
    if (notText.length) {
      message.error(`attachment only support text files: ${notText.join(', ')}`)
    }
  }

  const handleSubmit = useCallback(function () {
    const { store } = window
    if (store.aiConfigMissing()) {
      store.toggleAIConfig()
      return
    }
    if (isAgent && store.agentRunning) return
    if (!prompt.trim() && !attachments.length) return

    if (!store.currentChatSessionId) store.startNewChat()
    store.showChatSessions = false
    const requestConfig = { ...store.activeAIConfig }
    const chatId = uid()
    const block = buildAttachmentsBlock(attachments)
    const promptWithAttachments = block
      ? (prompt.trim() ? prompt + '\n\n' + block : block)
      : prompt
    const chatEntry = {
      prompt,
      promptWithAttachments,
      attachments: attachments.map(({ name, size, truncated }) => ({
        name, size, truncated
      })),
      response: '',
      isStreaming: false,
      sessionId: null,
      chatSessionId: store.currentChatSessionId,
      mode,
      toolCalls: [],
      ...getAIHistoryConfig(requestConfig),
      timestamp: Date.now(),
      id: chatId
    }

    // Reassign rather than push: the store only notifies on a property write,
    // and the transcript is keyed off the array identity.
    store.aiChatHistory = [...store.aiChatHistory, chatEntry].slice(-MAX_HISTORY)
    setPrompt('')
    setAttachments([])
    startChatRequest(chatEntry, requestConfig)
  }, [prompt, attachments, mode])

  function renderHistory () {
    if (props.showChatSessions) {
      return (
        <AiChatSessions
          sessions={window.store.getChatSessions()}
          currentChatSessionId={currentChatSessionId}
          onLoadSession={(sid) => window.store.loadChatSession(sid)}
          onDeleteSession={(sid) => window.store.deleteChatSession(sid)}
          onClearAll={() => window.store.clearAllChatSessions()}
        />
      )
    }
    return (
      <AiChatHistory
        history={sessionHistory}
        isAgent={isAgent}
      />
    )
  }

  function toggleConfig () {
    window.store.toggleAIConfig()
  }

  function handleNewChat () {
    window.store.startNewChat()
  }

  async function handleCompressSession () {
    setCompressing(true)
    try {
      await window.store.compressChatSession(currentChatSessionId)
    } finally {
      setCompressing(false)
    }
  }

  function handleAutoCompressChange (val) {
    window.store.setAiAutoCompress(val)
  }

  // The toolbar button is the auto compress button: the popover behind it holds
  // the persistent toggle plus the manual compress action, so one button covers
  // both "keep this session small for me" and "compact it right now".
  function renderAutoCompressPopover () {
    return (
      <div className='ai-auto-compress-popover'>
        <Flex align='center' justify='space-between' gap={12}>
          <span className='ai-auto-compress-label'>{e('autoCompress')}</span>
          <SwitchLabel
            checked={autoCompress}
            onChange={handleAutoCompressChange}
            size='small'
          />
        </Flex>
        <hr />
        <Flex vertical gap={4} align='flex-start'>
          <Button
            size='small'
            icon={<CompressOutlined />}
            onClick={handleCompressSession}
            loading={compressing}
            disabled={sessionHistory.length < 2}
            type={contextLevel === 'warn' || contextLevel === 'danger' ? 'primary' : 'default'}
          >
            {e('compress')}
          </Button>
        </Flex>
      </div>
    )
  }

  function handleShowHistory () {
    window.store.toggleChatSessions()
  }

  function renderTabSelect () {
    if (isAgent) {
      return null
    }
    return (
      <TabSelect
        selectedTabIds={props.selectedTabIds}
        tabs={props.tabs}
        activeTabId={props.activeTabId}
      />
    )
  }

  function renderSendIcon () {
    if (submitDisabled) {
      return (
        <SendOutlined
          className='mg1l send-to-ai-icon disabled'
          title='Agent is running, please wait'
        />
      )
    }
    return (
      <SendOutlined
        onClick={handleSubmit}
        className='mg1l pointer icon-hover send-to-ai-icon'
        title='Enter to send, Shift+Enter for new line'
      />
    )
  }

  useEffect(() => {
    refsStatic.add('AIChat', {
      setPrompt,
      handleSubmit
    })
    return () => {
      refsStatic.remove('AIChat')
    }
  }, [handleSubmit])

  if (props.rightPanelTab !== 'ai') {
    return null
  }

  const handleKeyPress = (evt) => {
    if (!evt.shiftKey) {
      evt.preventDefault()
      handleSubmit()
    }
  }
  return (
    <Flex
      vertical
      className={'ai-chat-container' + (dragOver ? ' ai-attachment-dragover' : '')}
      onDragOver={(evt) => {
        evt.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(evt) => {
        setDragOver(false)
        if (!evt.dataTransfer.files.length) {
          return
        }
        evt.preventDefault()
        handleFiles(evt.dataTransfer.files)
      }}
    >
      <Flex className='ai-chat-history' flex='auto'>
        {renderHistory()}
      </Flex>

      <Flex vertical className='ai-chat-input'>
        <Flex className='ai-chat-toolbar mg1b' align='center' justify='space-between' gap={4}>
          <Flex align='center' gap={4} wrap='wrap'>
            <Button
              size='small'
              icon={<PlusOutlined />}
              onClick={handleNewChat}
              className='new-chat-btn'
            >
              {e('new')}
            </Button>
            <Popover
              content={renderAutoCompressPopover()}
              trigger='click'
              placement='topLeft'
            >
              <Button
                size='small'
                icon={<CompressOutlined />}
                type={autoCompress ? 'primary' : 'default'}
                danger={!autoCompress && contextLevel === 'danger'}
              >
                {e('autoCompress')}
              </Button>
            </Popover>
            <Button
              size='small'
              icon={<HistoryOutlined />}
              aria-label={e('history')}
              aria-pressed={props.showChatSessions}
              title={e('history')}
              onClick={handleShowHistory}
              type={props.showChatSessions ? 'primary' : 'default'}
            />
          </Flex>
          <AiContextIndicator info={contextInfo} />
        </Flex>
        {attachments.length > 0 && (
          <Flex wrap='wrap' gap={4} className='ai-chat-attachments mg1b'>
            {attachments.map(a => (
              <Tag
                key={a.id}
                closable
                onClose={() => setAttachments(arr => arr.filter(x => x.id !== a.id))}
                title={`${a.name} (${formatSize(a.size)})`}
              >
                <PaperClipOutlined /> {a.name}
              </Tag>
            ))}
          </Flex>
        )}
        <div className='ai-chat-composer'>
          <TextArea
            value={prompt}
            onChange={handlePromptChange}
            onPressEnter={handleKeyPress}
            placeholder={isAgent ? promptPlaceholder.agent : promptPlaceholder.ask}
            autoSize={{ minRows: 3, maxRows: 10 }}
            className='ai-chat-textarea'
          />
          <Flex className='ai-chat-terminals' align='center'>
            <Flex align='center' gap={4} className='ai-chat-controls'>
              <Segmented
                options={['Ask', 'Agent']}
                value={mode === 'ask' ? 'Ask' : 'Agent'}
                onChange={handleModeChange}
                size='small'
              />
              {isAgent && <AgentApprovalModeSelect size='small' />}
              {renderTabSelect()}
              <PaperClipOutlined
                onClick={() => fileInputRef.current?.click()}
                className='pointer icon-hover toggle-ai-attach-icon'
              />
            </Flex>
            {renderSendIcon()}
          </Flex>
        </div>
        <input
          type='file'
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={(evt) => {
            handleFiles(evt.target.files)
            evt.target.value = ''
          }}
        />
        <Flex className='ai-chat-config-controls mg1t' align='center' gap={4}>
          <ActiveAIConfigSelect
            className='ai-chat-config-select'
            size='small'
            placement='topLeft'
          />
          <Button
            type='text'
            size='small'
            aria-label={e('settings')}
            title={e('settings')}
            icon={<SettingOutlined />}
            onClick={toggleConfig}
            className='toggle-ai-setting-icon'
          />
          <HelpIcon link={aiConfigWikiLink} />
        </Flex>
      </Flex>
      {window.et.AIDisclamer && (
        <div className='ai-disclamer mg1t'>{window.et.AIDisclamer}</div>
      )}
    </Flex>
  )
}
