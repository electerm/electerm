const { Readable, Writable } = require('stream')

async function readRemoteFile (client, remotePath) {
  return new Promise((resolve, reject) => {
    let data = ''
    const writable = new Writable({
      write (chunk, encoding, callback) {
        data += chunk.toString()
        callback()
      }
    })

    client.downloadTo(writable, remotePath)
      .then(() => resolve(data))
      .catch(reject)
  })
}

async function writeRemoteFile (client, remotePath, str) {
  const readable = new Readable({
    read () {
      this.push(str)
      this.push(null)
    }
  })

  return client.uploadFrom(readable, remotePath)
}

module.exports = {
  readRemoteFile,
  writeRemoteFile
}
