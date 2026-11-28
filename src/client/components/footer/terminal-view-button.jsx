import { memo, useEffect, useState } from 'react'
import { LoadingOutlined, CaretRightOutlined } from '@ant-design/icons'

const e = window.translate
const busyAfterMs = 750
// Allow for tail -f implementations that deliver new lines once per second.
const idleAfterMs = 1500

export default memo(function TerminalViewButton ({ pane }) {
  const [mode, setMode] = useState(pane?.state.viewPaused ? 'paused' : 'idle')
  const paused = mode === 'paused'

  useEffect(() => {
    if (!pane || paused) return
    let firstWrite = 0
    let lastWrite = 0
    let writes = 0
    let timer

    function checkIdle () {
      const remaining = lastWrite + idleAfterMs - Date.now()
      if (remaining > 0) {
        timer = setTimeout(checkIdle, remaining)
      } else {
        timer = null
        writes = 0
        setMode('idle')
      }
    }

    // Only the active pane has a listener. Use the timestamp its write batch
    // already recorded and arm one idle check when the button becomes visible.
    pane.onOutputActivity = (now, lastInput, length) => {
      // Small replies immediately after typing are usually keystroke echoes.
      if (length < 64 && now - lastInput < 300) return
      if (timer) {
        lastWrite = now
        return
      }
      if (!writes || now - lastWrite >= idleAfterMs) {
        firstWrite = now
        writes = 0
      }
      lastWrite = now
      if (++writes >= 3 && now - firstWrite >= busyAfterMs) {
        setMode('busy')
        timer = setTimeout(checkIdle, idleAfterMs)
      }
    }
    return () => {
      delete pane.onOutputActivity
      clearTimeout(timer)
    }
  }, [pane, paused])

  if (mode === 'idle') return null
  const label = e(paused ? 'resume' : 'pause') + ' · ' + e('terminal')
  function toggle () {
    pane.setViewPaused(!paused)
    setMode(paused ? 'idle' : 'paused')
  }
  return (
    <button
      type='button'
      className='terminal-footer-unit terminal-view-button'
      title={label}
      aria-label={label}
      aria-pressed={paused}
      onClick={toggle}
    >
      {paused ? <CaretRightOutlined className='terminal-view-resume' /> : <LoadingOutlined />}
    </button>
  )
})
