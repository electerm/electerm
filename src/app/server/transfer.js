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
    this.bufsize = this.chunkSize * this.concurrency
    this.onData = _.throttle((count) => {
      ws.s({
        id: 'transfer:data:' + id,
        data: count
      })
    }, 3000)

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

  onerror = (err) => {
    if (this.hadError) {
      return
    }
    this.hadError = true
    const {
      src,
      dst,
      isUpload,
      srcHandle,
      dstHandle
    } = this
    const th = this

    let left = 0
    let cbfinal

    if (srcHandle || dstHandle) {
      cbfinal = function () {
        if (--left === 0) {
          th.onError(err)
        }
      }
      if (this.srcHandle && (isUpload || src.writable)) {
        ++left
      }
      if (this.dstHandle && (!isUpload || dst.writable)) {
        ++left
      }
      if (this.srcHandle && (isUpload || src.writable)) {
        src.close(srcHandle, cbfinal)
      }
      if (this.dstHandle && (!isUpload || dst.writable)) {
        dst.close(dstHandle, cbfinal)
      }
    } else {
      this.onError(err)
    }
  }

  // from https://github.com/mscdex/ssh2-streams/blob/master/lib/sftp.js
  fastXfer = () => {
    const { src, srcPath } = this
    src.open(srcPath, 'r', this.onSrcOpen)
  }

  onSrcOpen = (err, sourceHandle) => {
    if (err) {
      return this.onerror(err)
    }
    const { src } = this
    const th = this

    th.srcHandle = sourceHandle

    src.fstat(th.srcHandle, this.tryStat)
  }

  tryStat = (err, attrs) => {
    let {
      concurrency,
      chunkSize,
      mode
    } = this
    const onstep = this.onData
    const { src, dst, srcPath, dstPath } = this
    const cb = this.onError
    const th = this

    // internal state variables
    let pdst = 0
    let total = 0
    let readbuf
    let bufsize = chunkSize * concurrency
    if (err) {
      if (src !== fs) {
        // Try stat() for sftp servers that may not support fstat() for
        // whatever reason
        src.stat(srcPath, (err_, attrs_) => {
          if (err_) {
            return th.onerror(err)
          }
          this.tryStat(null, attrs_)
        })
        return
      }
      return th.onerror(err)
    }
    const fsize = attrs.size
    dst.open(dstPath, 'w', (err, destHandle) => {
      if (err) {
        return th.onerror(err)
      }

      th.dstHandle = destHandle

      if (fsize <= 0) {
        return th.onerror()
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

      readbuf = th.tryCreateBuffer(bufsize)
      if (readbuf instanceof Error) {
        return th.onerror(readbuf)
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
          return th.onerror(err)
        }

        datapos = datapos || 0

        dst.write(th.dstHandle, readbuf, datapos, nb, dstpos, writeCb)

        function writeCb (err) {
          if (err) {
            return th.onerror(err)
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
                return th.onerror(err)
              }
              src.close(th.srcHandle, (err) => {
                th.srcHandle = undefined
                if (err) {
                  return th.onerror(err)
                }
                cb()
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
        if (th.pausing) {
          return setTimeout(
            () => singleRead(psrc, pdst, chunk), 2
          )
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
    })
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

  destroy = () => {
    if (this.src && this.srcHandle) {
      this.src.close(this.srcHandle, log.error)
    }
    if (this.dst && this.dstHandle) {
      this.dst.close(this.dstHandle, log.error)
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.src = null
    this.dst = null
    this.srcHandle = null
    this.dstHandle = null
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
