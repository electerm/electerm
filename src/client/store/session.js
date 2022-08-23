/**
 * sessions not proper closed related functions
 */

import { getData } from '../common/db'
import copy from 'json-deep-copy'

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
}
