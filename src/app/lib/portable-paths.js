const { app } = require('electron')
const { resolve, dirname } = require('path')
const { mkdirSync } = require('fs')

const root = app.isPackaged
  ? process.platform === 'darwin'
    ? resolve(dirname(process.execPath), '../../..')
    : dirname(process.execPath)
  : resolve(__dirname, '../../..')
let data = process.env.DATA_PATH || resolve(root, '.runtime')
try {
  mkdirSync(data, { recursive: true })
} catch (err) {
  if (process.env.DATA_PATH) throw err
  data = resolve(app.getPath('appData'), 'electerm-terminal')
}
const temp = resolve(data, 'tmp')
mkdirSync(temp, { recursive: true })
mkdirSync(resolve(data, 'chromium'), { recursive: true })
process.env.DATA_PATH = data
process.env.TEMP = temp
process.env.TMP = temp
process.env.TMPDIR = temp
app.setPath('userData', data)
app.setPath('sessionData', resolve(data, 'chromium'))
app.setPath('temp', temp)
app.setAppLogsPath(resolve(data, 'logs'))
