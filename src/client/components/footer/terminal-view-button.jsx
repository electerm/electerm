import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from 'antd'
import { LoadingOutlined, CaretRightOutlined } from '@ant-design/icons'
import { observeOutputActivity } from './terminal-view-activity.mjs'

const e = window.translate
const neverPaused = () => false
const noSubscription = () => () => {}

export default memo(function TerminalViewButton ({ pane }) {
  const paused = useSyncExternalStore(
    pane?.subscribeViewPaused || noSubscription,
    pane?.isViewPaused || neverPaused
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBusy(false)
    if (pane && !paused) return observeOutputActivity(pane, setBusy)
  }, [pane, paused])

  if (!paused && !busy) return null
  const label = e(paused ? 'resume' : 'pause')
  return (
    <Button
      type='text'
      size='small'
      icon={paused ? <CaretRightOutlined className='terminal-view-resume' /> : <LoadingOutlined />}
      className='terminal-footer-unit terminal-view-button'
      title={label}
      aria-label={label}
      aria-pressed={paused}
      onClick={() => pane.setViewPaused(!paused)}
    />
  )
})
