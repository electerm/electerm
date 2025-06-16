// ai-chat-history-item.jsx
import AIOutput from './ai-output'
import {
  Alert,
  Tooltip
} from 'antd'
import {
  UserOutlined,
  CopyOutlined,
  CloseOutlined,
  CaretDownOutlined,
  CaretRightOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { useState } from 'react'

export default function AIChatHistoryItem ({ item }) {
  const [showOutput, setShowOutput] = useState(true)
  const {
    prompt
  } = item

  function toggleOutput () {
    setShowOutput(!showOutput)
  }

  const alertProps = {
    message: (
      <>
        <span className='pointer mg1r' onClick={toggleOutput}>
          {showOutput ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
        <UserOutlined />: {prompt}
      </>
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
      {showOutput && <AIOutput item={item} />}
    </div>
  )
}
