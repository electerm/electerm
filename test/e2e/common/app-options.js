
const electronPath = require('electron')
const { resolve } = require('path')
const cwd = process.cwd()

module.exports = {
  path: electronPath,
  webdriverOptions: {
    deprecationWarnings: false
  },
  env: {
    NODE_TEST: 'yes'
  },
  // chromeDriverArgs: ['remote-debugging-port=9222'],
  chromeDriverLogPath: resolve(cwd, 'spectron-test.log'),
  args: [resolve(cwd, 'work/app')]
}
