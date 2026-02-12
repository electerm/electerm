import { WasmReceiver, WasmSender } from 'zmodem2-wasm'
import * as fs from './fs.js'
import EventEmitter from './event-emitter.js'

const BUFFER_SIZE = 10 * 1024 * 1024 // 10MB

export default class ZmodemSession extends EventEmitter {
  constructor (addon, type) {
    super()
    this.addon = addon
    this.type = type
    this.socket = addon.socket
    this.term = addon.term
    this._fileBuffer = null
    this._fileBufferOffset = 0
    this._reading = false
    this.currentTransfer = null
  }

  consume (data) {
    if (this.receiver) {
      this.handleReceiver(data)
    } else if (this.sender) {
      this.handleSender(data)
    } else if (this.type === 'receive' && this.started) {
      this.startReceiver(data)
    } else if (this.initialData) {
      // Append to initial data if not started yet?
      const newData = new Uint8Array(this.initialData.length + data.byteLength)
      newData.set(this.initialData)
      newData.set(new Uint8Array(data), this.initialData.length)
      this.initialData = newData
    }
  }

  start () {
    this.started = true
    if (this.type === 'receive' && this.initialData) {
      this.startReceiver(this.initialData)
      this.initialData = null
    }
  }

  async close () {
    this.receiver = null
    this.sender = null
    this.addon.session = null
    this.emit('session_end')
  }

  // --- Receiver Logic ---

  startReceiver (initialData) {
    try {
      this.receiver = new WasmReceiver()
      this.handleReceiver(initialData)
    } catch (e) {
      console.error('Failed to create Receiver', e)
    }
  }

  handleReceiver (data) {
    if (!this.receiver) return
    const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
    let offset = 0
    let loopCount = 0

    while (offset < u8.length && loopCount++ < 1000) {
      if (!this.receiver) break
      try {
        const chunk = u8.subarray(offset)
        const consumed = this.receiver.feed(chunk)
        offset += consumed

        const drained = this.pumpReceiver()

        if (consumed === 0 && !drained) {
          break
        }
      } catch (e) {
        console.error('Receiver error:', e)
        this.close()
        break
      }
    }
  }

  pumpReceiver () {
    if (!this.receiver) return false
    let didWork = false

    try {
      const outgoing = this.receiver.drain_outgoing()
      if (outgoing && outgoing.length > 0) {
        this.socket.send(outgoing)
        didWork = true
      }

      while (true) {
        const event = this.receiver.poll()
        if (!event) break

        didWork = true

        if (event.type === 'file_start') {
          // Emit offer event
          const transfer = new EventEmitter()
          transfer.get_details = () => ({
            name: event.name,
            size: event.size
          })
          transfer.accept = () => Promise.resolve()
          transfer.skip = () => { /* TODO */ }
          this.currentTransfer = transfer

          this.emit('offer', transfer)
        } else if (event.type === 'file_complete') {
          this.emit('file_end')
          this.currentTransfer = null
        } else if (event.type === 'session_complete') {
          this.close()
          return true
        }
      }

      const chunk = this.receiver.drain_file()
      if (chunk && chunk.length > 0) {
        // this.emit('data', chunk)
        if (this.currentTransfer) {
          this.currentTransfer.emit('input', chunk)
        }
        didWork = true
      }
    } catch (e) {
      console.error('Receiver error:', e)
      this.close()
    }
    return didWork
  }

  // --- Sender Logic ---

  async sendFile (file) {
    this.sendingFile = file
    if (!this.sender) {
      this.sender = new WasmSender()
    }
    this._reading = false
    this._fileBuffer = null
    this._fileBufferOffset = 0
    this.sentBytes = 0

    return new Promise((resolve, reject) => {
      this.currentFileResolve = resolve
      this.currentFileReject = reject

      try {
        this.sender.start_file(file.name, file.size)
        this.pumpSender()
      } catch (e) {
        console.error('Failed to start sender', e)
        reject(e)
      }
    })
  }

  handleSender (data) {
    if (!this.sender) return
    const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)

    let offset = 0
    let loopCount = 0

