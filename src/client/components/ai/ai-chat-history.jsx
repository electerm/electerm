// ai-chat-history.jsx
import { useLayoutEffect, useRef } from 'react'
import { auto } from 'manate/react'
import AIChatHistoryItem from './ai-chat-history-item'
import AiChatEmpty from './ai-chat-empty'

export default auto(function AIChatHistory ({ history, isAgent }) {
  const historyRef = useRef(null)

  const followStream = useRef(true)
  const lastId = history.at(-1)?.id
  const previousLastId = useRef(lastId)

  useLayoutEffect(() => {
    if (lastId !== previousLastId.current) followStream.current = true
    previousLastId.current = lastId
    if (historyRef.current && followStream.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history, lastId])
  if (!history.length) {
    return <AiChatEmpty isAgent={isAgent} />
  }
  return (
    <div
      ref={historyRef}
      className='ai-history-wrap'
      onScroll={({ currentTarget }) => {
        followStream.current = currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight < 32
      }}
    >
      {
        history.map((item) => {
          return (
            <AIChatHistoryItem
              key={item.id}
              item={item}
            />
          )
        })
      }
    </div>
  )
})
