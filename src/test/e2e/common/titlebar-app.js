const { app } = require('electron')
const { resolve } = require('path')
const { mkdirSync } = require('fs')

const appDir = resolve(process.cwd(), 'work/app')
const dataDir = process.env.DATA_PATH
mkdirSync(dataDir, { recursive: true })
app.setName('electerm-titlebar-test-' + process.pid)
app.setPath('appData', dataDir)
app.setPath('userData', resolve(dataDir, 'chromium'))
require(resolve(appDir, 'common/runtime-constants')).packInfo.name = app.getName()
require(resolve(appDir, 'app.js'))
