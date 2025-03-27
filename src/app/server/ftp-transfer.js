/**
 * ftp transfer class
 * Note: basic-ftp only supports one active transfer per client connection
 * See: https://github.com/patrickjuchli/basic-ftp#tracking-progress
 */
const { Transfer } = require('./transfer')

class FtpTransfer extends Transfer {
  constructor (options) {
    super(options)
    this.ftpClient = this.src.client || this.dst.client
    this.total = 0
  }

  handleProgress = (info) => {
    if (this.pausing) return
    const chunk = info.bytes - this.total
    this.total = info.bytes
    this.onData && this.onData(this.total, chunk)
  }

  trackProgress = () => {
    this.total = 0
    this.ftpClient.trackProgress(this.handleProgress)
  }

  // Override the fastXfer method from the parent class
  fastXfer = async () => {
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

  // Override onEnd to clean up progress tracking
  onEnd = (id = this.id, ws = this.ws) => {
    this.ftpClient.trackProgress() // Remove progress tracking
    super.onEnd(id, ws)
  }

  // Override kill to ensure cleanup
  kill = () => {
    this.ftpClient.trackProgress() // Remove progress tracking
    super.kill()
  }
}

module.exports = {
  Transfer: FtpTransfer,
  transferKeys: [
    'pause',
    'resume',
    'destroy'
  ]
}
