import { Flex, Button, Popconfirm } from 'antd'
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons'

export default function AiChatSession ({
  session,
  isActive,
  onLoadSession,
  onDeleteSession
}) {
  const time = new Date(session.timestamp).toLocaleString()
  const preview = session.firstPrompt.length > 80
    ? session.firstPrompt.substring(0, 80) + '...'
    : session.firstPrompt
  return (
    <div
      key={session.sessionId}
      className={`ai-chat-session-item${isActive ? ' active' : ''}`}
      onClick={() => onLoadSession(session.sessionId)}
    >
      <Flex vertical className='ai-chat-session-content'>
        <Flex align='center' className='ai-chat-session-header'>
          <MessageOutlined className='mg1r' />
          <span className='ai-chat-session-preview'>{preview}</span>
        </Flex>
        <Flex justify='space-between' align='center' className='ai-chat-session-meta'>
          <span className='ai-chat-session-time'>{time}</span>
          <span className='ai-chat-session-count'>{session.messageCount} messages</span>
        </Flex>
      </Flex>
      <Popconfirm
        title='Delete this chat session?'
        okText='Delete'
        cancelText='Cancel'
        onConfirm={(e) => {
          e?.stopPropagation()
          onDeleteSession(session.sessionId)
        }}
        onCancel={(e) => e?.stopPropagation()}
      >
        <Button
          size='small'
          type='text'
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
          className='ai-chat-session-delete'
        />
      </Popconfirm>
    </div>
  )
}
