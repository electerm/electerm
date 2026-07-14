import { Flex, Button, Popconfirm, Empty } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import AiChatSession from './ai-chat-session'

const e = window.translate

export default function AiChatSessions ({
  sessions,
  currentChatSessionId,
  onLoadSession,
  onDeleteSession,
  onClearAll
}) {
  if (!sessions || sessions.length === 0) {
    return (
      <Flex
        vertical
        align='center'
        justify='center'
        className='ai-chat-sessions-empty'
      >
        <Empty
          description='No chat history yet'
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Flex>
    )
  }

  return (
    <div className='ai-chat-sessions-wrap'>
      <Flex justify='end' className='ai-chat-sessions-toolbar'>
        <Popconfirm
          title='?'
          okText={e('clear')}
          cancelText={e('cancel')}
          onConfirm={onClearAll}
        >
          <Button
            size='small'
            danger
            icon={<ClearOutlined />}
          >
            {e('clear')}
          </Button>
        </Popconfirm>
      </Flex>
      {sessions.map(session => (
        <AiChatSession
          key={session.sessionId}
          session={session}
          isActive={session.sessionId === currentChatSessionId}
          onLoadSession={onLoadSession}
          onDeleteSession={onDeleteSession}
        />
      ))}
    </div>
  )
}
