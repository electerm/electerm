/* eslint-disable no-control-regex */
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g
const OTHER = /\x1b[@-Z\\-_]/g

export const stripAnsi = (s) => {
  if (!s) {
    return ''
  }
  return s.replace(OSC, '').replace(CSI, '').replace(OTHER, '')
}

// \r not followed by \n is treated as line break (progress bar scenes)
export const normalizeCR = (s) => {
  if (!s) {
    return ''
  }
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
