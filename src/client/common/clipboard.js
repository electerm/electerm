/**
 * clipboard related
 */

import { message } from 'antd'

const fileRegWin = /^(remote:)?\w:\\.+/
const fileReg = /^(remote:)?\/.+/

export const readClipboard = () => {
  return window.pre.readClipboard()
}

export const readClipboardAsync = () => {
  const {
    readClipboardSync,
    readClipboard
  } = window.pre
  return readClipboardSync ? readClipboardSync() : Promise.resolve(readClipboard())
}

export const copy = (str) => {
  message.success({
    content: window.translate('copied'),
    duation: 2,
    key: 'copy-message'
  })
  window.pre.writeClipboard(str)
}

export const cut = (str, itemTitle = '') => {
  message.success('Cutted ' + itemTitle, 2)
  window.pre.writeClipboard(str)
}

export const hasFileInClipboardText = (
  text = readClipboard()
) => {
  const arr = text.split('\n')
  return arr.reduce((prev, t) => {
    return prev &&
      (fileReg.test(t) || fileRegWin.test(t))
  }, true)
}
