// ai-chat-history.jsx
import { useEffect, useRef } from 'react'
import AIChatHistoryItem from './ai-chat-history-item'

export default function AIChatHistory ({ history }) {
  const historyRef = useRef(null)

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])
  if (!history.length) {
    return <div />
  }
  return (
    <div ref={historyRef}>
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
}
