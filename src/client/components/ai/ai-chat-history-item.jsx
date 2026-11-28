import { useState, memo } from 'react'
import { Button, Popover, Tag } from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  RightOutlined,
  CompressOutlined,
  PaperClipOutlined
} from '@ant-design/icons'
import AIOutput from './ai-output'
import AIStopIcon from './ai-stop-icon'
import AgentToolCallCard from './agent-tool-call-card'
import { isChatRequestStreaming, stopChatRequest } from './ai-chat-request'
import { copy } from '../../common/clipboard'
import { formatSize } from './ai-attachments'

const e = window.translate

// Draft changes re-render the panel. Entries are updated immutably, so memo
// keeps typing from re-parsing the markdown of every answer in the transcript.
export default memo(function AIChatHistoryItem ({ item }) {
  const [showOutput, setShowOutput] = useState(true)
  const isStreaming = isChatRequestStreaming(item)
  const { prompt, attachments, autoCompressCount, finalResponseStart = 0 } = item
  const toolCalls = item.toolCalls || []
  const response = item.response || ''
  const flagged = item.flagged && window.et?.enableAIFlag
  const narration = flagged ? '' : response.slice(0, finalResponseStart).trimEnd()
  const failed = toolCalls.filter(tc => tc.status === 'error').length
  const lastCall = toolCalls.at(-1)

  function renderPromptMenu () {
    return (
      <div className='ai-prompt-menu'>
        {item.nameAI && <div>{item.nameAI}</div>}
        <div><b>Model:</b> {item.modelAI}</div>
        <div><b>Role:</b> {item.roleAI}</div>
        <div><b>Base URL:</b> {item.baseURLAI}</div>
        <time>{new Date(item.timestamp).toLocaleString()}</time>
        <div className='ai-prompt-menu-actions'>
          <Button size='small' onClick={() => setShowOutput(!showOutput)}>
            {showOutput ? 'Hide reply' : 'Show reply'}
          </Button>
          <Button size='small' icon={<CopyOutlined />} aria-label={e('copy')} onClick={() => copy(prompt)} />
          <Button size='small' icon={<DeleteOutlined />} aria-label={e('del')} onClick={() => window.store.removeAiHistory(item.id)} />
        </div>
      </div>
    )
  }

  function renderActivity () {
    if (!toolCalls.length && !narration) return null
    return (
      <details className='ai-activity'>
        <summary>
          <RightOutlined className='ai-disclosure-arrow' />
          <span>{toolCalls.length ? `${toolCalls.length} tool call${toolCalls.length === 1 ? '' : 's'}` : 'Activity'}</span>
          {isStreaming && lastCall?.status === 'running' && <span className='ai-current-tool'>{lastCall.name}</span>}
          {failed > 0 && <span className='agent-tool-status-error'>· {failed} failed</span>}
          {lastCall?.status === 'stopped' && <span>· {e('stopped')}</span>}
        </summary>
        <div className='ai-activity-log'>
          {narration && <div className='ai-activity-note'>{narration}</div>}
          {toolCalls.map(tc => <AgentToolCallCard key={tc.id} toolCall={tc} />)}
        </div>
      </details>
    )
  }

  return (
    <article className='chat-history-item'>
      <div className='ai-user-message'>
        <Popover content={renderPromptMenu} trigger='click' placement='bottomRight'>
          <Button type='text' size='small' icon={<EllipsisOutlined />} aria-label='Message options' />
        </Popover>
        <div className='ai-prompt-bubble'>
          {prompt && <div className='ai-prompt-text'>{prompt}</div>}
          {attachments?.length > 0 && (
            <div className='ai-chat-item-attachments'>
              {attachments.map(a => (
                <Tag key={a.name + a.size} title={`${a.name} (${formatSize(a.size)})`}>
                  <PaperClipOutlined /> {a.name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      {!!autoCompressCount && (
        <div className='ai-auto-compress-badge' title='The context was summarized automatically'>
          <CompressOutlined /> {e('autoCompress')}{autoCompressCount > 1 ? ` ×${autoCompressCount}` : ''}
        </div>
      )}
      {renderActivity()}
      {showOutput
        ? <AIOutput item={item} response={response.slice(finalResponseStart)} />
        : <button className='ai-transcript-button' onClick={() => setShowOutput(true)}>Show reply</button>}
      {isStreaming && <AIStopIcon onClick={() => stopChatRequest(item)} title='Stop this AI request' />}
    </article>
  )
})
