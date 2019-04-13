
const electronPath = require('electron')
const {resolve} = require('path')
const cwd = process.cwd()
const isCI = !!process.env.GH_TOKEN

console.log(isCI, 'isci')
module.exports = {
  path: electronPath,
  webdriverOptions: {
    deprecationWarnings: false
  },
  chromeDriverArgs: isCI ? [] : ['remote-debugging-port=9222'],
  args: [resolve(cwd, 'work/app'), '--no-session-restore']
}
