import { Button, Popconfirm } from 'antd'
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons'

const e = window.translate

export default function AiChatSession ({
  session,
  isActive,
  onLoadSession,
  onDeleteSession
}) {
  const { sessionId, firstPrompt, timestamp, messageCount } = session
  const preview = firstPrompt || session.entries?.[0]?.attachments?.[0]?.name || 'Untitled chat'
  return (
    <div className={'ai-chat-session-row' + (isActive ? ' active' : '')}>
      <button
        type='button'
        className='ai-chat-session-item'
        aria-current={isActive || undefined}
        onClick={() => onLoadSession(sessionId)}
      >
        <MessageOutlined aria-hidden='true' />
        <span className='ai-chat-session-content'>
          <span className='ai-chat-session-preview'>{preview}</span>
          <span className='ai-chat-session-meta'>
            <time>{new Date(timestamp).toLocaleString()}</time>
            <span>{messageCount} {messageCount === 1 ? 'message' : 'messages'}</span>
          </span>
        </span>
      </button>
      <Popconfirm
        title='Delete this chat session?'
        okText={e('del')}
        okButtonProps={{ danger: true }}
        cancelText={e('cancel')}
        onConfirm={() => onDeleteSession(sessionId)}
      >
        <Button
          size='small'
          type='text'
          aria-label={e('del') + ' · ' + preview}
          icon={<DeleteOutlined />}
          className='ai-chat-session-delete'
        />
      </Popconfirm>
    </div>
  )
}
