/**
 * common functions for remote process handling,
 * for sftp, terminal and transfer
 */

// const _ = require('loadsh')

function session (sessionId) {
  return global.sessions[sessionId]
}

function sftp (id, sessionId, inst) {
  if (inst) {
    session(sessionId).sftps[id] = inst
    return inst
  }
  return session(sessionId).sftps[id]
}

function terminals (id, sessionId, inst) {
  if (inst) {
    session(sessionId).terminals[id] = inst
    return inst
  }
  return session(sessionId).terminals[id]
}

function transfer (id, sftpId, sessionId, inst) {
  if (inst) {
    sftp(sftpId, sessionId).transfers[id] = inst
    return inst
  }
  return sftp(sftpId, sessionId).transfers[id]
}

function onDestroySftp (id, sessionId) {
  const inst = sftp(id, sessionId)
  inst && inst.kill && inst.kill()
}

function onDestroyTransfer (id, sftpId, sessionId) {
  const sftpInst = sftp(sftpId, sessionId)
  const inst = transfer(id, sftpId, sessionId)
  inst && inst.destroy && inst.destroy()
  delete sftpInst.transfers[id]
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
