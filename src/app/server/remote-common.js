/**
 * common functions for remote process handling,
 * for sftp, terminal and transfer
 */

const globalState = require('./global-state')

function session (id, inst) {
  if (inst) {
    globalState.setSession(id, inst)
    return inst
  }
  return globalState.getSession(id)
}

function transfer (id, sftpId, inst) {
  const ss = session(sftpId)
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
  const inst = session(id)
  inst && inst.kill && inst.kill()
}

function onDestroyTransfer (id, sftpId) {
  const sftpInst = session(sftpId)
  const inst = transfer(id, sftpId)
  inst && inst.destroy && inst.destroy()
  sftpInst && delete sftpInst.transfers[id]
}

module.exports = {
  session,
  transfer,
  onDestroySftp,
  onDestroyTerminal: onDestroySftp,
  onDestroyTransfer
}
