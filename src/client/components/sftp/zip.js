/**
 * zip/unzip remote files
 * should only support linux server
 */

import { runCmd } from '../terminal/terminal-apis'
import { getFolderFromFilePath } from './file-read'
import resolve from '../../common/resolve'
import { nanoid as generate } from 'nanoid/non-secure'

const isRemote = true
const temp = '/tmp'

export async function zipCmd (pid, sessionId, filePath) {
  // tar -czf bin.tar.gz bin
  const id = generate()
  const { path, name } = getFolderFromFilePath(filePath, isRemote)
  const np = resolve(temp, `electerm-${id}.tar.gz`)
  const cmd = `tar -C ${path} -czf ${np} ${name}`
  console.log('cmd', cmd)
  await runCmd(pid, sessionId, cmd)
  return np
}

export function unzipCmd (pid, sessionId, from, to) {
  const cmd = `tar -xzf ${from} -C ${to}`
  return runCmd(pid, sessionId, cmd)
}

export async function rmCmd (pid, sessionId, path) {
  const cmd = `rm -rf ${path}`
  return runCmd(pid, sessionId, cmd)
}
