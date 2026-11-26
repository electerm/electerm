// Some upstream modules allocate Buffers at module initialization time.
globalThis.Buffer = require('buffer').Buffer
const { XServer } = require('x11/lib/xserver')
const { CanvasPresenter } = require('x11/browser/compositor')
const { MessagePortStream } = require('x11/browser/messageport-stream')

const server = new XServer({ width: 1024, height: 768 })
const presenter = new CanvasPresenter(server, document.querySelector('canvas'))
presenter.canvas.focus()
window.addEventListener('message', event => {
  if (event.source === window.parent && event.ports.length === 1) {
    server.addClientStream(new MessagePortStream(event.ports[0]))
  }
})
