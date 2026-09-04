import { useState, useCallback, useEffect, useRef } from 'react'
import { Flex, Input, Segmented, Button, Tag, message } from 'antd'
import TabSelect from '../footer/tab-select'
import AiChatHistory from './ai-chat-history'
import AiChatSessions from './ai-chat-sessions'
import uid from '../../common/uid'
import { pick } from 'lodash-es'
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

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState(() => getItem(aiChatModeLsKey) || 'ask')
  const isAgent = mode === 'agent'
  const submitDisabled = isAgent && props.agentRunning

  const currentChatSessionId = props.currentChatSessionId || ''

  useEffect(() => {
    if (!currentChatSessionId && props.rightPanelTab === 'ai') {
      window.store.startNewChat()
    }
  }, [currentChatSessionId, props.rightPanelTab])

  const sessionHistory = (props.aiChatHistory || []).filter(
    h => h.chatSessionId === currentChatSessionId
  )

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
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
    if (!prompt.trim() && !attachments.length) return

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
      pending: true,
      sessionId: null,
      chatSessionId: currentChatSessionId,
      mode,
      toolCalls: [],
      ...pick(props.config, [
        'nameAI',
        'modelAI',
        'roleAI',
        'baseURLAI',
        'apiPathAI',
        'apiKeyAI',
        'proxyAI',
        'languageAI',
        'authHeaderNameAI'
      ]),
      timestamp: Date.now(),
      id: chatId
    }

    window.store.aiChatHistory.push(chatEntry)
    setPrompt('')
    setAttachments([])

    if (window.store.aiChatHistory.length > MAX_HISTORY) {
      window.store.aiChatHistory.splice(MAX_HISTORY)
    }
  }, [prompt, attachments, mode, currentChatSessionId])

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
    if (props.rightPanelTab === 'ai' && window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
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
      if (!submitDisabled) {
        handleSubmit()
      }
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
        <Flex className='ai-chat-toolbar mg1b' align='left' gap={4}>
          <Button
            size='small'
            icon={<PlusOutlined />}
            onClick={handleNewChat}
            className='mg1r new-chat-btn'
          >
            {e('new')}
          </Button>
          {sessionHistory.length >= 2 && (
            <Button
              size='small'
              icon={<CompressOutlined />}
              onClick={handleCompressSession}
              loading={compressing}
              className='mg1r'
            >
              {e('compress')}
            </Button>
          )}
          <Button
            size='small'
            icon={<HistoryOutlined />}
            onClick={handleShowHistory}
            type={props.showChatSessions ? 'primary' : 'default'}
          >
            {e('history')}
          </Button>
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
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          onPressEnter={handleKeyPress}
          placeholder='Enter your prompt here'
          autoSize={{ minRows: 3, maxRows: 10 }}
          className='ai-chat-textarea'
        />
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
        <Flex className='ai-chat-terminals' justify='space-between' align='center'>
          <Flex align='center'>
            <Segmented
              options={['Ask', 'Agent']}
              value={mode === 'ask' ? 'Ask' : 'Agent'}
              onChange={handleModeChange}
              size='small'
            />
            {renderTabSelect()}
            <PaperClipOutlined
              onClick={() => fileInputRef.current?.click()}
              className='mg1l pointer icon-hover toggle-ai-attach-icon'
            />
            <SettingOutlined
              onClick={toggleConfig}
              className='mg1l pointer icon-hover toggle-ai-setting-icon'
            />
            <HelpIcon
              link={aiConfigWikiLink}
            />
          </Flex>
          {renderSendIcon()}
        </Flex>
      </Flex>
      {window.et.AIDisclamer && (
        <div className='ai-disclamer mg1t'>{window.et.AIDisclamer}</div>
      )}
    </Flex>
  )
}
