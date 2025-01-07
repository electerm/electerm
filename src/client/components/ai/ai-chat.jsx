import React, { useState } from 'react'
import { Flex, Input, Button } from 'antd'
import { AIConfigForm } from './ai-config'
import TabSelect from '../footer/tab-select'
import AiChatHistory from './chat-history'
import uid from '../../common/uid'
import { SettingOutlined } from '@ant-design/icons'

const { TextArea } = Input

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

  return (
    <Flex>
      {renderHistory()}
      {renderConfig()}

      <TextArea
        value={prompt}
        onChange={handlePromptChange}
        placeholder='Enter your prompt here'
        autoSize={{ minRows: 3, maxRows: 6 }}
        disabled={isLoading}
      />
      <div className='ai-chat-terminals pd1b'>
        <TabSelect
          selectedTabIds={props.selectedTabIds}
          tabs={props.tabs}
          activeTabId={props.activeTabId}
        />
        <SettingOutlined
          onClick={() => setShowConfig(!showConfig)}
          className='mg1l pointer'
        />
        <Button
          type='primary'
          onClick={handleSubmit}
          disabled={isLoading}
        >
          Submit
        </Button>
      </div>
    </Flex>
  )
}
