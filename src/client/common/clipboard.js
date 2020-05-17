/**
 * clipboard related
 */

import { isWin } from './constants'
import { notification } from 'antd'

const fileReg = isWin
  ? /^(remote:)?\w:\\.+/
  : /^(remote:)?\/.+/

export const readClipboard = () => {
  return window._require('electron').clipboard.readText()
}

export const copy = (str) => {
  notification.success({
    message: 'copied'
  })
  window._require('electron').clipboard.writeText(str)
}

export const hasFileInClipboardText = (
  text = readClipboard()
) => {
  const arr = text.split('\n')
  return arr.reduce((prev, t) => {
    return prev && fileReg.test(t)
  }, true)
}
