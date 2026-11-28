import { useState, memo } from 'react'
import AIOutput from './ai-output'
import AIStopIcon from './ai-stop-icon'
import AgentToolCallCard from './agent-tool-call-card'
import { isChatRequestStreaming, stopChatRequest } from './ai-chat-request'
import {
  Alert,
  Tooltip,
  Tag
} from 'antd'
import {
  CopyOutlined,
  CloseOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CompressOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { formatSize } from './ai-attachments'

// memo()'d: the panel holds the draft prompt in its own state, so every
// keystroke re-renders the whole transcript. Without this the keystroke also
// re-rendered (and re-parsed the markdown of) every message in it -- 50ms+ per
// character in a long agent session. Entries are updated immutably
// (store.updateAiHistoryEntry), so the reference comparison is meaningful.
export default memo(function AIChatHistoryItem ({ item }) {
  const [showOutput, setShowOutput] = useState(true)
  const isStreaming = isChatRequestStreaming(item)
  const {
    prompt,
    nameAI,
    modelAI,
    roleAI,
    baseURLAI,
    mode,
    toolCalls,
    autoCompressCount
  } = item

  function toggleOutput () {
    setShowOutput(!showOutput)
  }

  function handleStop (event) {
    event.stopPropagation()
    stopChatRequest(item)
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

  function renderAttachments () {
    if (!item.attachments || !item.attachments.length) {
      return null
    }
    return (
      <div className='ai-chat-item-attachments mg1b'>
        {item.attachments.map(a => (
          <Tag key={a.name + a.size} title={`${a.name} (${formatSize(a.size)})`}>
            <PaperClipOutlined /> {a.name}
          </Tag>
        ))}
      </div>
    )
  }

  // Auto compress happens on its own, with no visible step of its own, so the
  // turn says so: the conversation was summarized and the request continued
  // from the summary instead of the full history. Ask mode summarizes before
  // sending, agent mode in the middle of the run (possibly more than once).
  function renderAutoCompressBadge () {
    if (!autoCompressCount) {
      return null
    }
    return (
      <div className='ai-auto-compress-badge mg1b'>
        <Tag
          color='blue'
          title='The context filled up and was summarized automatically, this turn continued from the summary'
        >
          <CompressOutlined /> {window.translate('autoCompress')}
          {autoCompressCount > 1 ? ` x${autoCompressCount}` : ''}
        </Tag>
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
          <AgentToolCallCard key={tc.id} toolCall={tc} autoCollapse={!isStreaming} />
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
      {renderAttachments()}
      {renderAutoCompressBadge()}
      {renderToolCalls()}
      {showOutput && <AIOutput item={item} />}
      {renderStopButton()}
    </div>
  )
})
