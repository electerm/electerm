/**
 * zip/unzip remote files
 * should only support linux server
 */

import { runCmd } from '../terminal/terminal-apis'
import { getFolderFromFilePath } from './file-read'
import resolve from '../../common/resolve'
import generate from '../../common/uid'

const isRemote = true
const temp = '/tmp'

export async function zipCmd (pid, sessionId, filePath) {
  // tar -czf bin.tar bin
  const id = generate()
  const { path, name } = getFolderFromFilePath(filePath, isRemote)
  const np = resolve(temp, `electerm-${id}.tar`)
  const cmd = `tar -C "${path}" -cf "${np}" "${name}"`
  await runCmd(pid, sessionId, cmd)
  return np
}

export function unzipCmd (pid, sessionId, from, to) {
  const cmd = `tar -xf "${from}" -C "${to}"`
  return runCmd(pid, sessionId, cmd)
}

export async function rmCmd (pid, sessionId, path) {
  const cmd = `rm -rf "${path}"`
  return runCmd(pid, sessionId, cmd)
}

export async function mvCmd (pid, sessionId, from, to) {
  const cmd = `mv "${from}" "${to}"`
  return runCmd(pid, sessionId, cmd)
}

export async function mkdirCmd (pid, sessionId, p) {
  const cmd = `mkdir "${p}"`
  return runCmd(pid, sessionId, cmd)
}
