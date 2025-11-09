import { useState, useCallback, useEffect } from 'react'
import { Flex, Input } from 'antd'
import TabSelect from '../footer/tab-select'
import AiChatHistory from './ai-chat-history'
import uid from '../../common/uid'
import { pick } from 'lodash-es'
import {
  SettingOutlined,
  LoadingOutlined,
  SendOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import {
  aiConfigWikiLink
} from '../../common/constants'
import HelpIcon from '../common/help-icon'
import { refsStatic } from '../common/ref'
import './ai.styl'

const { TextArea } = Input
const MAX_HISTORY = 100

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  function buildRole () {
    const lang = props.config.languageAI || window.store.getLangName()
    return props.config.roleAI + `;用[${lang}]回复`
  }

  const handleSubmit = useCallback(async function () {
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
    if (!prompt.trim() || isLoading) return
    setIsLoading(true)

    // Create a placeholder entry for the streaming response
    const chatId = uid()
    const chatEntry = {
      prompt,
      response: '', // Will be updated as stream arrives
      isStreaming: false,
      sessionId: null,
      ...pick(props.config, [
        'modelAI',
        'roleAI',
        'baseURLAI'
      ]),
      timestamp: Date.now(),
      id: chatId
    }

    window.store.aiChatHistory.push(chatEntry)

    try {
      const aiResponse = await window.pre.runGlobalAsync(
        'AIchat',
        prompt,
        props.config.modelAI,
        buildRole(),
        props.config.baseURLAI,
        props.config.apiPathAI,
        props.config.apiKeyAI,
        props.config.proxyAI,
        true // Enable streaming for chat
      )

      if (aiResponse && aiResponse.error) {
        // Remove the placeholder entry and show error
        const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
        if (index !== -1) {
          window.store.aiChatHistory.splice(index, 1)
        }
        setIsLoading(false)
        return window.store.onError(
          new Error(aiResponse.error)
        )
      }

      if (aiResponse && aiResponse.isStream && aiResponse.sessionId) {
        // Handle streaming response with polling
        const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
        if (index !== -1) {
          window.store.aiChatHistory[index].isStreaming = true
          window.store.aiChatHistory[index].sessionId = aiResponse.sessionId
          window.store.aiChatHistory[index].response = aiResponse.content || ''
        }

        // Start polling for updates
        pollStreamContent(aiResponse.sessionId, chatId)
      } else if (aiResponse && aiResponse.response) {
        // Handle non-streaming response (fallback)
        const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
        if (index !== -1) {
          window.store.aiChatHistory[index].response = aiResponse.response
          window.store.aiChatHistory[index].isStreaming = false
        }
        setIsLoading(false)
      }
    } catch (error) {
      // Remove the placeholder entry and show error
      const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
      if (index !== -1) {
        window.store.aiChatHistory.splice(index, 1)
      }
      setIsLoading(false)
      window.store.onError(error)
    }

    if (window.store.aiChatHistory.length > MAX_HISTORY) {
      window.store.aiChatHistory.splice(MAX_HISTORY)
    }
    setPrompt('')
  }, [prompt, isLoading])

  // Function to poll for streaming content updates
  const pollStreamContent = async (sessionId, chatId) => {
    try {
      const streamResponse = await window.pre.runGlobalAsync('getStreamContent', sessionId)

      if (streamResponse && streamResponse.error) {
        // Remove the entry and show error
        const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
        if (index !== -1) {
          window.store.aiChatHistory.splice(index, 1)
        }
        setIsLoading(false)
        return window.store.onError(new Error(streamResponse.error))
      }

      // Update the chat entry with new content
      const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
      if (index !== -1) {
        window.store.aiChatHistory[index].response = streamResponse.content || ''
        window.store.aiChatHistory[index].isStreaming = streamResponse.hasMore

        // Force re-render by updating the array reference
        window.store.aiChatHistory = [...window.store.aiChatHistory]

        // Continue polling if there's more content
        if (streamResponse.hasMore) {
          setTimeout(() => pollStreamContent(sessionId, chatId), 200) // Poll every 200ms
        } else {
          setIsLoading(false)
        }
      }
    } catch (error) {
      // Remove the entry and show error
      const index = window.store.aiChatHistory.findIndex(item => item.id === chatId)
      if (index !== -1) {
        window.store.aiChatHistory.splice(index, 1)
      }
      setIsLoading(false)
      window.store.onError(error)
    }
  }

  function renderHistory () {
    return (
      <AiChatHistory
        history={props.aiChatHistory}
      />
    )
  }

  function toggleConfig () {
    window.store.toggleAIConfig()
  }

  function clearHistory () {
    window.store.aiChatHistory = []
  }

  function renderSendIcon () {
    if (isLoading) {
      return <LoadingOutlined />
    }
    return (
      <SendOutlined
        onClick={handleSubmit}
        className='mg1l pointer icon-hover send-to-ai-icon'
        title='Ctrl+Enter'
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

  return (
    <Flex vertical className='ai-chat-container'>
      <Flex className='ai-chat-history' flex='auto'>
        {renderHistory()}
      </Flex>

      <Flex className='ai-chat-input'>
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          placeholder='Enter your prompt here'
          autoSize={{ minRows: 3, maxRows: 10 }}
          disabled={isLoading}
          className='ai-chat-textarea'
        />
        <Flex className='ai-chat-terminals' justify='space-between' align='center'>
          <Flex align='center'>
            <TabSelect
              selectedTabIds={props.selectedTabIds}
              tabs={props.tabs}
              activeTabId={props.activeTabId}
            />
            <SettingOutlined
              onClick={toggleConfig}
              className='mg1l pointer icon-hover toggle-ai-setting-icon'
            />
            <UnorderedListOutlined
              onClick={clearHistory}
              className='mg2x pointer clear-ai-icon icon-hover'
              title='Clear AI chat history'
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
