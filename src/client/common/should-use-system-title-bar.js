import {
  isWin
} from './constants'

export default function shouldUseSystemTitleBar (config = {}) {
  return isWin || config.useSystemTitleBar === true
}
