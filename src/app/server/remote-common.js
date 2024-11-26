/**
 * common functions for remote process handling,
 * for sftp, terminal and transfer
 */

const globalState = require('./global-state')

function session (sessionId) {
  return globalState.getSession(sessionId)
}

function sftp (id, sessionId, inst) {
  const ss = session(sessionId)
  if (!ss) {
    return
  }
  if (inst) {
    ss.sftps[id] = inst
    return inst
  }
  return ss.sftps[id]
}

function terminals (id, sessionId, inst) {
  const ss = session(sessionId)
  if (!ss) {
    return
  }
  const tid = id || Object.keys(ss.terminals)[0]
  if (inst) {
    ss.terminals[tid] = inst
    return inst
  }
  return ss.terminals[tid]
}

function transfer (id, sftpId, sessionId, inst) {
  const ss = sftp(sftpId, sessionId)
  if (!ss) {
    return
  }
  if (inst) {
    ss.transfers[id] = inst
    return inst
  }
  return ss.transfers[id]
}

function onDestroySftp (id, sessionId) {
  const inst = sftp(id, sessionId)
  inst && inst.kill && inst.kill()
}

function onDestroyTransfer (id, sftpId, sessionId) {
  const sftpInst = sftp(sftpId, sessionId)
  const inst = transfer(id, sftpId, sessionId)
  inst && inst.destroy && inst.destroy()
  sftpInst && delete sftpInst.transfers[id]
}

module.exports = {
  session,
  sftp,
  transfer,
  onDestroySftp,
  onDestroyTerminal: onDestroySftp,
  onDestroyTransfer,
  terminals
}
