import init from 'zmodem2-wasm'
import * as fs from './fs.js'
import { throttle } from 'lodash-es'
import generate from '../../common/uid.js'
import { formatBytes } from '../../common/byte-format.js'
import { transferTypeMap } from '../../common/constants.js'
import { getLocalFileInfo } from '../sftp/file-read.js'
import ZmodemSession from './zmodem-session.js'

export class AddonZmodem {
  constructor () {
    this.initWasm()
    this._disposables = []
  }

  async initWasm () {
    try {
      await init()
      this.wasmInitialized = true
      console.log('ZMODEM WASM initialized')
    } catch (e) {
      console.error('Failed to init WASM', e)
    }
  }

  activate (terminal) {
    terminal.zmodemAttach = this.zmodemAttach
  }

  zmodemAttach = (ctx) => {
    this.socket = ctx.socket
    this.term = ctx.term
    this.ctx = ctx
    this.socket.binaryType = 'arraybuffer'
    this.socket.addEventListener('message', this.handleWSMessage)
  }

  handleWSMessage = (evt) => {
    if (typeof evt.data === 'string') {
      if (this.ctx.onZmodem) {
        this.term.write(evt.data)
      }
    } else {
      this.consume(evt.data)
    }
  }

  consume (data) {
    if (!this.wasmInitialized) {
      return
    }

    if (this.session) {
      this.session.consume(data)
      return
    }

    const u8 = new Uint8Array(data)
    let foundIdx = -1
    // ** + \x18 + B (ZHEX)
    for (let i = 0; i < u8.length - 3; i++) {
      if (u8[i] === 0x2a && u8[i + 1] === 0x2a && u8[i + 2] === 0x18 && u8[i + 3] === 0x42) {
        foundIdx = i
        break
      }
    }

    if (foundIdx >= 0) {
      if (foundIdx + 5 < u8.length) {
        const typeHex1 = u8[foundIdx + 4]
        const typeHex2 = u8[foundIdx + 5]

        if (typeHex1 === 0x30 && typeHex2 === 0x30) {
          // ZRQINIT (Receive)
          this.startSession('receive', u8.subarray(foundIdx))
        } else if (typeHex1 === 0x30 && typeHex2 === 0x31) {
          // ZRINIT (Send)
          this.startSession('send', null)
        }
      }
    }
  }

  startSession (type, initialData) {
    this.session = new ZmodemSession(this, type)
    this.onCanceling = false
    this.term.blur()
    this.ctx.onZmodem = true

    if (type === 'receive') {
      if (initialData) {
        this.session.initialData = initialData
      }
      this.onReceiveZmodemSession()
    } else {
      this.onSendZmodemSession()
    }
  }

  dispose = () => {
    this.socket && this.socket.removeEventListener('message', this.handleWSMessage)
    this.session && this.session.close()
    this.session = null
    this._disposables.forEach(d => d.dispose())
    this._disposables = []
    this.term = null
    this.socket = null
    if (this.ctx) {
      this.ctx.onZmodem = false
    }
    this.ctx = null
  }

  onzmodemRetract = () => {
    console.debug('zmodemRetract')
  }

  writeBanner = (type) => {
    const border = '='.repeat(50)
    this.term.write(`\r\n${border}\r\n`)
    this.term.write('\x1b[33m\x1b[1mRecommend use trzsz instead: https://github.com/trzsz/trzsz\x1b[0m\r\n')
    this.term.write(`${border}\r\n\r\n`)
    this.term.write(`\x1b[32m\x1b[1mZMODEM::${type}::START\x1b[0m\r\n`)
  }

  onReceiveZmodemSession = async () => {
    const savePath = await this.openSaveFolderSelect()
    this.session.on('offer', this.onOfferReceive)
    this.session.start()
    this.term.write('\r\n\x1b[2A\r\n')
    if (!savePath) {
      return this.onZmodemEnd()
    }
    this.writeBanner('RECEIVE')
    this.zmodemSavePath = savePath
    return new Promise((resolve) => {
      this.session.on('session_end', resolve)
    })
      .then(this.onZmodemEnd)
      .catch(this.onZmodemCatch)
  }

  initZmodemDownload = async (name, size) => {
    if (!this.zmodemSavePath) {
      return
    }
    let pth = window.pre.resolve(
      this.zmodemSavePath, name
    )
    const exist = await fs.exists(pth).catch(() => false)
    if (exist) {
      pth = pth + '.' + generate()
    }
    const fd = await fs.open(pth, 'w').catch(this.onZmodemEnd)
    this.downloadFd = fd
    this.downloadPath = pth
    this.downloadCount = 0
    this.zmodemStartTime = Date.now()
    this.downloadSize = size
    this.updateZmodemProgress(
      0, pth, size, transferTypeMap.download
    )
    return fd
  }

