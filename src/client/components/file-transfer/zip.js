/**
 * zip/unzip remote files
 * should only support linux server
 */

import { runCmd } from '../terminal/terminal-apis'
import { getFolderFromFilePath } from '../sftp/file-read'
import resolve from '../../common/resolve'
import generate from '../../common/uid'

const isRemote = true
const temp = '/tmp'

export async function zipCmd (pid, filePath) {
  // tar -czf bin.tar bin
  const id = generate()
  const { path, name } = getFolderFromFilePath(filePath, isRemote)
  const np = resolve(temp, `electerm-${id}.tar`)
  const cmd = `tar -C "${path}" -cf "${np}" "${name}"`
  await runCmd(pid, cmd)
  return np
}

export function unzipCmd (pid, from, to) {
  const cmd = `tar -xf "${from}" -C "${to}"`
  return runCmd(pid, cmd)
}

export async function rmCmd (pid, path) {
  const cmd = `rm -rf "${path}"`
  return runCmd(pid, cmd)
}

export async function mvCmd (pid, from, to) {
  const cmd = `mv "${from}" "${to}"`
  return runCmd(pid, cmd)
}

export async function mkdirCmd (pid, p) {
  const cmd = `mkdir "${p}"`
  return runCmd(pid, cmd)
}
