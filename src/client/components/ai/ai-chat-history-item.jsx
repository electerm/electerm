// ai-chat-history-item.jsx
import AIOutput from './ai-output'
import {
  Alert,
  Tooltip
} from 'antd'
import {
  UserOutlined,
  CopyOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'

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
  function handleDel (e) {
    e.stopPropagation()
    window.store.removeAiHistory(item.id)
  }
  function handleCopy () {
    copy(prompt)
  }
  function renderTitle () {
    return (
      <div>
        <p>
          <b>Model:</b> {item.modelAI}
        </p>
        <p>
          <b>Role:</b> {item.roleAI}
        </p>
        <p>
          <b>Base URL:</b> {item.baseURLAI}
        </p>
        <p>
          <b>Time:</b> {new Date(item.timestamp).toLocaleString()}
        </p>
        <p>
          <CopyOutlined
            className='pointer'
            onClick={handleCopy}
          />
          <CloseOutlined
            className='pointer mg1l'
            onClick={handleDel}
          />
        </p>
      </div>
    )
  }
  return (
    <div className='chat-history-item'>
      <div className='mg1y'>
        <Tooltip title={renderTitle()}>
          <Alert {...alertProps} />
        </Tooltip>
      </div>
      <AIOutput item={item} />
    </div>
  )
}
