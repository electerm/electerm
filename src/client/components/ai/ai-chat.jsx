import { useState, useCallback, useEffect } from 'react'
import { Flex, Input, message } from 'antd'
import AIConfigForm from './ai-config'
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
const aiConfigsArr = [
  'baseURLAI',
  'modelAI',
  'roleAI',
  'apiKeyAI'
]

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  const handleSubmit = useCallback(async function () {
    if (aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
    if (!prompt.trim() || isLoading) return
    setIsLoading(true)
    const aiResponse = await window.pre.runGlobalAsync(
      'AIchat',
      prompt,
      props.config.modelAI,
      props.config.roleAI,
      props.config.baseURLAI,
      props.config.apiKeyAI
    ).catch(
      window.store.onError
    )
    if (aiResponse && aiResponse.error) {
      return window.store.onError(
        new Error(aiResponse.error)
      )
    }
    window.store.aiChatHistory.push({
      prompt,
      response: aiResponse.response,
      ...pick(props.config, [
        'modelAI',
        'roleAI',
        'baseURLAI'
      ]),
      timestamp: Date.now(),
      id: uid()
    })

    if (window.store.aiChatHistory.length > MAX_HISTORY) {
      window.store.aiChatHistory.splice(MAX_HISTORY)
    }
    setPrompt('')
    setIsLoading(false)
  }, [prompt, isLoading, props.config])

  function handleConfigSubmit (values) {
    window.store.updateConfig(values)
    message.success('Saved')
  }

  const renderConfig = useCallback(() => {
    if (!props.showAIConfig) return null
    const aiConfigs = pick(props.config, aiConfigsArr)
    return (
      <AIConfigForm
        initialValues={aiConfigs}
        onSubmit={handleConfigSubmit}
        showAIConfig={props.showAIConfig}
      />
    )
  }, [props.showAIConfig, props.config])

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

  function aiConfigMissing () {
    return aiConfigsArr.some(k => !props.config[k])
  }

  function renderSendIcon () {
    if (isLoading) {
      return <LoadingOutlined />
    }
    return (
      <SendOutlined
        onClick={handleSubmit}
        className='mg1l pointer icon-hover'
      />
    )
  }

  useEffect(() => {
    refsStatic.add('AIChat', {
      setPrompt,
      handleSubmit
    })
    if (aiConfigMissing()) {
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
            {renderConfig()}
          </Flex>
          {renderSendIcon()}
        </Flex>
      </Flex>
    </Flex>
  )
}
