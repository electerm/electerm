const {exec} = require('child_process')
const os = require('os')
const platform = os.platform()
const cmd = platform.startsWith('win')
  ? 'del /f package-lock.json'
  : 'rm -rf package-lock.json'

exec(cmd)
