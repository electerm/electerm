import { useState, useCallback, useEffect } from 'react'
import { Flex, Input, Segmented, Button } from 'antd'
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
  CompressOutlined
} from '@ant-design/icons'
import {
  aiConfigWikiLink,
  aiChatModeLsKey
} from '../../common/constants'
import { getItem, setItem } from '../../common/safe-local-storage.js'
import HelpIcon from '../common/help-icon'
import { refsStatic } from '../common/ref'
import './ai.styl'

const { TextArea } = Input
const MAX_HISTORY = 500

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [compressing, setCompressing] = useState(false)
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

  const handleSubmit = useCallback(function () {
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
    if (!prompt.trim()) return

    const chatId = uid()
    const chatEntry = {
      prompt,
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

    if (window.store.aiChatHistory.length > MAX_HISTORY) {
      window.store.aiChatHistory.splice(MAX_HISTORY)
    }
  }, [prompt, mode, currentChatSessionId])

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

  const handleKeyPress = (e) => {
    if (!e.shiftKey) {
      e.preventDefault()
      if (!submitDisabled) {
        handleSubmit()
      }
    }
  }
  const e = window.translate
  return (
    <Flex vertical className='ai-chat-container'>
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
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          onPressEnter={handleKeyPress}
          placeholder='Enter your prompt here'
          autoSize={{ minRows: 3, maxRows: 10 }}
          className='ai-chat-textarea'
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
    </Flex>
  )
}
