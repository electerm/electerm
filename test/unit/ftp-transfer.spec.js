// ftp-transfer.spec.js
const { test, expect } = require('@playwright/test')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { Transfer } = require('../../src/app/server/ftp-transfer')
const { Ftp } = require('../../src/app/server/session-ftp')

test.describe('FtpTransfer Class', () => {
  let ftpServer
  let ftp

  test.beforeAll(async () => {
    // Start the FTP test server
    const serverPath = path.join(__dirname, '../e2e/common/ftp.js')
    ftpServer = spawn('node', [serverPath])
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('FTP server start timeout'))
      }, 5000)
      ftpServer.stdout.on('data', (data) => {
        if (data.toString().includes('FTP server is running at port 21')) {
          clearTimeout(timeout)
          resolve()
        }
      })
    })
  })

  test.afterAll(async () => {
    ftpServer.kill()
    await new Promise((resolve) => ftpServer.on('close', resolve))
  })

  test.beforeEach(async () => {
    const initOptions = {
      host: 'localhost',
      port: 21,
      user: 'test',
      password: 'test123'
    }
    ftp = new Ftp(initOptions)
    await ftp.connect(initOptions)
  })

  test.afterEach(() => {
    if (ftp) {
      ftp.kill()
    }
  })

  test('should handle file transfer events', async () => {
    const localPath = path.join(__dirname, 'test-upload.txt')
    const remotePath = '/test-upload.txt'
    const testContent = 'x'.repeat(1024 * 1024) // 1MB file
    let dataEventCalled = false
    let endEventCalled = false

    await fs.promises.writeFile(localPath, testContent)

    const transfer = new Transfer({
      remotePath,
      localPath,
      type: 'upload',
      sftp: ftp.client,
      sftpId: '1',
      sessionId: '1',
      id: '1',
      options: {
        ftp: true
      },
      ws: {
        s: (event) => {
          if (event.id.startsWith('transfer:data:')) {
            dataEventCalled = true
          }
          if (event.id.startsWith('transfer:end:')) {
            endEventCalled = true
          }
        },
        close: () => {}
      }
    })

    await transfer.start()
    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(dataEventCalled).toBe(true)
    expect(endEventCalled).toBe(true)

    await ftp.rm(remotePath)
    await fs.promises.unlink(localPath)
  })

  test('should pause and resume transfer', async () => {
    const transfer = new Transfer({
      remotePath: '/test.txt',
      localPath: 'test.txt',
      type: 'upload',
      sftp: ftp.client,
      id: '1',
      ws: {
        s: () => {},
        close: () => {}
      }
    })

    transfer.pause()
    expect(transfer.pausing).toBe(true)

    transfer.resume()
    expect(transfer.pausing).toBe(false)
  })

  test('should properly destroy transfer', async () => {
    const transfer = new Transfer({
      remotePath: '/test.txt',
      localPath: 'test.txt',
      type: 'upload',
      sftp: ftp.client,
      id: '1',
      ws: {
        s: () => {},
        close: () => {}
      }
    })

    transfer.destroy()
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(transfer.onDestroy).toBe(true)
    expect(transfer.src).toBe(null)
    expect(transfer.dst).toBe(null)
    expect(transfer.ftpClient).toBe(null)
  })

  test('should handle transfer errors', async () => {
    let errorCalled = false
    const transfer = new Transfer({
      remotePath: '/nonexistent/path/test.txt',
      localPath: 'test.txt',
      type: 'upload',
      sftp: ftp.client,
      id: '1',
      ws: {
        s: (event) => {
          if (event.id.startsWith('transfer:err:')) {
            errorCalled = true
          }
        },
        close: () => {}
      }
    })

    await transfer.start()
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(errorCalled).toBe(true)
  })
})
