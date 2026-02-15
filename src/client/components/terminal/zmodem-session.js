import { WasmReceiver, WasmSender } from 'zmodem2-wasm'
import * as fs from './fs.js'
import EventEmitter from './event-emitter.js'

export default class ZmodemSession extends EventEmitter {
  constructor (addon, type) {
    super()
    this.addon = addon
    this.type = type
    this.socket = addon.socket
    this.term = addon.term
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
    if (this.fd) {
      await fs.close(this.fd)
      this.fd = null
    }
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
    this.sentBytes = 0

    return new Promise((resolve, reject) => {
      this.currentFileResolve = resolve
      this.currentFileReject = reject

      try {
        this.sender.start_file(file.name, file.size)
        this.drainSenderOutgoing()

        // Open file and start polling
        fs.open(file.filePath, 'r').then(fd => {
          this.fd = fd
          this.pollSender()
        }).catch(e => {
          console.error('Failed to open file', e)
          reject(e)
          this.close()
        })
      } catch (e) {
        console.error('Failed to start sender', e)
        reject(e)
        this.close()
      }
    })
  }

  handleSender (data) {
    if (!this.sender) return
    const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)

    try {
      this.sender.feed(u8)
      this.drainSenderOutgoing()
      this.pollSender()
    } catch (e) {
      console.error('Sender error:', e)
      if (this.currentFileReject) {
        this.currentFileReject(e)
        this.currentFileReject = null
      }
      this.close()
    }
  }

  drainSenderOutgoing () {
    if (!this.sender) return
    const outgoing = this.sender.drain_outgoing()
    if (outgoing && outgoing.length > 0) {
      this.socket.send(outgoing)
    }
  }

  pollSender () {
    if (!this.sender) return

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const event = this.sender.poll()
        if (!event) break

        if (event.type === 'need_file_data') {
          this.sendFileData(event.offset, event.length)
          break
        } else if (event.type === 'file_complete') {
          if (this.currentFileResolve) {
            this.currentFileResolve()
            this.currentFileResolve = null
          }
        } else if (event.type === 'session_complete') {
          this.close()
          break
        }
      }
    } catch (e) {
      console.error('Poll sender error', e)
      this.close()
    }
  }

  async sendFileData (offset, length) {
    if (!this.fd || !this.sender) return

    try {
      const buffer = new Uint8Array(length)
      // fs.read in fs.js returns the subarray with data
      const data = await fs.read(this.fd, buffer, 0, length, offset)

      if (data && data.length > 0) {
        this.sender.feed_file(data)
        this.sentBytes = offset + data.length
        this.emit('progress', this.sentBytes)

        this.drainSenderOutgoing()
        this.pollSender()
      }
    } catch (e) {
      console.error('Send file data error', e)
      if (this.currentFileReject) {
        this.currentFileReject(e)
        this.currentFileReject = null
      }
      this.close()
    }
  }

  finish () {
    return new Promise((resolve) => {
      if (this.sender) {
        this.sender.finish_session()
        this.drainSenderOutgoing()
        this.pollSender()
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
}
