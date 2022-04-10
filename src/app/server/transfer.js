/**
 * transfer class
 */

const fs = require('original-fs')
const _ = require('lodash')
const log = require('../common/log')

function tryCreateBuffer (size) {
  try {
    return Buffer.allocUnsafe(size)
  } catch (ex) {
    return ex
  }
}

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

    this.onData = _.throttle((count) => {
      ws.s({
        id: 'transfer:data:' + id,
        data: count
      })
    }, 3000)

    this.ws = ws
    this.fastXfer(options, type)
  }

  // from https://github.com/mscdex/ssh2-streams/blob/master/lib/sftp.js
  fastXfer = (opts, type) => {
    let {
      concurrency = 64,
      chunkSize = 32768,
      mode
    } = opts
    const onstep = this.onData
    const { src, dst, srcPath, dstPath } = this
    let fileSize
    const isUpload = type === 'upload'
    const cb = this.onError
    const th = this

    // internal state variables
    let fsize
    let pdst = 0
    let total = 0
    let hadError = false
    let readbuf
    let bufsize = chunkSize * concurrency

    function onerror (err) {
      if (hadError) {
        return
      }
      hadError = true

      let left = 0
      let cbfinal

      if (th.srcHandle || th.dstHandle) {
        cbfinal = function () {
          if (--left === 0) {
            cb(err)
          }
        }
        if (th.srcHandle && (isUpload || src.writable)) {
          ++left
        }
        if (th.dstHandle && (!isUpload || dst.writable)) {
          ++left
        }
        if (th.srcHandle && (isUpload || src.writable)) {
          src.close(th.srcHandle, cbfinal)
        }
        if (th.dstHandle && (!isUpload || dst.writable)) {
          dst.close(th.dstHandle, cbfinal)
        }
      } else {
        cb(err)
      }
    }

    src.open(srcPath, 'r', (err, sourceHandle) => {
      if (err) {
        return onerror(err)
      }

      th.srcHandle = sourceHandle

      if (fileSize === undefined) {
        src.fstat(th.srcHandle, tryStat)
      } else {
        tryStat(null, { size: fileSize })
      }

      function tryStat (err, attrs) {
        if (err) {
          if (src !== fs) {
            // Try stat() for sftp servers that may not support fstat() for
            // whatever reason
            src.stat(srcPath, (err_, attrs_) => {
              if (err_) {
                return onerror(err)
              }
              tryStat(null, attrs_)
            })
            return
          }
          return onerror(err)
        }
        fsize = attrs.size
        dst.open(dstPath, 'w', (err, destHandle) => {
          if (err) {
            return onerror(err)
          }

          th.dstHandle = destHandle

          if (fsize <= 0) {
            return onerror()
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

          readbuf = tryCreateBuffer(bufsize)
          if (readbuf instanceof Error) {
            return onerror(readbuf)
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
              return onerror(err)
            }

            datapos = datapos || 0

            dst.write(th.dstHandle, readbuf, datapos, nb, dstpos, writeCb)

            function writeCb (err) {
              if (err) {
                return onerror(err)
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
                    return onerror(err)
                  }
                  src.close(th.srcHandle, (err) => {
                    th.srcHandle = undefined
                    if (err) {
                      return onerror(err)
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
      wid: 'transfer:err:' + id,
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
    this.ws.close()
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
