/**
 * get owner group/users list of local and remote sessions
 *
 * for mac list users: `dscl . -list /Users UniqueID`
 * for mac list groups: `dscl . list /Groups PrimaryGroupID`
 * for linux list users: `cat /etc/passwd`
 * for linux list groups: `cat /etc/group`
 * for windows list users: do not know yet
 * for windows list groups: do not know yet
 */

import fs from '../../common/fs'
import { runCmd } from '../terminal/terminal-apis'
import { isWin, isMac } from '../../common/constants'

function parseNames (str) {
  return str.split('\n')
    .reduce((p, d) => {
      const [name, , id] = d.split(':')
      return {
        ...p,
        [id + '']: name
      }
    }, {})
}

const linuxListUser = 'cat /etc/passwd'
const linuxListGroup = 'cat /etc/group'

export async function remoteListUsers (pid, sessionId) {
  const users = await runCmd(pid, sessionId, linuxListUser)
    .catch(log.error)
  if (users) {
    return parseNames(users)
  }
  return {}
}

export async function remoteListGroups (pid, sessionId) {
  const groups = await runCmd(pid, sessionId, linuxListGroup)
    .catch(log.error)
  if (groups) {
    return parseNames(groups)
  }
  return {}
}

export async function localListUsers () {
  if (isWin) {
    return {}
  } else if (isMac) {
    const g = await fs.run('dscl . -list /Users UniqueID')
      .catch(log.error)
    return g
      ? g.split('\n')
        .reduce((p, s) => {
          const [name, id] = s.split(/\s+/)
          if (!id) {
            return p
          }
          return {
            ...p,
            [id + '']: name
          }
        }, {})
      : {}
  } else {
    const g = await fs.run(linuxListUser).catch(log.error)
    return g
      ? parseNames(g)
      : {}
  }
}

export async function localListGroups () {
  if (isWin) {
    return {}
  } else if (isMac) {
    const g = await fs.run('dscl . list /Groups PrimaryGroupID')
      .catch(log.error)
    return g
      ? g.split('\n')
        .reduce((p, s) => {
          const [name, id] = s.split(/\s+/)
          return {
            ...p,
            [id + '']: name
          }
        }, {})
      : {}
  } else {
    const g = await fs.run(linuxListGroup).catch(log.error)
    return g
      ? parseNames(g)
      : {}
  }
}
