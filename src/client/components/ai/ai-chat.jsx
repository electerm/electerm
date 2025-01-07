import React, { useState } from 'react'
import { Flex, Input } from 'antd'
import { AIConfigForm } from './ai-config'
import TabSelect from '../footer/tab-select'
import AiChatHistory from './chat-history'
import uid from '../../common/uid'
import { SettingOutlined, SendOutlined } from '@ant-design/icons'
import './ai.styl'

const { TextArea } = Input
const FlexItem = Flex.Item

const MAX_HISTORY = 100

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  async function handleSubmit () {
    if (!prompt.trim() || isLoading) return
    setIsLoading(true)
    const aiResponse = await window.performance.runAsync(
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
    window.store.aiChatHistory.unshift({
      prompt,
      response: aiResponse.response,
      timestamp: Date.now(),
      id: uid()
    })

    if (window.store.aiChatHistory.length > MAX_HISTORY) {
      window.store.aiChatHistory.splice(MAX_HISTORY)
    }
    setPrompt('')
    setIsLoading(false)
  }

  function handleConfigSubmit (values) {
    window.store.updateConfig(values)
  }

  function renderConfig () {
    if (!showConfig) return null
    return (
      <AIConfigForm
        initialValues={props.config}
        onSubmit={handleConfigSubmit}
      />
    )
  }

  function renderHistory () {
    return (
      <AiChatHistory history={props.aiChatHistory} />
    )
  }

  function toggleConfig () {
    setShowConfig(!showConfig)
  }

  return (
    <Flex vertical className='ai-chat-container'>
      <FlexItem className='ai-chat-history' flex='auto'>
        {renderHistory()}
      </FlexItem>
      {showConfig && (
        <FlexItem className='ai-config-form'>
          {renderConfig()}
        </FlexItem>
      )}
      <FlexItem className='ai-chat-input'>
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          placeholder='Enter your prompt here'
          autoSize={{ minRows: 3, maxRows: 10 }}
          disabled={isLoading}
        />
        <Flex className='ai-chat-terminals' justify='space-between' align='center'>
          <TabSelect
            selectedTabIds={props.selectedTabIds}
            tabs={props.tabs}
            activeTabId={props.activeTabId}
          />
          <Flex>
            <SettingOutlined
              onClick={toggleConfig}
              className='mg1l pointer icon-hover'
            />
            <SendOutlined
              onClick={handleSubmit}
              className={`mg1l pointer icon-hover ${isLoading ? 'disabled' : ''}`}
            />
          </Flex>
        </Flex>
      </FlexItem>
    </Flex>
  )
}
