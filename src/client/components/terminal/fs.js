export const open = (filePath, flag) => {
  const fs = window.require('fs')
  return new Promise((resolve, reject) => {
    fs.open(filePath, flag, (err, fd) => {
      if (err) {
        return reject(err)
      }
      return resolve(fd)
    })
  })
}

export const close = (fd) => {
  const fs = window.require('fs')
  return new Promise((resolve, reject) => {
    fs.close(fd, (err) => {
      if (err) {
        return reject(err)
      }
      return resolve(true)
    })
  })
}

export const exists = (filePath) => {
  const fs = window.require('fs')
  return new Promise((resolve, reject) => {
    fs.access(filePath, (err) => {
      if (err) {
        return reject(err)
      }
      return resolve(true)
    })
  })
}

export const read = (fd, buffer, offset, length, position) => {
  const fs = window.require('fs')
  return new Promise((resolve, reject) => {
    fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
      if (err) {
        return reject(err)
      }
      return resolve(buffer.subarray(0, bytesRead))
    })
  })
}

export const write = (fd, buffer) => {
  const fs = window.require('fs')
  return new Promise((resolve, reject) => {
    fs.write(fd, buffer, (err, buffer) => {
      if (err) {
        return reject(err)
      }
      return resolve(buffer)
    })
  })
}
