import { memo } from 'react'
import { Button } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'

const e = window.translate

export default memo(function ReconnectOverlay ({ countdown, onCancel }) {
  if (countdown === null || countdown === undefined) {
    return null
  }
  return (
    <div className='terminal-reconnect-overlay'>
      <div className='terminal-reconnect-box'>
        <LoadingOutlined className='terminal-reconnect-icon' />
        <div className='terminal-reconnect-msg'>
          {e('autoReconnectTerminal')}: {countdown}s
        </div>
        <Button
          size='small'
          onClick={onCancel}
        >
          {e('cancel')}
        </Button>
      </div>
    </div>
  )
})
