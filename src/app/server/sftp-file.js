/**
 * sftp read/write file
 */

const { Readable, Writable } = require('stream')

function createReadStreamFromString (str) {
  const s = new Readable()
  s._read = () => {}
  s.push(str)
  s.push(null)
  return s
}

class FakeWrite extends Writable {
  constructor (opts) {
    super(opts)
    this.opts = opts
  }

  _write (data, encoding, done) {
    this.opts.onData(data)
    done()
  }
}

function writeRemoteFile (sftp, path, str, mode) {
  return new Promise((resolve, reject) => {
    const writeStream = sftp.createWriteStream(path, {
      highWaterMark: 64 * 1024 * 4 * 4,
      mode
    })
    writeStream.on('close', () => {
      resolve('ok')
    })
    writeStream.on('error', (e) => {
      reject(e)
    })
    createReadStreamFromString(str).pipe(writeStream)
  })
}

function readRemoteFile (sftp, path) {
  return new Promise((resolve, reject) => {
    let final = Buffer.alloc(0)
    const writeStream = new FakeWrite({
      onData: data => {
        final = Buffer.concat(
          [final, data]
        )
      }
    })
    writeStream.on('finish', () => {
      resolve(final.toString())
    })
    writeStream.on('error', (e) => {
      reject(e)
    })
    const readStream = sftp.createReadStream(path, {
      highWaterMark: 64 * 1024 * 4 * 4
    })
    // pipe() forwards an error of the *destination*, not of the source: when the
    // remote open fails (no such file, a directory, permission denied) the read
    // stream emits 'error' and nothing downstream ever ends, so neither 'finish'
    // nor the write stream's own 'error' ever fires and this promise hangs for
    // good. That is what left sftp_read_file spinning in the AI agent. Handle
    // the source error here and settle the promise with it.
    readStream.on('error', (e) => {
      writeStream.destroy()
      reject(e)
    })
    readStream.pipe(writeStream)
  })
}

module.exports = {
  readRemoteFile,
  writeRemoteFile
}
