import { useEffect, useRef, useState } from 'react'
import frameDocument from 'virtual:electerm-x11-frame'

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
      const ws = new WebSocket(url)
      connections.current.set(id, ws)
      ws.binaryType = 'arraybuffer'
      const { port1, port2 } = new MessageChannel()
      frame.current.contentWindow.postMessage(null, '*', [port2])
      port1.onmessage = ({ data }) => {
        if (data.type === 'x11-end') ws.close()
        else if (ws.readyState === WebSocket.OPEN) ws.send(data.data)
      }
      ws.onmessage = ({ data }) => port1.postMessage({ type: 'x11-data', data }, [data])
      ws.onclose = () => {
        port1.postMessage({ type: 'x11-end' })
        port1.close()
        if (connections.current.delete(id)) onDisconnect(id)
      }
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
        srcDoc={frameDocument}
        onLoad={() => setReady(true)}
      />
    </div>
  )
}
