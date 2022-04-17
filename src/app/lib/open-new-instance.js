const { spawn } = require('child_process')

module.exports = function openNewInstance () {
  const [cmd, ...args] = process.argv
  spawn(cmd, args, {
    cwd: process.cwd()
  })
}
