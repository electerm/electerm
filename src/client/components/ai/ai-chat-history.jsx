// ai-chat-history.jsx
import { useLayoutEffect, useRef } from 'react'
import { auto } from 'manate/react'
import AIChatHistoryItem from './ai-chat-history-item'

export default auto(function AIChatHistory ({ history }) {
  const historyRef = useRef(null)

  useLayoutEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history.length])
  if (!history.length) {
    return <div />
  }
  return (
    <div ref={historyRef} className='ai-history-wrap'>
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
