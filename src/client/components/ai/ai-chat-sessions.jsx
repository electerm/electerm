import { Button, Popconfirm } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import AiChatSession from './ai-chat-session'

const e = window.translate

export default function AiChatSessions ({
  sessions,
  currentChatSessionId,
  onLoadSession,
  onDeleteSession,
  onClearAll
}) {
  if (!sessions?.length) {
    return (
      <div className='ai-chat-sessions-empty'>
        <HistoryOutlined aria-hidden='true' />
        <span>No chat history yet</span>
      </div>
    )
  }

  return (
    <div className='ai-history-wrap'>
      <section className='ai-chat-sessions-wrap'>
        <header className='ai-chat-sessions-toolbar'>
          <h2>{e('history')}</h2>
          <Popconfirm
            title='Clear all chat history?'
            okText={e('clear')}
            okButtonProps={{ danger: true }}
            cancelText={e('cancel')}
            onConfirm={onClearAll}
          >
            <Button type='text' size='small'>{e('clear')}</Button>
          </Popconfirm>
        </header>
        {sessions.map(session => (
          <AiChatSession
            key={session.sessionId}
            session={session}
            isActive={session.sessionId === currentChatSessionId}
            onLoadSession={onLoadSession}
            onDeleteSession={onDeleteSession}
          />
        ))}
      </section>
    </div>
  )
}
