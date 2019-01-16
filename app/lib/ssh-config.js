/**
 * read ssh config
 */

const {app} = require('electron')
const home = app.getPath('home')
const sshConfig = require('ssh-config')
const {resolve} = require('path')
const defaultPort = 22
let config = []
try {
  const configStr = require('fs').readFileSync(
    resolve(home, '.ssh', 'config')
  ).toString()
  let sshConf = sshConfig.parse(configStr)
  config = sshConf.map((c, i) => {
    let {value} = c
    let obj = sshConf.compute(value.split(/\s/g)[0])
    let {HostName, User, Port = defaultPort, Host} = obj
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
  console.log('error parsing $HOME/.ssh/config')
  console.log('maybe no $HOME/.ssh/config, but it is ok')
}

module.exports = config
