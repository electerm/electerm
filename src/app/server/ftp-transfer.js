// ftp-transfer.js
/**
 * ftp transfer class
 * Note: basic-ftp only supports one active transfer per client connection
 */

class Transfer {
  constructor ({
    remotePath,
    localPath,
    options = {},
    id,
    type = 'download',
    sftp,
    sftpId,
    sessionId,
    ws
  }) {
    this.id = id
    this.ftpClient = sftp
    this.srcPath = type === 'download' ? remotePath : localPath
    this.dstPath = type === 'download' ? localPath : remotePath
    this.isUpload = type !== 'download'
    this.ws = ws
    this.pausing = false
    this.onDestroy = false
    this.total = 0
    this.src = type === 'download' ? sftp : null
    this.dst = type === 'download' ? null : sftp
  }

  handleProgress = (info) => {
    if (this.pausing) return
    const chunk = info.bytes - this.total
    this.total = info.bytes
    this.onData(this.total, chunk)
  }

  onData = (total, chunk) => {
    if (this.pausing) return
    this.ws?.s({
      id: `transfer:data:${this.id}`,
      data: total
    })
  }

  onEnd = () => {
    this.ws?.s({
      id: `transfer:end:${this.id}`,
      data: null
    })
  }

  onError = (err) => {
    if (!err) {
      return this.onEnd()
    }
    this.ws?.s({
      id: `transfer:err:${this.id}`,
      error: {
        message: err.message,
        stack: err.stack
      }
    })
  }

  trackProgress = () => {
    this.total = 0
    this.ftpClient?.trackProgress(this.handleProgress)
  }

  async start () {
    try {
      if (this.onDestroy) {
        return
      }
      this.trackProgress()
      if (!this.isUpload) {
        await this.ftpClient.downloadTo(this.dstPath, this.srcPath)
      } else {
        await this.ftpClient.uploadFrom(this.srcPath, this.dstPath)
      }
      this.onEnd()
    } catch (err) {
      this.onError(err)
    }
  }

  pause () {
    this.pausing = true
  }

  resume () {
    this.pausing = false
  }

  destroy () {
    this.onDestroy = true
    if (this.ftpClient) {
      this.ftpClient.trackProgress() // Remove progress tracking
    }
    this.ftpClient = null
    this.src = null
    this.dst = null
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

module.exports = {
  Transfer
}
