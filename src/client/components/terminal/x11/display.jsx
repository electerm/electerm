import { useEffect, useRef, useState } from 'react'
import { connectViewer } from 'electerm-x11/connect.mjs'
import viewerUrl from 'electerm-x11/viewer.html?url'

export default function X11Display ({ clients, socket, onDisconnect }) {
  const frame = useRef(null)
  const connections = useRef(new Map())
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const current = connections.current
    return () => {
      for (const ws of current.values()) ws.close()
      current.clear()
    }
  }, [])

  useEffect(() => {
    if (!ready || socket.readyState !== WebSocket.OPEN) return
    for (const id of clients) {
      if (connections.current.has(id)) continue
      const url = new URL(socket.url)
      url.searchParams.set('x11Client', id)
      const ws = connectViewer(frame.current, url)
      connections.current.set(id, ws)
      ws.addEventListener('close', () => {
        if (connections.current.delete(id)) onDisconnect(id)
      })
      setVisible(true)
    }
  }, [clients, ready, socket, onDisconnect])

  return (
    <div className='x11-display'>
      <button type='button' aria-expanded={visible} onClick={() => setVisible(!visible)}>
        {visible ? 'Show terminal' : 'Show X11 display'}
      </button>
      <iframe
        hidden={!visible}
        ref={frame}
        sandbox='allow-scripts'
        title='X11 display'
        src={viewerUrl}
        onLoad={() => setReady(true)}
      />
    </div>
  )
}
