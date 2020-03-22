
const electronPath = require('electron')
const { resolve } = require('path')
const cwd = process.cwd()

module.exports = {
  path: electronPath,
  webdriverOptions: {
    deprecationWarnings: false
  },
  // chromeDriverArgs: ['remote-debugging-port=9222'],
  chromeDriverLogPath: resolve(cwd, 'spectron-test.log'),
  args: [resolve(cwd, 'work/app'), '--no-session-restore']
}
