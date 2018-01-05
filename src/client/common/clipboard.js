/**
 * clipboard related
 */

export const readClipboard = () => {
  return window._require('electron').clipboard.readText()
}

export const copy = (str) => {
  window._require('electron').clipboard.writeText(str)
}



