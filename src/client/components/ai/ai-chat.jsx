import React, { useState } from 'react'
import { Tabs, Input, Button, List } from 'antd'
import { AIConfigForm } from './ai-config'
import AIOutput from './ai-output'
import TabSelect from '../footer/tab-select'

const { TextArea } = Input

const MAX_HISTORY = 100

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  async function handleSubmit () {
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    try {
      const aiResponse = await props.aiChat(prompt)
      setResponse(aiResponse)

      window.store.aiChatHistory.unshift({
        prompt,
        response: aiResponse,
        timestamp: new Date().toISOString()
      })

      if (window.store.aiChatHistory.length > MAX_HISTORY) {
        window.store.aiChatHistory.splice(MAX_HISTORY)
      }

      setPrompt('')
    } catch (error) {
      console.error('Error in AI chat:', error)
      setResponse('An error occurred while processing your request.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown (e) {
    if (e.keyCode === 13 && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleConfigSubmit (values) {
    props.onConfigSubmit(values)
  }

  function renderChat () {
    return (
      <div>
        <div className='ai-chat-terminals pd1b'>
          <TabSelect
            selectedTabIds={props.selectedTabIds}
            tabs={props.tabs}
            activeTabId={props.activeTabId}
          />
        </div>
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder='Enter your prompt here'
          autoSize={{ minRows: 3, maxRows: 6 }}
          disabled={isLoading}
        />
        <Button>
          Submit
        </Button>
        <div>
          <h3>

            Response:

          </h3>
          <AIOutput content={response} />
        </div>
      </div>
    )
  }

  function renderConfig () {
    return (
      <AIConfigForm
        initialValues={props.config}
        onSubmit={handleConfigSubmit}
      />
    )
  }

  function renderHistory () {
    return (
      <List
        dataSource={window.store.aiChatHistory}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              title={new Date(item.timestamp).toLocaleString()}
              description={
                <>

                  <strong>

                    Prompt:

                  </strong>

                  {item.prompt}

                  <br />
                  <strong>

                    Response:

                  </strong>
                  <AIOutput content={item.response} />
                </>
          }
            />
          </List.Item>
        )}
      />
    )
  }

  const items = [
    {
      key: 'chat',
      label: 'Chat',
      children: renderChat()
    },
    {
      key: 'config',
      label: 'Config',
      children: renderConfig()
    },
    {
      key: 'history',
      label: 'History',
      children: renderHistory()
    }
  ]

  return (

    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={items}
    />

  )
}
