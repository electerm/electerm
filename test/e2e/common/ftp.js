const { FtpSrv } = require('ftp-srv')
const path = require('path')
const fs = require('fs')

// Create FTP root directory if it doesn't exist
const ftpRoot = path.join(__dirname, 'ftp-root')
if (!fs.existsSync(ftpRoot)) {
  fs.mkdirSync(ftpRoot)
}

const ftpServer = new FtpSrv({
  url: 'ftp://0.0.0.0:21',
  anonymous: false,
  root: ftpRoot
})

// Handle user login
ftpServer.on('login', ({ username, password }, resolve, reject) => {
  // Simple authentication
  console.log('login', username, password)
  if (username === 'test' && password === 'test123') {
    return resolve({ root: ftpRoot })
  }
  return reject(new Error('Invalid username or password'))
})

// Log events
ftpServer.on('client-error', ({ connection, context, error }) => {
  console.log('Client error', error)
})

ftpServer.on('STOR', (error, fileName) => {
  if (error) {
    console.log('Error uploading file:', error)
  } else {
    console.log('File uploaded:', fileName)
  }
})

ftpServer.on('RETR', (error, fileName) => {
  if (error) {
    console.log('Error downloading file:', error)
  } else {
    console.log('File downloaded:', fileName)
  }
})

// Start server
ftpServer.listen()
  .then(() => {
    console.log('FTP server is running at port 21')
    console.log('Username: test')
    console.log('Password: test123')
    console.log('FTP root directory:', ftpRoot)
  })
  .catch(err => {
    console.log('Error starting FTP server:', err)
  })

// Handle shutdown
process.on('SIGTERM', () => {
  ftpServer.close()
    .then(() => {
      console.log('FTP server closed')
      process.exit(0)
    })
})
