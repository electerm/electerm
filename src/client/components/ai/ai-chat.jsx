// a ai chat component, has promote input and response output, also could choose which terminal to send command
import { useState } from 'react'
import { Tabs, Input } from 'antd'
import { AIConfigForm } from './ai-config'
import TabSelect from '../footer/tab-select'

const { TextArea } = Input
const { TabPane } = Tabs
const e = window.translate

export default function AIChat (props) {
  const [prompt, setPrompt] = useState('')
  const [selectedTabIds, setSelectedTabIds] = useState([props.activeTabId])
  // const [activeTab, setActiveTab] = useState('chat')

  function handlePromptChange (e) {
    setPrompt(e.target.value)
  }

  function handleSubmit () {
    if (!prompt.trim()) {
      return
    }
    props.onSubmit({
      prompt,
      selectedTabIds
    })
    setPrompt('')
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
    const tabSelectProps = {
      selectedTabIds,
      tabs: props.tabs,
      activeTabId: props.activeTabId,
      onSelect: (id) => {
        setSelectedTabIds(prev =>
          prev.includes(id)
            ? prev.filter(tabId => tabId !== id)
            : [...prev, id]
        )
      },
      onSelectAll: () => {
        setSelectedTabIds(props.tabs.map(tab => tab.id))
      },
      onSelectNone: () => {
        setSelectedTabIds([props.activeTabId])
      }
    }

    return (
      <div>
        <div className='ai-chat-terminals pd1b'>
          <TabSelect {...tabSelectProps} />

        </div>
        <TextArea
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder={e('enterPrompt')}
          autoSize={{ minRows: 2, maxRows: 6 }}
        />
        <pre>
          {props.response}
        </pre>
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

  return (

    <div>
      <Tabs>
        <TabPane>
          {renderChat()}
        </TabPane>
        <TabPane>
          {renderConfig()}
        </TabPane>
      </Tabs>
    </div>
  )
}
