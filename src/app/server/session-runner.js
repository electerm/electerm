const { fork } = require('child_process')

function getPort (fromPort = 30975) {
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        resolve(freePort)
      }
    })
  })
}

module.exports = async () => {
  const port = await getPort()
}
