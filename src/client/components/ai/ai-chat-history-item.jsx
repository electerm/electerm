// ai-chat-history-item.jsx
import AIOutput from './ai-output'
import {
  Alert
} from 'antd'
import {
  UserOutlined
} from '@ant-design/icons'

export default function AIChatHistoryItem ({ item }) {
  const {
    prompt
  } = item
  const alertProps = {
    message: (
      <div><UserOutlined />: {prompt}</div>
    ),
    type: 'info'
  }
  return (
    <div className='chat-history-item'>
      <div className='mg1y'>
        <Alert {...alertProps} />
      </div>
      <AIOutput item={item} />
    </div>
  )
}
