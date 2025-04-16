const { test, expect } = require('@playwright/test')
const { Ftp } = require('../../src/app/server/session-ftp')
const { spawn } = require('child_process')
const path = require('path')

let ftpServer

test.describe('Ftp Class', () => {
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

      ftpServer.stderr.on('data', (data) => {
        console.error(`FTP server error: ${data}`)
      })
    })
  }, { timeout: 10000 }) // Increase timeout to 10 seconds

  test.afterAll(async () => {
    // Stop the FTP test server
    ftpServer.kill()
    await new Promise((resolve) => ftpServer.on('close', resolve))
  })

  let ftp

  test.beforeEach(async () => {
    const initOptions = {
      host: 'localhost',
      port: 21,
      username: 'test',
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

  test('should connect to FTP server', async () => {
    expect(ftp.client).toBeTruthy()
  })

  test('should get home directory', async () => {
    const homeDir = await ftp.getHomeDir()
    expect(typeof homeDir).toBe('string')
  })

  test('should create and remove a directory', async () => {
    const testDir = '/test-dir'
    await ftp.mkdir(testDir)
    let list = await ftp.list('/')
    expect(list.some(item => item.name === 'test-dir')).toBeTruthy()

    await ftp.rmdir(testDir)
    list = await ftp.list('/')
    expect(list.some(item => item.name === 'test-dir')).toBeFalsy()
  })

  test('should create and remove a file', async () => {
    const testFile = '/test-file.txt'
    await ftp.touch(testFile)
    let list = await ftp.list('/')
    expect(list.some(item => item.name === 'test-file.txt')).toBeTruthy()

    await ftp.rm(testFile)
    list = await ftp.list('/')
    expect(list.some(item => item.name === 'test-file.txt')).toBeFalsy()
  })

  test('should write and read a file', async () => {
    const testFile = '/test-file.txt'
    const testContent = 'Hello, FTP!'

    console.log('Starting write operation')
    await ftp.writeFile(testFile, testContent)
    console.log('Write operation completed')

    console.log('Starting read operation')
    const content = await ftp.readFile(testFile)
    console.log('Read operation completed')

    expect(content.toString()).toBe(testContent)

    console.log('Starting delete operation')
    await ftp.rm(testFile)
    console.log('Delete operation completed')
  })

  test('should rename a file', async () => {
    const oldName = '/old-file.txt'
    const newName = '/new-file.txt'
    await ftp.touch(oldName)
    await ftp.rename(oldName, newName)

    const list = await ftp.list('/')
    expect(list.some(item => item.name === 'new-file.txt')).toBeTruthy()
    expect(list.some(item => item.name === 'old-file.txt')).toBeFalsy()

    await ftp.rm(newName)
  })

  test('should get file stats', async () => {
    const testFile = '/test-file.txt'
    await ftp.touch(testFile)

    const stats = await ftp.stat(testFile)
    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('modifyTime')
    expect(stats).toHaveProperty('isDirectory')

    await ftp.rm(testFile)
  })
})
