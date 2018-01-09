/**
 * clipboard related
 */

import {isWin} from './constants'
let fileReg = isWin
  ? /^(remote:)?\w:\\.+/
  : /^(remote:)?\/.+/

export const readClipboard = () => {
  return window._require('electron').clipboard.readText()
}

export const copy = (str) => {
  window._require('electron').clipboard.writeText(str)
}

export const hasFileInClipboardText = (
  text = readClipboard()
) => {
  let arr = text.split('\n')
  return arr.reduce((prev, t) => {
    return prev && fileReg.test(t)
  }, true)
}



