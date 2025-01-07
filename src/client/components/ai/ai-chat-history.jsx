// ai-chat-history.jsx

import React from 'react'
import { Collapse, Tag } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AIChatHistoryItem from './ai-chat-history-item'

// Initialize dayjs relative time plugin
dayjs.extend(relativeTime)

export default function AIChatHistory ({ history }) {
  const items = history.map((item, index) => {
    const time = dayjs(item.timestamp)
    return {
      key: index,
      label: (
        <div className='elli'>
          <Tag>{time.fromNow()}</Tag>
          <b>{item.prompt}</b>
        </div>
      ),
      children: (
        <AIChatHistoryItem
          prompt={item.prompt}
          response={item.response}
          brand={item.brand}
        />
      )
    }
  })

  return (
    <Collapse items={items} />
  )
}
