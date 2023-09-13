/**
 * sessions not proper closed related functions
 */

import { getData } from '../common/db'
import copy from 'json-deep-copy'
import { isMac, terminalActions } from '../common/constants'
import { debounce } from 'lodash-es'
import postMsg from '../common/post-msg'

export default Store => {
  Store.prototype.checkLastSession = async function () {
    const status = await window.pre.runGlobalAsync('getExitStatus')
    if (status === 'ok') {
      return
    }
    const sessionsGlob = await getData('sessions')
    window.store.showLastSessions(sessionsGlob)
  }

  Store.prototype.showLastSessions = function (sessions) {
    if (!sessions) {
      return
    }
    window.store.storeAssign({
      selectedSessions: copy(sessions).map(s => ({
        id: s.id,
        tab: s,
        checked: true
      })),
      sessionModalVisible: true
    })
  }

  Store.prototype.onMouseWheel = function (event) {
    if (
      (isMac && event.metaKey) ||
      (!isMac && event.ctrlKey)
    ) {
      event.stopPropagation()
      if (window.store.inActiveTerminal) {
        window.store.zoomTerminal(event.wheelDeltaY)
      } else {
        const plus = event.wheelDeltaY > 0 ? 0.2 : -0.2
        window.store.zoom(plus, true)
      }
    }
  }

  Store.prototype.onKeyDown = function (event) {
    if (
      event.key === '=' &&
      (
        (isMac && event.metaKey) ||
        (!isMac && event.ctrlKey)
      )
    ) {
      event.stopPropagation()
      window.store.zoom(0.25, true)
    } else if (
      event.key === '-' &&
      (
        (isMac && event.metaKey) ||
        (!isMac && event.ctrlKey)
      )
    ) {
      event.stopPropagation()
      window.store.zoom(-0.25, true)
    }
  }

  Store.prototype.zoomTerminal = debounce(function (delta) {
    postMsg({
      action: terminalActions.zoom,
      zoomValue: delta > 0 ? 1 : -1,
      activeSplitId: window.store.activeTerminalId
    })
  }, 500)
}
