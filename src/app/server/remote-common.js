/**
 * common functions for remote process handling,
 * for sftp, terminal and transfer
 */

const globalState = require('./global-state')

function sftp (id, inst) {
  if (inst) {
    globalState.setSession(id, inst)
    return inst
  }
  return globalState.getSession(id)
}

function terminals (id, inst) {
  if (inst) {
    globalState.setSession(id, inst)
    return inst
  }
  return globalState.getSession(id)
}

function transfer (id, sftpId, inst) {
  const ss = sftp(sftpId)
  if (!ss) {
    return
  }
  if (inst) {
    ss.transfers[id] = inst
    return inst
  }
  return ss.transfers[id]
}

function onDestroySftp (id) {
  const inst = sftp(id)
  inst && inst.kill && inst.kill()
}

function onDestroyTransfer (id, sftpId) {
  const sftpInst = sftp(sftpId)
  const inst = transfer(id, sftpId)
  inst && inst.destroy && inst.destroy()
  sftpInst && delete sftpInst.transfers[id]
}

function cleanAllSessions () {
  const { sessions } = globalState.data
  for (const id in sessions) {
    const inst = sessions[id]
    inst && inst.kill && inst.kill()
  }
}

module.exports = {
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTerminal: onDestroySftp,
  onDestroyTransfer,
  terminals,
  cleanAllSessions
}
