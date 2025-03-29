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

function ftp (id, inst) {
  if (inst) {
    globalState.ftps[id] = inst
    return inst
  }
  return globalState.ftps[id]
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

function ftpTransfer (id, sftpId, inst) {
  const ss = sftp(sftpId)
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

function onDestroyFtp (id) {
  const inst = ftp(id)
  inst && inst.kill && inst.kill()
}

function onDestroyTransfer (id, sftpId, sessionId) {
  const sftpInst = sftp(sftpId, sessionId)
  const inst = transfer(id, sftpId, sessionId)
  inst && inst.destroy && inst.destroy()
  sftpInst && delete sftpInst.transfers[id]
}

function onDestroyFtpTransfer (id, sftpId, sessionId) {
  const sftpInst = ftp(sftpId)
  const inst = ftpTransfer(id, sftpId)
  inst && inst.destroy && inst.destroy()
  sftpInst && delete sftpInst.transfers[id]
}

module.exports = {
  session,
  sftp,
  ftp,
  transfer,
  ftpTransfer,
  onDestroySftp,
  onDestroyFtp,
  onDestroyTerminal: onDestroySftp,
  onDestroyTransfer,
  onDestroyFtpTransfer,
  terminals
}
