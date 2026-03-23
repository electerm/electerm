import {
  isMacJs
} from './constants'
import shouldUseSystemTitleBar from './should-use-system-title-bar'
import shouldUseTitleBarOverlay from './should-use-title-bar-overlay'

export default function shouldUseNativeWindowControls (config = {}) {
  return isMacJs || shouldUseSystemTitleBar(config) || shouldUseTitleBarOverlay()
}
