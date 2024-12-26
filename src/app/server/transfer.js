/**
 * transfer class
 */

const fs = require('original-fs')
const _ = require('lodash')
const log = require('../common/log')

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
    const isd = type === 'download'
    this.src = isd ? sftp : fs
    this.dst = isd ? fs : sftp
    this.sftpId = sftpId
    this.sessionId = sessionId
    this.srcPath = isd ? remotePath : localPath
    this.dstPath = !isd ? remotePath : localPath
    this.pausing = false
    this.hadError = false
    this.isUpload = isd
    this.options = options
    this.concurrency = options.concurrency || 64
    this.chunkSize = options.chunkSize || 32768
    this.mode = options.mode
    this.onData = _.throttle((count) => {
      ws.s({
        id: 'transfer:data:' + id,
        data: count
      })
    }, 3000)
    this.timers = {}

    this.ws = ws
    this.fastXfer(options, type)
  }

  tryCreateBuffer = (size) => {
    try {
      return Buffer.allocUnsafe(size)
    } catch (ex) {
      return ex
    }
  }

  // from https://github.com/mscdex/ssh2-streams/blob/master/lib/sftp.js
  fastXfer = () => {
    const { src, srcPath } = this
    src.open(srcPath, 'r', this.onSrcOpen)
  }

  onSrcOpen = (err, sourceHandle) => {
    if (err) {
      return this.onError(err)
    }
    if (this.onDestroy) {
      return
    }
    const { src } = this
    const th = this

    th.srcHandle = sourceHandle

    src.fstat(th.srcHandle, this.tryStat)
  }

  tryStat = (err, attrs) => {
    const { src, dst, srcPath, dstPath } = this
    const th = this
    if (err) {
      if (src !== fs) {
        // Try stat() for sftp servers that may not support fstat() for
        // whatever reason
        src.stat(srcPath, (err_, attrs_) => {
          if (err_) {
            return th.onError(err_)
          }
          this.tryStat(null, attrs_)
        })
        return
      }
      return th.onError(err)
    }
    this.fsize = attrs.size
    dst.open(dstPath, 'w', this.onDstOpen)
  }

  onDstOpen = (err, destHandle) => {
    if (err) {
      return this.onError(err)
    }

    if (this.onDestroy) {
      return
    }

    let {
      concurrency,
      chunkSize,
      mode
    } = this
    const onstep = this.onData
    const { src, dst, dstPath } = this
    const th = this

    // internal state variables
    let pdst = 0
    let total = 0
    let bufsize = chunkSize * concurrency

    const { fsize } = this

    th.dstHandle = destHandle

    if (fsize <= 0) {
      return th.onError()
    }

    // Use less memory where possible
    while (bufsize > fsize) {
      if (concurrency === 1) {
        bufsize = fsize
        break
      }
      bufsize -= chunkSize
      --concurrency
    }

    const readbuf = th.tryCreateBuffer(bufsize)
    if (readbuf instanceof Error) {
      return th.onError(readbuf)
    }

    if (mode !== undefined) {
      dst.fchmod(th.dstHandle, mode, function tryAgain (err) {
        if (err) {
          // Try chmod() for sftp servers that may not support fchmod() for
          // whatever reason
          dst.chmod(dstPath, mode, function (err_) {
            tryAgain()
          })
          return
        }
        startReads()
      })
    } else {
      startReads()
    }

    function onread (err, nb, data, dstpos, datapos, origChunkLen) {
      if (err) {
        return th.onError(err)
      }

      if (th.onDestroy) {
        return
      }

      datapos = datapos || 0

      dst.write(th.dstHandle, readbuf, datapos, nb, dstpos, writeCb)

      function writeCb (err) {
        if (err) {
          return th.onError(err)
        }

        total += nb
        onstep && onstep(total, nb, fsize)

        if (nb < origChunkLen) {
          return singleRead(datapos, dstpos + nb, origChunkLen - nb)
        }

        if (total === fsize) {
          dst.close(th.dstHandle, (err) => {
            th.dstHandle = undefined
            if (err) {
              return th.onError(err)
            }
            src.close(th.srcHandle, (err) => {
              th.srcHandle = undefined
              if (err) {
                return th.onError(err)
              }
              th.onError()
            })
          })
          return
        }

        if (pdst >= fsize) {
          return
        }

        const chunk = (pdst + chunkSize > fsize ? fsize - pdst : chunkSize)
        singleRead(datapos, pdst, chunk)
        pdst += chunk
      }
    }

    function makeCb (psrc, pdst, chunk) {
      return function (err, nb, data) {
        onread(err, nb, data, pdst, psrc, chunk)
      }
    }

    function singleRead (psrc, pdst, chunk) {
      if (th.onDestroy) {
        return
      }
      if (th.pausing) {
        th.timers[psrc + ':' + pdst] = setTimeout(() => {
          singleRead(psrc, pdst, chunk)
        }, 2)
        return
      }
      src.read(
        th.srcHandle,
        readbuf,
        psrc,
        chunk,
        pdst,
        makeCb(psrc, pdst, chunk)
      )
    }

    function startReads () {
      let reads = 0
      let psrc = 0
      while (pdst < fsize && reads < concurrency) {
        const chunk = (pdst + chunkSize > fsize ? fsize - pdst : chunkSize)
        singleRead(psrc, pdst, chunk)
        psrc += chunk
        pdst += chunk
        ++reads
      }
    }
  }

  onEnd = (id = this.id, ws = this.ws) => {
    ws.s({
      id: 'transfer:end:' + id,
      data: null
    })
  }

  onError = (err = '', id = this.id, ws = this.ws) => {
    if (!err) {
      return this.onEnd()
    }
    ws && ws.s({
      id: 'transfer:err:' + id,
      error: {
        message: err.message,
        stack: err.stack
      }
    })
  }

  pause = () => {
    this.pausing = true
  }

  resume = () => {
    this.pausing = false
  }

  kill = () => {
    if (this.src && this.srcHandle) {
      this.src.close(this.srcHandle, log.error)
    }
    if (this.dst && this.dstHandle) {
      this.dst.close(this.dstHandle, log.error)
    }
    this.src = null
    this.dst = null
    this.srcHandle = null
    this.dstHandle = null
  }

  destroy = () => {
    this.onDestroy = true
    setTimeout(this.kill, 200)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.timers) {
      Object.keys(this.timers).forEach(k => {
        clearTimeout(this.timers[k])
        this.timers[k] = null
      })
      this.timers = null
    }
  }

  // end
}

module.exports = {
  Transfer,
  transferKeys: [
    'pause',
    'resume',
    'destroy'
  ]
}