    while (offset < u8.length && loopCount++ < 1000) {
      if (!this.sender) break
      try {
        const chunk = u8.subarray(offset)
        const consumed = this.sender.feed(chunk)
        offset += consumed

        const drained = this.pumpSender()

        if (consumed === 0 && !drained) {
          break
        }
      } catch (e) {
        console.error('Sender error:', e)
        if (this.currentFileReject) {
          this.currentFileReject(e)
          this.currentFileReject = null
        }
        this.close()
        break
      }
    }
  }

  finish () {
    return new Promise((resolve) => {
      if (this.sender) {
        this.sender.finish_session()
        this.pumpSender()
        // wait for session_complete
        const onEnd = () => {
          this.off('session_end', onEnd)
          resolve()
        }
        this.on('session_end', onEnd)
      } else {
        resolve()
      }
    })
  }

  pumpSender () {
    if (!this.sender) return false
    let didWork = false

    const outgoingChunks = []
    let totalOutgoingSize = 0
    const FLUSH_THRESHOLD = 64 * 1024

    const flushOutgoing = () => {
      if (outgoingChunks.length === 0) return
      if (outgoingChunks.length === 1) {
        this.socket.send(outgoingChunks[0])
      } else {
        this.socket.send(new Blob(outgoingChunks))
      }
      outgoingChunks.length = 0
      totalOutgoingSize = 0
    }

    try {
      const outgoing = this.sender.drain_outgoing()
      if (outgoing && outgoing.length > 0) {
        outgoingChunks.push(outgoing)
        totalOutgoingSize += outgoing.length
        didWork = true
      }

      while (true) {
        const event = this.sender.poll()
        if (!event) break

        didWork = true

        if (event.type === 'need_file_data') {
          const start = event.offset
          const length = event.length

          if (this._fileBuffer &&
            start >= this._fileBufferOffset &&
            (start + length) <= (this._fileBufferOffset + this._fileBuffer.byteLength)) {
            const relativeStart = start - this._fileBufferOffset
            const chunk = this._fileBuffer.subarray(relativeStart, relativeStart + length)
            this.sender.feed_file(chunk)

            this.sentBytes = start + chunk.length
            this.emit('progress', this.sentBytes)

            const outgoing = this.sender.drain_outgoing()
            if (outgoing && outgoing.length > 0) {
              outgoingChunks.push(outgoing)
              totalOutgoingSize += outgoing.length

              if (totalOutgoingSize > FLUSH_THRESHOLD) {
                flushOutgoing()
              }
            }
            continue
          }

          if (this.sendingFile && !this._reading) {
            flushOutgoing()
            this._reading = true
            this.loadBufferAndFeed(start, length)
            break
          } else if (this._reading) {
            break
          }
        } else if (event.type === 'file_complete') {
          // this.sender.finish_session() // Handled by finish()
          if (this.currentFileResolve) {
            this.currentFileResolve()
            this.currentFileResolve = null
          }
        } else if (event.type === 'session_complete') {
          this.close()
          flushOutgoing()
          return true
        }
      }
    } catch (e) {
      console.error('Pump Sender Error:', e)
      if (this.currentFileReject) {
        this.currentFileReject(e)
        this.currentFileReject = null
      }
      this.close()
    }

    flushOutgoing()
    return didWork
  }

  async loadBufferAndFeed (offset, length) {
    if (!this.sender || !this.sendingFile) {
      this._reading = false
      return
    }
    try {
      const readSize = Math.max(length, BUFFER_SIZE)
      // Use fs to read
      const fd = await fs.open(this.sendingFile.filePath, 'r')
      const buffer = new Uint8Array(readSize)
      const { bytesRead } = await fs.read(fd, buffer, 0, readSize, offset)
      await fs.close(fd)

      if (!this.sender) return
      const u8 = buffer.subarray(0, bytesRead)

      this._fileBuffer = u8
      this._fileBufferOffset = offset

      const feedLen = Math.min(length, u8.length)
      const chunk = u8.subarray(0, feedLen)

      this.sender.feed_file(chunk)

      this.sentBytes = offset + chunk.length
      this.emit('progress', this.sentBytes)

      this._reading = false

      this.pumpSender()
    } catch (e) {
      console.error('Buffer read error', e)
      this._reading = false
      try { this.pumpSender() } catch (_) {}
    }
  }
}
