import { useState, useEffect, useRef } from 'react'
import { Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { notification } from '../common/notification'

const e = window.translate
const COUNTDOWN_SECONDS = 3

export function showSocketCloseWarning ({
  tabId,
  tab,
  autoReconnect,
  delTab,
  reloadTab
}) {
  const key = `open${Date.now()}`

  function closeNotification () {
    notification.destroy(key)
  }

  const descriptionNode = (
    <SocketCloseDescription
      autoReconnect={autoReconnect}
      onClose={() => {
        closeNotification()
        delTab(tabId)
      }}
      onReload={() => {
        closeNotification()
        reloadTab({ ...tab, autoReConnect: (tab.autoReConnect || 0) + 1 })
      }}
    />
  )

  notification.warning({
    key,
    message: e('socketCloseTip'),
    duration: autoReconnect ? COUNTDOWN_SECONDS + 2 : 30,
    description: descriptionNode
  })

  return { key }
}

function SocketCloseDescription ({ autoReconnect, onClose, onReload }) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!autoReconnect) {
      return
    }
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          onReload()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [autoReconnect])

  return (
    <div className='pd2y'>
      {autoReconnect && (
        <div className='pd1b'>
          {e('autoReconnectTerminal')}: {countdown}s
        </div>
      )}
      <Button
        className='mg1r'
        type='primary'
        onClick={onClose}
      >
        {e('close')}
      </Button>
      <Button
        icon={<ReloadOutlined />}
        onClick={onReload}
      >
        {e('reload')}
      </Button>
    </div>
  )
}
