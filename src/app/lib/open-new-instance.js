const { spawn } = require('child_process')

module.exports = function openNewIsntance () {
  const [cmd, ...args] = process.argv
  spawn(cmd, args, {
    cwd: process.cwd()
  })
}
