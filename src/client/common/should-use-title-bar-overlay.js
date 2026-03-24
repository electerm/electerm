import {
  isWin
} from './constants'

export default function shouldUseTitleBarOverlay () {
  return isWin && !window.et.isWebApp
}
