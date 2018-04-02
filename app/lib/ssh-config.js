/**
 * read ssh config
 */

const {app} = require('electron')
const home = app.getPath('home')
const sshConfig = require('ssh-config')
const {resolve} = require('path')
const _ = require('lodash')
const defaultPort = 22
let config = []
try {
  const configStr = require('fs').readFileSync(
    resolve(home, '.ssh', 'config')
  ).toString()
  config = sshConfig.parse(configStr).map((c, i) => {
    let {param, value, config} = c
    if (param !== 'Host') {
      return null
    }
    let host = (_.find(config, f => f.param === 'HostName') || {}).value
    if (!host) {
      return null
    }
    let port = (_.find(config, f => f.param === 'Port') || { value: defaultPort }).value
    let username = (_.find(config, f => f.param === 'User') || {}).value
    if (!username) {
      return null
    }
    return {
      host,
      username,
      port,
      title: value,
      type: 'ssh-config',
      id: 'ssh' + i
    }
  }).filter(d => d)

} catch (e) {
  console.log('no $HOME/.ssh/config, but it is ok')
}

module.exports = config
