// ai-chat-history-item.jsx

import React from 'react'
import { Tag } from 'antd'
import AIOutput from './ai-output'

export default function AIChatHistoryItem ({ prompt, response, brand }) {
  return (
    <div>
      <p>
        <Tag>Prompt:</Tag>
        <b>{prompt}</b>
      </p>
      <AIOutput content={response} brand={brand} />
    </div>
  )
}
