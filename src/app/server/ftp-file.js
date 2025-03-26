const { Readable, Writable } = require('stream')

exports.writeRemoteFile = async function (client, remotePath, str, options = {}) {
  const stream = Readable.from(Buffer.isBuffer(str) ? str : Buffer.from(str))
  await client.uploadFrom(stream, remotePath)
  if (options.mode && client.chmod) {
    await client.chmod(remotePath, options.mode)
  }
}

exports.readRemoteFile = async function (client, remotePath) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const writableStream = new Writable({
      write (chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      }
    })

    client.downloadTo(writableStream, remotePath)
      .then(() => {
        resolve(Buffer.concat(chunks))
      })
      .catch(reject)
  })
}
