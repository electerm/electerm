/**
 * read ssh config
 */

const { app } = require('electron')
const home = app.getPath('home')
const { resolve } = require('path')
const log = require('../common/log')

function loadSshConfig () {
  const sshConfig = require('ssh-config')
  const defaultPort = 22
  let config = []
  try {
    const configStr = require('fs').readFileSync(
      resolve(home, '.ssh', 'config'), 'utf-8'
    )
    const sshConf = sshConfig.parse(configStr)
    config = sshConf.map((c, i) => {
      const { value } = c
      if (!value) {
        return null
      }
      const obj = sshConf.compute(value.split(/\s/g)[0])
      const { HostName, User, Port = defaultPort, Host } = obj
      if (!Host) {
        return null
      }
      return {
        host: HostName,
        username: User,
        port: Port,
        title: value,
        type: 'ssh-config',
        id: 'ssh' + i
      }
    }).filter(d => d)
  } catch (e) {
    log.debug('error parsing $HOME/.ssh/config')
    log.debug('maybe no $HOME/.ssh/config, it is ok', e)
  }
  return config
}

module.exports = loadSshConfig