  onOfferReceive = async (xfer) => {
    const {
      name,
      size
    } = xfer.get_details()
    if (!this.downloadFd) {
      await this.initZmodemDownload(name, size)
    }
    xfer.on('input', this.onZmodemDownload)
    this.xfer = xfer
    await xfer.accept()
      .then(this.finishZmodemTransfer)
      .catch(this.onZmodemEnd)
  }

  onZmodemDownload = async payload => {
    if (this.onCanceling || !this.downloadFd) {
      return
    }
    this.downloadCount += payload.length
    await fs.write(this.downloadFd, new Uint8Array(payload))
    this.updateZmodemProgress(
      this.downloadCount,
      this.downloadPath,
      this.downloadSize,
      transferTypeMap.download
    )
  }

  updateZmodemProgress = throttle((start, name, size, type) => {
    this.zmodemTransfer = {
      type,
      start,
      name,
      size
    }
    this.writeZmodemProgress()
  }, 500)

  finishZmodemTransfer = () => {
    this.zmodemTransfer = {
      ...this.zmodemTransfer,
      start: this.zmodemTransfer.size
    }
    this.writeZmodemProgress()
  }

  writeZmodemProgress = () => {
    if (this.onCanceling) {
      return
    }
    const {
      size, start, name
    } = this.zmodemTransfer
    const speed = size > 0 ? formatBytes(start * 1000 / 1024 / (Date.now() - this.zmodemStartTime)) : 0
    const percent = size > 0 ? Math.floor(start * 100 / size) : 100
    const str = `\x1b[32m${name}\x1b[0m::${percent}%,${start}/${size},${speed}/s`
    this.term.write('\r\n\x1b[2A' + str + '\n')
  }

  zmodemTransferFile = async (file, filesRemaining, sizeRemaining) => {
    // Initialize transfer state
    this.zmodemStartTime = Date.now()
    this.zmodemTransfer = {
      type: transferTypeMap.upload,
      start: 0,
      name: file.name,
      size: file.size
    }
    this.writeZmodemProgress()

    const onProgress = (bytes) => {
      this.updateZmodemProgress(bytes, file.name, file.size, transferTypeMap.upload)
    }
    this.session.on('progress', onProgress)

    try {
      await this.session.sendFile(file)
      this.finishZmodemTransfer()
    } catch (e) {
      window.store.onError(e)
      this.onZmodemEnd()
    } finally {
      this.session.off('progress', onProgress)
    }
  }

  openFileSelect = async () => {
    const properties = [
      'openFile',
      'multiSelections',
      'showHiddenFiles',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ]
    const files = await window.api.openDialog({
      title: 'Choose some files to send',
      message: 'Choose some files to send',
      properties
    }).catch(() => false)
    if (!files || !files.length) {
      return this.onZmodemEnd()
    }
    const r = []
    for (const filePath of files) {
      const stat = await getLocalFileInfo(filePath)
      r.push({ ...stat, filePath })
    }
    return r
  }

  openSaveFolderSelect = async () => {
    const savePaths = await window.api.openDialog({
      title: 'Choose a folder to save file(s)',
      message: 'Choose a folder to save file(s)',
      properties: [
        'openDirectory',
        'showHiddenFiles',
        'createDirectory',
        'noResolveAliases',
        'treatPackageAsDirectory',
        'dontAddToRecent'
      ]
    }).catch(() => false)
    if (!savePaths || !savePaths.length) {
      return false
    }
    return savePaths[0]
  }

  beforeZmodemUpload = async (files) => {
    if (!files || !files.length) {
      return false
    }
    this.writeBanner('SEND')
    let filesRemaining = files.length
    let sizeRemaining = files.reduce((a, b) => a + b.size, 0)
    for (const f of files) {
      await this.zmodemTransferFile(f, filesRemaining, sizeRemaining)
      filesRemaining = filesRemaining - 1
      sizeRemaining = sizeRemaining - f.size
    }
    if (this.session) {
      await this.session.finish()
    }
    this.onZmodemEnd()
  }

  onSendZmodemSession = async () => {
    this.term.write('\r\n\x1b[2A\n')
    const files = await this.openFileSelect()
    this.beforeZmodemUpload(files)
  }

  onZmodemEnd = async () => {
    if (this.zmodemTransfer) {
      const {
        name, size, type
      } = this.zmodemTransfer
      if (size) {
        this.updateZmodemProgress(size, name, size, type)
        this.updateZmodemProgress.flush()
      }
    }
    this.zmodemSavePath = null
    this.onCanceling = true
    if (this.downloadFd) {
      await fs.close(this.downloadFd)
    }
    if (this.xfer && this.xfer.end) {
      await this.xfer.end().catch(
        console.error
      )
    }
    this.xfer = null
    if (this.session && this.session.close) {
      await this.session.close().catch(
        console.error
      )
    }
    this.session = null
    this.term.focus()
    this.term.write('\r\n')
    this.ctx.onZmodem = false
    this.downloadFd = null
  }

  onZmodemCatch = (e) => {
    window.store.onError(e)
    this.onZmodemEnd()
  }
}
